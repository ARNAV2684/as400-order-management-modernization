"""ODBC access to Db2 for i through the SSH tunnel (handoff 5.3).

One connection per request (a FastAPI dependency), autocommit off, always rolled back at the end -
harmless after the RPG has already committed. Plain `def` endpoints: pyodbc blocks, and FastAPI
runs those in a thread pool.

Connections are POOLED here: signing on to IBM i over the tunnel takes 6-13 s (measured), a
statement ~0.5 s. A finished request rolls back and returns its connection; the next request
reuses it. A connection idle too long, or one that fails, is closed and replaced.
"""

import contextlib
import socket
import threading
import time
from collections.abc import Iterator
from typing import Any

import pyodbc

from . import trace
from .config import get_settings
from .errors import TunnelDown

# Our own pool (below); the driver manager's pooling doesn't keep IBM i jobs on Windows.
pyodbc.pooling = False
POOL_MAX = 4
IDLE_LIMIT_S = 240
_pool: list[tuple[pyodbc.Connection, float]] = []
_pool_lock = threading.Lock()


def _is_comm_failure(exc: pyodbc.Error) -> bool:
    state = str(exc.args[0]) if exc.args else ""
    return state.startswith("08") or state in ("HYT00", "HYT01")


def connect() -> pyodbc.Connection:
    try:
        conn = pyodbc.connect(get_settings().connection_string(), autocommit=False, timeout=10)
    except pyodbc.Error as exc:
        if _is_comm_failure(exc):
            raise TunnelDown() from None
        raise
    # A server-side hang (e.g. a program waiting on an inquiry message) becomes an error.
    conn.timeout = 60
    return conn


def _take() -> pyodbc.Connection:
    with _pool_lock:
        while _pool:
            conn, since = _pool.pop()
            if time.monotonic() - since < IDLE_LIMIT_S:
                return conn
            _close(conn)
    return connect()


def _give_back(conn: pyodbc.Connection, healthy: bool) -> None:
    try:
        conn.rollback()
    except pyodbc.Error:
        healthy = False
    with _pool_lock:
        if healthy and len(_pool) < POOL_MAX:
            _pool.append((conn, time.monotonic()))
            return
    _close(conn)


def _close(conn: pyodbc.Connection) -> None:
    with contextlib.suppress(pyodbc.Error):
        conn.close()


def warm() -> None:
    """Sign on POOL_MAX connections in parallel, so the first page doesn't pay 4 x 6-13 s."""
    if not reachable():
        return

    def one_more() -> None:
        with contextlib.suppress(pyodbc.Error, TunnelDown):
            _give_back(connect(), healthy=True)

    workers = [threading.Thread(target=one_more, daemon=True) for _ in range(POOL_MAX)]
    for w in workers:
        w.start()


def drop_pool() -> None:
    """Forget every pooled connection (the tunnel went down)."""
    with _pool_lock:
        old = [c for c, _ in _pool]
        _pool.clear()
    for c in old:
        _close(c)


def get_conn() -> Iterator[pyodbc.Connection]:
    conn = _take()
    healthy = True
    try:
        yield conn
    except TunnelDown:
        healthy = False
        drop_pool()
        raise
    except pyodbc.Error:
        healthy = False
        raise
    finally:
        _give_back(conn, healthy)


def ping() -> None:
    """Health probe on a pooled connection; a dead one is replaced once."""
    for attempt in (1, 2):
        conn = _take()
        try:
            one(conn, "SELECT 1 FROM SYSIBM.SYSDUMMY1", (), "SELECT 1 FROM SYSIBM.SYSDUMMY1")
            _give_back(conn, True)
            return
        except TunnelDown:
            _close(conn)
            drop_pool()
            if attempt == 2:
                raise


def reachable(timeout: float = 1.5) -> bool:
    """Does the database host server answer (the tunnel entrance, or PUB400 in direct mode)?"""
    try:
        with socket.create_connection(get_settings().db_endpoint, timeout=timeout):
            return True
    except OSError:
        return False


def rows(conn: pyodbc.Connection, sql: str, params: tuple[Any, ...], target: str) -> list[Any]:
    """Run a SELECT, recorded as one SQL trace step."""
    with trace.step("SQL", target):
        try:
            return list(conn.cursor().execute(sql, *params).fetchall())
        except pyodbc.Error as exc:
            if _is_comm_failure(exc):
                raise TunnelDown() from None
            raise


def one(conn: pyodbc.Connection, sql: str, params: tuple[Any, ...], target: str) -> Any:
    found = rows(conn, sql, params, target)
    return found[0] if found else None


def lib() -> str:
    return get_settings().pub400_lib


def t(name: str) -> str:
    """Qualified name LIB.NAME (the library is validated in config, so this is safe in SQL)."""
    return f"{lib()}.{name}"
