# COM API: the web's door into the RPG

FastAPI service between the React app (`../web/`) and the COM order system on IBM i
(Sprints 9–10).

> **Reads may use SQL; every write goes through RPG.**
> Lists and detail pages `SELECT` straight from the files and views. Every add, change and delete
> calls an SQL stored procedure (`ORDSVC_API`, `CUSTSVC_API`, `ITEMSVC_API`) that calls the same RPG
> service program the 5250 green screen uses. The API never re-implements a business rule.

```
React ──REST/JSON──▶ FastAPI ──ODBC (SSH tunnel)──▶ *_API (SQL PL) ──▶ *_X (external) ──▶ ORDSVC / CUSTSVC / ITEMSVC (RPGLE)
                        └──────── read-only SELECT ──▶ CSTMST · ITMMST · ORDSUMV · ORDDTL · ORDAUDJV
```

## Run it

```sh
sh ../tools/tunnel_pub400.sh                    # SSH tunnel (skip it when PUB400_DIRECT is set)
python -m venv .venv
.venv/Scripts/pip install -e ".[dev]"           # (bin/ instead of Scripts/ on Linux / macOS)
.venv/Scripts/uvicorn app.main:app --host 127.0.0.1 --port 8000
```

Interactive docs: http://127.0.0.1:8000/docs. You also need the **IBM i Access ODBC Driver**.

Settings come from the repo-root `.env` (git-ignored; see `../.env.example`):

| Variable | Meaning |
|---|---|
| `PUB400_USER`, `PUB400_PASS` | IBM i sign-on (never logged, `SecretStr`) |
| `PUB400_LIB` | Library, default `ARNAV27122`. The frozen green-screen baseline `ARNAV27121` is refused at start-up |
| `COM_AUDIT_TABLE` | `ORDAUDJV` (journal view, PUB400) or `ORDAUD` (trigger-written table) |
| `PUB400_DIRECT` | How to reach IBM i: blank = SSH tunnel (default); `plain` = straight to the host on 8471, **unencrypted**; `tls` = straight to the host on 9471 with `SSL=1` (the server certificate must be trusted by the ODBC driver) |
| `PUB400_HOST` | The host, for the direct modes only (`.env` only, never in the repo) |

## Endpoints

| Method | Path | IBM i | Success |
|---|---|---|---|
| GET | `/api/health` | socket check + `SELECT 1` | `{api, tunnel, db, latencyMs, system, library}` |
| GET | `/api/meta/messages` | `QSYS2.MESSAGE_FILE_DATA` (COMMSGF) | all COM + API texts |
| GET | `/api/meta/trace` | none | the last 200 requests with their IBM i steps |
| GET | `/api/customers?q&status&page&size` | `SELECT CSTMST` | page |
| GET | `/api/customers/{no}` | `SELECT CSTMST` + order count | detail / 404 COM0006 |
| POST | `/api/customers/validate?mode=add\|edit` | CUSTSVC V / U | 200 `{valid, errors}` |
| POST / PUT / DELETE | `/api/customers[/{no}]` | CUSTSVC A / E / D | 201 / 200 `{message}` |
| … | `/api/items…` | the same with ITEMSVC | |
| GET | `/api/orders?custNo&sort&page&size` | `SELECT ORDSUMV` | page |
| GET | `/api/orders/{no}` | ORDSUMV + ORDDTL, **ORDSVC CK** fingerprint | detail with `checksum` / 404 COM0023 |
| POST | `/api/orders/validate` | ORDSVC VA / VE (nothing written) | 200 `{valid, customerName, total, lines, errors}` |
| POST | `/api/orders` | ORDSVC SA (one commit) | 201 `{ordNo, message}` |
| PUT | `/api/orders/{no}` | ORDSVC SE + checksum | 200 / 409 COM0039 if changed meanwhile |
| DELETE | `/api/orders/{no}` | ORDSVC DL (stock back, one commit) | 200 |
| GET | `/api/orders/{no}/audit`, `/api/audit` | ORDAUDJV | A / U / D with WEB or 5250 |
| GET | `/api/dashboard` | several SELECTs | KPIs, 30 days, top items, low stock, recent |

## Errors: COM messages, on the right field and line

Every failure has the same shape: `{"errors": [{"id", "text", "field", "line"}], "traceId"}`.

- `id` is the COMMSGF message the RPG returned (`COM0019`), with `&1` / `&2` filled in;
- `field` is the camelCase field (`ERRFLD` `QTY` → `qty`);
- `line` is the **0-based index into the request's `lines`** (`ERRLINE` n → n − 1).

| Status | When |
|---|---|
| 400 API0002 | The request has the wrong shape (types, missing fields, path ≠ body number) |
| 404 | COM0006 / COM0013 / COM0023: not found |
| 409 | COM0005 / COM0012 / COM0024 duplicate; COM0009 / COM0017 delete blocked; **COM0038** record locked; **COM0039** stale edit |
| 422 | Any other RPG validation error |
| 500 | COM0033: the RPG rolled back (the file status is in the text); API0003 unexpected |
| 503 API0001 | The tunnel is down. The web turns every save off |

## How the RPG is called (`app/ibmi/`)

The service programs take **fixed-width character buffers**: 25 order lines × 88 bytes in, 30 errors ×
60 bytes out, numbers as zoned decimals. `buffers.py` builds and parses them (unused slots are filled so
they are valid numbers); `svc.py` calls the `*_API` procedure, which returns its OUT parameters as one
result-set row (pyodbc can't read OUT parameters from IBM i reliably); `errmap.py` turns the error
entries into the JSON above.

Each `*_API` procedure starts with `CHGCURLIB` and runs `SET OPTION COMMIT = *CHG`. Without the first,
an ODBC job uses the profile's current library and opens the wrong files. Without the second, a
procedure created with `COMMIT(*NONE)` can't call RPG that opens commit-controlled files (CPF4326).

## Design notes

- **Connection pool** (`db.py`): signing on over the tunnel takes 6–13 s, a statement about 0.5 s. Up to 4
  connections are kept, warmed in the background at start-up, rolled back on return and dropped after
  4 idle minutes or a communication error.
- **Locks don't hang**: a 60 s query timeout, and ORDSVC uses `(E)` on its reads, so a row held by another
  job comes back as COM0038.
- **Trace**: each response carries `X-COM-Trace` (base64 JSON of the SQL / PROC steps it ran, with
  timings). CORS exposes it, and the web's "Under the hood" drawer shows it.
- **Security**: binds to 127.0.0.1, CORS allows `localhost:5173` only, no authentication (local demo).
  Every SQL value is a bound parameter; sort columns come from a whitelist.
- **Money** is `Decimal` internally and a string (`"96850.00"`) in JSON.

## Tests

```sh
.venv/Scripts/python -m pytest tests/unit          # 23 tests, no IBM i needed
.venv/Scripts/python -m pytest tests/integration   # 11 tests against IBM i (skipped if the tunnel is down)
.venv/Scripts/ruff check app tests && .venv/Scripts/python -m mypy app
```

The integration tests use customers and items **9000001+** and remove them again, so the demo data stays
as it is. They cover CRUD for customers and items, delete blocking, order validation errors on the exact
line and field, and create → edit → stale edit → delete with exact stock checks. They also check that the
audit trail shows A / U / D from WEB, and that a cross-channel read sees what the RPG wrote. A forced
rollback (data area `COMTSTFAIL`) must leave nothing behind, and a row locked by a second connection must
answer COM0038 instead of hanging.
