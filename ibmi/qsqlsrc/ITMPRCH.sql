-- =====================================================================
-- ITMPRCH - Item price-change log: table ITMPRCH + SQL trigger
-- Author: Arnav    Created: 2026-10-09
--
-- Run: RUNSQLSTM SRCFILE(COM022LIB/QSQLSRC) SRCMBR(ITMPRCH)
--                COMMIT(*NONE) NAMING(*SQL)
-- Re-runnable: the trigger is dropped first (it depends on the table),
-- the table is replaced keeping its rows, then the trigger is re-created.
--
-- The trigger is part of the DATABASE, not of a program: it fires for
-- ITEMPGM, SQL, DFU... anything that changes a price. ITEMPGM itself
-- has no code for this and doesn't know the log exists.
--
-- No foreign key to ITMMST on purpose: the history must outlive a
-- deleted item (same reason as ORDAUD).
-- Sprint 6: ITMPRCH must be journaled with ITMMST. Once ITMMST is
-- updated under commitment control, the trigger's INSERT runs in the
-- same transaction, and an unjournaled ITMPRCH would make it fail.
--
-- Change log:
--   2026-10-09  Arnav  Created (Sprint 3, checkpoint 3C)
-- =====================================================================

SET SCHEMA COM022LIB;

BEGIN
  DECLARE CONTINUE HANDLER FOR SQLSTATE '42704' BEGIN END;
  DROP TRIGGER COM022LIB.ITMPRCHTRG;
END;

-- ---------------------------------------------------------------------
-- The log table. RCDFMT gives the record format its own name (an SQL
-- table's format is otherwise named like the table, which RPG refuses
-- without RENAME). ON REPLACE PRESERVE ROWS: re-running keeps history.
-- ---------------------------------------------------------------------
CREATE OR REPLACE TABLE COM022LIB.ITMPRCH (
    ITEMNO   DECIMAL(7, 0)  NOT NULL,
    OLDPRICE DECIMAL(9, 2)  NOT NULL,
    NEWPRICE DECIMAL(9, 2)  NOT NULL,
    CHGTS    TIMESTAMP      NOT NULL DEFAULT CURRENT TIMESTAMP,
    CHGUSER  CHAR(10)       NOT NULL )
  RCDFMT ITMPRCHR
  ON REPLACE PRESERVE ROWS;

LABEL ON TABLE COM022LIB.ITMPRCH IS 'COM - item price change log';

LABEL ON COLUMN COM022LIB.ITMPRCH (
    ITEMNO   TEXT IS 'Item number',
    OLDPRICE TEXT IS 'Price before the change',
    NEWPRICE TEXT IS 'Price after the change',
    CHGTS    TEXT IS 'When the price changed',
    CHGUSER  TEXT IS 'User who changed it' );

-- ---------------------------------------------------------------------
-- The trigger.
--   AFTER UPDATE OF UNITPRICE: runs after a row has been changed.
--     A native RPG UPDATE rewrites ALL columns, so for ITEMPGM it runs
--     on every save - the WHEN clause is what filters real changes.
--   OLD / NEW: the row before and after the change.
--   FOR EACH ROW: once per changed row (3 rows updated = 3 log rows).
-- ---------------------------------------------------------------------
CREATE OR REPLACE TRIGGER COM022LIB.ITMPRCHTRG
  AFTER UPDATE OF UNITPRICE ON COM022LIB.ITMMST
  REFERENCING OLD AS O NEW AS N
  FOR EACH ROW
  WHEN (O.UNITPRICE <> N.UNITPRICE)
    INSERT INTO COM022LIB.ITMPRCH
                (ITEMNO, OLDPRICE, NEWPRICE, CHGTS, CHGUSER)
         VALUES (N.ITEMNO, O.UNITPRICE, N.UNITPRICE,
                 CURRENT TIMESTAMP, USER);
