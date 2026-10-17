"""Call the *_API stored procedures (QSQLSRC/PROCS) - every write goes through RPG.

Each *_API procedure makes its own library current, calls the RPG program through its *_X
external procedure and returns ONE result-set row (pyodbc can't read OUT parameters). The RPG
ends the transaction itself (COMMIT / ROLBK); conn.commit() afterwards just closes the SQL unit
of work.
"""

from dataclasses import dataclass
from decimal import Decimal
from typing import Any

import pyodbc

from .. import db, trace
from ..errors import TunnelDown
from .buffers import ErrOut, LineIn, LineOut, build_lines, parse_errors, parse_lines


@dataclass(frozen=True)
class OrdResult:
    ord_no: int
    total: Decimal
    customer_name: str
    errors: list[ErrOut]
    lines: list[LineOut]
    checksum: str


def _call(conn: pyodbc.Connection, proc: str, rpg: str, action: str,
          args: tuple[Any, ...]) -> Any:
    marks = ", ".join("?" * len(args))
    with trace.step("PROC", f"{proc} → {rpg} (RPGLE)", action):
        try:
            cur = conn.cursor()
            cur.execute(f"CALL {db.t(proc)}({marks})", *args)
            row = cur.fetchone()
            conn.commit()
        except pyodbc.Error as exc:
            conn.rollback()
            state = str(exc.args[0]) if exc.args else ""
            if state.startswith("08") or state.startswith("HYT"):
                raise TunnelDown() from None
            raise
    return row


def ordsvc(conn: pyodbc.Connection, action: str, ord_no: int = 0, order_date: str = "",
           cust_no: int = 0, lines: list[LineIn] | None = None, checksum: str = "") -> OrdResult:
    lines = lines or []
    row = _call(conn, "ORDSVC_API", "ORDSVC", action,
                (action, ord_no, order_date.ljust(10), cust_no, len(lines),
                 build_lines(lines), checksum.ljust(32)))
    return OrdResult(
        ord_no=int(row.ORDNO), total=Decimal(row.TOTAL), customer_name=row.CUSTNAME.strip(),
        errors=parse_errors(row.ERRORS, row.ERRCNT), lines=parse_lines(row.LINES, len(lines)),
        checksum=(row.CHKSUM or "").strip(),
    )


def custsvc(conn: pyodbc.Connection, action: str, cust_no: int, name: str = "",
            address: str = "", city: str = "", state: str = "", status: str = "A") -> list[ErrOut]:
    row = _call(conn, "CUSTSVC_API", "CUSTSVC", action,
                (action, cust_no, name, address, city, state, status))
    return parse_errors(row.ERRORS, row.ERRCNT)


def itemsvc(conn: pyodbc.Connection, action: str, item_no: int, description: str = "",
            category: str = "", unit_price: Decimal = Decimal(0), stock_qty: int = 0,
            status: str = "A") -> list[ErrOut]:
    row = _call(conn, "ITEMSVC_API", "ITEMSVC", action,
                (action, item_no, description, category, unit_price, stock_qty, status))
    return parse_errors(row.ERRORS, row.ERRCNT)
