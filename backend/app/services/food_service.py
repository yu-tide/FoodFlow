import logging
import time
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import async_session
from app.models.analyze_task import AnalyzeTask
from app.models.food_item import FoodItem
from app.models.food_record import FoodRecord
from app.models.task_event import TaskEvent
from app.services.ai_service import generate_summary
from app.services.food_parser import parse_ocr_text
from app.services.fusion_service import fuse
from app.services.ocr_service import _image_url_to_path, recognize_image_text, MOCK_OCR_TEXT
from app.services.vision_service import recognize_food_from_image

logger = logging.getLogger(__name__)

STAGES = [
    ("UPLOADED", 10, 9, "图片上传完成"),
    ("OCR_PROCESSING", 25, 8, "正在识别图片内容"),
    ("OCR_SUCCESS", 40, 6, "识别完成"),
    ("STRUCTURING", 55, 5, "正在结构化食物信息"),
    ("CALCULATING", 75, 3, "正在计算营养素"),
    ("AI_SUMMARIZING", 90, 2, "正在生成饮食建议"),
]

MOCK_SUMMARY = "这餐蛋白质摄入较好。\n碳水适中，适合作为午餐。\n建议增加蔬菜比例."

# food_items 仍是 mock 数据（后续将由 food parser / nutrition engine 替换）
MOCK_FOOD_ITEMS = [
    {"food_name": "米饭", "weight": "150g", "calories": 180, "protein": 4, "carbs": 40, "fat": 1},
    {"food_name": "鸡胸肉", "weight": "120g", "calories": 198, "protein": 36, "carbs": 0, "fat": 4},
    {"food_name": "西兰花", "weight": "100g", "calories": 35, "protein": 3, "carbs": 7, "fat": 0},
    {"food_name": "鸡蛋", "weight": "1个", "calories": 78, "protein": 6, "carbs": 1, "fat": 5},
]


def _now() -> str:
    return datetime.now(timezone.utc).strftime("%H:%M")


async def _get_task(db: AsyncSession, task_id: str) -> AnalyzeTask:
    result = await db.execute(select(AnalyzeTask).where(AnalyzeTask.id == task_id))
    return result.scalar_one()


async def _update_task_status(
    db: AsyncSession, task_id: str, status: str, progress_percent: int, eta_seconds: int
) -> None:
    task = await _get_task(db, task_id)
    task.status = status
    task.progress_percent = progress_percent
    task.eta_seconds = eta_seconds
    await db.commit()


async def _add_task_event(db: AsyncSession, task_id: str, title: str) -> None:
    event = TaskEvent(task_id=task_id, time=_now(), title=title)
    db.add(event)
    await db.commit()


async def _create_food_record(
    db: AsyncSession, task_id: str, user_id: str, meal_type: str, remark: str, image_url: str,
    ocr_text: str | None = None,
    ocr_engine: str = "mock",
    ai_summary: str | None = None,
    ai_latency: str = "2.4s",
    ai_engine: str = "",
) -> FoodRecord:
    if ocr_text is None:
        ocr_text = MOCK_OCR_TEXT
    summary = ai_summary or MOCK_SUMMARY
    prompt_ver = f"{ocr_engine}-ocr-v1"
    if ai_engine:
        prompt_ver += f"+{ai_engine}"
    record = FoodRecord(
        user_id=user_id,
        task_id=task_id,
        meal_type=meal_type,
        image_url=image_url,
        remark=remark,
        ocr_text=ocr_text,
        total_calories=680,
        protein=48,
        carbohydrate=72,
        fat=18,
        target_calories=2000,
        status_label="分析完成",
        summary=summary,
        prompt_version=prompt_ver[:50],
        ai_latency=ai_latency,
        cache_hit=False,
    )
    db.add(record)
    await db.flush()
    return record


async def _create_food_items(db: AsyncSession, record_id: str) -> None:
    for i, item in enumerate(MOCK_FOOD_ITEMS, start=1):
        db.add(FoodItem(
            record_id=record_id,
            food_name=item["food_name"],
            weight=item["weight"],
            calories=item["calories"],
            protein=item["protein"],
            carbs=item["carbs"],
            fat=item["fat"],
            sort_order=i,
        ))
    await db.commit()


async def _complete_task(db: AsyncSession, task_id: str, record_id: str) -> None:
    logger.info("_complete_task: task_id=%s record_id=%s", task_id, record_id)
    task = await _get_task(db, task_id)
    task.status = "SUCCESS"
    task.progress_percent = 100
    task.eta_seconds = 0
    task.record_id = record_id
    await _add_task_event(db, task_id, "分析完成")
    await db.commit()
    logger.info("_complete_task: commited, task.record_id=%s", task.record_id)


async def _fail_task(db: AsyncSession, task_id: str, error_message: str) -> None:
    task = await _get_task(db, task_id)
    task.status = "FAILED"
    task.error_message = error_message
    await db.commit()
    await _add_task_event(db, task_id, "分析失败")


async def run_mock_analysis(task_id: str, meal_type: str, remark: str | None = None) -> None:
    """执行分析 pipeline（mock 或 paddle OCR）。由 Celery 任务通过 asyncio.run() 调用。"""
    async with async_session() as db:
        remark = remark or ""

        # 先获取 task 拿到 user_id 和 image_url
        task = await _get_task(db, task_id)
        ocr_text: str | None = None
        ocr_engine = "mock"
        parser_result = None
        fusion_result = None
        ai_engine = ""
        ai_summary_text: str | None = None
        ai_latency_val = "2.4s"
        image_path = _image_url_to_path(task.image_url)

        for status, progress, eta, event_title in STAGES:
            await _update_task_status(db, task_id, status, progress, eta)
            await _add_task_event(db, task_id, event_title)
            logger.info("task=%s stage=%s progress=%s%%", task_id, status, progress)

            # OCR_PROCESSING: OCR (空文本不中断，让 vision 补偿)
            if status == "OCR_PROCESSING":
                ocr_result = recognize_image_text(task.image_url)
                ocr_text = ocr_result.text if ocr_result.success else ""
                ocr_engine = ocr_result.engine
                if not ocr_result.success:
                    logger.warning("task=%s OCR failed: %s (will try vision)", task_id, ocr_result.error_message)
                logger.info("task=%s OCR engine=%s text_len=%d", task_id, ocr_engine, len(ocr_text or ""))

            # STRUCTURING: 解析 OCR → 有则 parser
            if status == "STRUCTURING":
                if ocr_text and ocr_text != MOCK_OCR_TEXT:
                    parser_result = parse_ocr_text(ocr_text)
                    logger.info("task=%s parser success=%s items=%d",
                                task_id, parser_result.success, len(parser_result.items))
                # 同时调用 Vision
                if image_path:
                    vision_result = recognize_food_from_image(image_path, ocr_text)
                else:
                    vision_result = None
                # 融合 OCR + Vision
                fusion_result = fuse(ocr_text=ocr_text, parser_result=parser_result, vision_result=vision_result)
                logger.info("task=%s fusion source=%s items=%d warning=%s",
                            task_id, fusion_result.source, len(fusion_result.items), fusion_result.warning or "none")

            # AI_SUMMARIZING 阶段调用大模型
            if status == "AI_SUMMARIZING":
                cal = fusion_result.items[0].calories if fusion_result and fusion_result.items else 0
                pro = fusion_result.items[0].protein if fusion_result and fusion_result.items else 0
                carb = fusion_result.items[0].carbs if fusion_result and fusion_result.items else 0
                fat = fusion_result.items[0].fat if fusion_result and fusion_result.items else 0
                food = fusion_result.items[0].food_name if fusion_result and fusion_result.items else ""
                ai_result = generate_summary(
                    food_name=food,
                    total_calories=cal, protein=pro, carbs=carb, fat=fat,
                    meal_type=meal_type, remark=remark, ocr_text=ocr_text or "",
                )
                ai_summary_text = ai_result.text
                ai_latency_val = ai_result.latency
                ai_engine = ai_result.engine
                logger.info("task=%s AI engine=%s latency=%s", task_id, ai_engine, ai_latency_val)

            time.sleep(1)  # 开发环境模拟延迟

        # prompt_version 标记
        source_tag = fusion_result.source if fusion_result else "unknown"
        prompt_ver = f"{ocr_engine}-ocr+{source_tag}+{ai_engine}" if ai_engine else f"{ocr_engine}-ocr+{source_tag}"
        prompt_ver = prompt_ver[:50]

        record = await _create_food_record(
            db, task_id, str(task.user_id), meal_type, remark, task.image_url or "",
            ocr_text=ocr_text,
            ocr_engine=ocr_engine,
            ai_summary=ai_summary_text,
            ai_latency=ai_latency_val,
            ai_engine=ai_engine,
        )

        # 使用 fusion 结果写入 food_items 和覆盖营养
        if fusion_result and fusion_result.items:
            fused = fusion_result.items[0]
            record.total_calories = fused.calories
            record.protein = fused.protein
            record.carbohydrate = fused.carbs
            record.fat = fused.fat
            record.prompt_version = prompt_ver
            await db.commit()

            for i, item in enumerate(fusion_result.items, start=1):
                db.add(FoodItem(
                    record_id=record.id,
                    food_name=item.food_name,
                    category=item.category,
                    weight=item.weight,
                    calories=item.calories,
                    protein=item.protein,
                    carbs=item.carbs,
                    fat=item.fat,
                    confidence=item.confidence,
                    source=item.source,
                    estimated=item.estimated,
                    sort_order=i,
                ))
            await db.commit()
            logger.info("task=%s fusion items=%d cal=%d pro=%d fat=%d carb=%d source=%s",
                        task_id, len(fusion_result.items),
                        fused.calories, fused.protein, fused.carbs, fused.fat, fusion_result.source)
        elif parser_result and parser_result.success:
            # fallback: 旧 OCR-only 路径（兼容）
            record.total_calories = parser_result.total_calories
            record.protein = parser_result.total_protein
            record.carbohydrate = parser_result.total_carbs
            record.fat = parser_result.total_fat
            record.prompt_version = prompt_ver
            await db.commit()
            for i, item in enumerate(parser_result.items, start=1):
                db.add(FoodItem(
                    record_id=record.id,
                    food_name=item.food_name,
                    category=item.category,
                    weight=item.weight,
                    calories=item.calories,
                    protein=item.protein,
                    carbs=item.carbs,
                    fat=item.fat,
                    sort_order=i,
                ))
            await db.commit()
        elif fusion_result and fusion_result.warning:
            # 都失败
            logger.warning("task=%s fusion warning: %s", task_id, fusion_result.warning)
            await _create_food_items(db, str(record.id))
        else:
            await _create_food_items(db, str(record.id))

        await _complete_task(db, task_id, str(record.id))
        logger.info("task=%s SUCCESS record=%s prompt=%s", task_id, record.id, record.prompt_version)


MOCK_MACRO_TARGETS = {"protein": 120, "carbs": 250, "fat": 70}


async def get_food_detail(db: AsyncSession, record_id: str) -> dict:
    """查询 FoodRecord 详情，包含 items、AI 日志、宏量营养素对比。"""
    from sqlalchemy import select

    record_result = await db.execute(
        select(FoodRecord).where(FoodRecord.id == record_id)
    )
    record = record_result.scalar_one()

    items_result = await db.execute(
        select(FoodItem)
        .where(FoodItem.record_id == record_id)
        .order_by(FoodItem.sort_order.asc())
    )
    food_items = items_result.scalars().all()

    macro_targets = dict(MOCK_MACRO_TARGETS)
    macro_percentages = {
        "protein": round(record.protein / macro_targets["protein"] * 100),
        "carbs": round(record.carbohydrate / macro_targets["carbs"] * 100),
        "fat": round(record.fat / macro_targets["fat"] * 100),
    }

    return {
        "record": {
            "id": str(record.id),
            "status_label": record.status_label,
            "total_calories": record.total_calories,
            "protein": record.protein,
            "carbohydrate": record.carbohydrate,
            "fat": record.fat,
            "target_calories": record.target_calories,
            "image_url": record.image_url,
            "created_at": record.created_at,
            "summary": record.summary,
            "ocr_text": record.ocr_text,
        },
        "food_items": [
            {
                "id": str(item.id),
                "food_name": item.food_name,
                "weight": item.weight,
                "calories": item.calories,
                "protein": item.protein,
                "carbohydrate": item.carbs,  # DB: carbs → API: carbohydrate
                "fat": item.fat,
                "image_url": item.image_url,
            }
            for item in food_items
        ],
        "ai_log": {
            "prompt_version": record.prompt_version,
            "latency": record.ai_latency,
            "cache_hit": record.cache_hit,
        },
        "macro_targets": macro_targets,
        "macro_percentages": macro_percentages,
    }


async def confirm_food_record(
    db: AsyncSession,
    record_id: str,
    user_id: str,
    items: list[dict],
) -> FoodRecord:
    """用户确认/修改识别结果"""
    # 查 record 并校验权限
    result = await db.execute(select(FoodRecord).where(FoodRecord.id == record_id))
    record = result.scalar_one_or_none()
    if record is None or str(record.user_id) != user_id:
        raise ValueError("记录不存在或无权访问")

    # 删除旧 food_items
    old_items = await db.execute(select(FoodItem).where(FoodItem.record_id == record_id))
    for old in old_items.scalars().all():
        await db.delete(old)
    await db.flush()

    # 写入新 items
    total_cal = total_pro = total_carb = total_fat = 0
    for i, item in enumerate(items, start=1):
        db.add(FoodItem(
            record_id=record.id,
            food_name=item.get("food_name", ""),
            weight=item.get("weight", ""),
            category=item.get("category", "unknown"),
            calories=item.get("calories", 0),
            protein=item.get("protein", 0),
            carbs=item.get("carbs", 0),
            fat=item.get("fat", 0),
            confidence=1.0,
            source="manual",
            estimated=False,
            sort_order=i,
        ))
        total_cal += item.get("calories", 0)
        total_pro += item.get("protein", 0)
        total_carb += item.get("carbs", 0)
        total_fat += item.get("fat", 0)

    # 更新 food_record 汇总
    record.total_calories = total_cal
    record.protein = total_pro
    record.carbohydrate = total_carb
    record.fat = total_fat
    record.status_label = "用户已确认"

    await db.commit()
    await db.refresh(record)
    return record
