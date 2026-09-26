"""Pydantic schemas and API contracts for Mating."""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator


# ── Generic API Error Schema ──
class ErrorDetail(BaseModel):
    code: str
    message: str


class ErrorResponse(BaseModel):
    error: ErrorDetail


# ── User Profile & Settings ──
class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    username: str | None = None
    first_name: str | None = None
    language_code: str = "ru"
    currency_code: str = "UZS"
    city: str | None = None
    monthly_budget: float | None = None
    created_at: datetime
    updated_at: datetime


class SettingsUpdateRequest(BaseModel):
    language_code: str | None = Field(None, max_length=5)
    currency_code: str | None = Field(None, max_length=5)
    city: str | None = Field(None, max_length=128)
    monthly_budget: float | None = Field(None, ge=0)


# ── Shopping Items ──
class ShoppingItemResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    user_id: str
    name: str
    quantity: float
    unit: str
    category: str
    price: float | None = None
    currency_code: str
    is_purchased: bool
    raw_input_text: str | None = None
    created_at: datetime
    purchased_at: datetime | None = None
    version: int
    client_mutation_id: str | None = None
    deleted_at: datetime | None = None


class CreateItemRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=256)
    quantity: float = Field(default=1.0, gt=0)
    unit: str = Field(default="шт", max_length=20)
    category: str = Field(default="Другое", max_length=64)
    price: float | None = Field(default=None, ge=0)
    currency_code: str | None = Field(default=None, max_length=5)
    raw_input_text: str | None = Field(default=None, max_length=500)
    client_mutation_id: str | None = Field(default=None, max_length=64)

    @field_validator("name")
    @classmethod
    def validate_name(cls, v: str) -> str:
        stripped = v.strip()
        if not stripped:
            raise ValueError("Item name cannot be empty or whitespace only")
        return stripped


class BatchCreateItemsRequest(BaseModel):
    items: list[CreateItemRequest]


class UpdateItemRequest(BaseModel):
    version: int = Field(..., description="Current version of the item for optimistic concurrency")
    name: str | None = Field(None, min_length=1, max_length=256)
    quantity: float | None = Field(None, gt=0)
    unit: str | None = Field(None, max_length=20)
    category: str | None = Field(None, max_length=64)
    price: float | None = Field(None, ge=0)
    currency_code: str | None = Field(None, max_length=5)
    is_purchased: bool | None = None

    @field_validator("name")
    @classmethod
    def validate_name(cls, v: str | None) -> str | None:
        if v is not None:
            stripped = v.strip()
            if not stripped:
                raise ValueError("Item name cannot be empty or whitespace only")
            return stripped
        return None


class ToggleItemRequest(BaseModel):
    version: int = Field(..., description="Current version of the item for optimistic concurrency")


# ── AI Parser Schemas ──
class AIParseRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=500)


class AIParsedItem(BaseModel):
    name: str
    quantity: float = 1.0
    unit: str = "шт"
    category: str = "Другое"
    estimated_price: float | None = None
    confidence: float = Field(default=1.0, ge=0.0, le=1.0)


class AIParseResponse(BaseModel):
    items: list[AIParsedItem]
    raw_text: str


# ── Monthly Stats Schemas ──
class CategorySpending(BaseModel):
    category: str
    amount: float
    count: int
    percentage: float


class MonthlyStatsResponse(BaseModel):
    year: int
    month: int
    currency_code: str
    total_spent: float
    monthly_budget: float | None = None
    budget_remaining: float | None = None
    budget_usage_percent: float | None = None
    items_purchased_count: int
    active_items_count: int
    categories: list[CategorySpending]


# ── Webhook Setup ──
class WebhookSetupResponse(BaseModel):
    ok: bool
    description: str | None = None
