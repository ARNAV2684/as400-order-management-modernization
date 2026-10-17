"""Read-only SQL (handoff principle: reads may use SQL, every write goes through RPG).

User values always go in as ? parameters. Only the library / table names (validated in config)
and computed integers (paging) are placed in the SQL text.
"""

from datetime import date, time, timedelta
from decimal import Decimal
from typing import Any

import pyodbc

from . import db
from .config import get_settings
from .db import t

MAX_SIZE = 100
LOW_STOCK = 5


def page_args(page: int, size: int, total: int) -> tuple[int, int, int]:
    """Same rules as the frontend contract: size 1..100 (default 20), page clamped to the last."""
    size = max(1, min(MAX_SIZE, size or 20))
    last = max(1, -(-total // size))
    page = max(1, min(last, page or 1))
    return page, size, (page - 1) * size


def _paged(conn: pyodbc.Connection, select: str, base: str, order: str, params: list[Any],
           page: int, size: int, target: str) -> tuple[list[Any], int, int, int]:
    total = int(db.one(conn, f"SELECT COUNT(*) {base}", tuple(params), f"SELECT COUNT {target}")[0])
    page, size, offset = page_args(page, size, total)
    found = db.rows(conn, f"SELECT {select} {base} ORDER BY {order} "
                          f"OFFSET {offset} ROWS FETCH FIRST {size} ROWS ONLY",
                    tuple(params), f"SELECT {target}")
    return found, page, size, total


def _s(v: Any) -> str:
    return (v or "").rstrip() if isinstance(v, str) else ("" if v is None else str(v))


def _iso(d: Any) -> str:
    return d.isoformat() if isinstance(d, date) else _s(d)


def _at(d: Any, tm: Any) -> str:
    tt = tm.isoformat() if isinstance(tm, time) else _s(tm).replace(".", ":")
    return f"{_iso(d)}T{tt}"


# ------------------------------------------------------------------ customers
_CUST = "CUSTNO, CUSTNAME, ADDRESS, CITY, STATE, STATUS"


def _customer(r: Any) -> dict[str, Any]:
    return {"custNo": int(r[0]), "name": _s(r[1]), "address": _s(r[2]), "city": _s(r[3]),
            "state": _s(r[4]), "status": _s(r[5])}


def customers(conn: pyodbc.Connection, q: str, status: str | None, page: int,
              size: int) -> dict[str, Any]:
    where, params = [], []
    if status:
        where.append("STATUS = ?")
        params.append(status)
    if q:
        where.append("(CAST(CAST(CUSTNO AS INTEGER) AS VARCHAR(10)) LIKE ? "
                     "OR UPPER(CUSTNAME) LIKE ?)")
        params += [f"{q}%", f"%{q}%"]
    base = f"FROM {t('CSTMST')}" + (" WHERE " + " AND ".join(where) if where else "")
    found, page, size, total = _paged(conn, _CUST, base, "CUSTNO", params, page, size, "CSTMST")
    return {"items": [_customer(r) for r in found], "page": page, "size": size, "total": total}


def customer(conn: pyodbc.Connection, cust_no: int) -> dict[str, Any] | None:
    r = db.one(conn, f"SELECT {_CUST} FROM {t('CSTMST')} WHERE CUSTNO = ?", (cust_no,),
               "SELECT CSTMST")
    if r is None:
        return None
    n = db.one(conn, f"SELECT COUNT(*) FROM {t('ORDHDR')} WHERE CUSTNO = ?", (cust_no,),
               "SELECT COUNT(*) ORDHDRL1")
    return {**_customer(r), "orderCount": int(n[0])}


# ------------------------------------------------------------------ items
_ITEM = "ITEMNO, ITEMDESC, CATEGORY, UNITPRICE, STOCKQTY, STATUS"


def _item(r: Any) -> dict[str, Any]:
    return {"itemNo": int(r[0]), "description": _s(r[1]), "category": _s(r[2]),
            "unitPrice": Decimal(r[3]), "stockQty": int(r[4]), "status": _s(r[5])}


def items(conn: pyodbc.Connection, q: str, status: str | None, in_stock: bool, page: int,
          size: int) -> dict[str, Any]:
    where, params = [], []
    if status:
        where.append("STATUS = ?")
        params.append(status)
    if in_stock:
        where.append("STOCKQTY > 0")
    if q:
        where.append("(CAST(CAST(ITEMNO AS INTEGER) AS VARCHAR(10)) LIKE ? "
                     "OR UPPER(ITEMDESC) LIKE ? OR UPPER(CATEGORY) LIKE ?)")
        params += [f"{q}%", f"%{q}%", f"%{q}%"]
    base = f"FROM {t('ITMMST')}" + (" WHERE " + " AND ".join(where) if where else "")
    found, page, size, total = _paged(conn, _ITEM, base, "ITEMNO", params, page, size, "ITMMST")
    return {"items": [_item(r) for r in found], "page": page, "size": size, "total": total}


def item(conn: pyodbc.Connection, item_no: int) -> dict[str, Any] | None:
    r = db.one(conn, f"SELECT {_ITEM} FROM {t('ITMMST')} WHERE ITEMNO = ?", (item_no,),
               "SELECT ITMMST")
    if r is None:
        return None
    n = db.one(conn, f"SELECT COUNT(*) FROM {t('ORDDTL')} WHERE ITEMNO = ?", (item_no,),
               "SELECT COUNT(*) ORDDTLL2")
    return {**_item(r), "orderLineCount": int(n[0])}


# ------------------------------------------------------------------ orders
_SUM = "ORDNO, ORDDATE, CUSTNO, CUSTNAME, LINECNT, STATUS, TOTAMT"
SORTS = {"ordNo": "ORDNO", "orderDate": "ORDDATE", "custNo": "CUSTNO", "total": "TOTAMT"}


def _summary(r: Any) -> dict[str, Any]:
    return {"ordNo": int(r[0]), "orderDate": _iso(r[1]), "custNo": int(r[2]),
            "customerName": _s(r[3]), "lineCount": int(r[4]), "status": _s(r[5]),
            "total": Decimal(r[6])}


def orders(conn: pyodbc.Connection, cust_no: int | None, sort: str, page: int,
           size: int) -> dict[str, Any]:
    desc = sort.startswith("-")
    col = SORTS.get(sort.lstrip("-"), "ORDNO")
    direction = "DESC" if desc else "ASC"
    order = f"{col} {direction}" + ("" if col == "ORDNO" else f", ORDNO {direction}")
    params: list[Any] = []
    base = f"FROM {t('ORDSUMV')}"
    if cust_no:
        base += " WHERE CUSTNO = ?"
        params.append(cust_no)
    found, page, size, total = _paged(conn, _SUM, base, order, params, page, size, "ORDSUMV")
    return {"items": [_summary(r) for r in found], "page": page, "size": size, "total": total}


def order(conn: pyodbc.Connection, ord_no: int) -> dict[str, Any] | None:
    r = db.one(conn, f"SELECT {_SUM} FROM {t('ORDSUMV')} WHERE ORDNO = ?", (ord_no,),
               "SELECT ORDSUMV (ORDHDR + CSTMST)")
    if r is None:
        return None
    lines = db.rows(conn, f"SELECT LINENO, ITEMNO, ITEMDESC, QTY, PRICE, AMOUNT "
                          f"FROM {t('ORDDTL')} WHERE ORDNO = ? ORDER BY LINENO", (ord_no,),
                    "SELECT ORDDTLF")
    return {**_summary(r), "lines": [
        {"lineNo": int(x[0]), "itemNo": int(x[1]), "description": _s(x[2]), "qty": int(x[3]),
         "price": Decimal(x[4]), "amount": Decimal(x[5])} for x in lines]}


# ------------------------------------------------------------------ audit
def _audit_sql() -> tuple[str, str, str]:
    table = get_settings().com_audit_table
    # ORDAUDJV (journal view) carries AUDSRC + JRNSEQ; a trigger-written ORDAUD has neither.
    if table == "ORDAUDJV":
        return t(table), "AUDSRC", "JRNSEQ DESC"
    return t(table), "'5250'", "AUDDATE DESC, AUDTIME DESC"


def _audit(r: Any) -> dict[str, Any]:
    return {"ordNo": int(r[0]), "action": _s(r[1]), "at": _at(r[2], r[3]), "user": _s(r[4]),
            "source": _s(r[5]) or "5250"}


def audit(conn: pyodbc.Connection, ord_no: int | None, action: str | None, source: str | None,
          page: int, size: int) -> dict[str, Any]:
    table, src, order = _audit_sql()
    where: list[str] = []
    params: list[object] = []
    if ord_no:
        where.append("ORDNO = ?")
        params.append(ord_no)
    if action:
        where.append("ACTION = ?")
        params.append(action)
    if source:
        where.append(f"{src} = ?")
        params.append(source)
    base = f"FROM {table}" + (" WHERE " + " AND ".join(where) if where else "")
    select = f"ORDNO, ACTION, AUDDATE, AUDTIME, AUDUSER, {src}"
    found, page, size, total = _paged(conn, select, base, order, params, page, size,
                                      get_settings().com_audit_table)
    return {"items": [_audit(r) for r in found], "page": page, "size": size, "total": total}


def order_audit(conn: pyodbc.Connection, ord_no: int) -> list[dict[str, Any]]:
    table, src, order = _audit_sql()
    found = db.rows(conn, f"SELECT ORDNO, ACTION, AUDDATE, AUDTIME, AUDUSER, {src} "
                          f"FROM {table} WHERE ORDNO = ? ORDER BY {order}", (ord_no,),
                    f"SELECT {get_settings().com_audit_table}")
    return [_audit(r) for r in found]


# ------------------------------------------------------------------ dashboard
def dashboard(conn: pyodbc.Connection, today: date) -> dict[str, Any]:
    k = db.one(conn,
               f"SELECT (SELECT COUNT(*) FROM {t('ORDHDR')} WHERE STATUS = 'O'), "
               f"(SELECT COALESCE(SUM(TOTAMT), 0) FROM {t('ORDHDR')}), "
               f"(SELECT COUNT(*) FROM {t('CSTMST')} WHERE STATUS = 'A'), "
               f"(SELECT COUNT(*) FROM {t('ITMMST')} WHERE STATUS = 'A' AND STOCKQTY <= ?) "
               "FROM SYSIBM.SYSDUMMY1", (LOW_STOCK,), "SELECT COUNT/SUM ORDHDR CSTMST ITMMST")
    first = today - timedelta(days=29)
    by_day = {_iso(r[0]): (int(r[1]), Decimal(r[2])) for r in db.rows(
        conn, f"SELECT ORDDATE, COUNT(*), SUM(TOTAMT) FROM {t('ORDHDR')} "
              "WHERE ORDDATE BETWEEN ? AND ? GROUP BY ORDDATE", (first, today),
        "SELECT SUM(TOTAMT) GROUP BY ORDDATE")}
    days = []
    for i in range(30):
        d = (first + timedelta(days=i)).isoformat()
        n, v = by_day.get(d, (0, Decimal(0)))
        days.append({"date": d, "value": v, "orders": n})
    top = db.rows(conn, f"SELECT D.ITEMNO, COALESCE(MAX(I.ITEMDESC), ''), SUM(D.QTY) "
                        f"FROM {t('ORDDTL')} D LEFT JOIN {t('ITMMST')} I ON I.ITEMNO = D.ITEMNO "
                        "GROUP BY D.ITEMNO ORDER BY 3 DESC, 1 FETCH FIRST 5 ROWS ONLY", (),
                  "SELECT SUM(QTY) ORDDTL GROUP BY ITEMNO")
    low = db.rows(conn, f"SELECT {_ITEM} FROM {t('ITMMST')} WHERE STATUS = 'A' AND STOCKQTY <= ? "
                        "ORDER BY STOCKQTY, ITEMNO", (LOW_STOCK,), "SELECT ITMMST STOCKQTY <= 5")
    recent = db.rows(conn, f"SELECT {_SUM} FROM {t('ORDSUMV')} ORDER BY ORDDATE DESC, ORDNO DESC "
                           "FETCH FIRST 5 ROWS ONLY", (), "SELECT ORDSUMV")
    table, src, order = _audit_sql()
    recent_audit = db.rows(conn, f"SELECT ORDNO, ACTION, AUDDATE, AUDTIME, AUDUSER, {src} "
                                 f"FROM {table} ORDER BY {order} FETCH FIRST 10 ROWS ONLY", (),
                           f"SELECT {get_settings().com_audit_table}")
    return {
        "kpis": {"openOrders": int(k[0]), "orderValue": Decimal(k[1]),
                 "activeCustomers": int(k[2]), "lowStockItems": int(k[3])},
        "valueByDay": days,
        "topItems": [{"itemNo": int(r[0]), "description": _s(r[1]), "qty": int(r[2])}
                     for r in top],
        "lowStock": [_item(r) for r in low],
        "recentOrders": [_summary(r) for r in recent],
        "recentAudit": [_audit(r) for r in recent_audit],
    }
