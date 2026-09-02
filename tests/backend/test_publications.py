import copy
import hashlib
import json
from pathlib import Path
from typing import Any

from fastapi.testclient import TestClient
import pytest

from pbdh_backend.api_errors import ApiError
from pbdh_backend.app import create_app
from pbdh_backend.contracts import (
    compute_resource_package_snapshot_digest,
    load_pbres,
    validate_resource_package_semantics,
    write_pbres,
)
from pbdh_backend.database import Database
from pbdh_backend.identity.tokens import VerifiedIdentity
from pbdh_backend.publications.repository import (
    PublicationVersionConflict,
)
from pbdh_backend.settings import Settings


ROOT = Path(__file__).parents[2]
FIXTURE_ROOT = ROOT / "contracts/conformance/resource-package/1.0.0"


class FakeTokenVerifier:
    def verify(self, token: str) -> VerifiedIdentity:
        if not token.startswith("token:"):
            raise ApiError(401, "AUTH_TOKEN_INVALID", "登录凭据无效或已过期。")
        return VerifiedIdentity(token.removeprefix("token:"))


def read_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def settings(tmp_path: Path, mode: str = "development") -> Settings:
    return Settings(
        database_path=tmp_path / "pbdh.sqlite3",
        migrations_path=ROOT / "apps/backend/migrations",
        supabase_url="https://example.supabase.co",
        supabase_anon_key="public-anon-key",
        admin_auth_subject="platform-admin",
        publication_mode=mode,
    )


def client(tmp_path: Path, mode: str = "development") -> TestClient:
    return TestClient(create_app(settings(tmp_path, mode), FakeTokenVerifier()))


def claim(api: TestClient, subject: str) -> dict[str, str]:
    response = api.post(
        "/api/auth/session/claim",
        headers={"Authorization": f"Bearer token:{subject}"},
        json={},
    )
    assert response.status_code == 200
    return {
        "Authorization": f"Bearer token:{subject}",
        "X-PbDH-Session": response.json()["sessionId"],
    }


def candidate() -> tuple[dict[str, Any], dict[str, bytes]]:
    document = read_json(FIXTURE_ROOT / "valid/minotaur-wrecker.json")
    media = {
        asset["id"]: (
            FIXTURE_ROOT / f"media/{asset['id'].removeprefix('sha256:')}.webp"
        ).read_bytes()
        for asset in document["assets"]
    }
    return document, media


def metadata(document: dict[str, Any]) -> dict[str, Any]:
    return {
        "title": "荒野遭遇集",
        "summary": "包含牛头人破坏者。",
        "language": "zh-CN",
        "tags": ["敌人", "荒野"],
        "coverAssetId": document["assets"][0]["id"],
    }


def publish(
    api: TestClient,
    headers: dict[str, str],
    document: dict[str, Any],
    media: dict[str, bytes],
    publication_metadata: dict[str, Any] | None = None,
):
    return api.post(
        "/api/publications",
        headers=headers,
        data={"metadata": json.dumps(publication_metadata or metadata(document), ensure_ascii=False)},
        files={
            "archive": (
                "package.pbres",
                write_pbres(document, media),
                "application/vnd.pbdh.resource-package+zip",
            )
        },
    )


def test_authenticated_development_publish_is_anonymously_discoverable_and_downloadable(tmp_path: Path) -> None:
    api = client(tmp_path, "development")
    document, media = candidate()
    response = publish(api, claim(api, "author-one"), document, media)

    assert response.status_code == 200, response.text
    publication = response.json()["publication"]
    assert publication["created"] is True
    assert publication["idempotent"] is False
    publication_id = publication["publicationId"]

    listing = api.get("/api/publications", params={"q": "牛头人"})
    assert listing.status_code == 200
    assert [item["publicationId"] for item in listing.json()["publications"]] == [publication_id]
    assert listing.json()["publications"][0]["resources"][0]["name"] == "牛头人破坏者"

    detail = api.get(f"/api/publications/{publication_id}")
    assert detail.status_code == 200
    expected_document = self_contained_document(document, media)
    assert detail.json()["publication"]["document"] == expected_document

    cover = api.get(f"/api/publications/{publication_id}/media/{document['assets'][0]['id']}")
    assert cover.status_code == 200
    assert cover.content == next(iter(media.values()))

    download = api.get(f"/api/publications/{publication_id}/download")
    assert download.status_code == 200
    assert "filename*=UTF-8''" in download.headers["content-disposition"]
    assert "%E8%8D%92%E9%87%8E%E9%81%AD%E9%81%87%E9%9B%86" in download.headers["content-disposition"]
    loaded = load_pbres(download.content, validate_resource_package_semantics)
    assert loaded["diagnostics"] == []
    assert loaded["candidate"] == {"document": expected_document, "media": media}


def test_logged_in_non_author_can_download_a_public_package(tmp_path: Path) -> None:
    api = client(tmp_path)
    document, media = candidate()
    created = publish(api, claim(api, "public-download-author"), document, media)
    publication_id = created.json()["publication"]["publicationId"]

    download = api.get(
        f"/api/publications/{publication_id}/download",
        headers=claim(api, "public-download-reader"),
    )

    assert download.status_code == 200, download.text
    assert "%E8%8D%92%E9%87%8E%E9%81%AD%E9%81%87%E9%9B%86" in download.headers[
        "content-disposition"
    ]
    loaded = load_pbres(download.content, validate_resource_package_semantics)
    assert loaded["diagnostics"] == []
    assert loaded["candidate"] is not None


def test_market_media_is_retained_only_by_the_document_that_acquired_it(tmp_path: Path) -> None:
    api = client(tmp_path)
    document, media = candidate()
    author = claim(api, "market-media-author")
    reader = claim(api, "market-media-reader")
    publication = publish(api, author, document, media).json()["publication"]
    publication_id = publication["publicationId"]
    asset_id = document["assets"][0]["id"]

    acquired = api.put(
        "/api/cloud/documents/acquired-workspace",
        headers=reader,
        json={
            "mutationId": "acquire-public-media",
            "documentKind": "creator-workspace",
            "contractFamily": "creator-workspace-draft",
            "contractVersion": "1",
            "baseRevision": None,
            "assetIds": [asset_id],
            "payload": {"name": "已取得的市场资源"},
            "force": False,
        },
    )
    assert acquired.status_code == 200, acquired.text
    assert api.post(
        f"/api/publications/{publication_id}/unpublish",
        headers=author,
    ).status_code == 200

    retained = api.get(
        f"/api/cloud/documents/acquired-workspace/media/{asset_id}",
        headers=reader,
    )
    assert retained.status_code == 200
    assert retained.content == media[asset_id]

    unrelated = api.put(
        "/api/cloud/documents/unrelated-workspace",
        headers=reader,
        json={
            "mutationId": "reuse-withdrawn-media",
            "documentKind": "creator-workspace",
            "contractFamily": "creator-workspace-draft",
            "contractVersion": "1",
            "baseRevision": None,
            "assetIds": [asset_id],
            "payload": {"name": "不应取得的市场资源"},
            "force": False,
        },
    )
    assert unrelated.status_code == 422
    assert unrelated.json()["error"]["code"] == "CLOUD_MEDIA_NOT_READY"


def test_heart_of_hopefind_text_resources_can_be_published(tmp_path: Path) -> None:
    loaded = load_pbres(
        (ROOT / "apps/player/public/system-packages/heart-of-hopefind/resources/heart-of-hopefind.pbres").read_bytes(),
        validate_resource_package_semantics,
    )
    assert loaded["diagnostics"] == []
    assert loaded["candidate"] is not None
    document = copy.deepcopy(loaded["candidate"]["document"])
    media = dict(loaded["candidate"]["media"])
    fixture_document, fixture_media = candidate()
    cover_asset = copy.deepcopy(fixture_document["assets"][0])
    document["assets"].append(cover_asset)
    media[cover_asset["id"]] = fixture_media[cover_asset["id"]]
    document["snapshotDigest"] = compute_resource_package_snapshot_digest(document, media)

    api = client(tmp_path)
    response = publish(api, claim(api, "hopefind-author"), document, media, {
        "title": "寻望之心官方资源",
        "summary": "寻望之心系统包随附的求生者风格。",
        "language": "zh-CN",
        "tags": ["寻望之心"],
        "coverAssetId": cover_asset["id"],
    })

    assert response.status_code == 200, response.text


def self_contained_document(
    document: dict[str, Any],
    media: dict[str, bytes],
    publication_metadata: dict[str, Any] | None = None,
) -> dict[str, Any]:
    embedded = copy.deepcopy(document)
    values = publication_metadata or metadata(document)
    embedded["package"]["name"] = values["title"]
    embedded["package"]["description"] = values["summary"]
    embedded["publication"] = {
        "language": values["language"],
        "tags": copy.deepcopy(values["tags"]),
        "coverAssetId": values["coverAssetId"],
    }
    embedded["snapshotDigest"] = compute_resource_package_snapshot_digest(embedded, media)
    return embedded


def test_current_converted_weapon_template_can_be_published_in_development(tmp_path: Path) -> None:
    document, media = candidate()
    document["package"]["id"] = "01989f4e-7b2c-7000-8000-000000000091"
    document["package"]["name"] = "第三方武器包"
    document["resources"][0]["template"] = {
        "id": "武器",
        "version": "1.0.0",
    }
    document["resources"][0]["data"] = {
        "名称": "砍刀",
        "类型": "主武器",
        "属性": "敏捷",
        "距离": "近战",
        "伤害": "d8",
        "负荷": "单手",
        "伤害类型": "物理",
        "特性名": "可靠",
        "特性原名": "Reliable",
        "特性描述": "你的攻击掷骰+1。",
        "风味描述": "",
        "位阶": "1",
    }
    document["snapshotDigest"] = compute_resource_package_snapshot_digest(document, media)

    api = client(tmp_path, "development")
    response = publish(api, claim(api, "weapon-author"), document, media, {
        **metadata(document),
        "title": "第三方武器包",
        "tags": ["武器"],
    })

    assert response.status_code == 200, response.text


def test_public_catalog_filters_sorts_paginates_and_reports_facets(tmp_path: Path) -> None:
    api = client(tmp_path)
    document, media = candidate()
    first = publish(api, claim(api, "author-one"), document, media)
    assert first.status_code == 200, first.text

    multi_target = copy.deepcopy(document)
    multi_target["package"]["id"] = "01989f4e-7b2c-7000-8000-000000000081"
    multi_target["package"]["name"] = "边境敌人集"
    multi_target["resources"][0]["id"] = "01989f4e-7b2c-7000-8000-000000000082"
    multi_target["resources"][0]["path"] = "敌人/边境哨兵.json"
    multi_target["resources"][0]["data"]["名称"] = "边境哨兵"
    multi_target["targets"].append({
        "systemPackageId": "01989f4e-7b2c-7000-8000-000000000083",
        "version": "2.0.0",
    })
    multi_target["snapshotDigest"] = compute_resource_package_snapshot_digest(multi_target, media)
    second = publish(api, claim(api, "author-two"), multi_target, media, {
        **metadata(multi_target),
        "title": "边境敌人集",
        "language": "en-US",
        "tags": ["敌人", "远征"],
    })
    assert second.status_code == 200, second.text

    unspecified = copy.deepcopy(document)
    unspecified["package"]["id"] = "01989f4e-7b2c-7000-8000-000000000084"
    unspecified["package"]["name"] = "无系统资源"
    unspecified["resources"][0]["id"] = "01989f4e-7b2c-7000-8000-000000000085"
    unspecified["targets"] = []
    unspecified["snapshotDigest"] = compute_resource_package_snapshot_digest(unspecified, media)
    third = publish(api, claim(api, "author-three"), unspecified, media, {
        **metadata(unspecified),
        "title": "无系统资源",
        "tags": ["通用"],
    })
    assert third.status_code == 200, third.text

    resource_search = api.get("/api/publications", params={"q": "边境哨兵"}).json()
    assert [item["title"] for item in resource_search["publications"]] == ["边境敌人集"]
    assert resource_search["publications"][0]["matchedResourceIds"] == [
        multi_target["resources"][0]["id"]
    ]

    filtered = api.get("/api/publications", params=[
        ("targetSystemPackageId", "01989f4e-7b2c-7000-8000-000000000083"),
        ("language", "en-US"),
        ("category", "远征"),
        ("templateId", "敌人"),
    ]).json()
    assert [item["title"] for item in filtered["publications"]] == ["边境敌人集"]

    no_target = api.get(
        "/api/publications", params={"targetSystemPackageId": "__none__"}
    ).json()
    assert [item["title"] for item in no_target["publications"]] == ["无系统资源"]

    by_author = api.get(
        "/api/publications",
        params={"authorAccountId": filtered["publications"][0]["author"]["accountId"]},
    ).json()
    assert [item["title"] for item in by_author["publications"]] == ["边境敌人集"]

    first_page = api.get(
        "/api/publications", params={"sort": "title", "page": 1, "pageSize": 2}
    ).json()
    second_page = api.get(
        "/api/publications", params={"sort": "title", "page": 2, "pageSize": 2}
    ).json()
    assert [item["title"] for item in first_page["publications"]] == ["无系统资源", "荒野遭遇集"]
    assert [item["title"] for item in second_page["publications"]] == ["边境敌人集"]
    assert first_page["pagination"] == {
        "page": 1,
        "pageSize": 2,
        "total": 3,
        "hasMore": True,
    }
    assert {item["value"]: item["count"] for item in first_page["facets"]["templateIds"]} == {"敌人": 3}
    assert {item["value"]: item["count"] for item in first_page["facets"]["languages"]} == {"en-US": 1, "zh-CN": 2}
    assert {item["value"] for item in first_page["facets"]["targetSystemPackageIds"]} == {
        "01a0132c-4eef-7703-94ac-ec8d1a660001",
        "01989f4e-7b2c-7000-8000-000000000083",
        "__none__",
    }


def test_publication_fork_requires_an_exact_existing_source_snapshot(tmp_path: Path) -> None:
    api = client(tmp_path)
    source_document, media = candidate()
    source = publish(api, claim(api, "source-author"), source_document, media).json()["publication"]
    assert source["publicationId"].split("-")[2].startswith("7")

    published_source_document = self_contained_document(source_document, media)
    derived = copy.deepcopy(published_source_document)
    derived["package"]["id"] = "01989f4e-7b2c-7000-8000-000000000072"
    derived["package"]["name"] = "牛头人破坏者 Fork"
    derived["forkSource"] = {
        "publicationId": source["publicationId"],
        "packageId": source_document["package"]["id"],
        "version": source_document["package"]["version"],
        "snapshotDigest": source["snapshotDigest"],
        "copiedResources": [{
            "packageId": source_document["package"]["id"],
            "resourceId": resource["id"],
        } for resource in source_document["resources"]],
    }
    derived["snapshotDigest"] = compute_resource_package_snapshot_digest(derived, media)
    accepted = publish(api, claim(api, "fork-author"), derived, media)
    assert accepted.status_code == 200, accepted.text

    forged = copy.deepcopy(derived)
    forged["package"]["id"] = "01989f4e-7b2c-7000-8000-000000000073"
    forged["forkSource"]["snapshotDigest"] = f"sha256:{'0' * 64}"
    forged["snapshotDigest"] = compute_resource_package_snapshot_digest(forged, media)
    rejected = publish(api, claim(api, "forged-fork-author"), forged, media)
    assert rejected.status_code == 422
    assert rejected.json()["error"]["fieldErrors"][0]["code"] == "publication.fork-source.snapshot-mismatch"
    assert len(api.get("/api/publications").json()["publications"]) == 2

@pytest.mark.parametrize(("template_id", "data"), [
    ("护甲", {"名称": "填充布甲", "类型": "护甲", "护甲值": "3", "重度伤害阈值": "5", "严重伤害阈值": "11", "特性名": "灵活", "特性原名": "Flexible", "特性描述": "闪避值+1。", "风味描述": "轻柔填料缝入耐磨布层。", "位阶": "1"}),
    ("环境", {"名称": "荒废林地", "类型": "环境", "原文": "ABANDONED GROVE", "位阶": "1", "种类": "探索", "简介": "一片曾经的德鲁伊林地。", "趋向": "吸引好奇者", "难度": "11", "潜在敌人": "野兽，林地守卫", "特性": [{"名称": "蔓生战场", "原名": "Overgrown Battlefield", "类型": "被动", "描述": "此地曾发生过一场战斗。", "引导问题": "为何发生冲突？"}]}),
    ("种族", {"名称": "人类", "原文": "Human", "类型": "种族", "简介": "适应力强。", "特性": [{"名称": "适应", "原名": "Adaptable", "描述": "获得优势。"}]}),
    ("社群", {"名称": "高岭", "类型": "社群", "简介": "来自山巅。", "性格": "坚韧", "特性": {"名称": "山民", "描述": "熟悉险地。"}}),
    ("职业", {"名称": "战士", "类型": "职业", "描述": "久经战阵。", "领域": ["利刃", "骸骨"], "生命点": "6", "闪避值": "10", "职业物品": "武器", "希望特性": "无畏", "职业特性": "猛攻", "推荐初始属性": [{"力量": "+1"}, {"敏捷": "-1"}], "推荐初始武器": ["阔剑"], "推荐初始护甲": "锁甲", "背景问题": ["为何战斗？"], "关系问题": ["保护谁？"], "施法属性": ""}),
    ("子职业", {"名称": "勇者", "类型": "子职业", "主职": "战士", "等级": "基础", "施法属性": "", "描述": "勇往直前。", "风味描述": "绝不退缩。"}),
    ("物品", {"名称": "治疗药水", "类型": "消耗品", "掷骰": "d4", "描述": "恢复生命。", "风味描述": "温热的红色药剂。"}),
    ("领域卡", {"名称": "旋风斩", "类型": "领域卡", "领域": "利刃", "等级": "1", "属性": "能力", "回想": "1", "描述": "攻击附近敌人。", "风味描述": "剑锋卷起狂风。"}),
    ("自由", {"名称": "复仇誓言", "类型": "专属", "内容": [{"标题": "效果", "正文": "造成伤害时，伤害+2。"}]}),
])
def test_development_templates_are_publishable_in_development(tmp_path: Path, template_id: str, data: dict[str, Any]) -> None:
    api = client(tmp_path, "development")
    document, media = candidate()
    document["resources"][0]["template"] = {"id": template_id, "version": "1.0.0"}
    document["resources"][0]["data"] = data
    document["snapshotDigest"] = compute_resource_package_snapshot_digest(document, media)

    response = publish(api, claim(api, "stable-template-author"), document, media)

    assert response.status_code == 200, response.text
    assert response.json()["publication"]["document"]["resources"][0]["template"] == {
        "id": template_id,
        "version": "1.0.0",
    }


def test_production_mode_rejects_development_template(tmp_path: Path) -> None:
    api = client(tmp_path, "production")
    document, media = candidate()

    response = publish(api, claim(api, "author-one"), document, media)

    assert response.status_code == 422
    assert response.json()["error"]["fieldErrors"] == [{
        "path": "/resources/0",
        "code": "template.publication.not-allowed",
        "message": "template.publication.not-allowed",
    }]


def test_publication_accepts_declared_replacement_and_rejects_unknown_button(tmp_path: Path) -> None:
    api = client(tmp_path)
    headers = claim(api, "replacement-author")
    document, media = candidate()
    resource = document["resources"][0]
    resource["replacements"] = [{
        "replacementId": "alternate-form",
        "targetResourceId": resource["id"],
    }]
    document["snapshotDigest"] = compute_resource_package_snapshot_digest(document, media)
    accepted = publish(api, headers, document, media)
    assert accepted.status_code == 200, accepted.text

    document["package"]["id"] = "01a0132c-4eef-7703-94ac-ec8c02654800"
    resource["replacements"][0]["replacementId"] = "unknown-button"
    document["snapshotDigest"] = compute_resource_package_snapshot_digest(document, media)
    rejected = publish(api, headers, document, media)
    assert rejected.status_code == 422, rejected.text
    assert rejected.json()["error"]["fieldErrors"][0]["code"] == "template.replacement.unsupported"


def test_legacy_reference_templates_are_not_publishable(tmp_path: Path) -> None:
    api = client(tmp_path)
    headers = claim(api, "legacy-template-author")
    fixture = read_json(FIXTURE_ROOT / "valid/daggerheart-core-reference-types.json")

    for resource in fixture["resources"]:
        document, media = candidate()
        document["resources"][0]["template"] = {
            "id": resource["template"]["id"],
            "version": "0.9.0",
        }
        document["resources"][0]["data"] = copy.deepcopy(resource["data"])
        document["snapshotDigest"] = compute_resource_package_snapshot_digest(document, media)

        response = publish(api, headers, document, media)

        assert response.status_code == 422, response.text

    assert api.get("/api/publications").json()["publications"] == []


def test_publication_requires_active_account_session(tmp_path: Path) -> None:
    api = client(tmp_path)
    document, media = candidate()
    response = publish(api, {}, document, media)
    assert response.status_code == 401
    assert response.json()["error"]["code"] == "AUTH_REQUIRED"


def test_invalid_archive_and_unpublishable_template_leave_zero_rows(tmp_path: Path) -> None:
    api = client(tmp_path)
    headers = claim(api, "author-one")
    document, media = candidate()
    broken_media = dict(media)
    broken_media[document["assets"][0]["id"]] = b"not-the-image"

    invalid = publish(api, headers, document, broken_media)
    assert invalid.status_code == 422
    assert invalid.json()["error"]["code"] == "PUBLICATION_CANDIDATE_INVALID"

    unsupported_root = ROOT / "contracts/conformance/resource-package/1.0.0"
    unsupported_document = read_json(unsupported_root / "valid/minotaur-wrecker.json")
    unsupported_document["resources"][0]["template"]["version"] = "0.9.0"
    unsupported_document["snapshotDigest"] = compute_resource_package_snapshot_digest(
        unsupported_document,
        media,
    )
    unsupported_media = {
        asset["id"]: (
            unsupported_root / f"media/{asset['id'].removeprefix('sha256:')}.webp"
        ).read_bytes()
        for asset in unsupported_document["assets"]
    }
    unpublishable = publish(api, headers, unsupported_document, unsupported_media)
    assert unpublishable.status_code == 422
    assert api.get("/api/publications").json()["publications"] == []


def test_package_ownership_idempotency_and_monotonic_versions(tmp_path: Path) -> None:
    api = client(tmp_path)
    first_headers = claim(api, "author-one")
    document, media = candidate()
    first = publish(api, first_headers, document, media)
    assert first.status_code == 200

    repeated = publish(api, first_headers, document, media)
    assert repeated.status_code == 200
    assert repeated.json()["publication"]["idempotent"] is True

    second_headers = claim(api, "author-two")
    stolen = publish(api, second_headers, document, media)
    assert stolen.status_code == 409
    assert stolen.json()["error"]["code"] == "PACKAGE_ID_OWNED_BY_ANOTHER_ACCOUNT"

    changed = copy.deepcopy(document)
    changed["resources"][0]["data"]["名称"] = "另一只牛头人"
    changed["snapshotDigest"] = compute_resource_package_snapshot_digest(changed, media)
    development_replace = publish(api, first_headers, changed, media)
    assert development_replace.status_code == 200
    assert development_replace.json()["publication"]["created"] is False
    assert development_replace.json()["publication"]["idempotent"] is False
    assert development_replace.json()["publication"]["packageVersion"] == "1.0.0"
    expected_changed = self_contained_document(changed, media)
    assert development_replace.json()["publication"]["snapshotDigest"] == expected_changed["snapshotDigest"]

    changed["package"]["version"] = "1.0.1"
    changed["snapshotDigest"] = compute_resource_package_snapshot_digest(changed, media)
    updated = publish(api, first_headers, changed, media)
    assert updated.status_code == 200
    assert updated.json()["publication"]["publicationId"] == first.json()["publication"]["publicationId"]
    assert updated.json()["publication"]["packageVersion"] == "1.0.1"


def test_repository_enforces_structural_version_minimum_atomically(tmp_path: Path) -> None:
    api = client(tmp_path)
    account = api.app.state.identity_repository.get_or_create_account("author-one")
    repository = api.app.state.publication_repository
    document, media = candidate()
    created = repository.publish(account.account_id, document, media, metadata(document))

    patch = copy.deepcopy(document)
    patch["package"]["version"] = "1.0.1"
    patch["resources"][0]["data"]["名称"] = "另一只牛头人"
    patch["snapshotDigest"] = compute_resource_package_snapshot_digest(patch, media)
    assert repository.publish(account.account_id, patch, media, metadata(patch)).created is False

    major = copy.deepcopy(patch)
    major["package"]["version"] = "1.0.2"
    major["resources"] = []
    major["snapshotDigest"] = compute_resource_package_snapshot_digest(major, media)
    with pytest.raises(PublicationVersionConflict):
        repository.publish(account.account_id, major, media, metadata(major))
    unchanged = repository.get_publication(created.publication_id)
    assert unchanged is not None
    assert unchanged["packageVersion"] == "1.0.1"
    assert unchanged["snapshotDigest"] == patch["snapshotDigest"]

    major["package"]["version"] = "2.0.0"
    major["snapshotDigest"] = compute_resource_package_snapshot_digest(major, media)
    assert repository.publish(account.account_id, major, media, metadata(major)).created is False


def test_publication_lifecycle_is_server_authoritative_and_rejects_unrelated_accounts(tmp_path: Path) -> None:
    api = client(tmp_path)
    document, media = candidate()
    owner = claim(api, "author-one")
    outsider = claim(api, "author-two")
    created = publish(api, owner, document, media).json()["publication"]
    publication_id = created["publicationId"]
    denied = api.patch(
        f"/api/publications/{publication_id}/information",
        headers=outsider,
        json={
            "package": {
                "name": "越权修改",
                "version": document["package"]["version"],
                "description": "",
            },
            "targets": document["targets"],
            "title": "越权修改",
            "summary": "",
            "language": "zh-CN",
            "tags": [],
            "coverAssetId": document["assets"][0]["id"],
        },
    )
    assert denied.status_code == 404

    information_update = api.patch(
        f"/api/publications/{publication_id}/information",
        headers=owner,
        json={
            "package": {
                "name": "匕首之心扩展资源",
                "version": document["package"]["version"],
                "description": "资源包本体信息已更新。",
            },
            "targets": [{
                "systemPackageId": "01a0132c-4eef-7703-94ac-ec8d1a660001",
                "version": "1.0.0",
            }],
            "title": "匕首之心扩展资源",
            "summary": "市场展示同步更新。",
            "language": "zh-CN",
            "tags": ["扩展"],
            "coverAssetId": document["assets"][0]["id"],
        },
    )
    assert information_update.status_code == 200, information_update.text
    assert information_update.json()["publication"]["targetSystemPackageIds"] == [
        "01a0132c-4eef-7703-94ac-ec8d1a660001"
    ]
    updated_archive = api.get(f"/api/publications/{publication_id}/download").content
    downloaded = load_pbres(
        updated_archive,
        validate_resource_package_semantics,
    )["candidate"]
    assert downloaded is not None
    assert downloaded["document"]["package"]["name"] == "匕首之心扩展资源"
    assert downloaded["document"]["targets"] == [{
        "systemPackageId": "01a0132c-4eef-7703-94ac-ec8d1a660001",
        "version": "1.0.0",
    }]

    assert api.post(f"/api/publications/{publication_id}/unpublish", headers=outsider).status_code == 403
    unpublished = api.post(f"/api/publications/{publication_id}/unpublish", headers=owner)
    assert unpublished.status_code == 200, unpublished.text
    assert unpublished.json()["publication"]["status"] == "unpublished"
    repeated_unpublish = api.post(f"/api/publications/{publication_id}/unpublish", headers=owner)
    assert repeated_unpublish.status_code == 200
    assert repeated_unpublish.json()["publication"]["status"] == "unpublished"
    assert repeated_unpublish.json()["publication"]["updatedAt"] == unpublished.json()["publication"]["updatedAt"]
    assert api.get("/api/publications").json()["publications"] == []
    assert api.get(f"/api/publications/{publication_id}").status_code == 404
    assert api.get(f"/api/publications/{publication_id}/download").status_code == 404
    assert api.get(
        f"/api/publications/{publication_id}/media/{document['assets'][0]['id']}"
    ).status_code == 404
    assert api.get(f"/api/publications/{publication_id}/download", headers=outsider).status_code == 404
    assert api.get(
        f"/api/publications/{publication_id}/media/{document['assets'][0]['id']}",
        headers=outsider,
    ).status_code == 404
    assert api.get(f"/api/publications/{publication_id}/download", headers=owner).content == updated_archive
    assert api.get(
        f"/api/publications/{publication_id}/media/{document['assets'][0]['id']}",
        headers=owner,
    ).content == media[document["assets"][0]["id"]]

    manageable = api.get("/api/publications/manageable", headers=owner)
    assert manageable.status_code == 200
    assert manageable.json()["publications"][0]["publicationId"] == publication_id
    assert manageable.json()["publications"][0]["status"] == "unpublished"
    assert api.get(f"/api/publications/{publication_id}/manage", headers=owner).status_code == 200
    assert api.get(f"/api/publications/{publication_id}/manage", headers=outsider).status_code == 404

    updated_document = copy.deepcopy(document)
    updated_document["resources"][0]["data"]["名称"] = "未发布状态下的新快照"
    updated_document["snapshotDigest"] = compute_resource_package_snapshot_digest(updated_document, media)
    updated_while_unpublished = publish(api, owner, updated_document, media)
    assert updated_while_unpublished.status_code == 200, updated_while_unpublished.text
    assert updated_while_unpublished.json()["publication"]["status"] == "unpublished"
    expected_updated = self_contained_document(updated_document, media)
    assert updated_while_unpublished.json()["publication"]["snapshotDigest"] == expected_updated["snapshotDigest"]
    assert api.get("/api/publications").json()["publications"] == []

    assert api.post(f"/api/publications/{publication_id}/republish", headers=outsider).status_code == 403
    republished = api.post(f"/api/publications/{publication_id}/republish", headers=owner)
    assert republished.status_code == 200, republished.text
    assert republished.json()["publication"]["publicationId"] == publication_id
    assert republished.json()["publication"]["status"] == "published"
    repeated_republish = api.post(f"/api/publications/{publication_id}/republish", headers=owner)
    assert repeated_republish.status_code == 200
    assert repeated_republish.json()["publication"]["publicationId"] == publication_id
    assert repeated_republish.json()["publication"]["status"] == "published"
    assert repeated_republish.json()["publication"]["updatedAt"] == republished.json()["publication"]["updatedAt"]


def test_platform_admin_can_manage_another_authors_publication(tmp_path: Path) -> None:
    api = client(tmp_path)
    document, media = candidate()
    owner = claim(api, "author-one")
    admin = claim(api, "platform-admin")
    created = publish(api, owner, document, media).json()["publication"]
    publication_id = created["publicationId"]

    edited = api.patch(
        f"/api/publications/{publication_id}/information",
        headers=admin,
        json={
            "package": {
                "name": "管理员修订展示",
                "version": document["package"]["version"],
                "description": "",
            },
            "targets": document["targets"],
            "title": "管理员修订展示",
            "summary": "",
            "language": "zh-CN",
            "tags": ["敌人"],
            "coverAssetId": document["assets"][0]["id"],
        },
    )
    assert edited.status_code == 200, edited.text
    assert edited.json()["publication"]["author"]["accountId"] == created["author"]["accountId"]

    unpublished = api.post(f"/api/publications/{publication_id}/unpublish", headers=admin)
    assert unpublished.status_code == 200, unpublished.text
    assert unpublished.json()["publication"]["status"] == "unpublished"
    assert api.get(f"/api/publications/{publication_id}/manage", headers=admin).status_code == 200
    assert api.get("/api/publications/manageable", headers=admin).json()["publications"][0]["publicationId"] == publication_id
    assert api.get(f"/api/publications/{publication_id}/download", headers=admin).status_code == 200
    assert api.get(
        f"/api/publications/{publication_id}/media/{document['assets'][0]['id']}",
        headers=admin,
    ).content == media[document["assets"][0]["id"]]

    republished = api.post(f"/api/publications/{publication_id}/republish", headers=admin)
    assert republished.status_code == 200, republished.text
    assert republished.json()["publication"]["status"] == "published"
    assert api.get(f"/api/publications/{publication_id}").status_code == 200


def test_author_can_replace_the_self_contained_market_cover(tmp_path: Path) -> None:
    api = client(tmp_path)
    document, media = candidate()
    document["resources"][0]["media"] = {}
    document["snapshotDigest"] = compute_resource_package_snapshot_digest(document, media)
    owner = claim(api, "cover-author")
    outsider = claim(api, "cover-outsider")
    created = publish(api, owner, document, media).json()["publication"]
    publication_id = created["publicationId"]
    original_archive = api.get(f"/api/publications/{publication_id}/download").content
    original_cover = next(iter(media.values()))
    replacement_cover_buffer = bytearray((
        FIXTURE_ROOT / "media/a991add6e770461480dd9bf35fde9debe267f7f5b970d01cb65bb689166b28cd.webp"
    ).read_bytes())
    replacement_cover_buffer[-1] ^= 1
    replacement_cover = bytes(replacement_cover_buffer)
    replacement_cover_id = f"sha256:{hashlib.sha256(replacement_cover).hexdigest()}"
    information = {
        "package": {
            "name": document["package"]["name"],
            "version": document["package"]["version"],
            "description": document["package"]["description"],
        },
        "targets": document["targets"],
        "title": "新的市场封面",
        "summary": "资源包本体保持不变。",
        "language": "zh-CN",
        "tags": ["封面"],
        "coverAssetId": replacement_cover_id,
        "coverAsset": {
            "id": replacement_cover_id,
            "mediaType": "image/webp",
            "byteLength": str(len(replacement_cover)),
            "width": "630",
            "height": "880",
        },
    }

    denied = api.patch(
        f"/api/publications/{publication_id}/information-with-cover",
        headers=outsider,
        data={"information": json.dumps(information, ensure_ascii=False)},
        files={"cover": ("cover.webp", replacement_cover, "image/webp")},
    )
    assert denied.status_code == 404

    updated = api.patch(
        f"/api/publications/{publication_id}/information-with-cover",
        headers=owner,
        data={"information": json.dumps(information, ensure_ascii=False)},
        files={"cover": ("cover.webp", replacement_cover, "image/webp")},
    )
    assert updated.status_code == 200, updated.text
    assert updated.json()["publication"]["coverAssetId"] == replacement_cover_id
    assert api.get(
        f"/api/publications/{publication_id}/media/{replacement_cover_id}"
    ).content == replacement_cover
    updated_archive = api.get(f"/api/publications/{publication_id}/download").content
    assert updated_archive != original_archive
    downloaded = load_pbres(updated_archive, validate_resource_package_semantics)["candidate"]
    assert downloaded is not None
    assert downloaded["document"]["publication"] == {
        "language": "zh-CN",
        "tags": ["封面"],
        "coverAssetId": replacement_cover_id,
    }
    assert downloaded["document"]["license"] == document["license"]
    assert downloaded["media"][replacement_cover_id] == replacement_cover
    assert created["coverAssetId"] not in downloaded["media"]

    invalid = api.patch(
        f"/api/publications/{publication_id}/information-with-cover",
        headers=owner,
        data={"information": json.dumps(information, ensure_ascii=False)},
        files={"cover": ("cover.png", b"not-webp", "image/png")},
    )
    assert invalid.status_code == 422


def test_unpublished_publication_can_be_permanently_deleted_by_its_owner(tmp_path: Path) -> None:
    api = client(tmp_path)
    document, media = candidate()
    owner = claim(api, "delete-owner")
    outsider = claim(api, "delete-outsider")
    created = publish(api, owner, document, media).json()["publication"]
    publication_id = created["publicationId"]

    still_public = api.delete(f"/api/publications/{publication_id}", headers=owner)
    assert still_public.status_code == 409
    assert still_public.json()["error"]["code"] == "PUBLICATION_MUST_BE_UNPUBLISHED"

    unpublished = api.post(f"/api/publications/{publication_id}/unpublish", headers=owner)
    assert unpublished.status_code == 200
    assert api.delete(f"/api/publications/{publication_id}", headers=outsider).status_code == 403

    deleted = api.delete(f"/api/publications/{publication_id}", headers=owner)
    assert deleted.status_code == 204
    assert api.get(f"/api/publications/{publication_id}/manage", headers=owner).status_code == 404
    assert api.get(f"/api/publications/{publication_id}").status_code == 404
    assert api.get(f"/api/publications/{publication_id}/download", headers=owner).status_code == 404
    assert api.get(
        f"/api/publications/{publication_id}/media/{document['assets'][0]['id']}",
        headers=owner,
    ).status_code == 404

    republished = publish(api, owner, document, media)
    assert republished.status_code == 200, republished.text
    assert republished.json()["publication"]["publicationId"] != publication_id
    assert publish(api, outsider, document, media).status_code == 409


def test_status_migration_preserves_existing_publications_as_published(tmp_path: Path) -> None:
    migrations = tmp_path / "migrations"
    migrations.mkdir()
    source_migrations = ROOT / "apps/backend/migrations"
    for name in ("0001_identity.sql", "0002_publications.sql"):
        (migrations / name).write_text(
            (source_migrations / name).read_text(encoding="utf-8"),
            encoding="utf-8",
        )
    migrated_settings = Settings(
        database_path=tmp_path / "existing.sqlite3",
        migrations_path=migrations,
        supabase_url="https://example.supabase.co",
        supabase_anon_key="public-anon-key",
        publication_mode="development",
    )
    document, _ = candidate()
    database = Database(migrated_settings.database_path, migrations)
    connection = database.connect()
    connection.execute(
        "INSERT INTO accounts(account_id, auth_subject, username, username_key, created_at, updated_at) "
        "VALUES ('account-existing', 'author-one', 'author-one', 'author-one', '2026-08-25', '2026-08-25')"
    )
    connection.execute(
        "INSERT INTO package_ownership(package_id, account_id, claimed_at) VALUES (?, 'account-existing', '2026-08-25')",
        (document["package"]["id"],),
    )
    connection.execute(
        "INSERT INTO publications(publication_id, package_id, contract_version, package_version, "
        "snapshot_digest, title, summary, language, tags_json, cover_asset_id, logical_document_json, "
        "created_at, updated_at) VALUES ('publication-existing', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '2026-08-25', '2026-08-25')",
        (
            document["package"]["id"],
            document["contractVersion"],
            document["package"]["version"],
            document["snapshotDigest"],
            "荒野遭遇集",
            "包含牛头人破坏者。",
            "zh-CN",
            json.dumps(["敌人"], ensure_ascii=False),
            document["assets"][0]["id"],
            json.dumps(document, ensure_ascii=False),
        ),
    )
    connection.commit()
    connection.close()

    (migrations / "0003_publication_status.sql").write_text(
        (source_migrations / "0003_publication_status.sql").read_text(encoding="utf-8"),
        encoding="utf-8",
    )
    after = TestClient(create_app(migrated_settings, FakeTokenVerifier()))
    publications = after.get("/api/publications").json()["publications"]

    assert len(publications) == 1
    assert publications[0]["publicationId"] == "publication-existing"
    assert publications[0]["status"] == "published"


def test_invalid_update_preserves_current_snapshot(tmp_path: Path) -> None:
    api = client(tmp_path)
    owner = claim(api, "author-one")
    document, media = candidate()
    first = publish(api, owner, document, media)
    assert first.status_code == 200, first.text
    publication_id = first.json()["publication"]["publicationId"]

    update = copy.deepcopy(document)
    update["package"]["version"] = "1.0.1"
    update["resources"][0]["data"]["名称"] = "无效更新不应提交"
    update["snapshotDigest"] = compute_resource_package_snapshot_digest(update, media)
    invalid_metadata = metadata(update)
    invalid_metadata["coverAssetId"] = "sha256:" + "0" * 64
    rejected = publish(api, owner, update, media, invalid_metadata)
    assert rejected.status_code == 422
    assert rejected.json()["error"]["code"] == "PUBLICATION_CANDIDATE_INVALID"

    unchanged = api.get(f"/api/publications/{publication_id}").json()["publication"]
    expected_original = self_contained_document(document, media)
    assert unchanged["snapshotDigest"] == expected_original["snapshotDigest"]
    assert unchanged["packageVersion"] == "1.0.0"


def test_production_mode_rejects_unsupported_old_contract(tmp_path: Path) -> None:
    api = client(tmp_path, "production")
    document, media = candidate()
    document["contractVersion"] = "0.9.0"
    response = publish(api, claim(api, "author-one"), document, media)
    assert response.status_code == 422
    field_errors = response.json()["error"]["fieldErrors"]
    assert field_errors[0]["code"] == "contract.version.unsupported"
    assert api.get("/api/publications").json()["publications"] == []
