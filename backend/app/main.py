import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.api.routes.areas import router as areas_router
from app.api.routes.history import router as history_router
from app.api.routes.members import router as members_router
from app.api.routes.org import router as org_router
from app.api.routes.programs import router as programs_router
from app.core.config import settings

os.makedirs(settings.upload_dir, exist_ok=True)


@asynccontextmanager
async def lifespan(app: FastAPI):
    yield


app = FastAPI(title="Team Resourcer API", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "Accept"],
)


@app.get("/health")
async def health():
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
app.include_router(areas_router, prefix="/api/areas", tags=["areas", "teams"])
app.include_router(org_router, prefix="/api/org", tags=["org"])
