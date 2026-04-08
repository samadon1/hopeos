from pydantic import BaseModel, EmailStr
from datetime import datetime


class UserBase(BaseModel):
    username: str
    email: EmailStr | None = None
    display_name: str
    role: str  # admin, doctor, nurse, registrar, pharmacy, lab
    description: str | None = None


class UserCreate(UserBase):
    password: str


class UserUpdate(BaseModel):
    email: EmailStr | None = None
    display_name: str | None = None
    role: str | None = None
    description: str | None = None
    active: bool | None = None
    password: str | None = None


class UserResponse(UserBase):
    id: str
    active: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class UserLogin(BaseModel):
    username: str
    password: str
