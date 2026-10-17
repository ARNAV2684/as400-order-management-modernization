-- =====================================================================
-- COMDDL1 - SQL view ORDSUMV and index ORDHDRIX1
-- Author: Arnav    Created: 2026-10-06
--
-- Run: RUNSQLSTM SRCFILE(COM022LIB/QSQLSRC) SRCMBR(COMDDL1)
--                COMMIT(*NONE) NAMING(*SQL)
-- Re-runnable: drops both objects first (missing ones are ignored).
--
-- Change log:
--   2026-10-06  Arnav  Created (Sprint 1, checkpoint 1C)
-- =====================================================================

SET SCHEMA COM022LIB;

BEGIN
  DECLARE CONTINUE HANDLER FOR SQLSTATE '42704' BEGIN END;
  DROP VIEW  COM022LIB.ORDSUMV;
  DROP INDEX COM022LIB.ORDHDRIX1;
END;

-- ---------------------------------------------------------------------
-- ORDSUMV: one row per order with customer name and line count.
-- LEFT JOIN so an order with no lines would still show (LINECNT 0);
-- the inner JOIN to CSTMST is safe because ORDHDR_CUST_FK guarantees
-- the customer exists. A DDS join LF can't do GROUP BY / COUNT.
-- ---------------------------------------------------------------------
CREATE VIEW COM022LIB.ORDSUMV (
    ORDNO, ORDDATE, CUSTNO, CUSTNAME, STATUS, TOTAMT, LINECNT ) AS
  SELECT h.ORDNO, h.ORDDATE, h.CUSTNO, c.CUSTNAME, h.STATUS, h.TOTAMT,
         COUNT(d.LINENO)
    FROM COM022LIB.ORDHDR h
    JOIN COM022LIB.CSTMST c      ON c.CUSTNO = h.CUSTNO
    LEFT JOIN COM022LIB.ORDDTL d ON d.ORDNO  = h.ORDNO
   GROUP BY h.ORDNO, h.ORDDATE, h.CUSTNO, c.CUSTNAME, h.STATUS,
            h.TOTAMT;

LABEL ON TABLE COM022LIB.ORDSUMV IS 'COM - Orders with customer name';

-- ---------------------------------------------------------------------
-- ORDHDRIX1: order date access path for date-range searches (ORDINQ,
-- Sprint 4; ORDRPT, Sprint 7). It is a keyed LF under the covers, so
-- RPG could also declare it on an F-spec and READ in date order.
-- ---------------------------------------------------------------------
CREATE INDEX COM022LIB.ORDHDRIX1 ON COM022LIB.ORDHDR (ORDDATE, ORDNO);

LABEL ON INDEX COM022LIB.ORDHDRIX1 IS 'COM - Orders by date';
