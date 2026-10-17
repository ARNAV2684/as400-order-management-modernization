"""HTTP routers. Reads call repositories (SQL); writes call ibmi.svc (RPG)."""

from typing import Any, NoReturn

import pyodbc

from .. import messages
from ..errors import ApiError, item
from ..ibmi.buffers import ErrOut
from ..ibmi.errmap import status_for, to_items


def rpg_failed(conn: pyodbc.Connection, errors: list[ErrOut], lines: bool = False) -> NoReturn:
    """The RPG refused: its messages become the error body, with the matching HTTP status."""
    found = to_items(conn, errors, lines)
    raise ApiError(status_for([e["id"] for e in found]), found)


def not_found(conn: pyodbc.Connection, msg_id: str) -> NoReturn:
    raise ApiError(404, [item(msg_id, messages.text(conn, msg_id))])


def saved(conn: pyodbc.Connection, msg_id: str, data1: str = "") -> dict[str, Any]:
    return {"message": messages.text(conn, msg_id, data1)}
