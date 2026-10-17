# Demo script: one order, two channels (about 10 minutes)

The story: **the same RPG rules serve a 1990s-style green screen and a modern web app at once.**
Nothing was rewritten; the web is a new door into the same building.

## Before the audience arrives

1. `sh tools/tunnel_pub400.sh` (keep the window open).
2. `cd api && .venv/Scripts/uvicorn app.main:app --port 8000`, then wait for the pill to go green (the first
   sign-on takes about 10 s).
3. `cd web && npm run dev` and open http://localhost:5173 in a wide window, light theme.
4. In ACS / 5250: sign on, `CALL ARNAV27122/COMSTART`, and leave it on the menu.
5. Optional reset to the known data: `CALL ARNAV27122/LOADDATA` (2 orders, 124,750.00).
6. Open **Under the hood** once, so you know where it is.

PUB400 is a shared public machine. A call takes 0.5–7 s, so say that out loud once and then let it work.

## 1. The building (1 min): System page

- Open **System**. Show the diagram: browser → FastAPI → stored procedures → RPG service programs → files.
- Point at the rule: **reads may use SQL, every write goes through RPG**, the same ORDSVC the 5250 calls.

## 2. Same data, two screens (1 min)

- Web: **Orders**. 10001 ABC INDUSTRIES 96,850.00 and 10002 SHARMA TRADERS 27,900.00.
- 5250: menu option **3**. The same two orders.

## 3. The RPG validates the web (3 min): New order

- Web: **Orders → New order** (Alt+N). In the customer picker, **2005** is greyed out (inactive). That is only
  a convenience: the RPG refuses it anyway with COM0010 "Customer is inactive - orders not allowed.", and the
  API tests prove it. Pick **2001**.
- Add item **5005 LASER PRINTER**, qty 1. COM0019 "Only 0 in stock for item 5005." appears on *that line*.
- Change it to **5004 24 INCH MONITOR**, qty 2. Add **5002**, qty 3. The total is ORDSVC's, not the browser's.
- Open **Under the hood**: `PROC ORDSVC_API → ORDSVC (RPGLE) · action VA`. That is the RPG checking a draft
  without writing anything.
- **Save** (Alt+S): "Order 100xx created." Note the number.

## 4. Cross-channel (2 min)

- 5250: F3 back to the menu, option **3** again. **The new order is there**. Put `X` next to it and press Enter to see the same lines.
- Web: **Items → 5004**. Stock went down by 2.
- Web: **Audit log**. `A · WEB` for the new order.
- 5250: `X` next to the new order, **F6** = Edit, change a qty, F10. Web **order detail**: the audit trail now shows `U · 5250`.

## 5. Safety under concurrency (2 min)

- Web: open the same order in the editor and **leave it open**.
- 5250: `X` + F6 on the same order, change a qty, F10.
- Web: change a qty and **Save**. **COM0039** "Order … was changed since you opened it - reload and try again." offers a reload.
  The fingerprint comes from ORDSVC action CK, the same check on both channels.

## 6. Delete gives the stock back (1 min)

- Web: order detail → **Delete**. "Order 100xx deleted." Item 5004's stock is back. The audit trail shows `D · WEB`.

## If something goes wrong

| You see | Do |
|---|---|
| Red pill "Tunnel down", banner | Restart `tools/tunnel_pub400.sh`, then **Check again** |
| "API offline" | Start uvicorn (step 2) |
| COM0038 "… is being changed by another user" | A 5250 session holds the record. Leave that screen (F12) |
| Very slow | PUB400 is busy. Keep talking; Under the hood shows every step's timing |

## Questions people ask

- **Why not rewrite it in Python?** The rules are proven, and the green screen still runs the business.
  One rule set behind both doors means they can never disagree.
- **How does the web get IBM i errors?** The RPG fills an error buffer: message ID, field, line. The API
  returns it as JSON, and the browser puts each message on the field or line it belongs to.
- **What if a save fails half-way?** ORDSVC runs under commitment control: header, lines and stock commit
  together or roll back together. The tests force a failure (`COMTSTFAIL`) to prove it.
- **Where does the audit come from?** From the journal (view ORDAUDJV). PUB400 doesn't allow triggers, so
  journal entries for rolled-back work are filtered out.
