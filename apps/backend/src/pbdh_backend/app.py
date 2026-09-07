from pathlib import Path

from fastapi import FastAPI
from fastapi.exceptions import RequestValidationError

from pbdh_backend.api_errors import (
    ApiError,
    handle_api_error,
    handle_request_validation,
)
from pbdh_backend.cloud_documents.repository import CloudDocumentRepository
from pbdh_backend.cloud_documents.router import router as cloud_documents_router
from pbdh_backend.database import Database
from pbdh_backend.identity.repository import IdentityRepository
from pbdh_backend.identity.router import router as identity_router
from pbdh_backend.identity.tokens import SupabaseJwtVerifier, TokenVerifier
from pbdh_backend.managed_media import ManagedMedia
from pbdh_backend.openapi_contract import (
    BACKEND_API_VERSION,
    install_openapi_contract,
    stable_operation_id,
)
from pbdh_backend.publications.repository import PublicationRepository
from pbdh_backend.publications.router import router as publications_router
from pbdh_backend.publications.service import PublicationService
from pbdh_backend.settings import Settings
from pbdh_backend.storage_usage import router as storage_router


def project_root() -> Path:
    return Path(__file__).resolve().parents[4]


def create_app(
    settings: Settings | None = None,
    token_verifier: TokenVerifier | None = None,
) -> FastAPI:
    resolved = settings or Settings.from_environment()
    application = FastAPI(
        title="PbDH Platform API",
        version=BACKEND_API_VERSION,
        docs_url=None,
        redoc_url=None,
        generate_unique_id_function=stable_operation_id,
    )
    database = Database(resolved.database_path, resolved.migrations_path)
    managed_media = ManagedMedia(database, resolved.account_media_quota_bytes)
    publication_repository = PublicationRepository(database, managed_media)
    cloud_document_repository = CloudDocumentRepository(database, managed_media)
    application.state.settings = resolved
    application.state.identity_repository = IdentityRepository(database)
    application.state.managed_media = managed_media
    application.state.publication_repository = publication_repository
    application.state.cloud_document_repository = cloud_document_repository
    application.state.publication_service = PublicationService(
        publication_repository,
        project_root(),
        resolved.publication_mode,
    )
    application.state.token_verifier = token_verifier or (
        SupabaseJwtVerifier(
            resolved.supabase_url,
            resolved.supabase_audience,
            resolved.supabase_jwt_secret,
        )
        if resolved.auth_configured and resolved.supabase_url
        else None
    )
    application.add_exception_handler(ApiError, handle_api_error)
    application.add_exception_handler(RequestValidationError, handle_request_validation)
    application.include_router(identity_router)
    application.include_router(storage_router)
    application.include_router(cloud_documents_router)
    application.include_router(publications_router)

    @application.get("/api/health", tags=["system"])
    def health() -> dict[str, str]:
        with database.connect() as connection:
            connection.execute("SELECT 1").fetchone()
        return {"status": "ok", "service": "pbdh-platform-api"}

    install_openapi_contract(application)

    return application


app = create_app()
