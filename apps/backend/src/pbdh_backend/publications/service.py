from __future__ import annotations

import copy
import json
from collections.abc import Mapping
from pathlib import Path
from typing import Any

from jsonschema import Draft202012Validator

from pbdh_backend.contracts import (
    ContractRuntime,
    compute_resource_package_snapshot_digest,
    load_pbres,
    validate_resource_package_semantics,
    write_pbres,
)
from pbdh_backend.publications.repository import PublicationNotFound, PublicationRepository


class PublicationValidationError(Exception):
    def __init__(self, diagnostics: list[dict[str, Any]]) -> None:
        super().__init__("Publication validation failed")
        self.diagnostics = diagnostics


class PublicationService:
    def __init__(
        self,
        repository: PublicationRepository,
        project_root: Path,
        mode: str,
    ) -> None:
        if mode not in ("development", "production"):
            raise ValueError(f"Invalid publication mode: {mode}")
        self._repository = repository
        self._project_root = project_root
        self._mode = mode
        self._contract_runtime = self._load_contract_runtime()
        self._templates = self._load_templates()

    def publish(
        self,
        account_id: str,
        archive_bytes: bytes,
        metadata: Mapping[str, Any],
    ) -> dict[str, Any]:
        result = load_pbres(archive_bytes, self._validate_candidate)
        if result["candidate"] is None:
            raise PublicationValidationError(result["diagnostics"])
        candidate = result["candidate"]
        document = candidate["document"]
        media = candidate["media"]
        document["package"]["name"] = metadata["title"]
        document["package"]["description"] = metadata["summary"]
        document["publication"] = {
            "language": metadata["language"],
            "tags": copy.deepcopy(metadata["tags"]),
            "coverAssetId": metadata["coverAssetId"],
        }
        document["snapshotDigest"] = compute_resource_package_snapshot_digest(document, media)
        diagnostics = self._validate_candidate(document, media)
        if diagnostics:
            raise PublicationValidationError(diagnostics)
        fork_diagnostics = self._validate_fork_source(document)
        if fork_diagnostics:
            raise PublicationValidationError(fork_diagnostics)
        cover_asset_id = metadata["coverAssetId"]
        if cover_asset_id not in {asset["id"] for asset in document["assets"]}:
            raise PublicationValidationError([{
                "code": "publication.cover.asset-undeclared",
                "severity": "error",
                "family": "resource-package",
                "version": document["contractVersion"],
                "location": "/metadata/coverAssetId",
                "params": {"assetId": cover_asset_id},
            }])
        write = self._repository.publish(
            account_id,
            document,
            media,
            metadata,
            allow_same_version_replace=self._mode == "development",
        )
        publication = self._repository.get_owned_publication(write.publication_id, account_id)
        if publication is None:
            raise RuntimeError("Publication disappeared after commit")
        publication["created"] = write.created
        publication["idempotent"] = write.idempotent
        return publication

    def update_information(
        self,
        publication_id: str,
        account_id: str,
        information: Mapping[str, Any],
        allow_all: bool = False,
        cover_media: tuple[Mapping[str, Any], bytes] | None = None,
    ) -> dict[str, Any]:
        current_publication = self._repository.get_manageable_publication(
            publication_id, account_id, allow_all
        )
        if current_publication is None:
            raise PublicationNotFound(publication_id)
        candidate = self._repository.get_archive_candidate(
            publication_id, account_id, allow_all
        )
        if candidate is None:
            raise PublicationNotFound(publication_id)
        previous_document, media = candidate
        normalized_information = copy.deepcopy(dict(information))
        normalized_information["title"] = normalized_information["package"]["name"]
        normalized_information["summary"] = normalized_information["package"]["description"]
        document = copy.deepcopy(previous_document)
        document["package"]["name"] = normalized_information["package"]["name"]
        document["package"]["version"] = normalized_information["package"]["version"]
        document["package"]["description"] = normalized_information["package"]["description"]
        document["targets"] = copy.deepcopy(normalized_information["targets"])
        if normalized_information.get("license") is not None:
            document["license"] = copy.deepcopy(normalized_information["license"])
        if cover_media is not None:
            cover_asset, cover_bytes = cover_media
            old_cover_id = current_publication["coverAssetId"]
            referenced_asset_ids = {
                asset_id
                for resource in document["resources"]
                for asset_id in resource["media"].values()
            }
            if old_cover_id != cover_asset["id"] and old_cover_id not in referenced_asset_ids:
                document["assets"] = [
                    asset for asset in document["assets"] if asset["id"] != old_cover_id
                ]
                media.pop(old_cover_id, None)
            document["assets"] = [
                asset for asset in document["assets"] if asset["id"] != cover_asset["id"]
            ]
            document["assets"].append(copy.deepcopy(cover_asset))
            media[cover_asset["id"]] = cover_bytes
        document["publication"] = {
            "language": normalized_information["language"],
            "tags": copy.deepcopy(normalized_information["tags"]),
            "coverAssetId": normalized_information["coverAssetId"],
        }
        document["snapshotDigest"] = compute_resource_package_snapshot_digest(document, media)
        diagnostics = self._validate_candidate(document, media)
        if diagnostics:
            raise PublicationValidationError(diagnostics)
        previous_targets = {
            (target["systemPackageId"], target["version"])
            for target in previous_document["targets"]
        }
        updated_targets = {
            (target["systemPackageId"], target["version"])
            for target in document["targets"]
        }
        return self._repository.update_information(
            publication_id,
            account_id,
            document,
            normalized_information,
            allow_all,
            allow_same_version_replace=previous_targets == updated_targets,
            cover_media=cover_media,
        )

    def _validate_fork_source(self, document: Mapping[str, Any]) -> list[dict[str, Any]]:
        fork_source = document.get("forkSource")
        if fork_source is None:
            return []
        source = self._repository.get_publication_snapshot(fork_source["publicationId"])
        expected = {
            "packageId": fork_source["packageId"],
            "version": fork_source["version"],
            "snapshotDigest": fork_source["snapshotDigest"],
        }
        if source is None or any(source[key] != value for key, value in expected.items()):
            return [self._fork_diagnostic("publication.fork-source.snapshot-mismatch", "/forkSource")]
        source_resource_ids = {resource["id"] for resource in source["document"]["resources"]}
        for index, reference in enumerate(fork_source["copiedResources"]):
            if (reference["packageId"] != source["packageId"]
                    or reference["resourceId"] not in source_resource_ids):
                return [self._fork_diagnostic(
                    "publication.fork-source.resource-mismatch",
                    f"/forkSource/copiedResources/{index}",
                )]
        return []

    @staticmethod
    def _fork_diagnostic(code: str, location: str) -> dict[str, Any]:
        return {
            "code": code,
            "severity": "error",
            "family": "resource-package",
            "version": "1.0.0",
            "location": location,
            "params": {},
        }

    def download(
        self,
        publication_id: str,
        account_id: str | None = None,
        allow_all: bool = False,
    ) -> bytes | None:
        candidate = self._repository.get_archive_candidate(publication_id, account_id, allow_all)
        if candidate is None:
            return None
        return write_pbres(*candidate)

    def _validate_candidate(
        self,
        document: Mapping[str, Any],
        media: Mapping[str, bytes],
    ) -> list[dict[str, Any]]:
        version = str(document.get("contractVersion", ""))
        diagnostics = self._contract_runtime.validate({
            "family": "resource-package",
            "version": version,
            "mode": self._mode,
            "candidate": document,
        })
        if diagnostics:
            return diagnostics
        diagnostics = validate_resource_package_semantics(document, media)
        if diagnostics:
            return diagnostics
        for index, resource in enumerate(document["resources"]):
            template_ref = resource["template"]
            key = f"{template_ref['id']}@{template_ref['version']}"
            template = self._templates.get(key)
            if template is None:
                diagnostics.append(self._template_diagnostic(
                    resource,
                    index,
                    "template.version.unsupported",
                    {"id": template_ref["id"]},
                ))
                continue
            if not template["publication"][self._mode]:
                diagnostics.append(self._template_diagnostic(
                    resource,
                    index,
                    "template.publication.not-allowed",
                    {"mode": self._mode},
                ))
                continue
            allowed_replacements = {
                replacement["id"]
                for replacement in template.get("tabletopReplacements", [])
            }
            for replacement_index, replacement in enumerate(
                resource.get("replacements", [])
            ):
                if replacement["replacementId"] not in allowed_replacements:
                    diagnostics.append(self._template_diagnostic(
                        resource,
                        index,
                        "template.replacement.unsupported",
                        {"replacementId": replacement["replacementId"]},
                        f"/replacements/{replacement_index}/replacementId",
                    ))
            for error in template["validator"].iter_errors(resource["data"]):
                pointer = "".join(
                    f"/{str(segment).replace('~', '~0').replace('/', '~1')}"
                    for segment in error.absolute_path
                )
                diagnostics.append(self._template_diagnostic(
                    resource,
                    index,
                    "template.data.invalid",
                    {"keyword": error.validator},
                    f"/data{pointer}",
                ))
        return sorted(diagnostics, key=lambda item: (item["location"], item["code"]))

    def _load_contract_runtime(self) -> ContractRuntime:
        contracts_root = self._project_root / "contracts"
        catalog = self._read_json(contracts_root / "catalog.json")
        schemas = {
            version["schema"]: self._read_json(contracts_root / version["schema"])
            for family in catalog["families"]
            for version in family["versions"]
        }
        return ContractRuntime(catalog, schemas)

    def _load_templates(self) -> dict[str, dict[str, Any]]:
        templates_root = self._project_root / "packages/templates"
        catalog = self._read_json(templates_root / "catalog.json")
        result = {}
        for entry in catalog["templates"]:
            result[f"{entry['id']}@{entry['version']}"] = {
                **entry,
                "validator": Draft202012Validator(
                    self._read_json(templates_root / entry["schema"])
                ),
            }
        return result

    @staticmethod
    def _read_json(path: Path) -> Any:
        return json.loads(path.read_text(encoding="utf-8"))

    @staticmethod
    def _template_diagnostic(
        resource: Mapping[str, Any],
        index: int,
        code: str,
        params: Mapping[str, Any],
        suffix: str = "",
    ) -> dict[str, Any]:
        return {
            "code": code,
            "severity": "error",
            "family": "resource-template",
            "version": resource["template"]["version"],
            "location": f"/resources/{index}{suffix}",
            "params": dict(params),
        }
