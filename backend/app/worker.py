from celery import Celery

from app.core.config import settings

celery_app = Celery(
    "foodflow",
    broker=settings.REDIS_URL,
    backend=settings.REDIS_URL,
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="Asia/Shanghai",
    enable_utc=True,
)

# 显式 import 任务模块，确保 worker 启动时加载所有任务
import app.tasks.analyze_food  # noqa: F401

# celery -A app.worker worker --loglevel=info -P solo
