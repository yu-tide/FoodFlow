"""AI 营养总结服务 — mock / bailian / fallback"""
import logging
import time
from dataclasses import dataclass

from app.core.config import settings
from app.services.prompt_service import (
    FALLBACK_SUMMARY,
    SYSTEM_MESSAGE,
    build_user_message,
)

logger = logging.getLogger(__name__)

MOCK_SUMMARY = FALLBACK_SUMMARY


@dataclass
class AISummaryResult:
    text: str
    engine: str
    latency: str
    success: bool
    fallback_reason: str | None = None


def _generate_fallback(
    total_calories: int,
    protein: int,
    carbs: int,
    fat: int,
    reason: str,
) -> AISummaryResult:
    """规则 fallback — 根据营养数据动态生成建议"""
    lines = []
    if protein >= 30:
        lines.append(f"蛋白质摄入 {protein}g，较充足，适合作为正餐。")
    elif protein > 0:
        lines.append(f"蛋白质 {protein}g，可增加鸡蛋、鱼肉或豆制品。")

    if carbs > protein * 1.5 and protein > 0:
        lines.append("碳水占比较高，建议搭配蔬菜或控制主食量。")
    elif carbs > 0:
        lines.append("碳水摄入适中，整体搭配较均衡。")

    if fat <= 15 and fat > 0:
        lines.append("脂肪摄入相对适中，继续保持。")
    elif fat > 15:
        lines.append(f"脂肪 {fat}g，注意减少油炸食品比例。")

    if total_calories <= 600 and total_calories > 0:
        lines.append(f"总热量 {total_calories} kcal，较为适中。")
    elif total_calories > 600:
        lines.append(f"总热量 {total_calories} kcal，偏高，可适当减少分量。")

    if not lines:
        lines = FALLBACK_SUMMARY.split("\n")

    logger.info("ai_service: fallback reason=%s lines=%d", reason, len(lines))
    return AISummaryResult(
        text="\n".join(lines),
        engine="ai-fallback-v1",
        latency="0.0s",
        success=True,
        fallback_reason=reason,
    )


def _call_bailian(messages: list[dict]) -> AISummaryResult:
    """调用阿里云百炼"""
    if not settings.BAILIAN_API_KEY:
        return _generate_fallback(0, 0, 0, 0, "BAILIAN_API_KEY missing")

    try:
        from openai import OpenAI
    except ImportError:
        return _generate_fallback(0, 0, 0, 0, "openai package not installed")

    t0 = time.time()
    try:
        client = OpenAI(
            api_key=settings.BAILIAN_API_KEY,
            base_url=settings.BAILIAN_BASE_URL,
        )
        response = client.chat.completions.create(
            model=settings.BAILIAN_MODEL,
            messages=messages,
            temperature=0.4,
            timeout=settings.AI_TIMEOUT_SECONDS,
        )
        content = response.choices[0].message.content
        elapsed = time.time() - t0

        if not content or not content.strip():
            return _generate_fallback(0, 0, 0, 0, "bailian returned empty content")

        logger.info("ai_service: bailian model=%s latency=%.1fs len=%d",
                     settings.BAILIAN_MODEL, elapsed, len(content))
        return AISummaryResult(
            text=content.strip(),
            engine="ai-bailian-v1",
            latency=f"{elapsed:.1f}s",
            success=True,
        )
    except Exception as e:
        elapsed = time.time() - t0
        logger.warning("ai_service: bailian failed after %.1fs: %s", elapsed, e)
        return _generate_fallback(0, 0, 0, 0, f"bailian error: {e}")


def generate_summary(
    *,
    food_name: str = "",
    total_calories: int = 0,
    protein: int = 0,
    carbs: int = 0,
    fat: int = 0,
    meal_type: str = "",
    remark: str = "",
    ocr_text: str = "",
) -> AISummaryResult:
    """统一入口"""
    if settings.AI_MODE == "bailian":
        messages = [
            SYSTEM_MESSAGE,
            build_user_message(
                food_name=food_name,
                meal_type=meal_type,
                total_calories=total_calories,
                protein=protein,
                carbs=carbs,
                fat=fat,
                ocr_text=ocr_text,
                remark=remark,
            ),
        ]
        return _call_bailian(messages)

    # mock 模式
    return AISummaryResult(
        text=MOCK_SUMMARY,
        engine="ai-mock-v1",
        latency="0.0s",
        success=True,
    )
