-- =====================================================================
-- JRNQRY - practice queries: read COM's journal with SQL
-- Author: Arnav    Created: 2026-10-12
--
-- NOT part of the build. Run the queries one by one in Run SQL Scripts
-- (or STRSQL) after saving / failing an order on the 5250.
--
-- QSYS2.DISPLAY_JOURNAL is a table function: it turns journal entries
-- into rows. '*CURCHAIN' = read every attached receiver, not only the
-- current one (after COMJRN0002 appears, older entries stay visible).
--
-- Entry codes used here:
--   R = record change: PT add, UB/UP before/after image of an update,
--       DL delete, and the rollback "undo" entries DR / UR / BR
--   C = commitment control: SC start of a cycle, CM commit, RB rollback
--   COMMIT_CYCLE ties the R entries of one save to its SC ... CM / RB.
--
-- Change log:
--   2026-10-12  Arnav  Created (Sprint 6, checkpoint 6A)
-- =====================================================================

-- 1. The last 30 entries, newest first: what happened, to which file,
--    in which commit cycle, by which program.
SELECT SEQUENCE_NUMBER                       AS SEQ,
       JOURNAL_CODE                          AS C,
       JOURNAL_ENTRY_TYPE                    AS T,
       SUBSTR("OBJECT", 1, 10)               AS FILE,
       COMMIT_CYCLE                          AS CYCLE,
       ENTRY_TIMESTAMP                       AS AT,
       PROGRAM_NAME                          AS PGM,
       "CURRENT_USER"                        AS USR
  FROM TABLE(QSYS2.DISPLAY_JOURNAL('COM022LIB', 'COMJRN',
             STARTING_RECEIVER_NAME => '*CURCHAIN')) J
 WHERE JOURNAL_CODE IN ('R', 'C')
 ORDER BY SEQUENCE_NUMBER DESC
 FETCH FIRST 30 ROWS ONLY;

-- 2. One row per commit cycle: the story of each save in one line.
--    A good save reads  SC PT PT UB UP ... CM.
--    A failed save reads SC PT ... DR ... RB (DR = the system's own
--    "delete" that undid the PT).
SELECT COMMIT_CYCLE                                           AS CYCLE,
       MIN(ENTRY_TIMESTAMP)                                   AS STARTED,
       LISTAGG(JOURNAL_ENTRY_TYPE, ' ')
         WITHIN GROUP (ORDER BY SEQUENCE_NUMBER)              AS STORY,
       MAX(CASE WHEN JOURNAL_ENTRY_TYPE = 'CM' THEN 'COMMIT'
                WHEN JOURNAL_ENTRY_TYPE = 'RB' THEN 'ROLLBACK'
           END)                                               AS ENDED
  FROM TABLE(QSYS2.DISPLAY_JOURNAL('COM022LIB', 'COMJRN',
             STARTING_RECEIVER_NAME => '*CURCHAIN')) J
 WHERE COMMIT_CYCLE <> 0
 GROUP BY COMMIT_CYCLE
 ORDER BY COMMIT_CYCLE DESC;

-- 3. Only the rolled-back work: every change of every cycle that ended
--    in RB (PDF test 18 should show up here, and in no file).
SELECT J.COMMIT_CYCLE                        AS CYCLE,
       J.JOURNAL_ENTRY_TYPE                  AS T,
       SUBSTR(J."OBJECT", 1, 10)             AS FILE,
       J.ENTRY_TIMESTAMP                     AS AT
  FROM TABLE(QSYS2.DISPLAY_JOURNAL('COM022LIB', 'COMJRN',
             STARTING_RECEIVER_NAME => '*CURCHAIN')) J
 WHERE J.JOURNAL_CODE = 'R'
   AND J.COMMIT_CYCLE IN (
         SELECT R.COMMIT_CYCLE
           FROM TABLE(QSYS2.DISPLAY_JOURNAL('COM022LIB', 'COMJRN',
                      STARTING_RECEIVER_NAME => '*CURCHAIN')) R
          WHERE R.JOURNAL_CODE = 'C' AND R.JOURNAL_ENTRY_TYPE = 'RB')
 ORDER BY J.SEQUENCE_NUMBER;
