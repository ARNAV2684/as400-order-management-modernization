# Sprint 7C: debugging exercises, final test pass, viva cheat-sheet

Written 2026-10-13 for PUB400 (library **ARNAV27121**). Everything below runs there.
Line numbers refer to the baseline `ORDPGM` in ARNAV27121 (tag `greenscreen-v2`, 2026-10-15). If ORDPGM changes, find the line again with F16 (Find) in the debugger.

---

## Part 1: Debugging exercises (PDF §11)

### How every exercise starts

1. On a 5250 session, run `STRDBG PGM(ARNAV27121/ORDPGM) UPDPROD(*YES)`.
   ARNAV27121 is a `*PROD` library. Without `UPDPROD(*YES)`, debug mode won't let the program change its files.
2. In the source view:
   - F6 on a line sets a breakpoint, and F6 again removes it;
   - F16 searches for text;
   - **F12 leaves the view (the program carries on)**.
3. `CALL ARNAV27121/COMSTART`, then go to the screen in question. The program stops on the breakpoint line *before* running it.
4. While it's stopped:

   | Key / command | What it does |
   |---|---|
   | **F11** | with the cursor on a variable, shows its value |
   | **`EVAL x`** | shows `x` |
   | **`EVAL x = value`** | changes `x` |
   | **F10** | steps one statement |
   | **F12** | runs on to the next breakpoint |
   | **F3** | ends the debug session's program |

5. When you're done, run `ENDDBG`.

The indicators can be inspected too, e.g. `EVAL *IN36`, and so can subfile fields such as DQTY or DITEM.

**The same line can be hit from other paths.** LoadList (line 145) runs when the order list first appears, and ShowLines (line 977) runs in Display, Add and Edit. At a stop you don't need, just press F12.

**Two exercises are adapted.** The PDF assumed *program-controlled* paging (a page counter and SFLRCDNBR). We chose **system paging** (option B, 2026-10-09), so exercises 1 and 6 check what replaces it.

### Exercise 1: "Lines Page Down does not work" (adapted)

- **Where:** line **977** in `ShowLines` (`*in36 = (DRrn > 0);`).
- **Steps:** X + Enter on order **10002** (4 lines), so it stops at 977. Then:
  1. `EVAL DRrn`
  2. F10 three times
  3. `EVAL *IN36`, `EVAL *IN37`, `EVAL *IN39`
- **Correct:**
  - DRrn = 4 (the rows written);
  - 36 (SFLDSP) = '1', 37 (SFLDSPCTL) = '1', 39 (SFLEND(*MORE)) = '1'.
  - With SFLPAG 5 and only 4 rows, there's **nothing to page**: the screen says *Bottom*, and Page Down shows the system's "roll past last record" message. That's correct, not a bug.
  - Do the same in **Edit** (F6) or **Add** (F5): DRrn = **25**, so Page Down scrolls 5 rows at a time and *More...* shows until the last page.
- **What a real fault would look like:** DRrn = 0 (no rows written), or 39 off (no More/Bottom marker). In DDS, SFLSIZ must be larger than SFLPAG (25 / 5) for the system to page at all.

### Exercise 2: "Existing order shows as not found"

- **Where:** line **228** in `ShowOrder` (`chain(n) pOrd ORDHDR;`).
- **Steps:**
  1. X + Enter on 10001, so it stops at 228. `EVAL pOrd` should show 10001.
  2. **Make the fault:** `EVAL pOrd = 99999`, then F10 twice.
  3. You land in the `not %found` branch, and F12 shows **COM0023 "Order not found."**
- **What to check in a real case:**
  - the key value (pOrd);
  - **the file used:** ORDHDR is keyed by ORDNO. ORDHDRL1 is keyed by CUSTNO + ORDNO, so a CHAIN with just an order number there finds the wrong thing;
  - **the library list** (`DSPLIBL`): the wrong library's ORDHDR is the classic cause, as with OLDLIB in Sprint 1;
  - after the CHAIN, whether `%FOUND` is on. The debugger can't EVAL %FOUND; step with F10 and see which branch runs.

### Exercise 3: "Total amount is wrong"

- **Where:** line **650** in `ValidateOrder` (`Total += DAMT;`).
- **Steps:**
  1. F5 → customer 2001 → item 5002 qty 3 → Enter. It stops at 650.
  2. `EVAL DQTY` = 3, `EVAL DPRICE` = 650.00, `EVAL DAMT` = 1950.00, `EVAL Total` (before the add).
  3. **Make the fault:** `EVAL DAMT = 1`, then F12.
  4. The screen total shows **1.00**, not 1,950.00.
- **What to check:** QTY, PRICE and AMOUNT per row, and that Total starts at 0 for each validation (it's a local variable, so it does).
- **Viva point:** the **line** AMOUNT is protected by the constraint AMOUNT = QTY × PRICE. The **header** TOTAMT has no constraint tying it to the sum of its lines, so only the program keeps it right.

### Exercise 4: "Lines remain after deleting an order"

- **Where:** line **343** in `DeleteOrder` (`delete(e) ORDDREC;`).
- **Steps:**
  1. X + F7 on an order with 2 or more lines → F10. It stops at 343.
  2. `EVAL ORDNO`, `EVAL LINENO`, `EVAL pOrd`. ORDNO must equal pOrd.
  3. F12 → it stops again for the next line. On the last line, F10 step by step: the `reade(e)` at 348 finds no more rows, `%EOF` is on, and the loop ends.
- **What to check:**
  - the READE key (pOrd);
  - that READE is **without (N)**, because DELETE needs the locked record;
  - the loop condition `not %eof`;
  - the DELETE result (`%ERROR`).
- **What the fault would be:** a READE with `(N)` makes DELETE fail. A wrong key, or no SETLL first, means the loop never starts.
- **Check afterwards** with STRSQL: `SELECT * FROM ARNAV27121.ORDDTL WHERE ORDNO = <the order>`. It must return 0 rows.

### Exercise 5: "Header written but line write fails" (= PDF test 18)

- **Where:** line **748** in `SaveOrder` (`write(e) ORDDREC;`).
- **Steps:**
  1. F5 → customer 2001 → item 5001 qty 1 → F10. It stops at 748.
  2. `EVAL AMOUNT = 1` (this breaks the AMOUNT = QTY × PRICE check), then F10 twice. You're now on the `rolbk;` at **751**.
  3. F12 → **COM0033 "Database error on ORDDTL - all changes rolled back."**
- **Check:**
  - no new order in the list;
  - item 5001's stock unchanged;
  - `DSPDTAARA ARNAV27121/NXTORDNO` is **+1**: the gap, decision A11;
  - **no audit row**: `SELECT * FROM ARNAV27121.ORDAUDJV`;
  - in the journal (`QSQLSRC/JRNQRY`, query 3): PT ORDHDR … DR ORDHDR, RB.

### Exercise 6: "Wrong page displayed" (adapted)

With system paging, there's no page variable that could be wrong. What *can* go wrong is a row showing the wrong line.

- **Where:** line **274** in `ShowOrder` (`write LINSFL;`).
- **Steps:** X + Enter on 10002. At each stop:
  1. `EVAL DRrn`, `EVAL DLINE`, `EVAL DITEM`
  2. F12
- **Correct:**
  - DRrn goes 1, 2, 3, 4 and DLINE goes 1, 2, 3, 4: rows are written in line order, because ORDDTLF is keyed ORDNO + LINENO;
  - the rows go into the subfile at the RRN in DRrn, the `SFILE(LINSFL:DRrn)` on the F-spec.
- **What the fault would be:** DRrn not incremented, so every WRITE goes to the same RRN. The second WRITE then fails, because that subfile record already exists, and at best only one line shows. Or reading ORDDTL in arrival order instead of through ORDDTLF, so the lines come out of order.

### Exercise 7: "Blank subfile"

- **Where:** line **145** in `LoadList` (`*in31 = (RowCount > 0);`).
- **Steps:**
  1. On the order list, type `9999` in the Customer No search field → Enter. It stops at 145.
  2. `EVAL RowCount` = 0. F10, then `EVAL *IN31` = '0'.
  3. F12 → the screen shows the heading only, and **COM0037 "No orders found."**
- **Why:**
  - **SFLDSP (31) must be off when there are no rows.** Displaying an empty subfile is an error.
  - SFLDSPCTL (32) stays on, so the heading and search field still show.
- **Make the fault:** search blank (all orders) → at 145, F10, then `EVAL *IN31 = '0'`, then F12. The heading appears **without any rows**, even though 2 orders exist.
- **What to check in a real case:** RRN = 0 (nothing written), indicator 31 or 32 off, SFLCLR (33) left on, or a SETLL / READE key that finds nothing.

---

## Part 2: Final test pass (PDF §10) on PUB400

**Before you start:**
- Run `CALL ARNAV27121/LOADDATA` (fresh data: customers 2001–2005, items 5001–5008, orders 10001 + 10002).
- Then `CALL ARNAV27121/COMSTART`.
- The audit is checked with `SELECT * FROM ARNAV27121.ORDAUDJV ORDER BY JRNSEQ`. On PUB400, the journal view replaces ORDTRG, because PUB400 refuses ADDPFTRG.

| ✓ | # | Test | How (on PUB400) | Expected |
|---|---|---|---|---|
| ☐ | 1 | Add order (2+ lines) | 3 → F5 → cust 2001; 5002 qty 2, 5003 qty 1 → Enter → F10 | "Order 10003 created."; stock 5002 −2, 5003 −1; total 2,500.00; audit **A** 10003 |
| ☐ | 2 | Order already exists | `CHGDTAARA DTAARA(ARNAV27121/NXTORDNO) VALUE(10000)` → add an order → F10 | **COM0024**, nothing written. Afterwards `CHGDTAARA ... VALUE(10003)` (the highest order number) |
| ☐ | 3 | Display order | X + Enter on 10001 | Header + 3 lines, total 96,850.00 |
| ☐ | 4 | Order no longer exists | Open the list on session A; delete the order on session B; then X + Enter (or F6) on it in A | **COM0023** |
| ☐ | 5 | Edit: change qty | X + F6 on 10003 → 5002 qty 4 → F10 | "Order 10003 changed."; line updated; stock −2 more; total recalculated; audit **U** |
| ☐ | 6 | Edit: add a line | F6 → blank row: 5006 qty 1 → F10 | New line number = max + 1 |
| ☐ | 7 | Edit: delete a line | F6 → Opt **D** on a line → F10 | Line removed, stock returned |
| ☐ | 8 | Delete order | X + F7 → F10 | "Order … deleted."; lines + header gone; stock returned; audit **D** |
| ☐ | 9 | Qty 0 or negative | Add: qty 0 → Enter | **COM0020** |
| ☐ | 10 | Negative price | 2 → X + F6 on an item → price −1 → Enter | **COM0015** |
| ☐ | 11 | Qty > stock | Add: item 5008 (stock 3) qty 4 → Enter | **COM0019 "Only 3 in stock for item 5008."** |
| ☐ | 12 | Inactive customer / item | Add: customer **2005** → Enter; then item **5007** | **COM0010** / **COM0018** |
| ☐ | 13 | Save with no lines | Add: customer 2001, no rows → F10; or Edit: D on every line → F10 | **COM0022** |
| ☐ | 14 | Page Down / Up on lines *(agreed form)* | F5 (25 rows): Page Down / Page Up | Scrolls 5 rows; *More...* / *Bottom* shows where you are |
| ☐ | 15 | Past the last / first page *(agreed form)* | At *Bottom*, Page Down; at the top, Page Up | The **system's** "roll past last/first record" message (COM0028/29 not used, decision B) |
| ☐ | 16 | Search by customer | List: Customer No **2002** → Enter | Only 10002 |
| ☐ | 17 | Delete customer / item with orders | 1 → X + F7 on 2001; 2 → X + F7 on 5001 | **COM0009** / **COM0017** |
| ☐ | 18 | Forced failure mid-save | Debugging exercise 5 | ROLLBACK: no header, no lines, stock unchanged, **no audit row** |
| ☐ | 19 | F6/F7 without X; two X's | List: F6 with no X; X on 2 rows + F6 | **COM0002** / **COM0003** |
| ☐ | 20 | Customer + item happy paths | Add / edit / display / delete a new customer 2006 and a new item 5009 | Saved, with COM0034 / COM0035 |

**Extras beyond the PDF, same session:**

| ✓ | Test | Expected |
|---|---|---|
| ☐ | 4. Order Inquiry (menu 4), From after To | **COM0041** |
| ☐ | Order Inquiry with the default dates | The rows + count / total from ORDSTATS |
| ☐ | `SBMJOB CMD(CALL PGM(ARNAV27121/ORDRPT)) JOB(ORDRPT) JOBQ(QGPL/QBATCH)` → `WRKSPLF` | The order summary report |
| ☐ | Edit with no change → F10 (E6) | Back to the list, no new audit row |
| ☐ | After everything: `CALL ARNAV27121/LOADDATA`, then the audit query | Only 4 rows: A + U for 10001 and 10002 (the view's reset rule) |

---

## Part 3: Viva cheat-sheet

### The 14 questions from the PDF (§12)

1. **ORDHDR vs ORDDTL; how do many lines belong to one order?** ORDHDR has one row per order (customer, date, status, total). ORDDTL has one row per line. They're linked by **ORDNO**: the lines carry the header's order number, the key is ORDNO + LINENO, and a foreign key (RESTRICT) ORDDTL → ORDHDR enforces it.
2. **Why ORDDTLF, ORDHDRL1, ORDDTLL2?**
   - ORDDTL has no key, so ORDDTLF (keyed ORDNO + LINENO, UNIQUE) gives one order's lines in order.
   - ORDHDRL1 (CUSTNO + ORDNO) serves the customer search and the "customer has orders" delete check.
   - ORDDTLL2 (ITEMNO) serves the "item is on orders" delete check.
3. **CHAIN / SETLL / READE:**
   - **CHAIN:** random read by key, one record (`%FOUND`).
   - **SETLL:** positions *before* the first record ≥ key (`%EQUAL` = an exact match exists), and reads nothing.
   - **READE:** the next record *only if* it has the same key (`%EOF` at the first different key).
   - Together, SETLL + READE = "all lines of this order".
4. **RRN; SFLPAG vs SFLSIZ:** RRN is a subfile row's number (1, 2, 3…), used by WRITE and CHAIN on the subfile. SFLPAG is the rows per screen (5). SFLSIZ is the rows the subfile holds (25). SFLSIZ > SFLPAG means the system can page.
5. **How do Page Up / Down work; how do you know first or last?** Here the **system** pages (option B). SFLEND(*MORE) shows *More...* / *Bottom*, and at the edges the system sends its own "roll past" message. (The PDF's program-controlled way would keep a page counter and use ROLLUP/ROLLDOWN with SFLRCDNBR.)
6. **CHAIN doesn't find the order. What then?** `%FOUND` is off, and the program sends **COM0023** and returns to the list. It never uses the old field values.
7. **How are duplicate orders prevented; why lock the data area?** The number comes from NXTORDNO with **`IN *LOCK` → +1 → `OUT`**: a second clerk's `IN *LOCK` waits until the first one's OUT, so no two orders get the same number. Two safety nets back it up: a CHAIN before the write (COM0024) and the primary key.
8. **Why commitment control; when COMMIT, when ROLLBACK?** An order is several writes (header, lines, stock), and it must be all or nothing. **COMMIT** once after every write has succeeded; **ROLBK** at the first failure (COM0033). STRCMTCTL `*CHG *JOB` runs in COMSTART.
9. **What is journaling, and why is it needed before commit?** The journal records every change with before and after images, *before* the file itself is changed. ROLLBACK undoes changes *from the journal*, so without one there's nothing to undo from, and the open is refused.
10. **Trigger; events, buffer, old/new image:**
    - A program the database calls on insert, update or delete, before or after the change.
    - The buffer holds file/lib/member, the event, the time, the commit level, and the offsets to the **old** image (update/delete) and the **new** image (insert/update).
    - ORDTRG: A/U from the new image, D from the old, with `ACTGRP(*CALLER)`.
    - On PUB400, ADDPFTRG is refused, so the audit comes from the journal view ORDAUDJV.
11. **Debugging a blank subfile / a wrong total?** See exercises 7 and 3. For a blank subfile: RRN = 0? SFLDSP off? SFLCLR left on? For a wrong total: QTY, PRICE and AMOUNT per row, and the running total.
12. **Packed vs zoned, why packed?** Packed stores **2 digits per byte** plus a sign half-byte (7,0 → 4 bytes); zoned uses 1 byte per digit. Packed is smaller and quicker to calculate with. Using the same type for every key across files avoids conversion mismatches (decision D11).
13. **Message subfile; how do messages get in?** A small subfile (`SFLMSGRCD(24)`) that shows a program message queue. The program sends with **QMHSNDPM** to its own queue, **by program name** (lesson 1), and clears it with QMHRMVPM. The texts live in COMMSGF.
14. **Why can't the data area roll back; why are gaps OK?** Data areas aren't journaled, so they're outside commitment control. A rolled-back order leaves its number unused. A gap is harmless; a duplicate number is not.

### Extras (Sprints 1–7)

- **Constraints vs program checks:** both. The program gives friendly messages, and the constraints (PK, CHECK, FK) are the last guard against *any* program or SQL.
- **ILE:**
  - **Module** COMUTIL → **service program** (`*SRVPGM`), found through the **binding directory** COMBNDDIR.
  - **Binder source** lists the exports. Its **signature** changes when exports are added, and **`*PRV`** keeps old programs working without a recompile.
  - **Activation groups:** COMAG for the app; `*CALLER` for the service program and the trigger; RCLACTGRP on exit.
- **Subroutines vs sub-procedures:** CUSTPGM uses subroutines (shared variables); ITEMPGM and ORDPGM use sub-procedures (local variables, parameters, return values). Messages sent from a sub-procedure must name the program queue, which is lesson 1.
- **Locks:** `(N)` = read without a lock, for display. Without N, an update file locks the record. Under `*CHG`, locks taken for changes last until COMMIT or ROLBK.
- **The journal story** of a good save is `SC … PT … UB UP … CM`. A failed one is `SC … PT … DR … RB`: a rollback *adds* undo entries.
- **Embedded SQL:**
  - host variables (`:FromDate`), a cursor (DECLARE / OPEN / FETCH / CLOSE), SQLSTATE classes (00 OK, 01 warning, 02 no rows);
  - `SET OPTION`: COMMIT, NAMING `*SYS` (library list) vs `*SQL` (schema = user);
  - the stored procedure ORDSTATS (IN/OUT parameters).
- **Report:** a printer file with SKIPB / SPACEB and an overflow indicator, an SQL GROUP BY cursor, SBMJOB → job queue → subsystem → spooled file.
- **Messages for the caller vs the screen:** *COMP / *ESCAPE to **`*PGMBDY` + 1**; screen messages to the program's own queue by name.
