-- =====================================================================
-- COMCST - Database constraints for the COM files
-- Author: Arnav    Created: 2026-10-06
--
-- Run: RUNSQLSTM SRCFILE(COM022LIB/QSQLSRC) SRCMBR(COMCST)
--                COMMIT(*NONE) NAMING(*SQL)
--
-- Re-runnable: step 1 drops every constraint first (missing ones are
-- ignored by the handler), step 2 adds them all again.
--
-- RESTRICT (not CASCADE) on every foreign key: refuses the change
-- instead of silently deleting children, and needs no journaling.
--
-- ORDAUD deliberately has NO foreign key to ORDHDR: the trigger writes
-- the 'D' audit row after the header is gone, and the log must outlive
-- the orders it describes.
--
-- CL equivalents (same result, M1 Day 4):
--   ADDPFCST FILE(COM022LIB/CSTMST) TYPE(*PRIKEY) KEY(CUSTNO)
--   ADDPFCST FILE(COM022LIB/ITMMST) TYPE(*CHKCST)
--            CHKCST('UNITPRICE >= 0') CST(ITMMST_PRC_CK)
--   ADDPFCST FILE(COM022LIB/ORDDTL) TYPE(*REFCST) KEY(ORDNO)
--            PRNFILE(COM022LIB/ORDHDR) DLTRULE(*RESTRICT)
--            UPDRULE(*RESTRICT) CST(ORDDTL_ORD_FK)
--   WRKPFCST / RMVPFCST to list / remove.
--
-- Change log:
--   2026-10-06  Arnav  Created (Sprint 1, checkpoint 1A-2)
-- =====================================================================

-- Unqualified constraint names go to the default schema, which under
-- *SQL naming is the USER NAME (e.g. MYUSER) -> SQL5051 "qualifier MYUSER not
-- same as COM022LIB". SET SCHEMA makes them land in COM022LIB.
SET SCHEMA COM022LIB;

-- ---------------------------------------------------------------------
-- 1. Drop existing constraints. Children (foreign keys) before parents
--    (primary keys): a primary key can't be dropped while a foreign key
--    still references it. SQLSTATE 42704 = "constraint not found".
-- ---------------------------------------------------------------------
BEGIN
  DECLARE CONTINUE HANDLER FOR SQLSTATE '42704' BEGIN END;

  ALTER TABLE COM022LIB.ORDDTL DROP CONSTRAINT ORDDTL_ORD_FK;
  ALTER TABLE COM022LIB.ORDDTL DROP CONSTRAINT ORDDTL_ITM_FK;
  ALTER TABLE COM022LIB.ORDHDR DROP CONSTRAINT ORDHDR_CUST_FK;

  ALTER TABLE COM022LIB.ORDDTL DROP CONSTRAINT ORDDTL_PK;
  ALTER TABLE COM022LIB.ORDDTL DROP CONSTRAINT ORDDTL_LN_CK;
  ALTER TABLE COM022LIB.ORDDTL DROP CONSTRAINT ORDDTL_QTY_CK;
  ALTER TABLE COM022LIB.ORDDTL DROP CONSTRAINT ORDDTL_PRC_CK;
  ALTER TABLE COM022LIB.ORDDTL DROP CONSTRAINT ORDDTL_AMT_CK;

  ALTER TABLE COM022LIB.ORDHDR DROP CONSTRAINT ORDHDR_PK;
  ALTER TABLE COM022LIB.ORDHDR DROP CONSTRAINT ORDHDR_NO_CK;
  ALTER TABLE COM022LIB.ORDHDR DROP CONSTRAINT ORDHDR_STS_CK;
  ALTER TABLE COM022LIB.ORDHDR DROP CONSTRAINT ORDHDR_TOT_CK;

  ALTER TABLE COM022LIB.ITMMST DROP CONSTRAINT ITMMST_PK;
  ALTER TABLE COM022LIB.ITMMST DROP CONSTRAINT ITMMST_NO_CK;
  ALTER TABLE COM022LIB.ITMMST DROP CONSTRAINT ITMMST_DESC_CK;
  ALTER TABLE COM022LIB.ITMMST DROP CONSTRAINT ITMMST_PRC_CK;
  ALTER TABLE COM022LIB.ITMMST DROP CONSTRAINT ITMMST_STK_CK;
  ALTER TABLE COM022LIB.ITMMST DROP CONSTRAINT ITMMST_STS_CK;

  ALTER TABLE COM022LIB.CSTMST DROP CONSTRAINT CSTMST_PK;
  ALTER TABLE COM022LIB.CSTMST DROP CONSTRAINT CSTMST_NO_CK;
  ALTER TABLE COM022LIB.CSTMST DROP CONSTRAINT CSTMST_NAME_CK;
  ALTER TABLE COM022LIB.CSTMST DROP CONSTRAINT CSTMST_STS_CK;

  ALTER TABLE COM022LIB.ORDAUD DROP CONSTRAINT ORDAUD_NO_CK;
  ALTER TABLE COM022LIB.ORDAUD DROP CONSTRAINT ORDAUD_ACT_CK;
END;

-- ---------------------------------------------------------------------
-- 2. CSTMST - Customer master
--    The primary key reuses the DDS UNIQUE access path (no new index).
--    "<> ' '" catches an all-blank name: NOT NULL alone allows blanks.
-- ---------------------------------------------------------------------
ALTER TABLE COM022LIB.CSTMST
  ADD CONSTRAINT CSTMST_PK      PRIMARY KEY (CUSTNO);
ALTER TABLE COM022LIB.CSTMST
  ADD CONSTRAINT CSTMST_NO_CK   CHECK (CUSTNO > 0);
ALTER TABLE COM022LIB.CSTMST
  ADD CONSTRAINT CSTMST_NAME_CK CHECK (CUSTNAME <> ' ');
ALTER TABLE COM022LIB.CSTMST
  ADD CONSTRAINT CSTMST_STS_CK  CHECK (STATUS IN ('A', 'I'));

-- ---------------------------------------------------------------------
-- 3. ITMMST - Item master
--    ITMMST_STK_CK also stops an order-program bug from ever pushing
--    stock below zero.
-- ---------------------------------------------------------------------
ALTER TABLE COM022LIB.ITMMST
  ADD CONSTRAINT ITMMST_PK      PRIMARY KEY (ITEMNO);
ALTER TABLE COM022LIB.ITMMST
  ADD CONSTRAINT ITMMST_NO_CK   CHECK (ITEMNO > 0);
ALTER TABLE COM022LIB.ITMMST
  ADD CONSTRAINT ITMMST_DESC_CK CHECK (ITEMDESC <> ' ');
ALTER TABLE COM022LIB.ITMMST
  ADD CONSTRAINT ITMMST_PRC_CK  CHECK (UNITPRICE >= 0);
ALTER TABLE COM022LIB.ITMMST
  ADD CONSTRAINT ITMMST_STK_CK  CHECK (STOCKQTY >= 0);
ALTER TABLE COM022LIB.ITMMST
  ADD CONSTRAINT ITMMST_STS_CK  CHECK (STATUS IN ('A', 'I'));

-- ---------------------------------------------------------------------
-- 4. ORDHDR - Order header
--    STATUS: only Open exists today (A7). A new status = change this.
--    "TOTAMT = sum of lines" spans rows, so it can't be a CHECK - it
--    stays a program rule.
-- ---------------------------------------------------------------------
ALTER TABLE COM022LIB.ORDHDR
  ADD CONSTRAINT ORDHDR_PK      PRIMARY KEY (ORDNO);
ALTER TABLE COM022LIB.ORDHDR
  ADD CONSTRAINT ORDHDR_NO_CK   CHECK (ORDNO > 0);
ALTER TABLE COM022LIB.ORDHDR
  ADD CONSTRAINT ORDHDR_STS_CK  CHECK (STATUS IN ('O'));
ALTER TABLE COM022LIB.ORDHDR
  ADD CONSTRAINT ORDHDR_TOT_CK  CHECK (TOTAMT >= 0);
ALTER TABLE COM022LIB.ORDHDR
  ADD CONSTRAINT ORDHDR_CUST_FK FOREIGN KEY (CUSTNO)
      REFERENCES COM022LIB.CSTMST (CUSTNO)
      ON DELETE RESTRICT ON UPDATE RESTRICT;

-- ---------------------------------------------------------------------
-- 5. ORDDTL - Order lines
--    The PF stays in arrival sequence; the primary key gets its own
--    access path (or shares ORDDTLF's, which has the same unique key).
--    No upper limit on LINENO: deleted numbers aren't reused (A6).
--    ORDDTL_AMT_CK makes a wrong line amount impossible to store.
-- ---------------------------------------------------------------------
ALTER TABLE COM022LIB.ORDDTL
  ADD CONSTRAINT ORDDTL_PK      PRIMARY KEY (ORDNO, LINENO);
ALTER TABLE COM022LIB.ORDDTL
  ADD CONSTRAINT ORDDTL_LN_CK   CHECK (LINENO > 0);
ALTER TABLE COM022LIB.ORDDTL
  ADD CONSTRAINT ORDDTL_QTY_CK  CHECK (QTY > 0);
ALTER TABLE COM022LIB.ORDDTL
  ADD CONSTRAINT ORDDTL_PRC_CK  CHECK (PRICE >= 0);
ALTER TABLE COM022LIB.ORDDTL
  ADD CONSTRAINT ORDDTL_AMT_CK  CHECK (AMOUNT = QTY * PRICE);
ALTER TABLE COM022LIB.ORDDTL
  ADD CONSTRAINT ORDDTL_ORD_FK  FOREIGN KEY (ORDNO)
      REFERENCES COM022LIB.ORDHDR (ORDNO)
      ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE COM022LIB.ORDDTL
  ADD CONSTRAINT ORDDTL_ITM_FK  FOREIGN KEY (ITEMNO)
      REFERENCES COM022LIB.ITMMST (ITEMNO)
      ON DELETE RESTRICT ON UPDATE RESTRICT;

-- ---------------------------------------------------------------------
-- 6. ORDAUD - Audit log (checks only, no foreign key - see header)
-- ---------------------------------------------------------------------
ALTER TABLE COM022LIB.ORDAUD
  ADD CONSTRAINT ORDAUD_NO_CK   CHECK (ORDNO > 0);
ALTER TABLE COM022LIB.ORDAUD
  ADD CONSTRAINT ORDAUD_ACT_CK  CHECK (ACTION IN ('A', 'U', 'D'));
