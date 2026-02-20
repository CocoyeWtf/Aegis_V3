"""Schémas Chargeur / Loader schemas."""

from pydantic import BaseModel, ConfigDict


class LoaderBase(BaseModel):
    code: str
    name: str
    base_id: int


class LoaderCreate(LoaderBase):
    pass


class LoaderUpdate(BaseModel):
    code: str | None = None
    name: str | None = None
    base_id: int | None = None


class LoaderRead(LoaderBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
