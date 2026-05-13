from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, field_validator

MEAL_TYPE_VALUES = Literal["breakfast", "lunch", "dinner", "snack"]
VALID_MEAL_TYPES = {"breakfast", "lunch", "dinner", "snack"}
VALID_IMAGE_TYPES = {"image/jpeg", "image/png", "image/jpg", "image/webp"}


class FoodUploadResponse(BaseModel):
    task_id: str


class FoodItemDetail(BaseModel):
    id: str
    food_name: str
    weight: str
    calories: int
    protein: int
    carbohydrate: int  # DB 字段 carbs，API 返回 carbohydrate
    fat: int
    image_url: Optional[str] = None


class FoodRecordDetail(BaseModel):
    id: str
    status_label: str
    total_calories: int
    protein: int
    carbohydrate: int
    fat: int
    target_calories: int
    image_url: Optional[str] = None
    created_at: Optional[datetime] = None
    summary: Optional[str] = None
    ocr_text: Optional[str] = None


class AiLogDetail(BaseModel):
    prompt_version: Optional[str] = None
    latency: Optional[str] = None
    cache_hit: bool = False


class MacroTargets(BaseModel):
    protein: int
    carbs: int
    fat: int


class MacroPercentages(BaseModel):
    protein: int
    carbs: int
    fat: int


class FoodDetailData(BaseModel):
    record: FoodRecordDetail
    food_items: list[FoodItemDetail]
    ai_log: AiLogDetail
    macro_targets: MacroTargets
    macro_percentages: MacroPercentages


class FoodDetailResponse(BaseModel):
    data: FoodDetailData


class FoodListItemDetail(BaseModel):
    food_name: str


class FoodListItem(BaseModel):
    id: str
    meal_type: str
    title: str
    time: str
    total_calories: int
    summary: Optional[str] = None
    protein: int
    carbohydrate: int
    fat: int
    image_url: Optional[str] = None
    foods: str = ""
    food_items: list[FoodListItemDetail] = []


class FoodListResponse(BaseModel):
    data: list[FoodListItem]