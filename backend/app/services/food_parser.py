"""Food Parser — 从 OCR 文本中解析食物名称和营养素

支持的格式（顿号分隔或换行分隔）:
    鸡胸肉饭、热量 520 kcal、蛋白质 36 g、脂肪 12 g、碳水 65 g
    鸡胸肉饭
    热量 520 kcal
    蛋白质 36 g
    脂肪 12 g
    碳水 65 g
"""
import logging
import re
from dataclasses import dataclass, field

logger = logging.getLogger(__name__)


@dataclass
class ParsedFoodItem:
    food_name: str = ""
    weight: str = "1份"
    calories: int = 0
    protein: int = 0
    fat: int = 0
    carbs: int = 0


@dataclass
class ParseResult:
    items: list[ParsedFoodItem] = field(default_factory=list)
    success: bool = False
    engine: str = "rule"  # "rule" | "mock-fallback"
    total_calories: int = 0
    total_protein: int = 0
    total_fat: int = 0
    total_carbs: int = 0


# ── regex patterns ──
_CALORIE_RE = re.compile(
    r"(?:热量|卡路里|能量|kcal|calorie)[:\s]*(\d+)\s*(?:kcal|千卡|大卡)?",
    re.IGNORECASE,
)
_PROTEIN_RE = re.compile(
    r"(?:蛋白质|蛋白)[:\s]*(\d+)\s*(?:g|克)?",
    re.IGNORECASE,
)
_FAT_RE = re.compile(
    r"(?:脂肪)[:\s]*(\d+)\s*(?:g|克)?",
    re.IGNORECASE,
)
_CARB_RE = re.compile(
    r"(?:碳水|碳水化合物|carbs|carbohydrate)[:\s]*(\d+)\s*(?:g|克)?",
    re.IGNORECASE,
)

# 重量提取
_WEIGHT_RE = re.compile(r"(\d+)\s*(?:g|克|份|个|碗)", re.IGNORECASE)

# 分隔符
_SEP = re.compile(r"[、，,;\n；]+")


def _normalize_text(text: str) -> str:
    """全角→半角转换 + 分隔符统一 + 空白压缩"""
    text = text.replace("：", ":")       # 全角冒号 → 半角
    text = text.replace("　", " ")        # 全角空格
    text = text.replace("、", " ")       # CJK 顿号 → 空格（关键：OCR 用顿号分隔，正则需跨越）
    text = re.sub(r"\s+", " ", text)     # 多空白压缩
    return text.strip()


def _parse_int(text: str, pattern: re.Pattern) -> int:
    m = pattern.search(text)
    if m:
        try:
            return int(m.group(1))
        except ValueError:
            return 0
    return 0


def _parse_data_from_text(text: str) -> ParsedFoodItem:
    """从一段文本中提取所有营养数据"""
    cal = _parse_int(text, _CALORIE_RE)
    pro = _parse_int(text, _PROTEIN_RE)
    fat = _parse_int(text, _FAT_RE)
    carb = _parse_int(text, _CARB_RE)
    logger.debug("parser raw: cal=%d pro=%d fat=%d carb=%d text=%s", cal, pro, fat, carb, text[:100])
    return ParsedFoodItem(calories=cal, protein=pro, fat=fat, carbs=carb)


def _extract_food_name(text: str) -> str:
    """从 OCR 文本中提取食物名称（取第一段不含数字和营养关键词的纯中文）"""
    # 按分隔符拆分，如果归一化后没有分隔符则按空格拆
    parts = [p.strip() for p in _SEP.split(text) if p.strip()]
    if len(parts) <= 1:
        parts = text.split()

    for part in parts:
        part = part.strip()
        if not part or len(part) < 2:
            continue
        # 跳过纯数字或营养素行
        if re.match(r"^[\d\s.kcalg白蛋碳水脂肪路里质肪]+$", part, re.IGNORECASE):
            continue
        # 跳过以营养关键词开头的行
        if re.match(r"^(热量|蛋白质|脂肪|碳水|卡路里|能量|kcal|g\b|\d)", part, re.IGNORECASE):
            continue
        return part[:50]
    return ""


def _extract_weight(text: str) -> str:
    m = _WEIGHT_RE.search(text)
    return m.group(0) if m else "1份"


def parse_ocr_text(ocr_text: str) -> ParseResult:
    """从 OCR 文本中解析食物项目和营养数据。

    返回 ParseResult，success=True 表示至少解析到一个食物项目。
    """
    if not ocr_text or not ocr_text.strip():
        logger.warning("food_parser: empty ocr_text")
        return ParseResult(success=False)

    ocr_text = _normalize_text(ocr_text)
    logger.info("food_parser: ocr_text=%s", repr(ocr_text[:120]))

    # 按分隔符拆成段落
    parts = [p.strip() for p in _SEP.split(ocr_text) if p.strip()]
    logger.info("food_parser: parts=%d", len(parts))

    # 策略 A: 整体解析 → 一个食物项
    food_name = _extract_food_name(ocr_text)
    item = _parse_data_from_text(ocr_text)
    item.food_name = food_name or "未识别食物"
    item.weight = _extract_weight(ocr_text)

    # success: 至少提取到 calories，或 protein+carbs 都有值
    has_nutrition = item.calories > 0 or (item.protein > 0 and item.carbs > 0)

    result = ParseResult(
        items=[item],
        success=has_nutrition,
        engine="rule" if has_nutrition else "mock-fallback",
        total_calories=item.calories,
        total_protein=item.protein,
        total_fat=item.fat,
        total_carbs=item.carbs,
    )
    logger.info("food_parser: name=%s cal=%d pro=%d fat=%d carb=%d success=%s",
                item.food_name, item.calories, item.protein, item.fat, item.carbs, has_nutrition)
    return result

