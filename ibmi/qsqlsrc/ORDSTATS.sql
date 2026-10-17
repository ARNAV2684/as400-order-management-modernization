-- =====================================================================
-- ORDSTATS - SQL stored procedure: number and total value of orders
-- Author: Arnav    Created: 2026-10-09
--
-- Run: RUNSQLSTM SRCFILE(COM022LIB/QSQLSRC) SRCMBR(ORDSTATS)
--                COMMIT(*NONE) NAMING(*SQL)
-- Re-runnable: CREATE OR REPLACE.
--
-- CREATE PROCEDURE ... LANGUAGE SQL makes a program object (*PGM,
-- generated as C) named ORDSTATS in COM022LIB, plus a row in the
-- catalog QSYS2.SYSPROCS. Any program can CALL it: ORDINQ (RPG) does,
-- so can STRSQL, CL (RUNSQL) and later the web API.
--
-- Mainly here to show the simplest complete stored procedure: ORDINQ
-- could count the rows itself while fetching them.
--
-- Change log:
--   2026-10-09  Arnav  Created (Sprint 4, checkpoint 4C)
-- =====================================================================

SET SCHEMA COM022LIB;

CREATE OR REPLACE PROCEDURE COM022LIB.ORDSTATS (
    IN  P_FROM  DATE,
    IN  P_TO    DATE,
    IN  P_MIN   DECIMAL(11, 2),
    OUT P_COUNT INTEGER,
    OUT P_TOTAL DECIMAL(13, 2) )
  LANGUAGE SQL
  READS SQL DATA
BEGIN
  -- SUM over zero rows is NULL; COALESCE turns it into 0.
  SELECT COUNT(*), COALESCE(SUM(TOTAMT), 0)
    INTO P_COUNT, P_TOTAL
    FROM COM022LIB.ORDHDR
   WHERE ORDDATE BETWEEN P_FROM AND P_TO
     AND TOTAMT >= P_MIN;
END;

COMMENT ON PROCEDURE COM022LIB.ORDSTATS IS
  'COM - count and total value of orders in a date range';
