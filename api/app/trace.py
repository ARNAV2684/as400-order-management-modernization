"""Per-request trace of every IBM i interaction (handoff 5.7).

Steps are sent back in the X-COM-Trace header (base64 of UTF-8 JSON: the targets contain "→")
and the last 200 requests are kept for GET /api/meta/trace. Only object names, action codes and
timings - never parameter values or credentials.
"""

import base64
import json
import secrets
import time
from collections import deque
from collections.abc import Iterator
from contextlib import contextmanager
from contextvars import ContextVar
from typing import Any

_steps: ContextVar[list[dict[str, Any]] | None] = ContextVar("com_trace_steps", default=None)
_trace_id: ContextVar[str] = ContextVar("com_trace_id", default="-")
RING: deque[dict[str, Any]] = deque(maxlen=200)


def start() -> str:
    tid = secrets.token_hex(3)
    _trace_id.set(tid)
    _steps.set([])
    return tid


def trace_id() -> str:
    return _trace_id.get()


def steps() -> list[dict[str, Any]]:
    return list(_steps.get() or [])


@contextmanager
def step(kind: str, target: str, action: str | None = None) -> Iterator[None]:
    """Time one SQL statement or procedure call; ok=False if it raised."""
    t0 = time.perf_counter()
    ok = False
    try:
        yield
        ok = True
    finally:
        current = _steps.get()
        if current is not None:
            current.append({
                "kind": kind,
                "target": target,
                "action": action,
                "ms": round((time.perf_counter() - t0) * 1000),
                "ok": ok,
            })


def header_value() -> str:
    payload = json.dumps({"traceId": trace_id(), "steps": steps()}, ensure_ascii=False,
                         separators=(",", ":"))
    return base64.b64encode(payload.encode("utf-8")).decode("ascii")


def remember(method: str, path: str, status: int, ms: int, error: dict[str, str] | None) -> None:
    record: dict[str, Any] = {
        "traceId": trace_id(), "at": int(time.time() * 1000), "method": method, "path": path,
        "status": status, "ms": ms, "steps": steps(),
    }
    if error:
        record["error"] = error
    RING.appendleft(record)
