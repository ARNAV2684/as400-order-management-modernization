"""Customers (CUSTSVC) and items (ITEMSVC): SQL for reads, the RPG for every check and write."""

from typing import Any, Literal

from fastapi import APIRouter, Depends, Query, status

from .. import db
from .. import repositories as repo
from ..errors import api_error
from ..ibmi import svc
from ..ibmi.errmap import to_items
from ..schemas import (
    Customer,
    CustomerDetail,
    CustomerPage,
    ErrorBody,
    Item,
    ItemDetail,
    ItemPage,
    Saved,
    Validation,
)
from . import not_found, rpg_failed, saved

customers = APIRouter(prefix="/api/customers", tags=["customers"])
items = APIRouter(prefix="/api/items", tags=["items"])
ERRORS: dict[int | str, dict[str, Any]] = {
    c: {"model": ErrorBody} for c in (400, 404, 409, 422, 500, 503)}
Mode = Literal["add", "edit"]


# ------------------------------------------------------------------ customers
@customers.get("", response_model=CustomerPage, summary="Paged customer list (SELECT CSTMST)")
def list_customers(q: str = "", status_: Literal["A", "I"] | None = Query(None, alias="status"),
                   page: int = 1, size: int = 20, conn: Any = Depends(db.get_conn)) -> Any:
    return repo.customers(conn, q.strip().upper(), status_, page, size)


@customers.get("/{cust_no}", response_model=CustomerDetail, responses=ERRORS,
               summary="One customer + how many orders use it")
def get_customer(cust_no: int, conn: Any = Depends(db.get_conn)) -> Any:
    return repo.customer(conn, cust_no) or not_found(conn, "COM0006")


@customers.post("/validate", response_model=Validation, responses=ERRORS,
                summary="CUSTSVC V / U: the RPG checks, nothing written")
def validate_customer(body: Customer, mode: Mode = "add",
                      conn: Any = Depends(db.get_conn)) -> Any:
    errs = svc.custsvc(conn, "V" if mode == "add" else "U", body.cust_no, body.name,
                       body.address, body.city, body.state, body.status)
    return {"valid": not errs, "errors": to_items(conn, errs, lines=False)}


@customers.post("", response_model=Saved, status_code=status.HTTP_201_CREATED, responses=ERRORS,
                summary="CUSTSVC A: add a customer")
def add_customer(body: Customer, conn: Any = Depends(db.get_conn)) -> Any:
    errs = svc.custsvc(conn, "A", body.cust_no, body.name, body.address, body.city,
                       body.state, body.status)
    if errs:
        rpg_failed(conn, errs)
    return saved(conn, "COM0034")


@customers.put("/{cust_no}", response_model=Saved, responses=ERRORS,
               summary="CUSTSVC E: change a customer (the number never changes)")
def edit_customer(cust_no: int, body: Customer, conn: Any = Depends(db.get_conn)) -> Any:
    if body.cust_no != cust_no:
        raise api_error(400, "API0002", "custNo")
    errs = svc.custsvc(conn, "E", cust_no, body.name, body.address, body.city, body.state,
                       body.status)
    if errs:
        rpg_failed(conn, errs)
    return saved(conn, "COM0034")


@customers.delete("/{cust_no}", response_model=Saved, responses=ERRORS,
                  summary="CUSTSVC D: delete (refused with COM0009 while it has orders)")
def delete_customer(cust_no: int, conn: Any = Depends(db.get_conn)) -> Any:
    errs = svc.custsvc(conn, "D", cust_no)
    if errs:
        rpg_failed(conn, errs)
    return saved(conn, "COM0035")


# ------------------------------------------------------------------ items
@items.get("", response_model=ItemPage, summary="Paged item list (SELECT ITMMST)")
def list_items(q: str = "", status_: Literal["A", "I"] | None = Query(None, alias="status"),
               in_stock: bool = Query(False, alias="inStock"), page: int = 1, size: int = 20,
               conn: Any = Depends(db.get_conn)) -> Any:
    return repo.items(conn, q.strip().upper(), status_, in_stock, page, size)


@items.get("/{item_no}", response_model=ItemDetail, responses=ERRORS,
           summary="One item + how many order lines use it")
def get_item(item_no: int, conn: Any = Depends(db.get_conn)) -> Any:
    return repo.item(conn, item_no) or not_found(conn, "COM0013")


@items.post("/validate", response_model=Validation, responses=ERRORS,
            summary="ITEMSVC V / U: the RPG checks, nothing written")
def validate_item(body: Item, mode: Mode = "add", conn: Any = Depends(db.get_conn)) -> Any:
    errs = svc.itemsvc(conn, "V" if mode == "add" else "U", body.item_no, body.description,
                       body.category, body.unit_price, body.stock_qty, body.status)
    return {"valid": not errs, "errors": to_items(conn, errs, lines=False)}


@items.post("", response_model=Saved, status_code=status.HTTP_201_CREATED, responses=ERRORS,
            summary="ITEMSVC A: add an item")
def add_item(body: Item, conn: Any = Depends(db.get_conn)) -> Any:
    errs = svc.itemsvc(conn, "A", body.item_no, body.description, body.category,
                       body.unit_price, body.stock_qty, body.status)
    if errs:
        rpg_failed(conn, errs)
    return saved(conn, "COM0034")


@items.put("/{item_no}", response_model=Saved, responses=ERRORS,
           summary="ITEMSVC E: change an item (the number never changes)")
def edit_item(item_no: int, body: Item, conn: Any = Depends(db.get_conn)) -> Any:
    if body.item_no != item_no:
        raise api_error(400, "API0002", "itemNo")
    errs = svc.itemsvc(conn, "E", item_no, body.description, body.category, body.unit_price,
                       body.stock_qty, body.status)
    if errs:
        rpg_failed(conn, errs)
    return saved(conn, "COM0034")


@items.delete("/{item_no}", response_model=Saved, responses=ERRORS,
              summary="ITEMSVC D: delete (refused with COM0017 while on an order line)")
def delete_item(item_no: int, conn: Any = Depends(db.get_conn)) -> Any:
    errs = svc.itemsvc(conn, "D", item_no)
    if errs:
        rpg_failed(conn, errs)
    return saved(conn, "COM0035")
