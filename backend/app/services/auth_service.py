import random

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.redis import get_redis
from app.core.security import hash_password, verify_password, create_access_token
from app.models.user import User


def _generate_code() -> str:
    return f"{random.randint(0, 999999):06d}"


def _code_key(scene: str, phone: str) -> str:
    return f"sms_code:{scene}:{phone}"


def _limit_key(scene: str, phone: str) -> str:
    return f"sms_code_limit:{scene}:{phone}"


async def send_code(db: AsyncSession, phone: str, scene: str) -> dict:
    """发送验证码，返回 {dev_code} 或空 dict。Redis 不可用时抛异常。"""
    r = get_redis()
    if r is None:
        raise RuntimeError("验证码服务暂不可用")

    # 频控检查
    limit_key = _limit_key(scene, phone)
    if r.exists(limit_key):
        return {"blocked": True}

    # 注册场景检查手机号是否已注册
    if scene == "register":
        result = await db.execute(select(User).where(User.phone == phone))
        if result.scalar_one_or_none() is not None:
            return {"already_registered": True}

    code = _generate_code()
    code_key = _code_key(scene, phone)

    r.setex(code_key, 300, code)
    r.setex(limit_key, 60, "1")

    from app.core.config import settings

    if settings.ENVIRONMENT == "development" or settings.DEBUG:
        return {"dev_code": code}

    return {}


async def verify_code(phone: str, scene: str, code: str) -> bool:
    """验证验证码是否正确，验证成功后删除。"""
    r = get_redis()
    if r is None:
        return False

    code_key = _code_key(scene, phone)
    stored = r.get(code_key)

    if stored is None or stored != code:
        return False

    r.delete(code_key)
    return True


async def register_user(db: AsyncSession, phone: str, nickname: str, password: str) -> User:
    avatar_text = nickname[0] if nickname else ""

    user = User(
        phone=phone,
        nickname=nickname,
        hashed_password=hash_password(password),
        avatar_text=avatar_text,
    )

    db.add(user)
    await db.commit()
    await db.refresh(user)

    return user


async def authenticate_user(db: AsyncSession, phone: str, password: str) -> User | None:
    result = await db.execute(select(User).where(User.phone == phone))
    user = result.scalar_one_or_none()

    if user is None:
        return None

    if not verify_password(password, user.hashed_password):
        return None

    return user


def create_login_response(user: User) -> dict:
    token = create_access_token(str(user.id))

    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {
            "id": str(user.id),
            "phone": user.phone,
            "nickname": user.nickname,
            "avatarText": user.avatar_text or "",
        },
    }
