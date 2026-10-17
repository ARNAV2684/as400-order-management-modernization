"""Every customer / item / order scenario through the API, against the real RPG on IBM i."""

import time
from typing import Any

import pyodbc
from fastapi.testclient import TestClient

from app.db import t

from .conftest import TEST_CUST, TEST_CUST2, TEST_ITEMS, scalar

IT1, IT2, IT3 = TEST_ITEMS


def ids(body: dict[str, Any]) -> list[str]:
    return [e["id"] for e in body["errors"]]


def cust(no: int, name: str = "API TEST CUSTOMER", status: str = "A") -> dict[str, Any]:
    return {"custNo": no, "name": name, "address": "1 TEST ROAD", "city": "MUMBAI",
            "state": "MH", "status": status}


def item(no: int, price: str = "10.00", stock: int = 10, status: str = "A") -> dict[str, Any]:
    return {"itemNo": no, "description": f"API TEST ITEM {no}", "category": "TEST",
            "unitPrice": price, "stockQty": stock, "status": status}


def draft(lines: list[dict[str, Any]], cust_no: int = TEST_CUST, ord_no: int = 0,
          checksum: str | None = None) -> dict[str, Any]:
    body: dict[str, Any] = {"ordNo": ord_no, "orderDate": "2026-10-15", "custNo": cust_no,
                            "lines": lines}
    if checksum is not None:
        body["checksum"] = checksum
    return body


def new(item_no: int, qty: int) -> dict[str, Any]:
    return {"lineNo": 0, "action": "N", "itemNo": item_no, "qty": qty}


def stock(client: TestClient, item_no: int) -> int:
    return int(client.get(f"/api/items/{item_no}").json()["stockQty"])


# ------------------------------------------------------------------ system
def test_health_and_messages(client: TestClient) -> None:
    h = client.get("/api/health").json()
    assert h["tunnel"] == "ok" and h["db"] == "ok" and h["library"] == "ARNAV27122"
    msgs = {m["id"]: m["text"] for m in client.get("/api/meta/messages").json()}
    assert msgs["COM0019"].startswith("Only &1 in stock") and "API0001" in msgs


def test_trace_header(client: TestClient) -> None:
    r = client.get("/api/customers/2001")
    import base64
    import json
    tr = json.loads(base64.b64decode(r.headers["X-COM-Trace"]).decode())
    assert tr["steps"] and tr["steps"][0]["kind"] == "SQL"
    assert client.get("/api/meta/trace").json()[0]["path"].startswith("/api/")


# ------------------------------------------------------------------ customers (CUSTSVC)
def test_customer_lifecycle(client: TestClient) -> None:
    bad = client.post("/api/customers/validate", json=cust(0, name="", status="X")).json()
    assert not bad["valid"] and ids(bad) == ["COM0004", "COM0007", "COM0008"]
    assert [e["field"] for e in bad["errors"]] == ["custNo", "name", "status"]

    r = client.post("/api/customers", json=cust(TEST_CUST))
    assert r.status_code == 201 and r.json()["message"] == "Record saved."
    dup = client.post("/api/customers", json=cust(TEST_CUST))
    assert dup.status_code == 409 and ids(dup.json()) == ["COM0005"]
    assert client.post("/api/customers/validate?mode=edit", json=cust(TEST_CUST)).json()["valid"]

    r = client.put(f"/api/customers/{TEST_CUST}", json=cust(TEST_CUST, name="API TEST RENAMED"))
    assert r.status_code == 200
    got = client.get(f"/api/customers/{TEST_CUST}").json()
    assert got["name"] == "API TEST RENAMED" and got["orderCount"] == 0
    found = client.get("/api/customers", params={"q": "renamed"}).json()
    assert [c["custNo"] for c in found["items"]] == [TEST_CUST]

    assert client.put(f"/api/customers/{TEST_CUST}", json=cust(1)).status_code == 400
    r = client.delete(f"/api/customers/{TEST_CUST}")
    assert r.status_code == 200 and r.json()["message"] == "Record deleted."
    gone = client.get(f"/api/customers/{TEST_CUST}")
    assert gone.status_code == 404 and ids(gone.json()) == ["COM0006"]


def test_delete_blocking(client: TestClient) -> None:
    r = client.delete("/api/customers/2001")
    assert r.status_code == 409 and ids(r.json()) == ["COM0009"]
    r = client.delete("/api/items/5001")
    assert r.status_code == 409 and ids(r.json()) == ["COM0017"]


# ------------------------------------------------------------------ items (ITEMSVC)
def test_item_lifecycle(client: TestClient) -> None:
    bad = client.post("/api/items/validate",
                      json=item(0, price="-1", stock=-1, status="X") | {"description": ""})
    assert ids(bad.json()) == ["COM0011", "COM0014", "COM0015", "COM0016", "COM0008"]
    assert client.post("/api/items", json=item(IT1)).status_code == 201
    assert ids(client.post("/api/items", json=item(IT1)).json()) == ["COM0012"]
    assert client.put(f"/api/items/{IT1}", json=item(IT1, price="12.50")).status_code == 200
    got = client.get(f"/api/items/{IT1}").json()
    assert got["unitPrice"] == "12.50" and got["orderLineCount"] == 0
    in_stock = client.get("/api/items", params={"q": "API TEST", "inStock": "true"}).json()
    assert IT1 in [i["itemNo"] for i in in_stock["items"]]
    assert client.delete(f"/api/items/{IT1}").status_code == 200


# ------------------------------------------------------------------ orders (ORDSVC)
def _setup_order_data(client: TestClient) -> None:
    for no in (TEST_CUST, TEST_CUST2):
        client.post("/api/customers", json=cust(no))
    client.post("/api/items", json=item(IT1, price="10.00", stock=10))
    client.post("/api/items", json=item(IT2, price="25.00", stock=5))
    client.post("/api/items", json=item(IT3, price="1.00", stock=3, status="I"))


def test_order_validation_maps_line_and_field(client: TestClient) -> None:
    _setup_order_data(client)
    body = draft([new(IT1, 2), new(IT2, 6), new(IT3, 1), new(8888888, 1), new(IT1, 1),
                  new(IT2, 0)], cust_no=2005)
    r = client.post("/api/orders/validate", json=body)
    assert r.status_code == 200
    v = r.json()
    assert not v["valid"]
    got = {(e["id"], e["line"], e["field"]) for e in v["errors"]}
    assert ("COM0010", None, "custNo") in got            # inactive customer (header)
    assert ("COM0019", 1, "qty") in got                  # 6 > stock 5, on request index 1
    assert ("COM0018", 2, "itemNo") in got               # inactive item
    assert ("COM0013", 3, "itemNo") in got               # unknown item
    assert ("COM0021", 4, "itemNo") in got               # duplicate item
    assert ("COM0020", 5, "qty") in got                  # qty 0
    first = v["lines"][0]
    assert first["description"] == f"API TEST ITEM {IT1}" and first["price"] == "10.00"
    assert first["amount"] == "20.00" and v["lines"][3]["price"] is None


def test_order_create_edit_stale_delete_audit(client: TestClient, raw: pyodbc.Connection) -> None:
    _setup_order_data(client)
    s1, s2 = stock(client, IT1), stock(client, IT2)

    r = client.post("/api/orders", json=draft([new(IT1, 2), new(IT2, 1)]))
    assert r.status_code == 201, r.json()
    ord_no = r.json()["ordNo"]
    assert r.json()["message"] == f"Order {ord_no} created."
    assert (stock(client, IT1), stock(client, IT2)) == (s1 - 2, s2 - 1)
    # Cross-channel: the RPG wrote it, plain SQL sees it.
    assert scalar(raw, f"SELECT TOTAMT FROM {t('ORDHDR')} WHERE ORDNO = ?", ord_no) == 45

    a = client.get(f"/api/orders/{ord_no}").json()
    b = client.get(f"/api/orders/{ord_no}").json()
    assert a["checksum"] == b["checksum"] == "4500/2/3/4"
    lines = [{"lineNo": ln["lineNo"], "action": "C", "itemNo": ln["itemNo"], "qty": ln["qty"]}
             for ln in a["lines"]]
    lines[0]["qty"] = 4                                   # 2 -> 4: two more taken
    r = client.put(f"/api/orders/{ord_no}", json=draft(lines, ord_no=ord_no,
                                                       checksum=a["checksum"]))
    assert r.status_code == 200 and r.json()["message"] == f"Order {ord_no} changed."
    assert stock(client, IT1) == s1 - 4

    # Stale: the second user still holds the fingerprint from before the first save.
    lines[0]["qty"] = 3
    r = client.put(f"/api/orders/{ord_no}", json=draft(lines, ord_no=ord_no,
                                                       checksum=b["checksum"]))
    assert r.status_code == 409 and ids(r.json()) == ["COM0039"]
    assert stock(client, IT1) == s1 - 4                  # nothing changed

    r = client.delete(f"/api/orders/{ord_no}")
    assert r.status_code == 200 and r.json()["message"] == f"Order {ord_no} deleted."
    assert (stock(client, IT1), stock(client, IT2)) == (s1, s2)
    assert client.get(f"/api/orders/{ord_no}").status_code == 404

    trail = client.get(f"/api/orders/{ord_no}/audit").json()
    assert sorted(e["action"] for e in trail) == ["A", "D", "U"]
    assert {e["source"] for e in trail} == {"WEB"}
    log = client.get("/api/audit", params={"ordNo": ord_no, "source": "WEB"}).json()
    assert log["total"] == 3


def test_rollback_leaves_nothing(client: TestClient, raw: pyodbc.Connection) -> None:
    _setup_order_data(client)
    before = client.get("/api/orders", params={"custNo": TEST_CUST}).json()["total"]
    s1 = stock(client, IT1)
    lib = t("X").split(".")[0]
    raw.cursor().execute("CALL QSYS2.QCMDEXC(?)",
                         f"CHGDTAARA DTAARA({lib}/COMTSTFAIL) VALUE('Y')")
    raw.commit()
    try:
        r = client.post("/api/orders", json=draft([new(IT1, 1)]))
    finally:
        raw.cursor().execute("CALL QSYS2.QCMDEXC(?)",
                             f"CHGDTAARA DTAARA({lib}/COMTSTFAIL) VALUE(' ')")
        raw.commit()
    assert r.status_code == 500 and ids(r.json()) == ["COM0033"]
    assert client.get("/api/orders", params={"custNo": TEST_CUST}).json()["total"] == before
    assert stock(client, IT1) == s1


def test_lock_is_reported_quickly(client: TestClient) -> None:
    _setup_order_data(client)
    from app.db import connect
    holder = connect()
    try:
        holder.cursor().execute(f"UPDATE {t('ITMMST')} SET STOCKQTY = STOCKQTY "
                                "WHERE ITEMNO = ?", IT2)   # uncommitted: the row stays locked
        t0 = time.monotonic()
        r = client.post("/api/orders", json=draft([new(IT2, 1)]))
        assert r.status_code == 409 and ids(r.json()) == ["COM0038"]
        assert time.monotonic() - t0 < 90
    finally:
        holder.rollback()
        holder.close()
    r = client.post("/api/orders", json=draft([new(IT2, 1)], cust_no=TEST_CUST2))
    assert r.status_code == 201
    assert client.delete(f"/api/orders/{r.json()['ordNo']}").status_code == 200


def test_orders_list_detail_dashboard(client: TestClient) -> None:
    page = client.get("/api/orders", params={"sort": "-total", "size": 1}).json()
    assert page["size"] == 1 and page["total"] >= 2
    d = client.get("/api/orders/10001").json()
    assert d["customerName"] == "ABC INDUSTRIES" and len(d["lines"]) == 3 and d["checksum"]
    assert ids(client.get("/api/orders/9999999").json()) == ["COM0023"]
    dash = client.get("/api/dashboard").json()
    assert len(dash["valueByDay"]) == 30 and dash["kpis"]["openOrders"] >= 2
    assert all(i["stockQty"] <= 5 for i in dash["lowStock"])


def test_shape_errors(client: TestClient) -> None:
    r = client.post("/api/orders", json={"ordNo": 0, "custNo": "x", "lines": []})
    assert r.status_code == 400 and ids(r.json())[0] == "API0002"
    r = client.post("/api/orders/validate", json=draft([new(IT1, 1)] * 26))
    assert ids(r.json()) == ["COM0030"]
