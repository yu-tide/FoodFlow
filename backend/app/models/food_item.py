import uuid

from sqlalchemy import Column, String, Text, Integer, ForeignKey
from sqlalchemy.dialects.postgresql import UUID

from app.db.base import Base


class FoodItem(Base):
    __tablename__ = "food_items"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    record_id = Column(
        UUID(as_uuid=True),
        ForeignKey("food_records.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    food_name = Column(String(200), nullable=False)
    weight = Column(String(50), default="")
    calories = Column(Integer, default=0)
    protein = Column(Integer, default=0)
    carbs = Column(Integer, default=0)
    fat = Column(Integer, default=0)
    image_url = Column(Text, nullable=True)
    sort_order = Column(Integer, default=0)
