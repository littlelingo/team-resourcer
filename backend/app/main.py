"""FastAPI application factory with router registration and CORS configuration."""

import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.api.routes.agencies import router as agencies_router
from app.api.routes.areas import router as areas_router
from app.api.routes.history import router as history_router
from app.api.routes.import_router import router as import_router
from app.api.routes.members import router as members_router
from app.api.routes.org import router as org_router
from app.api.routes.programs import router as programs_router
from app.core.config import settings
from app.services.import_session import start_cleanup_task

os.makedirs(settings.upload_dir, exist_ok=True)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Start background cleanup task on startup and cancel it on shutdown."""
    cleanup_task = start_cleanup_task()
    yield
    cleanup_task.cancel()


app = FastAPI(title="Team Resourcer API", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in settings.cors_origins.split(",") if o.strip()],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "Accept"],
)


@app.get("/health")
async def health():
    """Return a simple health-check payload."""
    return {"status": "ok"}


# Mount static files for uploads
app.mount("/uploads", StaticFiles(directory=settings.upload_dir, html=False), name="uploads")

# Include routers
app.include_router(members_router, prefix="/api/members", tags=["members"])
app.include_router(
    history_router,
    prefix="/api/members/{member_uuid}/history",
    tags=["history"],
)
app.include_router(programs_router, prefix="/api/programs", tags=["programs"])
app.include_router(agencies_router, prefix="/api/agencies", tags=["agencies"])
app.include_router(areas_router, prefix="/api/areas", tags=["areas", "teams"])
app.include_router(org_router, prefix="/api/org", tags=["org"])
app.include_router(import_router, prefix="/api/import", tags=["import"])
