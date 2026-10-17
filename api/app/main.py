"""COM API - the web's door into IBM i.

    sh tools/tunnel_pub400.sh
    cd api && .venv/Scripts/uvicorn app.main:app --host 127.0.0.1 --port 8000

Reads may use SQL; every write goes through RPG (ORDSVC / CUSTSVC / ITEMSVC via stored
procedures). Docs: http://127.0.0.1:8000/docs
"""

import logging
import time
from collections.abc import AsyncIterator, Awaitable, Callable
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware

from . import db, errors, trace
from .config import get_settings
from .routers import masters, orders, system

log = logging.getLogger("com.api")


@asynccontextmanager
async def _lifespan(_: FastAPI) -> AsyncIterator[None]:
    db.warm()          # background sign-ons; startup doesn't wait for them
    yield
    db.drop_pool()


def create_app() -> FastAPI:
    settings = get_settings()   # fails fast on a bad library name or missing credentials
    app = FastAPI(
        title="COM API",
        version="1.0.0",
        lifespan=_lifespan,
        description=(
            "REST API over the COM order system on IBM i. **Reads may use SQL; every write "
            "goes through RPG**: ORDSVC, CUSTSVC and ITEMSVC, reached through SQL stored "
            "procedures. Errors are COM message IDs from COMMSGF, each with its field and "
            "line. Library: " + settings.pub400_lib
        ),
    )

    @app.middleware("http")
    async def _trace(request: Request,
                     call_next: Callable[[Request], Awaitable[Response]]) -> Response:
        trace.start()
        t0 = time.perf_counter()
        response = await call_next(request)
        if request.url.path.startswith("/api") and request.url.path != "/api/meta/trace":
            response.headers["X-COM-Trace"] = trace.header_value()
            trace.remember(request.method, request.url.path, response.status_code,
                           round((time.perf_counter() - t0) * 1000), None)
        return response

    # Added after the trace middleware, so CORS wraps it: headers land on every response.
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_methods=["GET", "POST", "PUT", "DELETE"],
        allow_headers=["Content-Type"],
        # Without this the browser hides the trace header from the "Under the hood" drawer.
        expose_headers=["X-COM-Trace"],
    )
    errors.install(app)
    app.include_router(system.router)
    app.include_router(masters.customers)
    app.include_router(masters.items)
    app.include_router(orders.router)
    return app


app = create_app()
