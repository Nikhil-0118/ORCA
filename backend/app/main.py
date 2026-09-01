"""
FastAPI Application Entry Point.
Configures CORS middleware, lifespan events (DB & Scheduler), and mounts API routers.
"""
from contextlib import asynccontextmanager
from typing import AsyncGenerator
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.router import api_router
from app.core.config import settings
from app.core.database import close_db, init_db
from app.core.logger import logger, setup_logging
from app.jobs.scheduler import start_background_jobs, stop_background_jobs


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """Application startup and shutdown event lifecycle handler."""
    setup_logging()
    logger.info("app_starting", project_name=settings.PROJECT_NAME, environment=settings.ENVIRONMENT)

    # Initialize database connection pools
    await init_db()

    # Start background alert poller & scheduler
    start_background_jobs()

    yield

    # Teardown background workers and db pools
    stop_background_jobs()
    await close_db()
    logger.info("app_shutdown_complete")


def create_app() -> FastAPI:
    """FastAPI application factory."""
    app = FastAPI(
        title="ORCA — Marine Intelligence Platform API",
        description="Multi-Agent Marine Intelligence & Safety Hub for SIH 2026 under ISRO",
        version="0.1.0",
        lifespan=lifespan,
    )

    # CORS configuration
    if settings.BACKEND_CORS_ORIGINS:
        app.add_middleware(
            CORSMiddleware,
            allow_origins=[str(origin) for origin in settings.BACKEND_CORS_ORIGINS],
            allow_credentials=True,
            allow_methods=["*"],
            allow_headers=["*"],
        )

    # Mount API routers
    app.include_router(api_router)

    return app


app = create_app()
