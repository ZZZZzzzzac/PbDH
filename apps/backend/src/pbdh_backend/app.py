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
from pbdh_backend.publications.repository import PublicationRepository
from pbdh_backend.publications.router import router as publications_router
from pbdh_backend.publications.service import PublicationService
from pbdh_backend.settings import Settings


def project_root() -> Path:
    return Path(__file__).resolve().parents[4]


def create_app(
    settings: Settings | None = None,
    token_verifier: TokenVerifier | None = None,
) -> FastAPI:
    resolved = settings or Settings.from_environment()
    application = FastAPI(
        title="PbDH Platform API",
        version="0.0.0",
        docs_url=None,
        redoc_url=None,
    )
    database = Database(resolved.database_path, resolved.migrations_path)
    publication_repository = PublicationRepository(database)
    cloud_document_repository = CloudDocumentRepository(database)
    application.state.settings = resolved
    application.state.identity_repository = IdentityRepository(database)
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
    application.include_router(cloud_documents_router)
    application.include_router(publications_router)

    @application.get("/api/health", tags=["system"])
    def health() -> dict[str, str]:
        return {"status": "ok", "service": "pbdh-platform-api"}

    return application


app = create_app()
