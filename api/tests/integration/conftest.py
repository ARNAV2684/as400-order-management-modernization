"""Integration tests: the real API in-process against IBM i through the tunnel.

Skipped when the tunnel is down. Test data lives in the 9000001+ range and is removed again,
so the demo data (orders 10001 / 10002) is never touched.
"""

from collections.abc import Iterator

import pyodbc
import pytest
from fastapi.testclient import TestClient

from app import db
from app.main import app

TEST_CUST = 9000001
TEST_CUST2 = 9000002
TEST_ITEMS = (9000001, 9000002, 9000003)


def pytest_collection_modifyitems(items: list[pytest.Item]) -> None:
    if db.reachable():
        return
    skip = pytest.mark.skip(reason="PUB400 not reachable (tunnel down, or no route if direct)")
    for it in items:
        if "integration" in str(it.fspath):
            it.add_marker(skip)


@pytest.fixture(scope="session")
def client() -> Iterator[TestClient]:
    with TestClient(app) as c:
        yield c


@pytest.fixture(scope="session")
def raw() -> Iterator[pyodbc.Connection]:
    """A plain ODBC connection for checks the API doesn't offer (cross-channel, locks)."""
    conn = db.connect()
    yield conn
    conn.rollback()
    conn.close()


def scalar(conn: pyodbc.Connection, sql: str, *params: object) -> object:
    v = conn.cursor().execute(sql, *params).fetchone()
    conn.commit()
    return v[0] if v else None


def cleanup(client: TestClient) -> None:
    """Remove every test order, then the test items and customers (FK order)."""
    for cust in (TEST_CUST, TEST_CUST2):
        page = client.get("/api/orders", params={"custNo": cust, "size": 100}).json()
        for o in page.get("items", []):
            client.delete(f"/api/orders/{o['ordNo']}")
    for item in TEST_ITEMS:
        client.delete(f"/api/items/{item}")
    for cust in (TEST_CUST, TEST_CUST2):
        client.delete(f"/api/customers/{cust}")


@pytest.fixture(scope="session", autouse=True)
def clean_range(client: TestClient) -> Iterator[None]:
    if not db.reachable():
        yield
        return
    cleanup(client)
    yield
    cleanup(client)
