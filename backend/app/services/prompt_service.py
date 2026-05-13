"""AI Prompt 构建服务"""

MEAL_LABELS = {
    "breakfast": "早餐",
    "lunch": "午餐",
    "dinner": "晚餐",
    "snack": "加餐",
}

SYSTEM_MESSAGE = {
    "role": "system",
    "content": (
        "你是一名专业营养师，请根据用户的餐食识别结果生成简洁、可靠的饮食建议。"
        "输出 3 条建议，每条 1-2 句话，用换行分隔。不要 markdown。不要虚构食物。"
        "如果数据有限，说明'基于当前识别数据'。只输出建议内容。"
    ),
}


def build_user_message(
    *,
    food_name: str = "",
    meal_type: str = "",
    total_calories: int = 0,
    protein: int = 0,
    carbs: int = 0,
    fat: int = 0,
    ocr_text: str = "",
    remark: str = "",
) -> dict:
    meal_label = MEAL_LABELS.get(meal_type, meal_type or "未知")
    content = (
        f"请根据以下餐食数据生成 3 条中文建议。\n\n"
        f"食物名称：{food_name or '未识别'}\n"
        f"餐别：{meal_label}\n"
        f"热量：{total_calories} kcal\n"
        f"蛋白质：{protein}g\n"
        f"碳水：{carbs}g\n"
        f"脂肪：{fat}g\n"
        f"OCR 识别文本：{ocr_text or '无'}\n"
        f"用户备注：{remark or '无'}"
    )
    return {"role": "user", "content": content}


FALLBACK_SUMMARY = "\n".join([
    "这餐营养搭配基本合理，建议继续保持。",
    "可适当增加蔬菜摄入，提高膳食纤维比例。",
    "注意控制总热量，避免高油高盐烹饪方式。",
])
