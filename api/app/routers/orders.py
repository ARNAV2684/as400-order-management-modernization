"""Orders (ORDSVC), audit and dashboard."""

from datetime import date
from decimal import Decimal
from typing import Any, Literal

from fastapi import APIRouter, Depends, Query, status

from .. import db, messages
from .. import repositories as repo
from ..errors import ApiError, api_error, item
from ..ibmi import svc
from ..ibmi.buffers import MAX_LINES, LineIn
from ..ibmi.errmap import to_items
from ..schemas import (
    AuditEntry,
    AuditPage,
    Dashboard,
    ErrorBody,
    OrderCreated,
    OrderDetail,
    OrderDraft,
    OrderPage,
    OrderValidation,
    Saved,
)
from . import not_found, rpg_failed, saved

router = APIRouter(prefix="/api", tags=["orders"])
ERRORS: dict[int | str, dict[str, Any]] = {
    c: {"model": ErrorBody} for c in (400, 404, 409, 422, 500, 503)}
Sort = Literal["ordNo", "-ordNo", "orderDate", "-orderDate", "custNo", "-custNo", "total",
               "-total"]


def _lines(draft: OrderDraft) -> list[LineIn]:
    return [LineIn(ln.line_no, ln.action, ln.item_no, ln.qty) for ln in draft.lines]


def _too_many(conn: Any, draft: OrderDraft) -> list[dict[str, Any]]:
    # ORDSVC's buffer holds 25 lines (= SFLSIZ on the 5250), so the API stops more right here.
    if len(draft.lines) > MAX_LINES:
        return [item("COM0030", messages.text(conn, "COM0030"), "lines")]
    return []


@router.get("/orders", response_model=OrderPage, tags=["orders"],
            summary="Paged order list with customer name (SELECT ORDSUMV)")
def list_orders(cust_no: int | None = Query(None, alias="custNo"), sort: Sort = "-ordNo",
                page: int = 1, size: int = 20, conn: Any = Depends(db.get_conn)) -> Any:
    return repo.orders(conn, cust_no, sort, page, size)


@router.get("/orders/{ord_no}", response_model=OrderDetail, responses=ERRORS,
            summary="Header + lines + the fingerprint for a later edit (ORDSVC CK)")
def get_order(ord_no: int, conn: Any = Depends(db.get_conn)) -> Any:
    found = repo.order(conn, ord_no) or not_found(conn, "COM0023")
    # The stale-edit fingerprint is ORDSVC's own rule, so ORDSVC computes it.
    ck = svc.ordsvc(conn, "CK", ord_no=ord_no)
    return {**found, "checksum": ck.checksum}


@router.post("/orders/validate", response_model=OrderValidation, responses=ERRORS,
             summary="ORDSVC VA / VE: live validation, nothing written (200 even when invalid)")
def validate_order(draft: OrderDraft, conn: Any = Depends(db.get_conn)) -> Any:
    too_many = _too_many(conn, draft)
    if too_many:
        return {"valid": False, "customerName": "", "total": Decimal(0), "lines": [],
                "errors": too_many}
    res = svc.ordsvc(conn, "VE" if draft.ord_no else "VA", draft.ord_no, draft.order_date,
                     draft.cust_no, _lines(draft))
    errors = to_items(conn, res.errors, lines=True)
    bad_lines = {e["line"] for e in errors if e["line"] is not None}
    out_lines = []
    for i, (req, got) in enumerate(zip(draft.lines, res.lines, strict=True)):
        known = bool(got.description)
        out_lines.append({
            "index": i, "lineNo": req.line_no, "itemNo": req.item_no, "qty": req.qty,
            "description": got.description, "price": got.price if known else None,
            "amount": got.amount if known and i not in bad_lines else None,
        })
    return {"valid": not errors, "customerName": res.customer_name, "total": res.total,
            "lines": out_lines, "errors": errors}


@router.post("/orders", response_model=OrderCreated, status_code=status.HTTP_201_CREATED,
             responses=ERRORS, summary="ORDSVC SA: create an order in ONE commit")
def create_order(draft: OrderDraft, conn: Any = Depends(db.get_conn)) -> Any:
    if draft.ord_no:
        raise api_error(400, "API0002", "ordNo")
    too_many = _too_many(conn, draft)
    if too_many:
        raise ApiError(422, too_many)
    res = svc.ordsvc(conn, "SA", 0, draft.order_date, draft.cust_no, _lines(draft))
    if res.errors:
        rpg_failed(conn, res.errors, lines=True)
    return {"ordNo": res.ord_no, **saved(conn, "COM0025", str(res.ord_no))}


@router.put("/orders/{ord_no}", response_model=Saved, responses=ERRORS,
            summary="ORDSVC SE: edit an order; a changed fingerprint is refused (COM0039)")
def edit_order(ord_no: int, draft: OrderDraft, conn: Any = Depends(db.get_conn)) -> Any:
    if draft.ord_no != ord_no:
        raise api_error(400, "API0002", "ordNo")
    too_many = _too_many(conn, draft)
    if too_many:
        raise ApiError(422, too_many)
    res = svc.ordsvc(conn, "SE", ord_no, draft.order_date, draft.cust_no, _lines(draft),
                     draft.checksum or "")
    if res.errors:
        rpg_failed(conn, res.errors, lines=True)
    return saved(conn, "COM0027", str(ord_no))


@router.delete("/orders/{ord_no}", response_model=Saved, responses=ERRORS,
               summary="ORDSVC DL: stock back, lines, header - in ONE commit")
def delete_order(ord_no: int, conn: Any = Depends(db.get_conn)) -> Any:
    res = svc.ordsvc(conn, "DL", ord_no)
    if res.errors:
        rpg_failed(conn, res.errors)
    return saved(conn, "COM0026", str(ord_no))


@router.get("/orders/{ord_no}/audit", response_model=list[AuditEntry], tags=["audit"],
            summary="Audit trail of one order, newest first")
def order_audit(ord_no: int, conn: Any = Depends(db.get_conn)) -> Any:
    return repo.order_audit(conn, ord_no)


@router.get("/audit", response_model=AuditPage, tags=["audit"],
            summary="The audit log (journal view ORDAUDJV on PUB400)")
def audit_log(ord_no: int | None = Query(None, alias="ordNo"),
              action: Literal["A", "U", "D"] | None = None,
              source: Literal["WEB", "5250"] | None = None, page: int = 1, size: int = 20,
              conn: Any = Depends(db.get_conn)) -> Any:
    return repo.audit(conn, ord_no, action, source, page, size)


@router.get("/dashboard", response_model=Dashboard, tags=["dashboard"],
            summary="KPIs, 30-day value, top items, low stock, recent orders and audit")
def dashboard(conn: Any = Depends(db.get_conn)) -> Any:
    return repo.dashboard(conn, date.today())
