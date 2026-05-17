"""FoodFlow AI Assistant — Phase 7: real data tool routing."""
import uuid

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user, get_db
from app.models.user import User
from app.services.assistant_tools import (
    get_dashboard_snapshot,
    get_record_detail_snapshot,
    get_settings_snapshot,
    get_weekly_snapshot,
    search_recent_confirmed,
)

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


def _format_snapshot_reply(template: str, **kwargs) -> str:
    return template.format(**kwargs)


@router.post("/chat", response_model=ChatResponse)
async def chat(
    body: ChatRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    user_id = str(current_user.id)
    msg = body.message
    page = body.page or ""
    ctx = body.page_context or {}
    record_id = ctx.get("record_id", "")
    answer = ""
    sources = []

    # Priority 1: Record detail (records or confirm page with record_id)
    if record_id and (page.startswith("/records/") or page.startswith("/confirm/")):
        detail = await get_record_detail_snapshot(db, user_id, record_id)
        if detail:
            is_confirm = page.startswith("/confirm/")
            name = detail["name"]
            cal = detail["calories"]
            status_note = ""
            if not detail["is_confirmed"]:
                status_note = "（注意：该记录尚未保存，不会进入统计。）"
            comp_list = [c["name"] for c in detail["components"][:6] if c.get("name")]
            comp_str = "、".join(comp_list) if comp_list else "暂未获取到成分"

            lines = [
                f"当前{'待确认' if is_confirm else ''}记录：{name}，{detail['weight']}，约 {cal} kcal。",
                f"蛋白质 {detail['protein']}g · 碳水 {detail['carbs']}g · 脂肪 {detail['fat']}g。",
                f"包含 {detail['component_count']} 项成分：{comp_str}。",
                status_note,
            ]
            answer = " ".join(l for l in lines if l)
            sources.append({"type": "food_record", "title": f"{name} · {cal} kcal", "id": record_id})
        else:
            answer = "未找到该记录，请确认记录是否存在或是否属于当前账号。"

    # Priority 2: Meta-queries about recent records
    elif any(kw in msg for kw in ["最近", "哪几顿", "高热量", "高脂肪", "脂肪偏高", "蛋白质最高"]):
        recent = await search_recent_confirmed(db, user_id, limit=5)
        if recent:
            total = sum(r["calories"] for r in recent)
            max_item = max(recent, key=lambda r: r["calories"])
            lines = [f"最近 {len(recent)} 条已保存记录，合计 {total} kcal。"]
            lines.append(f"其中热量最高的是 {max_item['name']}，{max_item['calories']} kcal。")
            lines.append("详细：")
            for r in recent:
                lines.append(f"· {r['name']} {r['calories']}kcal P{r['protein']}g C{r['carbs']}g F{r['fat']}g")
            answer = "\n".join(lines)
            sources.append({"type": "recent_records", "title": f"最近 {len(recent)} 条记录"})
        else:
            answer = "还没有已保存的饮食记录。上传餐图并保存后即可查看。"

    # Priority 3: Statistics / weekly
    elif page.startswith("/statistics") or any(kw in msg for kw in ["本周", "周统计", "蛋白质达标", "这周"]):
        week = await get_weekly_snapshot(db, user_id)
        if week["record_count"] > 0:
            lines = [
                f"本周（{week['week_start']} 至 {week['week_end']}）共 {week['record_count']} 条已保存记录。",
                f"平均每日 {week['avg_daily_calories']} kcal，总热量 {week['total_calories']} kcal。",
                f"蛋白质合计 {week['total_protein']}g · 碳水 {week['total_carbs']}g · 脂肪 {week['total_fat']}g。",
            ]
            daily_str = " · ".join(f"{d['day']} {d['calories']}kcal" for d in week["daily"])
            lines.append(f"每日热量：{daily_str}")
            answer = "\n".join(lines)
        else:
            answer = "本周还没有已保存的饮食记录。上传餐图并保存后即可查看统计。"
        sources.append({"type": "weekly_statistics", "title": "本周饮食统计"})

    # Priority 4: Dashboard / today
    elif page.startswith("/dashboard") or any(kw in msg for kw in ["今天", "今日"]):
        dash = await get_dashboard_snapshot(db, user_id)
        if dash["record_count"] > 0:
            answer = _format_snapshot_reply(
                "今日已摄入 {consumed} kcal，目标 {target} kcal，剩余 {remaining} kcal。"
                "蛋白质 {protein}g · 碳水 {carbs}g · 脂肪 {fat}g。共 {count} 条记录。",
                consumed=dash["consumed_calories"], target=dash["target_calories"],
                remaining=dash["remaining_calories"], protein=dash["protein"],
                carbs=dash["carbs"], fat=dash["fat"], count=dash["record_count"],
            )
        else:
            answer = "今天还没有已保存的饮食记录。上传餐图并保存后即可查看今日统计。"
        sources.append({"type": "dashboard_summary", "title": "今日饮食汇总"})

    # Priority 5: Settings / targets
    elif page.startswith("/settings") or any(kw in msg for kw in ["目标", "蛋白质目标", "热量目标"]):
        s = await get_settings_snapshot(db, user_id)
        goal_labels = {"maintain": "维持体重", "lose": "减脂", "gain": "增肌"}
        mode_labels = {"agent_recommended": "系统推荐", "manual": "手动设置"}
        answer = _format_snapshot_reply(
            "当前营养目标：每日 {cal} kcal，蛋白质 {pro}g，碳水 {carb}g，脂肪 {fat}g。"
            "目标类型：{goal}，目标来源：{mode}。",
            cal=s["target_calories"],
            pro=s["target_protein"] or "未设置",
            carb=s["target_carbs"] or "未设置",
            fat=s["target_fat"] or "未设置",
            goal=goal_labels.get(s["goal_type"], s["goal_type"]),
            mode=mode_labels.get(s["nutrition_goal_mode"], s["nutrition_goal_mode"]),
        )
        sources.append({"type": "user_settings", "title": "营养目标设置"})

    # Fallback
    else:
        answer = "我是 FoodFlow AI 助手，可以帮你查看饮食记录、营养目标、每周统计和分析结果。试着问我「今日热量」「本周蛋白质」「最近哪几顿热量最高」等问题。"
        sources.append({"type": "assistant_info", "title": "FoodFlow AI 助手"})

    return ChatResponse(
        answer=answer,
        session_id=body.session_id or str(uuid.uuid4()),
        sources=sources,
    )
