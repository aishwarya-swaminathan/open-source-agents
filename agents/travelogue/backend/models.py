from datetime import date
from decimal import Decimal
from typing import Literal
from pydantic import BaseModel, Field, model_validator
from .catalog import PLACES, COUNTRIES


class EntryInput(BaseModel):
    place_id: str
    title: str = Field(min_length=1, max_length=160)
    visited_on: date
    body: str = Field(default="", max_length=20000)
    tags: str = Field(default="", max_length=200)
    published: bool = False

    @model_validator(mode="after")
    def validate_place(self):
        if self.place_id not in PLACES:
            raise ValueError("Choose a place from the curated catalog.")
        if not self.title.strip():
            raise ValueError("A title cannot be blank.")
        if self.visited_on > date.today():
            raise ValueError("Memories must have a past or present visit date.")
        return self


class TripRequest(BaseModel):
    country: str
    start_date: date
    end_date: date
    travelers: int = Field(default=2, ge=1, le=10)
    budget: Decimal = Field(default=Decimal("100000"), gt=0, le=100000000)
    currency: Literal["INR", "USD", "EUR", "JPY", "THB"] = "INR"
    interests: str = Field(default="Culture, local food, quiet walks", min_length=1, max_length=1000)
    pace: Literal["relaxed", "balanced", "active"] = "relaxed"

    @model_validator(mode="after")
    def check_trip(self):
        if self.country not in {c["code"] for c in COUNTRIES}:
            raise ValueError("The first milestone supports the five curated countries.")
        if not 1 <= (self.end_date - self.start_date).days + 1 <= 14:
            raise ValueError("Choose 1–14 consecutive days in one country.")
        return self


class Activity(BaseModel):
    place_id: str
    title: str = Field(min_length=1, max_length=200)
    note: str = Field(min_length=1, max_length=1500)
    estimate: Decimal = Field(ge=0)
    source_ids: list[str] = Field(min_length=1)


class PlanDay(BaseModel):
    date: date
    activities: list[Activity] = Field(min_length=1, max_length=5)


class Itinerary(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    country: str
    currency: str
    travelers: int
    days: list[PlanDay] = Field(min_length=1, max_length=14)
    warnings: list[str] = Field(min_length=1)


def validate_itinerary(plan: Itinerary, request: TripRequest, source_ids: set[str]) -> list[str]:
    from datetime import timedelta
    errors = []
    expected = [request.start_date + timedelta(days=i) for i in range((request.end_date - request.start_date).days + 1)]
    if [day.date for day in plan.days] != expected:
        errors.append("Dates must match the requested range without gaps or duplicates.")
    if (plan.country, plan.currency, plan.travelers) != (request.country, request.currency, request.travelers):
        errors.append("Country, currency, or traveler count changed.")
    total = Decimal(0)
    for day in plan.days:
        for a in day.activities:
            if a.place_id not in PLACES or PLACES[a.place_id]["country"] != request.country:
                errors.append("An activity references an unknown or wrong-country place.")
            if not set(a.source_ids).issubset(source_ids):
                errors.append("An activity references a source that was not retrieved.")
            total += a.estimate
    if total > request.budget:
        errors.append("Estimated activity costs exceed the budget.")
    return sorted(set(errors))
