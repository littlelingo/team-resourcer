from __future__ import annotations

import io
import os
import uuid

import aiofiles
from fastapi import UploadFile
from PIL import Image, UnidentifiedImageError

from app.core.config import settings

_ALLOWED_CONTENT_TYPES: dict[str, str] = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
}

_MAX_SIZE_BYTES = 5 * 1024 * 1024  # 5 MB
_CHUNK_SIZE = 64 * 1024  # 64 KB read chunks


async def save_profile_image(member_uuid: uuid.UUID, file: UploadFile) -> str:
    """Validate and persist a profile image. Returns the relative URL path."""
    content_type = file.content_type or ""
    if content_type not in _ALLOWED_CONTENT_TYPES:
        raise ValueError(
            f"Unsupported content type '{content_type}'. "
            "Allowed types: image/jpeg, image/png, image/webp."
        )

    ext = _ALLOWED_CONTENT_TYPES[content_type]
    filename = f"{member_uuid}.{ext}"
    dest_path = os.path.join(settings.upload_dir, filename)

    # Read file in chunks to validate size and collect data
    chunks: list[bytes] = []
    total = 0
    while True:
        chunk = await file.read(_CHUNK_SIZE)
        if not chunk:
            break
        total += len(chunk)
        if total > _MAX_SIZE_BYTES:
            raise ValueError("File exceeds maximum allowed size of 5 MB.")
        chunks.append(chunk)

    data = b"".join(chunks)

    # Validate image bytes via magic byte inspection
    try:
        img = Image.open(io.BytesIO(data))
        img.verify()
    except (UnidentifiedImageError, Exception):
        raise ValueError("File is not a valid image.")

    os.makedirs(settings.upload_dir, exist_ok=True)
    async with aiofiles.open(dest_path, "wb") as f:
        await f.write(data)

    return f"/uploads/{filename}"
