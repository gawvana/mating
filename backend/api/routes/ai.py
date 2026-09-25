"""AI natural language parsing route."""

from fastapi import APIRouter, Depends, HTTPException, status

from backend.api.dependencies import get_current_user
from backend.api.schemas import AIParseRequest, AIParseResponse
from backend.database.models import User
from backend.services.ai_service import (
    AIError,
    AIRateLimitError,
    ai_service,
)

router = APIRouter(prefix="/api/v1/ai", tags=["AI Parsing"])


@router.post("/parse", response_model=AIParseResponse)
async def parse_shopping_text(
    payload: AIParseRequest,
    user: User = Depends(get_current_user),
):
    """Parse natural language shopping text into structured items.
    DOES NOT insert into database — only returns preview for user selection!
    """
    try:
        return await ai_service.parse_text(payload.text, user_id=user.id)
    except AIRateLimitError as e:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail={"error": {"code": e.code, "message": e.message}},
        )
    except AIError as e:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail={"error": {"code": e.code, "message": e.message}},
        )
