from __future__ import annotations

"""Profile image validation and persistence."""

import io
import os
import uuid

import aiofiles
from fastapi import UploadFile
from PIL import Image, UnidentifiedImageError

from app.core.config import settings

_FORMAT_TO_EXT: dict[str, str] = {
    "JPEG": "jpg",
    "PNG": "png",
    "WEBP": "webp",
}

_MAX_SIZE_BYTES = 5 * 1024 * 1024  # 5 MB
_CHUNK_SIZE = 64 * 1024  # 64 KB read chunks


async def save_profile_image(member_uuid: uuid.UUID, file: UploadFile) -> str:
    """Validate and persist a profile image. Returns the relative URL path."""
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
    except (UnidentifiedImageError, SyntaxError):
        raise ValueError("File is not a valid image.")

    # Derive extension from actual image format, not Content-Type header
    detected_format = Image.open(io.BytesIO(data)).format or ""
    ext = _FORMAT_TO_EXT.get(detected_format)
    if ext is None:
        raise ValueError("File is not a valid image.")

    filename = f"{member_uuid}.{ext}"
    dest_path = os.path.join(settings.upload_dir, filename)

    os.makedirs(settings.upload_dir, exist_ok=True)
    async with aiofiles.open(dest_path, "wb") as f:
        await f.write(data)

    return f"/uploads/{filename}"
