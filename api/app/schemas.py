"""Request / response shapes - the same contract as web/src/api/types.ts (handoff 4 + 5.5).

camelCase on the wire; money as a decimal string ("96850.00"), never a float. Pydantic only
checks SHAPE (types, lengths). Business rules - stock, active/inactive, duplicates - are the
RPG's job, and its messages come back as errors.
"""

from decimal import Decimal
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, PlainSerializer, WithJsonSchema
from pydantic.alias_generators import to_camel

Money = Annotated[
    Decimal,
    PlainSerializer(lambda v: f"{v:.2f}", return_type=str),
    WithJsonSchema({"type": "string", "example": "96850.00"}),
]
OptMoney = Annotated[
    Decimal | None,
    PlainSerializer(lambda v: None if v is None else f"{v:.2f}", return_type=str | None),
    WithJsonSchema({"type": ["string", "null"], "example": "650.00"}),
]
Num7 = Annotated[int, Field(ge=0, le=9_999_999)]
Status = Literal["A", "I"]


class Camel(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)


# ------------------------------------------------------------------ shared
class ErrorItem(Camel):
    id: str
    text: str
    field: str | None = None
    line: int | None = None


class ErrorBody(Camel):
    errors: list[ErrorItem]
    trace_id: str


class Validation(Camel):
    valid: bool
    errors: list[ErrorItem]


class Saved(Camel):
    message: str


class Health(Camel):
    api: Literal["ok"] = "ok"
    tunnel: Literal["ok", "down"]
    db: Literal["ok", "down"]
    latency_ms: int | None
    system: str
    library: str
    connection: Literal["tunnel", "direct-plain", "direct-tls"] = "tunnel"


class Message(Camel):
    id: str
    text: str


# ------------------------------------------------------------------ customers
class Customer(Camel):
    cust_no: Num7
    name: Annotated[str, Field(max_length=40)] = ""
    address: Annotated[str, Field(max_length=50)] = ""
    city: Annotated[str, Field(max_length=30)] = ""
    state: Annotated[str, Field(max_length=20)] = ""
    # One character; A / I is checked by the RPG (COM0008).
    status: Annotated[str, Field(max_length=1)] = "A"


class CustomerDetail(Customer):
    order_count: int


class CustomerPage(Camel):
    items: list[Customer]
    page: int
    size: int
    total: int


# ------------------------------------------------------------------ items
class Item(Camel):
    item_no: Num7
    description: Annotated[str, Field(max_length=50)] = ""
    category: Annotated[str, Field(max_length=20)] = ""
    # Negative is allowed through on purpose: the RPG answers COM0015.
    unit_price: Annotated[Money, Field(max_digits=9, decimal_places=2)] = Decimal(0)
    stock_qty: Annotated[int, Field(ge=-999_999_999, le=999_999_999)] = 0
    status: Annotated[str, Field(max_length=1)] = "A"


class ItemDetail(Item):
    order_line_count: int


class ItemPage(Camel):
    items: list[Item]
    page: int
    size: int
    total: int


# ------------------------------------------------------------------ orders
class OrderSummary(Camel):
    ord_no: int
    order_date: str
    cust_no: int
    customer_name: str
    line_count: int
    status: str
    total: Money


class OrderPage(Camel):
    items: list[OrderSummary]
    page: int
    size: int
    total: int


class OrderLine(Camel):
    line_no: int
    item_no: int
    description: str
    qty: int
    price: Money
    amount: Money


class OrderDetail(OrderSummary):
    lines: list[OrderLine]
    checksum: str


class DraftLine(Camel):
    line_no: Annotated[int, Field(ge=0, le=999)] = 0
    action: Literal["N", "C", "D"] = "N"
    item_no: Num7 = 0
    qty: Num7 = 0


class OrderDraft(Camel):
    ord_no: Num7 = 0
    order_date: Annotated[str, Field(max_length=10)] = ""
    cust_no: Num7 = 0
    checksum: Annotated[str | None, Field(max_length=32)] = None
    lines: list[DraftLine] = []


class ValidatedLine(Camel):
    index: int
    line_no: int
    item_no: int
    qty: int
    description: str
    price: OptMoney
    amount: OptMoney


class OrderValidation(Camel):
    valid: bool
    customer_name: str
    total: Money
    lines: list[ValidatedLine]
    errors: list[ErrorItem]


class OrderCreated(Camel):
    ord_no: int
    message: str


# ------------------------------------------------------------------ audit + dashboard
class AuditEntry(Camel):
    ord_no: int
    action: Literal["A", "U", "D"]
    at: str
    user: str
    source: Literal["WEB", "5250"]


class AuditPage(Camel):
    items: list[AuditEntry]
    page: int
    size: int
    total: int


class Kpis(Camel):
    open_orders: int
    order_value: Money
    active_customers: int
    low_stock_items: int


class DayValue(Camel):
    date: str
    value: Money
    orders: int


class TopItem(Camel):
    item_no: int
    description: str
    qty: int


class Dashboard(Camel):
    kpis: Kpis
    value_by_day: list[DayValue]
    top_items: list[TopItem]
    low_stock: list[Item]
    recent_orders: list[OrderSummary]
    recent_audit: list[AuditEntry]
