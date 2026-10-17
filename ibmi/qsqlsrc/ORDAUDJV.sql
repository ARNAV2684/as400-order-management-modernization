-- =====================================================================
-- ORDAUDJV - Order audit trail READ FROM THE JOURNAL (PUB400 fallback)
-- Author: Arnav    Created: 2026-10-13
--
-- Run: RUNSQLSTM SRCFILE(COM022LIB/QSQLSRC) SRCMBR(ORDAUDJV)
--                COMMIT(*NONE) NAMING(*SQL)
-- Re-runnable: CREATE OR REPLACE.
--
-- Only for PUB400, which refuses ADDPFTRG (CPD0032), so ORDTRG can't be
-- attached there. Where triggers are allowed, ORDTRG writes ORDAUD instead.
-- Design: docs/pub400-audit-fallback.md (Arnav's choice 2026-10-12).
--
-- Same columns as ORDAUD (+ AUDSRC), so a reader can use either one:
--   PT (add)    -> 'A'   ORDNO from the after image
--   UP (update) -> 'U'   after image (UB = before image, skipped)
--   DL (delete) -> 'D'   the deleted image
-- ORDNO is the first field of ORDHDR, packed 7,0 = 4 bytes: INTERPRET
-- reads those raw bytes as DECIMAL(7,0) (verified on PUB400).
--
-- Hidden:
--   - every change of a commit cycle that ended in ROLLBACK (RB)
--   - everything up to the last LOADDATA reset: its last DL on ORDHDR.
--     The reload's own PT / UP rows stay - the same rows the trigger
--     would leave (decision S3). Uses SEQUENCE_NUMBER, not time: two
--     entries can share a timestamp.
-- Users: CURRENT_USER (JOB_USER is QUSER in server jobs). Source: WEB
-- for the ODBC server job QZDASOINIT (Sprint 8+), else 5250.
--
-- Change log:
--   2026-10-13  Arnav  Created (Sprint 7, checkpoint 7A)
-- =====================================================================

SET SCHEMA COM022LIB;

CREATE OR REPLACE VIEW COM022LIB.ORDAUDJV
  (ORDNO, ACTION, AUDDATE, AUDTIME, AUDUSER, AUDSRC, JRNSEQ) AS
WITH J AS (
  SELECT *
    FROM TABLE(QSYS2.DISPLAY_JOURNAL('COM022LIB', 'COMJRN',
               STARTING_RECEIVER_NAME => '*CURCHAIN')) X
   WHERE JOURNAL_CODE IN ('R', 'C') ),
RESET AS (
  SELECT COALESCE(MAX(SEQUENCE_NUMBER), 0) AS SEQ
    FROM J
   WHERE JOURNAL_CODE = 'R' AND JOURNAL_ENTRY_TYPE = 'DL'
     AND PROGRAM_NAME = 'LOADDATA'
     AND SUBSTR(J."OBJECT", 1, 10) = 'ORDHDR' ),
UNDONE AS (
  SELECT DISTINCT COMMIT_CYCLE
    FROM J
   WHERE JOURNAL_CODE = 'C' AND JOURNAL_ENTRY_TYPE = 'RB' )
SELECT CAST(INTERPRET(SUBSTR(J.ENTRY_DATA, 1, 4) AS DECIMAL(7, 0))
            AS DECIMAL(7, 0)),
       CAST(CASE J.JOURNAL_ENTRY_TYPE WHEN 'PT' THEN 'A'
                                      WHEN 'UP' THEN 'U'
                                      ELSE 'D' END AS CHAR(1)),
       DATE(J.ENTRY_TIMESTAMP),
       TIME(J.ENTRY_TIMESTAMP),
       CAST(J."CURRENT_USER" AS CHAR(10)),
       CAST(CASE WHEN J.JOB_NAME = 'QZDASOINIT' THEN 'WEB'
                 ELSE '5250' END AS CHAR(5)),
       J.SEQUENCE_NUMBER
  FROM J, RESET
 WHERE J.JOURNAL_CODE = 'R'
   AND J.JOURNAL_ENTRY_TYPE IN ('PT', 'UP', 'DL')
   AND SUBSTR(J."OBJECT", 1, 10)  = 'ORDHDR'
   AND SUBSTR(J."OBJECT", 11, 10) = 'COM022LIB'
   AND J.SEQUENCE_NUMBER > RESET.SEQ
   AND (J.COMMIT_CYCLE = 0
        OR J.COMMIT_CYCLE NOT IN (SELECT COMMIT_CYCLE FROM UNDONE));

LABEL ON TABLE COM022LIB.ORDAUDJV IS
  'COM - order audit from journal (PUB400)';
