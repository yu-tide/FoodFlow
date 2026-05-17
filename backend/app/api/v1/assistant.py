"""FoodFlow AI Assistant — Phase 1 mock endpoint."""
import uuid

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from app.core.deps import get_current_user
from app.models.user import User

router = APIRouter(prefix="/assistant", tags=["AI 助手"])


class ChatRequest(BaseModel):
    message: str
    page: str = ""
    page_context: dict = {}
    session_id: str | None = None
    history: list[dict] = []


class ChatResponse(BaseModel):
    answer: str
    session_id: str
    sources: list[dict] = []
    suggested_actions: list[str] = []


MOCK_REPLIES: dict[str, str] = {
    "热量": "根据你最近的饮食记录，今日已摄入约 1,580 kcal，距离目标 2,000 kcal 还有 420 kcal 余额。",
    "蛋白质": "本周蛋白质平均摄入 85g/天，距离目标 120g 还有提升空间。建议增加鸡蛋、鱼肉、豆制品。",
    "目标": "当前营养目标为每日 2,000 kcal，蛋白质 120g，碳水 250g，脂肪 70g。你可以在设置页调整。",
    "统计": "本周已记录 5 天，平均每日 1,720 kcal。蛋白质达标 3 天，碳水偏高 2 天。",
    "记录": "你最近一次饮食记录是今天午餐：冒菜约 850 kcal，含 6 项餐内成分。",
    "default": "我是 FoodFlow AI 助手，可以帮你查看饮食记录、营养目标、每周统计和分析结果。试着问我「今日热量」「本周蛋白质」「营养目标」等问题。",
}


def _mock_reply(message: str) -> str:
    for keyword, reply in MOCK_REPLIES.items():
        if keyword in message:
            return reply
    return MOCK_REPLIES["default"]


@router.post("/chat", response_model=ChatResponse)
async def chat(
    body: ChatRequest,
    current_user: User = Depends(get_current_user),
):
    answer = _mock_reply(body.message)
    return ChatResponse(
        answer=answer,
        session_id=body.session_id or str(uuid.uuid4()),
    )
