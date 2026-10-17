"""RPG error entries -> the API's error items and HTTP status (handoff 5.5 / 5.6)."""

from typing import Any

import pyodbc

from .. import messages
from ..errors import item
from .buffers import ErrOut

# ERRFIELD (RPG) -> JSON field name. DB / ACTION errors belong to no field.
FIELDS = {
    "CUSTNO": "custNo", "CUSTNAME": "name", "ADDRESS": "address", "CITY": "city",
    "STATE": "state", "STATUS": "status", "ITEMNO": "itemNo", "ITEMDESC": "description",
    "CATEGORY": "category", "UNITPRICE": "unitPrice", "STOCKQTY": "stockQty",
    "ORDDATE": "orderDate", "ORDNO": "ordNo", "QTY": "qty", "LACTION": "action",
    "LINES": "lines",
}

CONFLICT = {"COM0005", "COM0012", "COM0024", "COM0038", "COM0039", "COM0009", "COM0017"}
NOT_FOUND = {"COM0006", "COM0013", "COM0023"}


def to_items(conn: pyodbc.Connection, errors: list[ErrOut], lines: bool) -> list[dict[str, Any]]:
    """`lines`: the call had a line buffer, so ERRLINE n -> 0-based request index n-1."""
    out = []
    for e in errors:
        line = e.line - 1 if lines and e.line > 0 else None
        out.append(item(e.msg_id, messages.text(conn, e.msg_id, e.data1, e.data2),
                        FIELDS.get(e.field), line))
    return out


def status_for(ids: list[str]) -> int:
    """500 rolled back > 409 conflict / locked / stale / blocked > 404 not found > 422 invalid."""
    if "COM0033" in ids:
        return 500
    if any(i in CONFLICT for i in ids):
        return 409
    if any(i in NOT_FOUND for i in ids):
        return 404
    return 422
