"""Routes declarations chauffeur / Driver declaration routes."""

import os
import uuid
from datetime import datetime, timezone
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.driver_declaration import DeclarationPhoto, DeclarationType, DriverDeclaration
from app.models.mobile_device import MobileDevice
from app.models.user import User
from app.schemas.declaration import DeclarationCreate, DeclarationPhotoRead, DeclarationRead
from app.api.deps import get_authenticated_device, require_permission

router = APIRouter()

# Repertoire stockage photos / Photo storage directory
PHOTOS_DIR = Path("data/photos")

MAX_PHOTOS_PER_DECLARATION = 5
MAX_PHOTO_SIZE = 5 * 1024 * 1024  # 5 MB


# ─── Endpoints chauffeur (device auth) / Driver endpoints ───

@router.post("/driver", response_model=DeclarationRead, status_code=201)
async def create_declaration_driver(
    data: DeclarationCreate,
    db: AsyncSession = Depends(get_db),
    device: MobileDevice = Depends(get_authenticated_device),
):
    """Creer declaration depuis le mobile / Create declaration from mobile."""
    now = datetime.now(timezone.utc).isoformat(timespec="seconds")

    declaration = DriverDeclaration(
        device_id=device.id,
        tour_id=data.tour_id,
        tour_stop_id=data.tour_stop_id,
        declaration_type=DeclarationType(data.declaration_type),
        description=data.description,
        latitude=data.latitude,
        longitude=data.longitude,
        accuracy=data.accuracy,
        driver_name=data.driver_name,
        created_at=data.created_at or now,
    )
    db.add(declaration)
    await db.flush()

    return DeclarationRead(
        id=declaration.id,
        device_id=declaration.device_id,
        tour_id=declaration.tour_id,
        tour_stop_id=declaration.tour_stop_id,
        declaration_type=declaration.declaration_type.value,
        description=declaration.description,
        latitude=declaration.latitude,
        longitude=declaration.longitude,
        accuracy=declaration.accuracy,
        driver_name=declaration.driver_name,
        created_at=declaration.created_at,
        photos=[],
    )


@router.post("/driver/{declaration_id}/photos", response_model=DeclarationPhotoRead, status_code=201)
async def upload_photo_driver(
    declaration_id: int,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    device: MobileDevice = Depends(get_authenticated_device),
):
    """Upload photo pour une declaration / Upload photo for a declaration."""
    declaration = await db.get(DriverDeclaration, declaration_id)
    if not declaration or declaration.device_id != device.id:
        raise HTTPException(status_code=404, detail="Declaration not found")

    # Verifier nombre de photos existantes / Check existing photo count
    result = await db.execute(
        select(DeclarationPhoto).where(DeclarationPhoto.declaration_id == declaration_id)
    )
    existing = result.scalars().all()
    if len(existing) >= MAX_PHOTOS_PER_DECLARATION:
        raise HTTPException(status_code=400, detail=f"Max {MAX_PHOTOS_PER_DECLARATION} photos par declaration")

    # Lire et valider le fichier / Read and validate file
    content = await file.read()
    if len(content) > MAX_PHOTO_SIZE:
        raise HTTPException(status_code=400, detail="Photo trop volumineuse (max 5 MB)")

    mime = file.content_type or "image/jpeg"
    if not mime.startswith("image/"):
        raise HTTPException(status_code=400, detail="Seules les images sont acceptees")

    # Sauvegarder sur disque / Save to disk
    ext = mime.split("/")[-1].replace("jpeg", "jpg")
    unique_name = f"{uuid.uuid4().hex[:12]}.{ext}"
    photo_dir = PHOTOS_DIR / str(declaration_id)
    photo_dir.mkdir(parents=True, exist_ok=True)
    file_path = photo_dir / unique_name
    file_path.write_bytes(content)

    now = datetime.now(timezone.utc).isoformat(timespec="seconds")
    photo = DeclarationPhoto(
        declaration_id=declaration_id,
        filename=file.filename or unique_name,
        file_path=str(file_path),
        file_size=len(content),
        mime_type=mime,
        uploaded_at=now,
    )
    db.add(photo)
    await db.flush()

    return photo


@router.get("/driver/my-declarations", response_model=list[DeclarationRead])
async def list_my_declarations(
    db: AsyncSession = Depends(get_db),
    device: MobileDevice = Depends(get_authenticated_device),
):
    """Lister mes declarations / List my declarations."""
    result = await db.execute(
        select(DriverDeclaration)
        .where(DriverDeclaration.device_id == device.id)
        .order_by(DriverDeclaration.id.desc())
        .limit(50)
    )
    declarations = result.scalars().all()
    out = []
    for d in declarations:
        photos_result = await db.execute(
            select(DeclarationPhoto).where(DeclarationPhoto.declaration_id == d.id)
        )
        photos = photos_result.scalars().all()
        out.append(DeclarationRead(
            id=d.id,
            device_id=d.device_id,
            tour_id=d.tour_id,
            tour_stop_id=d.tour_stop_id,
            declaration_type=d.declaration_type.value,
            description=d.description,
            latitude=d.latitude,
            longitude=d.longitude,
            accuracy=d.accuracy,
            driver_name=d.driver_name,
            created_at=d.created_at,
            photos=[DeclarationPhotoRead(
                id=p.id, declaration_id=p.declaration_id,
                filename=p.filename, file_size=p.file_size,
                mime_type=p.mime_type, uploaded_at=p.uploaded_at,
            ) for p in photos],
        ))
    return out


# ─── Endpoints web admin (JWT auth) / Web admin endpoints ───

@router.get("/", response_model=list[DeclarationRead])
async def list_declarations(
    tour_id: int | None = None,
    declaration_type: str | None = None,
    date_from: str | None = None,
    date_to: str | None = None,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_permission("declarations", "read")),
):
    """Lister toutes les declarations (web admin) / List all declarations (web admin)."""
    query = select(DriverDeclaration).order_by(DriverDeclaration.id.desc())

    if tour_id is not None:
        query = query.where(DriverDeclaration.tour_id == tour_id)
    if declaration_type is not None:
        query = query.where(DriverDeclaration.declaration_type == DeclarationType(declaration_type))
    if date_from is not None:
        query = query.where(DriverDeclaration.created_at >= date_from)
    if date_to is not None:
        query = query.where(DriverDeclaration.created_at <= date_to + "T23:59:59")

    result = await db.execute(query.limit(200))
    declarations = result.scalars().all()

    out = []
    for d in declarations:
        photos_result = await db.execute(
            select(DeclarationPhoto).where(DeclarationPhoto.declaration_id == d.id)
        )
        photos = photos_result.scalars().all()
        out.append(DeclarationRead(
            id=d.id,
            device_id=d.device_id,
            tour_id=d.tour_id,
            tour_stop_id=d.tour_stop_id,
            declaration_type=d.declaration_type.value,
            description=d.description,
            latitude=d.latitude,
            longitude=d.longitude,
            accuracy=d.accuracy,
            driver_name=d.driver_name,
            created_at=d.created_at,
            photos=[DeclarationPhotoRead(
                id=p.id, declaration_id=p.declaration_id,
                filename=p.filename, file_size=p.file_size,
                mime_type=p.mime_type, uploaded_at=p.uploaded_at,
            ) for p in photos],
        ))
    return out


@router.get("/{declaration_id}", response_model=DeclarationRead)
async def get_declaration(
    declaration_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_permission("declarations", "read")),
):
    """Voir une declaration / View a declaration."""
    declaration = await db.get(DriverDeclaration, declaration_id)
    if not declaration:
        raise HTTPException(status_code=404, detail="Declaration not found")

    photos_result = await db.execute(
        select(DeclarationPhoto).where(DeclarationPhoto.declaration_id == declaration_id)
    )
    photos = photos_result.scalars().all()

    return DeclarationRead(
        id=declaration.id,
        device_id=declaration.device_id,
        tour_id=declaration.tour_id,
        tour_stop_id=declaration.tour_stop_id,
        declaration_type=declaration.declaration_type.value,
        description=declaration.description,
        latitude=declaration.latitude,
        longitude=declaration.longitude,
        accuracy=declaration.accuracy,
        driver_name=declaration.driver_name,
        created_at=declaration.created_at,
        photos=[DeclarationPhotoRead(
            id=p.id, declaration_id=p.declaration_id,
            filename=p.filename, file_size=p.file_size,
            mime_type=p.mime_type, uploaded_at=p.uploaded_at,
        ) for p in photos],
    )


@router.get("/{declaration_id}/photos/{photo_id}")
async def get_photo(
    declaration_id: int,
    photo_id: int,
    db: AsyncSession = Depends(get_db),
):
    """Servir une photo / Serve a photo."""
    photo = await db.get(DeclarationPhoto, photo_id)
    if not photo or photo.declaration_id != declaration_id:
        raise HTTPException(status_code=404, detail="Photo not found")

    if not os.path.exists(photo.file_path):
        raise HTTPException(status_code=404, detail="Photo file missing")

    return FileResponse(photo.file_path, media_type=photo.mime_type or "image/jpeg")
