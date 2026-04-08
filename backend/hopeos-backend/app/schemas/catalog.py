from pydantic import BaseModel
from datetime import datetime


class CatalogItem(BaseModel):
    id: str
    name: str
    code: str | None = None
    category: str | None = None
    active: bool = True

    class Config:
        from_attributes = True


class CatalogCreate(BaseModel):
    name: str
    code: str | None = None
    category: str | None = None
