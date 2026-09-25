"""Shopping items routes with strict user isolation, idempotency, and optimistic locking."""

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from backend.api.dependencies import get_current_user
from backend.api.schemas import (
    BatchCreateItemsRequest,
    CreateItemRequest,
    ShoppingItemResponse,
    ToggleItemRequest,
    UpdateItemRequest,
)
from backend.database.engine import get_db
from backend.database.models import User
from backend.repositories.item_repository import ItemNotFoundError, OptimisticLockError
from backend.services.item_service import ItemService

router = APIRouter(prefix="/api/v1/items", tags=["Shopping Items"])


@router.get("", response_model=list[ShoppingItemResponse])
async def list_items(
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
):
    """Retrieve all active shopping items for the authenticated user."""
    service = ItemService(session)
    return await service.list_items(user.id)


@router.post("", response_model=ShoppingItemResponse)
async def create_item(
    item_data: CreateItemRequest,
    response: Response,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
):
    """Create a shopping item with idempotency support via client_mutation_id."""
    service = ItemService(session)
    item, created = await service.create_item(user.id, item_data)
    response.status_code = status.HTTP_201_CREATED if created else status.HTTP_200_OK
    return item


@router.post("/batch", response_model=list[ShoppingItemResponse], status_code=status.HTTP_201_CREATED)
async def batch_create_items(
    batch_data: BatchCreateItemsRequest,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
):
    """Add multiple items at once (e.g. after AI parse selection)."""
    service = ItemService(session)
    return await service.batch_create(user.id, batch_data.items)


@router.patch("/{item_id}", response_model=ShoppingItemResponse)
async def update_item(
    item_id: str,
    update_data: UpdateItemRequest,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
):
    """Update item with optimistic concurrency check (version)."""
    service = ItemService(session)
    try:
        return await service.update_item(user.id, item_id, update_data)
    except ItemNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error": {"code": "ITEM_NOT_FOUND", "message": "Item not found"}},
        )
    except OptimisticLockError as e:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "error": {
                    "code": "VERSION_CONFLICT",
                    "message": "Item was updated by another request. Please refresh.",
                }
            },
        )


@router.patch("/{item_id}/toggle", response_model=ShoppingItemResponse)
async def toggle_purchased(
    item_id: str,
    toggle_data: ToggleItemRequest,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
):
    """Toggle purchased state with optimistic concurrency check (version)."""
    service = ItemService(session)
    try:
        return await service.toggle_purchased(user.id, item_id, toggle_data.version)
    except ItemNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error": {"code": "ITEM_NOT_FOUND", "message": "Item not found"}},
        )
    except OptimisticLockError:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "error": {
                    "code": "VERSION_CONFLICT",
                    "message": "Item was updated by another request. Please refresh.",
                }
            },
        )


@router.delete("/{item_id}", response_model=ShoppingItemResponse)
async def delete_item(
    item_id: str,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
):
    """Soft delete item (allows undo without data loss)."""
    service = ItemService(session)
    try:
        return await service.soft_delete(user.id, item_id)
    except ItemNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error": {"code": "ITEM_NOT_FOUND", "message": "Item not found"}},
        )


@router.post("/{item_id}/restore", response_model=ShoppingItemResponse)
async def restore_item(
    item_id: str,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
):
    """Restore a previously soft-deleted item (Undo action)."""
    service = ItemService(session)
    try:
        return await service.restore_item(user.id, item_id)
    except ItemNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error": {"code": "ITEM_NOT_FOUND", "message": "Item not found"}},
        )


@router.post("/clear-purchased")
async def clear_purchased(
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
):
    """Soft-delete all purchased items. Keeps purchased_at for accurate monthly spending stats."""
    service = ItemService(session)
    count = await service.clear_purchased(user.id)
    return {"cleared_count": count}
