"""HTTP behaviour that needs no IBM i: tunnel down -> 503 API0001, CORS exposes the trace."""

from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient

from app import db
from app.config import Settings
from app.errors import TunnelDown
from app.main import app


@pytest.fixture
def down(monkeypatch: pytest.MonkeyPatch) -> Iterator[TestClient]:
    def no_db() -> None:
        raise TunnelDown()

    monkeypatch.setattr(db, "_take", no_db)
    monkeypatch.setattr(db, "reachable", lambda *a, **k: False)
    with TestClient(app, raise_server_exceptions=False) as c:
        yield c


def test_tunnel_down_is_503_api0001(down: TestClient) -> None:
    r = down.get("/api/customers")
    assert r.status_code == 503
    body = r.json()
    assert body["errors"][0]["id"] == "API0001" and body["traceId"]
    assert "X-COM-Trace" in r.headers


def test_health_reports_down_without_failing(down: TestClient) -> None:
    h = down.get("/api/health").json()
    assert h["tunnel"] == "down" and h["db"] == "down" and h["latencyMs"] is None


def test_cors_exposes_trace_header(down: TestClient) -> None:
    r = down.get("/api/health", headers={"Origin": "http://localhost:5173"})
    assert r.headers["access-control-allow-origin"] == "http://localhost:5173"
    assert "X-COM-Trace" in r.headers["access-control-expose-headers"]


def test_baseline_library_is_refused() -> None:
    with pytest.raises(ValueError):
        Settings(pub400_user="x", pub400_pass="y", pub400_lib="ARNAV27121")  # type: ignore[arg-type]


def _settings(**kw: str) -> Settings:
    # _env_file=None: these tests must not depend on what the real .env says.
    return Settings(_env_file=None, pub400_user="u", pub400_pass="p", **kw)  # type: ignore[arg-type,call-arg]


def test_tunnel_is_the_default() -> None:
    s = _settings()
    assert s.connection_mode == "tunnel" and s.db_endpoint == ("127.0.0.1", 8471)
    assert "SYSTEM=127.0.0.1;" in s.connection_string() and "SSL" not in s.connection_string()


def test_direct_plain_and_tls() -> None:
    plain = _settings(pub400_direct="plain", pub400_host="ibmi.example")
    assert plain.connection_mode == "direct-plain" and plain.db_endpoint == ("ibmi.example", 8471)
    assert "SYSTEM=ibmi.example;" in plain.connection_string()
    assert "SSL" not in plain.connection_string()
    tls = _settings(pub400_direct="tls", pub400_host="ibmi.example")
    assert tls.db_endpoint == ("ibmi.example", 9471) and tls.connection_string().endswith("SSL=1;")


def test_direct_needs_a_host() -> None:
    with pytest.raises(ValueError):
        _settings(pub400_direct="plain")
