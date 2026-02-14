"""Schémas Pays / Country schemas."""

from pydantic import BaseModel, ConfigDict


class CountryBase(BaseModel):
    name: str
    code: str


class CountryCreate(CountryBase):
    pass


class CountryUpdate(BaseModel):
    name: str | None = None
    code: str | None = None


class CountryRead(CountryBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
