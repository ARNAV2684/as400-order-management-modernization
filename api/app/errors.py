"""The error contract (handoff 5.6): every failure is {errors:[{id,text,field,line}], traceId}."""

from typing import Any

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

from . import trace

# API-level messages (COM messages come from COMMSGF, see messages.py).
API_TEXTS = {
    "API0000": "Can't reach the COM API. Is it running on 127.0.0.1:8000?",
    "API0001": "Can't reach PUB400 - is the SSH tunnel running? (sh tools/tunnel_pub400.sh)",
    "API0002": "Request is not valid.",
    "API0003": "Unexpected server error - nothing was saved.",
}


def api_text(id_: str) -> str:
    """API message text; API0001 names the right fix for how this API reaches IBM i."""
    if id_ == "API0001":
        from .config import get_settings

        if get_settings().pub400_direct:
            return "Can't reach PUB400 directly - check the internet connection or PUB400's status."
    return API_TEXTS[id_]


def item(id_: str, text: str, field: str | None = None, line: int | None = None) -> dict[str, Any]:
    return {"id": id_, "text": text, "field": field, "line": line}


class ApiError(Exception):
    """Raised anywhere in a request; turned into the contract JSON with this HTTP status."""

    def __init__(self, status: int, errors: list[dict[str, Any]]) -> None:
        super().__init__(errors[0]["text"] if errors else str(status))
        self.status = status
        self.errors = errors


class TunnelDown(Exception):
    """ODBC could not reach the database (SQLSTATE 08xxx / login timeout)."""


def api_error(status: int, id_: str, field: str | None = None) -> ApiError:
    return ApiError(status, [item(id_, api_text(id_), field)])


def _body(errors: list[dict[str, Any]]) -> dict[str, Any]:
    return {"errors": errors, "traceId": trace.trace_id()}


def install(app: FastAPI) -> None:
    @app.exception_handler(ApiError)
    async def _api(_: Request, exc: ApiError) -> JSONResponse:
        return JSONResponse(_body(exc.errors), status_code=exc.status)

    @app.exception_handler(TunnelDown)
    async def _tunnel(_: Request, __: TunnelDown) -> JSONResponse:
        return JSONResponse(_body([item("API0001", api_text("API0001"))]), status_code=503)

    @app.exception_handler(RequestValidationError)
    async def _shape(_: Request, exc: RequestValidationError) -> JSONResponse:
        errors = []
        for e in exc.errors():
            loc = [str(p) for p in e.get("loc", []) if p not in ("body", "query", "path")]
            errors.append(item("API0002", f"{API_TEXTS['API0002']} {e.get('msg', '')}".strip(),
                               ".".join(loc) or None))
        return JSONResponse(_body(errors or [item("API0002", API_TEXTS["API0002"])]),
                            status_code=400)

    @app.exception_handler(Exception)
    async def _unexpected(_: Request, __: Exception) -> JSONResponse:
        # Details stay in the server log; the browser gets a safe message.
        return JSONResponse(_body([item("API0003", API_TEXTS["API0003"])]), status_code=500)
