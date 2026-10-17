# PUB400 audit fallback: audit from the journal

Decided by Arnav on 2026-10-12. **Built and verified on 2026-10-13 (Sprint 7A)**, because PUB400 refuses `ADDPFTRG`: running it gives CPD0032, and so does compiling a CL program that contains it.

The real view is [`ibmi/qsqlsrc/ORDAUDJV.sql`](../ibmi/qsqlsrc/ORDAUDJV.sql). It differs from the section 3 draft in two places:
- **`JOB_NAME`** in `DISPLAY_JOURNAL` holds only the job *name* (e.g. `QZDASOINIT`), so the WEB test is `JOB_NAME = 'QZDASOINIT'`.
- **The reset rule** is "after the last `DL` on ORDHDR made by LOADDATA", compared by `SEQUENCE_NUMBER`, not by time (two entries can share a timestamp). So the reload's own A/U rows stay visible, the same rows the trigger would leave (decision S3).

What was verified:
- `INTERPRET` decodes ORDNO correctly.
- `CURRENT_USER` gives ARNAV2712, whereas `JOB_USER` gives QUSER.
- A committed add / change / delete of a test order 10099 shows exactly **A, U, D**.
- Rolled-back inserts (10097, 10098) show **nothing**.
- The reset rule is not tested yet: it needs a LOADDATA run.

## 1. Why this exists

- By design (per the PDF), the audit log is made by the RPG trigger **ORDTRG** (Sprint 7), which writes one ORDAUD row for every add, change or delete on ORDHDR.
- PUB400 (library `ARNAV27121`) refuses SQL `CREATE TRIGGER` (SQL0552). `ADDPFTRG` is not tested yet, but it will probably be refused too.
- Journaling and commit/rollback **do work** on PUB400. That was proven on 2026-10-12 with ZZ objects: a COMMIT kept its row, a ROLLBACK undid its row, and `QSYS2.DISPLAY_JOURNAL` could read the journal.
- So, on PUB400 only, the audit trail is **read from the journal** instead of being written by a trigger.

| Environment | How the audit is made | What the API / frontend reads |
|---|---|---|
| A system that allows triggers (per the PDF) | ORDTRG trigger → ORDAUD rows | `ORDAUD` |
| PUB400 (only if ADDPFTRG is refused) | Sprint 6's journal on ORDHDR | SQL view `ORDAUDJV` |

**When it is used:** at Sprint 7 on PUB400, first try `ADDPFTRG` on a ZZ file.
- If it works, PUB400 uses ORDTRG as designed, and this document is not needed.
- If it is refused, build `ORDAUDJV`.

## 2. The idea in plain words

Sprint 6 journals ORDHDR with `IMAGES(*BOTH)`, so the system already writes an entry for every change:

| Journal entry | Meaning | Audit action |
|---|---|---|
| `R` / `PT` | a record was added | **A** |
| `R` / `UP` | after-image of a changed record (`UB` = the before-image, ignored) | **U** |
| `R` / `DL` | a record was deleted (the entry carries the deleted record) | **D** |
| `C` / `RB` | that commit cycle was rolled back | hide every entry of that cycle |

Each entry also records the time, the user, the job and the program, which are the same facts ORDTRG would write. A view simply turns those entries into rows that look like ORDAUD.

## 3. The view (draft; verify every detail when it is built)

```sql
CREATE OR REPLACE VIEW ARNAV27121.ORDAUDJV AS
WITH J AS (
  SELECT * FROM TABLE(QSYS2.DISPLAY_JOURNAL(
           'ARNAV27121', 'COMJRN',
           STARTING_RECEIVER_NAME => '*CURCHAIN')) X ),   -- all receivers, not just the current one
RESET AS (                                                -- time of the last LOADDATA run
  SELECT COALESCE(MAX(ENTRY_TIMESTAMP), TIMESTAMP('0001-01-01-00.00.00'))
         AS TS FROM J WHERE PROGRAM_NAME = 'LOADDATA' )
SELECT INTERPRET(SUBSTR(J.ENTRY_DATA, 1, 4) AS DECIMAL(7, 0)) AS ORDNO,  -- 1st field = ORDNO 7P0 = 4 bytes
       CASE J.JOURNAL_ENTRY_TYPE WHEN 'PT' THEN 'A'
                                 WHEN 'UP' THEN 'U' ELSE 'D' END        AS ACTION,
       DATE(J.ENTRY_TIMESTAMP)                                          AS AUDDATE,
       TIME(J.ENTRY_TIMESTAMP)                                          AS AUDTIME,
       J."CURRENT_USER"                                                 AS AUDUSER,
       CASE WHEN J.JOB_NAME LIKE '%QZDASOINIT%' THEN 'WEB'
            ELSE '5250' END                                             AS AUDSRC
  FROM J, RESET
 WHERE J.JOURNAL_CODE = 'R'
   AND J.JOURNAL_ENTRY_TYPE IN ('PT', 'UP', 'DL')
   AND SUBSTR(J."OBJECT", 1, 10)  = 'ORDHDR'
   AND SUBSTR(J."OBJECT", 11, 10) = 'ARNAV27121'
   AND J.ENTRY_TIMESTAMP > RESET.TS
   AND NOT EXISTS (SELECT 1 FROM J R                       -- skip rolled-back work
                    WHERE R.JOURNAL_CODE = 'C'
                      AND R.JOURNAL_ENTRY_TYPE = 'RB'
                      AND R.COMMIT_CYCLE = J.COMMIT_CYCLE
                      AND J.COMMIT_CYCLE <> 0);
```

Points to check at build time:
- **`INTERPRET` decodes the packed ORDNO** from the raw record image. Prove it against a known order number.
- **`CURRENT_USER` vs `JOB_USER`:** web calls run in QZDASOINIT jobs, where the job user is QUSER, so `CURRENT_USER` is the right one. Confirm it.
- **The LOADDATA reset rule:** LOADDATA deletes and reloads every order and resets NXTORDNO, so order numbers are used again. The view therefore shows only entries made after the latest LOADDATA run, and the reload's own PT/DL entries are hidden by the `>`.
- **Rollback:** entries of a rolled-back cycle (PT followed by DR) are hidden. Test it: a forced failure must show no row.

## 4. What changes elsewhere (PUB400 only)

- **Sprint 6:** `COMJRN` must journal ORDHDR with `IMAGES(*BOTH)`. This is already in the plan (§8.1), so nothing changes.
- **Sprint 7:** ORDTRG is not attached on PUB400. Instead, run `QSQLSRC/ORDAUDJV` (re-runnable, `CREATE OR REPLACE`). The ORDAUD PF stays, empty, and is **not deleted**.
- **Sprint 9 API:** the audit table name becomes a setting, `COM_AUDIT_TABLE=ORDAUD` (where the trigger runs) or `ORDAUDJV` (PUB400). The view has the same columns as ORDAUD (ORDNO, ACTION, AUDDATE, AUDTIME, AUDUSER, AUDSRC), so `/api/audit`, `/api/orders/{ordNo}/audit`, the dashboard's "recent audit" and the frontend do not change at all.
- **The PUB400 build of the sources** keeps the same `sed COM022LIB → ARNAV27121` step as before.

## 5. Trigger vs journal (viva points)

| | Trigger (ORDTRG) | Journal view (PUB400) |
|---|---|---|
| Catches every change, even from STRSQL or DFU | Yes | Yes |
| Rolled-back changes | Its ORDAUD row is rolled back too | Hidden by the RB filter |
| When the audit row exists | Written at the moment of the change | Worked out when someone reads it |
| Depends on | Trigger authority (`ADDPFTRG`) | The journal and its receivers being kept |
| Cost | Small extra work on every change | The journal is scanned on every read (fine for this data volume) |
| Can be switched off by | `RMVPFTRG` | `ENDJRNPF`, which also stops commitment control |

Concepts this shows [EXTRA · M2: journaling, SQL table functions, views]:
- journal entry codes and types;
- before and after images;
- commit cycles;
- rollback entries (`DR`): a rollback adds new "undo" entries and never erases history;
- `QSYS2` services.
