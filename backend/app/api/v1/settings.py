from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user, get_db
from app.models.user import User

router = APIRouter(prefix="/users", tags=["用户设置"])


class UserSettingsResponse(BaseModel):
    target_calories: int = 2000
    target_protein: int | None = None
    target_carbs: int | None = None
    target_fat: int | None = None
    goal_type: str = "maintain"


class UserSettingsUpdate(BaseModel):
    target_calories: int | None = None
    target_protein: int | None = None
    target_carbs: int | None = None
    target_fat: int | None = None
    goal_type: str | None = None


@router.get("/me/settings")
async def get_settings(
    current_user: User = Depends(get_current_user),
):
    return UserSettingsResponse(
        target_calories=current_user.target_calories or 2000,
        target_protein=current_user.target_protein,
        target_carbs=current_user.target_carbs,
        target_fat=current_user.target_fat,
        goal_type=current_user.goal_type or "maintain",
    )


@router.patch("/me/settings")
async def update_settings(
    body: UserSettingsUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if body.target_calories is not None:
        current_user.target_calories = body.target_calories
    if body.target_protein is not None:
        current_user.target_protein = body.target_protein
    if body.target_carbs is not None:
        current_user.target_carbs = body.target_carbs
    if body.target_fat is not None:
        current_user.target_fat = body.target_fat
    if body.goal_type is not None:
        current_user.goal_type = body.goal_type

    await db.commit()
    await db.refresh(current_user)

    return UserSettingsResponse(
        target_calories=current_user.target_calories or 2000,
        target_protein=current_user.target_protein,
        target_carbs=current_user.target_carbs,
        target_fat=current_user.target_fat,
        goal_type=current_user.goal_type or "maintain",
    )
