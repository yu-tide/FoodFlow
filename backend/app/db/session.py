from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

from app.core.config import settings

# NullPool: Celery 每次 asyncio.run() 创建新 event loop，
# 避免 asyncpg 连接跨 loop 复用导致 "Event loop is closed"
engine = create_async_engine(settings.DATABASE_URL, echo=settings.DEBUG, poolclass=NullPool)

async_session = async_sessionmaker(engine, expire_on_commit=False)


async def get_db():
    async with async_session() as session:
        try:
            yield session
        finally:
            await session.close()
