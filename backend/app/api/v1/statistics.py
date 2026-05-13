from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_db, get_optional_current_user
from app.models.user import User
from app.services.statistics_service import get_mock_weekly_stats, get_weekly_stats

router = APIRouter(prefix="/statistics", tags=["每周统计"])


@router.get("/weekly")
async def weekly_statistics(
    current_user: User | None = Depends(get_optional_current_user),
    db: AsyncSession = Depends(get_db),
):
    if current_user is not None:
        return await get_weekly_stats(db, current_user)
    return get_mock_weekly_stats()
