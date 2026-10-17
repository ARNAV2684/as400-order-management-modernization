"""Health and meta: is the tunnel up, the COM message texts, the recent IBM i traces."""

import time
from typing import Any

from fastapi import APIRouter, Depends

from .. import db, messages, trace
from ..config import get_settings
from ..errors import TunnelDown
from ..schemas import Health, Message

router = APIRouter(prefix="/api", tags=["system"])


@router.get("/health", response_model=Health, summary="Is the tunnel up and IBM i answering?")
def health() -> dict[str, Any]:
    s = get_settings()
    # "tunnel" = the network path to IBM i (the SSH tunnel, or PUB400 itself in direct mode).
    out: dict[str, Any] = {"api": "ok", "tunnel": "down", "db": "down", "latencyMs": None,
                           "system": s.system_name, "library": s.pub400_lib,
                           "connection": s.connection_mode}
    if not db.reachable():
        return out
    out["tunnel"] = "ok"
    try:
        t0 = time.perf_counter()
        db.ping()
        out["db"] = "ok"
        out["latencyMs"] = round((time.perf_counter() - t0) * 1000)
    except TunnelDown:
        pass
    return out


@router.get("/meta/messages", response_model=list[Message],
            summary="All COM message texts (COMMSGF) plus the API's own")
def all_messages(conn: Any = Depends(db.get_conn)) -> list[dict[str, str]]:
    return messages.all_messages(conn)


@router.get("/meta/trace", summary="The last 200 requests and the IBM i steps each one ran")
def recent_traces() -> list[dict[str, Any]]:
    return list(trace.RING)
