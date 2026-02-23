"""Routes Types de support / Support Type API routes."""

from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.support_type import SupportType
from app.models.user import User
from app.schemas.pickup import SupportTypeCreate, SupportTypeRead, SupportTypeUpdate
from app.api.deps import require_permission

UPLOAD_DIR = Path("data/uploads/support-types")
ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp"}
MAX_FILE_SIZE = 2 * 1024 * 1024  # 2 MB

router = APIRouter()


@router.get("/", response_model=list[SupportTypeRead])
async def list_support_types(
    is_active: bool | None = None,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_permission("support-types", "read")),
):
    """Liste des types de support / List support types."""
    query = select(SupportType)
    if is_active is not None:
        query = query.where(SupportType.is_active == is_active)
    result = await db.execute(query)
    return result.scalars().all()


@router.get("/{support_type_id}", response_model=SupportTypeRead)
async def get_support_type(
    support_type_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_permission("support-types", "read")),
):
    """Détail d'un type de support / Support type detail."""
    st = await db.get(SupportType, support_type_id)
    if not st:
        raise HTTPException(status_code=404, detail="Support type not found")
    return st


@router.post("/", response_model=SupportTypeRead, status_code=201)
async def create_support_type(
    data: SupportTypeCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_permission("support-types", "create")),
):
    """Créer un type de support / Create a support type."""
    st = SupportType(**data.model_dump())
    db.add(st)
    try:
        await db.flush()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(status_code=409, detail=f"Le code '{data.code}' existe deja")
    await db.refresh(st)
    return st


@router.put("/{support_type_id}", response_model=SupportTypeRead)
async def update_support_type(
    support_type_id: int,
    data: SupportTypeUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_permission("support-types", "update")),
):
    """Modifier un type de support / Update a support type."""
    st = await db.get(SupportType, support_type_id)
    if not st:
        raise HTTPException(status_code=404, detail="Support type not found")
    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(st, key, value)
    try:
        await db.flush()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(status_code=409, detail=f"Le code '{data.code}' existe deja")
    await db.refresh(st)
    return st


@router.delete("/{support_type_id}", status_code=204)
async def delete_support_type(
    support_type_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_permission("support-types", "delete")),
):
    """Supprimer un type de support / Delete a support type."""
    st = await db.get(SupportType, support_type_id)
    if not st:
        raise HTTPException(status_code=404, detail="Support type not found")
    await db.delete(st)


@router.post("/{support_type_id}/image", response_model=SupportTypeRead)
async def upload_support_type_image(
    support_type_id: int,
    file: UploadFile,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_permission("support-types", "update")),
):
    """Upload une image pour un type de support / Upload image for a support type."""
    st = await db.get(SupportType, support_type_id)
    if not st:
        raise HTTPException(status_code=404, detail="Support type not found")

    # Valider extension / Validate extension
    ext = Path(file.filename or "").suffix.lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail=f"Format non autorise. Formats acceptes: {', '.join(ALLOWED_EXTENSIONS)}")

    # Lire et valider taille / Read and validate size
    content = await file.read()
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail="Fichier trop volumineux (max 2 Mo)")

    # Supprimer ancienne image / Delete old image
    if st.image_path:
        old_path = Path(st.image_path)
        if old_path.exists():
            old_path.unlink()

    # Sauvegarder / Save
    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    safe_name = f"{support_type_id}{ext}"
    file_path = UPLOAD_DIR / safe_name
    file_path.write_bytes(content)

    st.image_path = str(file_path)
    await db.flush()
    await db.refresh(st)
    return st


@router.get("/{support_type_id}/image")
async def get_support_type_image(
    support_type_id: int,
    db: AsyncSession = Depends(get_db),
):
    """Telecharger l'image d'un type de support (public) / Download support type image (public, used by <img> tags)."""
    st = await db.get(SupportType, support_type_id)
    if not st or not st.image_path:
        raise HTTPException(status_code=404, detail="Image not found")

    file_path = Path(st.image_path)
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Image file not found on disk")

    return FileResponse(file_path)
