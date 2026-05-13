import asyncio
import logging

from app.worker import celery_app

logger = logging.getLogger(__name__)


@celery_app.task(name="analyze_food_image", bind=True, max_retries=3)
def analyze_food_image(self, task_id: str, meal_type: str, remark: str | None = None):
    """AI 分析食物图片的异步任务（Mock 实现）。

    7 阶段推进并在 SUCCESS 时写入 FoodRecord + FoodItems。
    Celery 不可用时 task_service 端有 try/except 降级保护。
    """
    try:
        from app.services.food_service import run_mock_analysis

        asyncio.run(run_mock_analysis(task_id, meal_type, remark))
    except Exception as exc:
        logger.exception("Task %s failed: %s", task_id, exc)

        try:
            from app.services.food_service import _fail_task, _get_task
            from app.db.session import async_session

            async def _mark_failed():
                async with async_session() as db:
                    await _fail_task(db, task_id, str(exc))

            asyncio.run(_mark_failed())
        except Exception as inner:
            logger.error("Failed to mark task %s as FAILED: %s", task_id, inner)

        raise
