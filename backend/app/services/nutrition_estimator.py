"""营养估算引擎 — 基于小型内置规则库"""
import logging
from dataclasses import dataclass

logger = logging.getLogger(__name__)

# 每 100g 的营养值 (calories, protein, carbs, fat)
_NUTRITION_PER_100G: dict[str, tuple[float, float, float, float]] = {
    "米饭":     (116, 2.6,  25.9, 0.3),
    "白米饭":   (116, 2.6,  25.9, 0.3),
    "鸡胸肉":   (133, 31.0, 0.0,  1.2),
    "牛肉":     (250, 26.0, 0.0,  15.0),
    "猪肉":     (242, 27.0, 0.0,  14.0),
    "鸡蛋":     (144, 13.0, 1.0,  10.0),
    "鱼":       (105, 18.0, 0.0,  3.0),
    "鱼肉":     (105, 18.0, 0.0,  3.0),
    "三文鱼":   (208, 20.0, 0.0,  13.0),
    "豆腐":     (76,  8.0,  1.9,  4.8),
    "西兰花":   (34,  2.8,  7.0,  0.4),
    "青菜":     (20,  1.7,  3.0,  0.3),
    "菠菜":     (23,  2.9,  3.6,  0.4),
    "番茄":     (18,  0.9,  3.9,  0.2),
    "胡萝卜":   (41,  0.9,  10.0, 0.2),
    "白菜":     (13,  1.5,  2.2,  0.2),
    "生菜":     (15,  1.4,  2.9,  0.2),
    "土豆":     (77,  2.0,  17.0, 0.1),
    "面条":     (138, 4.5,  28.0, 0.7),
    "馒头":     (223, 7.0,  44.0, 1.0),
    "面包":     (265, 9.0,  49.0, 3.2),
    "汉堡":     (295, 17.0, 32.0, 12.0),
    "薯条":     (312, 3.4,  41.0, 15.0),
    "炸鸡":     (290, 24.0, 12.0, 17.0),
    "奶茶":     (70,  0.8,  12.0, 2.0),
    "咖啡":     (1,   0.1,  0.0,  0.0),
    "可乐":     (42,  0.0,  10.6, 0.0),
    "果汁":     (45,  0.7,  10.0, 0.2),
    "薯片":     (536, 7.0,  53.0, 34.0),
    "饼干":     (433, 6.0,  63.0, 17.0),
    "蛋糕":     (350, 4.0,  45.0, 16.0),
    "冰淇淋":   (207, 3.5,  24.0, 11.0),
}

# 按份估算 (per serving)
_SERVING_NUTRITION: dict[str, tuple[float, float, float, float, str]] = {
    "鸡胸肉饭": (520, 36.0, 65.0, 12.0, "1份"),
    "牛肉饭":   (650, 40.0, 70.0, 18.0, "1份"),
    "便当":     (600, 30.0, 65.0, 20.0, "1份"),
    "套餐":     (650, 35.0, 70.0, 22.0, "1份"),
}


@dataclass
class NutritionEstimate:
    calories: int = 0
    protein: int = 0
    carbs: int = 0
    fat: int = 0
    estimated: bool = True
    confidence: float = 0.0
    source: str = "rule"


def _fuzzy_match(food_name: str) -> str | None:
    """模糊匹配食物名称"""
    if not food_name:
        return None
    # 精确匹配
    if food_name in _NUTRITION_PER_100G:
        return food_name
    if food_name in _SERVING_NUTRITION:
        return food_name
    # 子串匹配
    for key in _NUTRITION_PER_100G:
        if key in food_name or food_name in key:
            return key
    for key in _SERVING_NUTRITION:
        if key in food_name or food_name in key:
            return key
    return None


def estimate_nutrition(
    food_name: str,
    weight_g: int = 0,
    estimated_weight: str = "",
) -> NutritionEstimate:
    """估算单个食物的营养数据

    Args:
        food_name: 食物名称
        weight_g: 克数（0 表示未知）
        estimated_weight: 估重文本（如 "约150g"）

    Returns:
        NutritionEstimate
    """
    if not food_name or not food_name.strip():
        return NutritionEstimate(confidence=0.0)

    food_name = food_name.strip()

    # 先查按份估算（优先级更高）
    if food_name in _SERVING_NUTRITION:
        cal, pro, carb, fat, _ = _SERVING_NUTRITION[food_name]
        return NutritionEstimate(
            calories=int(cal), protein=int(pro), carbs=int(carb), fat=int(fat),
            confidence=0.6, estimated=True, source="rule-serving",
        )

    # 再查模糊匹配 serving
    for key in _SERVING_NUTRITION:
        if key in food_name:
            cal, pro, carb, fat, _ = _SERVING_NUTRITION[key]
            return NutritionEstimate(
                calories=int(cal), protein=int(pro), carbs=int(carb), fat=int(fat),
                confidence=0.55, estimated=True, source="rule-fuzzy-serving",
            )

    # 查每 100g 规则
    matched_key = _fuzzy_match(food_name)
    matched_100g = matched_key in _NUTRITION_PER_100G if matched_key else False

    if matched_100g:
        cal, pro, carb, fat = _NUTRITION_PER_100G[matched_key]
        conf = 0.7 if matched_key == food_name else 0.5
        if weight_g > 0:
            factor = weight_g / 100.0
            cal *= factor
            pro *= factor
            carb *= factor
            fat *= factor
            conf = min(conf + 0.1, 0.95)
        return NutritionEstimate(
            calories=int(cal), protein=int(pro), carbs=int(carb), fat=int(fat),
            confidence=conf, estimated=True, source="rule-100g",
        )

    if matched_key in _SERVING_NUTRITION:
        cal, pro, carb, fat, _ = _SERVING_NUTRITION[matched_key]
        return NutritionEstimate(
            calories=int(cal), protein=int(pro), carbs=int(carb), fat=int(fat),
            confidence=0.5, estimated=True, source="rule-fuzzy",
        )

    # 未找到
    logger.info("nutrition_estimator: unknown food=%s", food_name)
    return NutritionEstimate(confidence=0.0)
