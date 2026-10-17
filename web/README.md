# COM web — the modern front door to the IBM i order system

React front end for **COM** (Customer Order Management), the green-screen order-entry app on IBM i
built in `../ibmi/`. Same database, same RPG rules, new front door.

> **The one principle: reads may use SQL, every write goes through RPG.**
> The browser only checks shape (digits, lengths). "Customer already exists", "only 4 in stock",
> "can't delete, it has orders" all come back from the RPG as COM messages, and the UI puts each one
> on the field or order line it belongs to.

**Status (2026-10-15):** done and running on real data. The app talks to the COM API (`../api/`,
FastAPI, Sprints 9–10), which calls the RPG service programs ORDSVC / CUSTSVC / ITEMSVC (Sprint 8) in
library ARNAV27122 on PUB400. The in-browser mock used while the backend was being built is gone.

---

## Run it

```sh
sh ../tools/tunnel_pub400.sh                 # 1. SSH tunnel to IBM i (ODBC ports)
cd ../api && .venv/Scripts/uvicorn app.main:app --port 8000   # 2. the COM API
npm install && npm run dev                   # 3. http://localhost:5173
```

The API only accepts CORS calls from `localhost:5173`. Its setup is in `../api/README.md`.

| Script           | What it does                                                                                      |
| ---------------- | ------------------------------------------------------------------------------------------------- |
| `npm run dev`    | Dev server (needs the API on 127.0.0.1:8000)                                                      |
| `npm run build`  | Type-check (`tsc -b`) + production build (one chunk per page)                                     |
| `npm test`       | Vitest unit tests                                                                                 |
| `npm run a11y`   | axe-core scan of every screen, light and dark, in the installed Edge (dev server must be running) |
| `npm run lint`   | oxlint                                                                                            |
| `npm run format` | Prettier with Tailwind class sorting                                                              |

Settings (`.env.local`, see `.env.example`): `VITE_API_BASE` (default `http://127.0.0.1:8000`).
No secrets ever go in the frontend.

---

## What's in it

| Screen           | Replaces          | Highlights                                                                                                                             |
| ---------------- | ----------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Dashboard        | (new)             | Open orders, order value, active customers, low stock; order value per day (30 days); top items; recent orders and audit               |
| Orders           | ORDPGM list       | Customer filter, server-side sort and paging (all in the URL)                                                                          |
| Order detail     | ORDPGM display    | Lines, total, **audit trail** with WEB / 5250 source                                                                                   |
| Order editor     | ORDPGM add / edit | ORDSVC checks the draft 400 ms after each change; errors on the exact line; the total is ORDSVC's; handles COM0039 / COM0038 / COM0033 |
| Customers, Items | CUSTPGM, ITEMPGM  | Search, filters, add/edit side panel with RPG validation on blur, delete → "Set Inactive instead" on COM0009 / COM0017                 |
| Audit log        | (new)             | Filters by order / action / source, 10 s auto-refresh for the demo                                                                     |
| System           | (new)             | Architecture diagram, the principle, live connection, IBM i objects behind each screen                                                 |
| Under the hood   | (new)             | Every API call with the IBM i steps it ran (`PROC ORDSVC_API → ORDSVC (RPGLE) · action SE · 84 ms ✓`)                                  |

### Keyboard

| Keys    | Action                                                                         | Green screen  |
| ------- | ------------------------------------------------------------------------------ | ------------- |
| Ctrl+K  | Command palette: pages, actions, any order / customer / item by number or name | menu option   |
| `/`     | Search the list on this page                                                   |               |
| Alt+N   | New order / customer / item                                                    | F5            |
| Alt+1–6 | Go to menu option 1–6 (Dashboard … System)                                     | option number |
| Alt+G   | Flip a list to its 5250 twin and back                                          |               |
| Alt+S   | Save                                                                           | F10           |
| Esc     | Cancel / close                                                                 | F12           |
| `?`     | Shortcut list                                                                  |               |

---

## Design: "modern ledger, green-screen heritage"

The app should look like what it is: a modern front door on an IBM i system, not a generic admin template.

- **Type:** IBM Plex Sans (body; its condensed width for headings and figures) and IBM Plex Mono for
  numbers and codes. It's IBM's own typeface, for an IBM i product.
- **Colour:** warm "ledger paper" neutrals, one teal accent, and a dark ink sidebar in both themes.
  Phosphor green is used **only** for the 5250 world (the twin and live IBM i signals).
- **Ledger details:** mono uppercase column labels over an ink rule, tabular figures, and a double-ruled
  page total on the order list.
- **Motion:** one staggered entrance per page, count-up figures on the dashboard, a packet on the System
  diagram for each real call. All of it switches off with "reduce motion".

What's interactive:

| Feature                 | Where                                                               | What it does                                                                                                                                                                                                                                        |
| ----------------------- | ------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **5250 twin**           | Orders, Customers, Items (`Web / 5250` switch, Alt+G, `?view=5250`) | The same live rows drawn exactly where the DDS puts them (ORDDSPF / CUSTDSPF / ITEMDSPF), with the real edit codes Z / 1 / J. Click or Enter = X, Page Down / Up = Roll (with the system's "roll past" message), X SYSTEM while loading, Esc = back |
| **IBM i heartbeat**     | Dashboard                                                           | One tick per API call this tab made; height = time taken, colour = RPG call / SQL read / failure. A tick opens Under the hood                                                                                                                       |
| **Where the book sits** | Dashboard                                                           | Each order's share of the open order book                                                                                                                                                                                                           |
| **Quick views + peek**  | Orders                                                              | Shopify-style views (Newest / Oldest / Highest value / Smallest), a Stripe-style peek panel with the lines, copyable order numbers                                                                                                                  |
| **Request waterfall**   | Under the hood                                                      | Each IBM i step drawn where it ran in the request; what's left is API + tunnel time                                                                                                                                                                 |
| **Live packet**         | System                                                              | The architecture diagram animates the path each real call took (through RPG for writes, straight to the files for reads)                                                                                                                            |
| **Signal meter**        | Top bar                                                             | Tunnel latency as 1–3 bars                                                                                                                                                                                                                          |

## How it's built

React 19 + TypeScript (strict) · Vite · Tailwind v4 + Radix primitives (via shadcn/ui, restyled) · React Router 7 (lazy routes) ·
TanStack Query 5 + Table 8 · React Hook Form + Zod (shape only) · Recharts ·
Vitest · Playwright + axe-core (accessibility scan).

```
src/
├── api/          the only code that talks HTTP: client (ApiError, trace capture), types, query keys, hooks
├── app/          router (one lazy chunk per page), sidebar nav
├── components/
│   ├── ui/       shadcn components (generated; command.tsx has one a11y fix, marked "COM:")
│   ├── layout/   AppShell, Topbar, ConnectionPill, BackendBanner, CommandPalette, GlobalOverlays, Page
│   ├── data/     DataTable, Pagination, badges, Money, pickers, Empty / Error states, DeleteDialog
│   ├── forms/    FormSheet, Field, SaveButton, server-side validation hook
│   ├── green-screen/  the 5250 twin: 24×80 screen buffer + edit codes, the three DDS list layouts, toggle
│   └── theme/    light / dark / system
├── features/     one folder per screen; orders/editor/ is the order editor; inspector/ is Under the hood
└── lib/          money (₹ from decimal strings), dates, hotkeys, URL list params, UI state
```

Rules the code follows:

- **Money is a decimal string** end to end (`"96850.00"`); `Intl.NumberFormat("en-IN")` formats the string.
- **The API's error contract** (`{errors:[{id,text,field,line}], traceId}`) becomes a typed `ApiError` in
  one place; screens place messages by `field` / `line`.
- **Saves never retry**; reads retry once, never on 4xx or when the backend is down.
- **Backend down** (status 0 or 503 API0001): red pill, banner with the fix, every save switched off.
- **Stale edits**: orders carry a checksum; ORDSVC refuses a save on changed data with COM0039.
- Text is saved **in capitals**, because the 5250 display files have no `CHECK(LC)`.
- **Accessibility**: `npm run a11y` passes WCAG 2.1 AA on every screen (and the 5250 twin) in both themes.


---

## How it was built against a backend that didn't exist yet

Sprints 11–13 came before the API. The screens were built on an in-browser MSW mock that spoke the
handoff §5 contract and copied the RPG rules (same message IDs, same order). In Sprint 10 the mock was
switched off, every screen was checked against the real API, and then the mock was deleted
(`src/mocks/`, the service worker, the `msw` dependency, `VITE_USE_MOCKS`, the failure simulator).

**Nothing in `features/` had to change for the switch**, so the contract held. Two findings came from
the real backend:

- The Ctrl+K palette fired two empty searches on every page load. The mock answered in milliseconds;
  over the tunnel each one is a real Db2 round trip. The searches now wait until something is typed.
- Signing on to IBM i takes 6–13 s per ODBC connection, so the API keeps a small pool and warms it at
  start-up.

Verified on 2026-10-15 with Playwright in Edge: all 11 screens load real PUB400 data with no console
errors; an order edit saved through the UI (ORDSVC SE) moved stock by the net change and was put back;
44 Vitest tests; `npm run a11y` on real data.
