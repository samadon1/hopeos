from pydantic import BaseModel, EmailStr
from datetime import date, datetime


class AddressSchema(BaseModel):
    address1: str | None = None
    address2: str | None = None
    cityVillage: str | None = None
    stateProvince: str | None = None
    postalCode: str | None = None
    country: str = "Ghana"


class PatientBase(BaseModel):
    first_name: str
    middle_name: str | None = None
    last_name: str
    gender: str
    birthdate: date
    birthdate_estimated: bool = False
    phone_number: str | None = None
    email: EmailStr | None = None
    national_id: str | None = None
    community: str | None = None
    religion: str | None = None
    occupation: str | None = None
    marital_status: str | None = None
    education_level: str | None = None
    emergency_contact_name: str | None = None
    emergency_contact_phone: str | None = None
    emergency_contact_relationship: str | None = None
    ghana_card_number: str | None = None
    nhis_number: str | None = None


class PatientCreate(PatientBase):
    address: AddressSchema | None = None


class PatientUpdate(BaseModel):
    first_name: str | None = None
    middle_name: str | None = None
    last_name: str | None = None
    gender: str | None = None
    birthdate: date | None = None
    birthdate_estimated: bool | None = None
    phone_number: str | None = None
    email: EmailStr | None = None
    national_id: str | None = None
    community: str | None = None
    religion: str | None = None
    occupation: str | None = None
    marital_status: str | None = None
    education_level: str | None = None
    emergency_contact_name: str | None = None
    emergency_contact_phone: str | None = None
    emergency_contact_relationship: str | None = None
    ghana_card_number: str | None = None
    nhis_number: str | None = None
    address_line1: str | None = None
    address_line2: str | None = None
    city: str | None = None
    state: str | None = None
    postal_code: str | None = None
    active: bool | None = None


class PatientResponse(PatientBase):
    id: str
    identifier: str
    identifier_type: str
    address_line1: str | None = None
    address_line2: str | None = None
    city: str | None = None
    state: str | None = None
    postal_code: str | None = None
    country: str
    active: bool
    deceased: bool
    age: int
    full_name: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class PatientSearch(BaseModel):
    q: str


class PatientListResponse(BaseModel):
    results: list[PatientResponse]
    count: int
    total_count: int
