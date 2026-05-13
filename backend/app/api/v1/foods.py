import os
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, status, UploadFile
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.deps import get_current_user, get_db
from app.models.analyze_task import AnalyzeTask
from app.models.food_item import FoodItem
from app.models.food_record import FoodRecord
from app.models.task_event import TaskEvent
from app.models.user import User
from app.schemas.foods import (
    ConfirmFoodRequest,
    ConfirmFoodResponse,
    FoodDetailResponse,
    FoodListItem,
    FoodListItemDetail,
    FoodListResponse,
    VALID_MEAL_TYPES,
)
from app.services.food_service import confirm_food_record, get_food_detail
from app.services.upload_service import save_upload, validate_image_file
from app.services.task_service import create_analyze_task, dispatch_analyze_task

router = APIRouter(prefix="/foods", tags=["食物记录"])

MEAL_LABELS = {
    "breakfast": "早餐",
    "lunch": "午餐",
    "dinner": "晚餐",
    "snack": "加餐",
}


@router.post("/upload", status_code=201)
async def upload_food_image(
    meal_type: str = Form(...),
    # 兼容前端两个字段名: image / file
    image: Optional[UploadFile] = File(None),
    file: Optional[UploadFile] = File(None),
    # 兼容前端两个字段名: remark / note
    remark: str = Form(""),
    note: str = Form(""),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # 统一字段名
    upload_file = image or file
    if upload_file is None or upload_file.filename == "":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="请选择一张食物图片",
        )

    # 校验 meal_type
    if meal_type not in VALID_MEAL_TYPES:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"无效的餐别: {meal_type}，可选值: {', '.join(sorted(VALID_MEAL_TYPES))}",
        )

    # 校验图片文件
    try:
        validate_image_file(upload_file)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

    # 保存文件
    saved = await save_upload(upload_file, str(current_user.id))

    # 创建分析任务
    task = await create_analyze_task(
        db,
        user_id=str(current_user.id),
        filename=saved["filename"],
        image_url=saved["image_url"],
        file_size=saved["file_size"],
        image_format=saved["image_format"],
    )

    # 组合备注
    combined_remark = remark or note or ""

    # 推送 Celery（降级安全）
    dispatch_analyze_task(str(task.id), meal_type, combined_remark)

    return {"task_id": str(task.id)}


@router.get("/tasks/{task_id}")
async def get_task_status(
    task_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(AnalyzeTask).where(AnalyzeTask.id == task_id)
    )
    task = result.scalar_one_or_none()

    if task is None or str(task.user_id) != str(current_user.id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="任务不存在")

    events_result = await db.execute(
        select(TaskEvent)
        .where(TaskEvent.task_id == task.id)
        .order_by(TaskEvent.created_at.asc())
    )
    events = events_result.scalars().all()

    return {
        "task_id": str(task.id),
        "status": task.status,
        "progress_percent": task.progress_percent,
        "image_url": task.image_url,
        "filename": task.filename,
        "file_size": task.file_size,
        "image_format": task.image_format,
        "eta_seconds": task.eta_seconds,
        "error_message": task.error_message,
        "events": [{"time": e.time, "title": e.title} for e in events],
    }


@router.get("")
async def list_food_records(
    limit: Optional[int] = Query(None),
    range: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    stmt = (
        select(FoodRecord)
        .where(FoodRecord.user_id == current_user.id)
    )

    now = datetime.now(timezone.utc)
    today_start = datetime(now.year, now.month, now.day, tzinfo=timezone.utc)

    if range == "today":
        stmt = stmt.where(FoodRecord.created_at >= today_start)
    elif range == "yesterday":
        yesterday_start = today_start - timedelta(days=1)
        stmt = stmt.where(
            FoodRecord.created_at >= yesterday_start,
            FoodRecord.created_at < today_start,
        )
    elif range == "week":
        week_start = today_start - timedelta(days=6)
        stmt = stmt.where(FoodRecord.created_at >= week_start)

    stmt = stmt.order_by(FoodRecord.created_at.desc())

    if limit is not None:
        stmt = stmt.limit(limit)

    result = await db.execute(stmt)
    records = result.scalars().all()

    items = []
    for record in records:
        items_result = await db.execute(
            select(FoodItem)
            .where(FoodItem.record_id == record.id)
            .order_by(FoodItem.sort_order.asc())
        )
        food_items = items_result.scalars().all()

        created = record.created_at
        if created and created.tzinfo is None:
            created = created.replace(tzinfo=timezone.utc)
        time_str = created.strftime("%H:%M") if created else ""

        items.append(
            FoodListItem(
                id=str(record.id),
                meal_type=record.meal_type,
                title=MEAL_LABELS.get(record.meal_type, record.meal_type),
                time=time_str,
                total_calories=record.total_calories or 0,
                summary=record.summary,
                protein=record.protein or 0,
                carbohydrate=record.carbohydrate or 0,
                fat=record.fat or 0,
                image_url=record.image_url,
                foods=", ".join(item.food_name for item in food_items),
                food_items=[
                    FoodListItemDetail(food_name=item.food_name)
                    for item in food_items
                ],
            )
        )

    return FoodListResponse(data=items)


@router.get("/{record_id}")
async def get_food_detail_endpoint(
    record_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(FoodRecord).where(FoodRecord.id == record_id)
    )
    record = result.scalar_one_or_none()

    if record is None or str(record.user_id) != str(current_user.id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="记录不存在")

    detail = await get_food_detail(db, record_id)
    return FoodDetailResponse(data=detail)


@router.patch("/{record_id}/confirm")
async def confirm_food_record_endpoint(
    record_id: str,
    body: ConfirmFoodRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    try:
        record = await confirm_food_record(
            db, record_id, str(current_user.id),
            [item.model_dump() for item in body.items],
        )
        return ConfirmFoodResponse(record_id=str(record.id))
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))