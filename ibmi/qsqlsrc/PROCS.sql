-- =====================================================================
-- PROCS - The web's doors into RPG: two procedures per service program
-- Author: Arnav    Created: 2026-10-14
--
-- Run: RUNSQLSTM SRCFILE(COM022LIB/QSQLSRC) SRCMBR(PROCS)
--                COMMIT(*NONE) NAMING(*SQL)
-- Re-runnable: CREATE OR REPLACE.
--
-- Layer 1, *_X: an EXTERNAL procedure - no code, just "this name with
--   these parameters = CALL program ORDSVC". Its parameters are exactly
--   the RPG program's (COMPROTO: OrdSvc / CustSvc / ItemSvc).
-- Layer 2, *_API: an SQL PL procedure with only IN parameters. It calls
--   *_X with local variables, then returns ONE RESULT-SET ROW holding
--   every output. Why: pyodbc (the web API's driver) cannot read OUT /
--   INOUT parameters, but it reads a result set like any SELECT.
-- SQL PL is IBM's SQL procedure language - no embedded SQL in the RPG.
--
-- Commitment: the RPG program owns COMMIT / ROLBK. It runs ACTGRP
-- (*CALLER), inside the caller's commitment definition (the ODBC
-- connection's CMT=2), so its COMMIT ends the web's transaction too.
-- Proved by tools/spike_svc.py (forced failure via data area COMTSTFAIL).
--
-- CHGCURLIB first in every *_API procedure - REQUIRED. Found by the
-- ODBC spike 2026-10-15: the connection's current library was the
-- user's (ARNAV27121, the green-screen baseline), so ORDSVC - though
-- called as ARNAV27122.ORDSVC_X - opened ARNAV27121's files through
-- *LIBL and saved orders THERE.
--
-- SET OPTION COMMIT = *CHG on every *_API procedure - REQUIRED. Without
-- it the procedure takes RUNSQLSTM's COMMIT(*NONE) and runs outside
-- commitment control; the RPG then can't open its COMMIT files: CPF4326
-- "Commitment definition *N not valid for open of ITMMST", a function
-- check, and the job waits on an inquiry message (MSGW). Proved on
-- PUB400 2026-10-14: the same call works from a *CHG procedure and from
-- a CL program after STRCMTCTL (the 5250 path).
--
-- Change log:
--   2026-10-14  Arnav  Created (Sprint 8)
-- =====================================================================

SET SCHEMA COM022LIB;

-- ------------------------------------------------------------- ORDSVC
CREATE OR REPLACE PROCEDURE COM022LIB.ORDSVC_X (
    IN    P_ACTION   CHAR(2),
    INOUT P_ORDNO    DECIMAL(7, 0),
    IN    P_ORDDATE  CHAR(10),
    IN    P_CUSTNO   DECIMAL(7, 0),
    IN    P_LINECNT  DECIMAL(3, 0),
    INOUT P_LINES    CHAR(2200),
    OUT   P_TOTAL    DECIMAL(11, 2),
    OUT   P_CUSTNAME CHAR(40),
    OUT   P_ERRCNT   DECIMAL(3, 0),
    OUT   P_ERRORS   CHAR(1800),
    INOUT P_CHKSUM   CHAR(32) )
  LANGUAGE RPGLE
  PARAMETER STYLE GENERAL
  NOT DETERMINISTIC
  MODIFIES SQL DATA
  EXTERNAL NAME 'COM022LIB/ORDSVC';

CREATE OR REPLACE PROCEDURE COM022LIB.ORDSVC_API (
    IN P_ACTION  CHAR(2),
    IN P_ORDNO   DECIMAL(7, 0),
    IN P_ORDDATE CHAR(10),
    IN P_CUSTNO  DECIMAL(7, 0),
    IN P_LINECNT DECIMAL(3, 0),
    IN P_LINES   CHAR(2200),
    IN P_CHKSUM  CHAR(32) )
  LANGUAGE SQL
  MODIFIES SQL DATA
  DYNAMIC RESULT SETS 1
  SET OPTION COMMIT = *CHG
BEGIN
  DECLARE V_ORDNO  DECIMAL(7, 0);
  DECLARE V_LINES  CHAR(2200);
  DECLARE V_TOTAL  DECIMAL(11, 2) DEFAULT 0;
  DECLARE V_NAME   CHAR(40) DEFAULT ' ';
  DECLARE V_ERRCNT DECIMAL(3, 0) DEFAULT 0;
  DECLARE V_ERRORS CHAR(1800) DEFAULT ' ';
  DECLARE V_CHKSUM CHAR(32);
  -- The variables are read when the cursor is OPENed, after the CALL.
  DECLARE C1 CURSOR WITH RETURN TO CALLER FOR
    SELECT V_ORDNO AS ORDNO, V_TOTAL AS TOTAL, V_NAME AS CUSTNAME,
           V_ERRCNT AS ERRCNT, V_ERRORS AS ERRORS, V_LINES AS LINES,
           V_CHKSUM AS CHKSUM
      FROM SYSIBM.SYSDUMMY1;

  -- The RPG finds its files through the LIBRARY LIST, and an ODBC job
  -- starts with the user's own current library (not this one): make
  -- this library current first, as COMSTART does on the 5250.
  CALL QSYS2.QCMDEXC('CHGCURLIB CURLIB(COM022LIB)');
  SET V_ORDNO = P_ORDNO;
  SET V_LINES = P_LINES;
  SET V_CHKSUM = P_CHKSUM;
  CALL COM022LIB.ORDSVC_X(P_ACTION, V_ORDNO, P_ORDDATE, P_CUSTNO,
                          P_LINECNT, V_LINES, V_TOTAL, V_NAME,
                          V_ERRCNT, V_ERRORS, V_CHKSUM);
  OPEN C1;
END;

-- ------------------------------------------------------------ CUSTSVC
CREATE OR REPLACE PROCEDURE COM022LIB.CUSTSVC_X (
    IN  P_ACTION   CHAR(1),
    IN  P_CUSTNO   DECIMAL(7, 0),
    IN  P_CUSTNAME CHAR(40),
    IN  P_ADDRESS  CHAR(50),
    IN  P_CITY     CHAR(30),
    IN  P_STATE    CHAR(20),
    IN  P_STATUS   CHAR(1),
    OUT P_ERRCNT   DECIMAL(3, 0),
    OUT P_ERRORS   CHAR(1800) )
  LANGUAGE RPGLE
  PARAMETER STYLE GENERAL
  NOT DETERMINISTIC
  MODIFIES SQL DATA
  EXTERNAL NAME 'COM022LIB/CUSTSVC';

CREATE OR REPLACE PROCEDURE COM022LIB.CUSTSVC_API (
    IN P_ACTION   CHAR(1),
    IN P_CUSTNO   DECIMAL(7, 0),
    IN P_CUSTNAME CHAR(40),
    IN P_ADDRESS  CHAR(50),
    IN P_CITY     CHAR(30),
    IN P_STATE    CHAR(20),
    IN P_STATUS   CHAR(1) )
  LANGUAGE SQL
  MODIFIES SQL DATA
  DYNAMIC RESULT SETS 1
  SET OPTION COMMIT = *CHG
BEGIN
  DECLARE V_ERRCNT DECIMAL(3, 0) DEFAULT 0;
  DECLARE V_ERRORS CHAR(1800) DEFAULT ' ';
  DECLARE C1 CURSOR WITH RETURN TO CALLER FOR
    SELECT V_ERRCNT AS ERRCNT, V_ERRORS AS ERRORS FROM SYSIBM.SYSDUMMY1;

  -- The RPG finds its files through the LIBRARY LIST, and an ODBC job
  -- starts with the user's own current library (not this one): make
  -- this library current first, as COMSTART does on the 5250.
  CALL QSYS2.QCMDEXC('CHGCURLIB CURLIB(COM022LIB)');
  CALL COM022LIB.CUSTSVC_X(P_ACTION, P_CUSTNO, P_CUSTNAME, P_ADDRESS,
                           P_CITY, P_STATE, P_STATUS, V_ERRCNT, V_ERRORS);
  OPEN C1;
END;

-- ------------------------------------------------------------ ITEMSVC
CREATE OR REPLACE PROCEDURE COM022LIB.ITEMSVC_X (
    IN  P_ACTION    CHAR(1),
    IN  P_ITEMNO    DECIMAL(7, 0),
    IN  P_ITEMDESC  CHAR(50),
    IN  P_CATEGORY  CHAR(20),
    IN  P_UNITPRICE DECIMAL(9, 2),
    IN  P_STOCKQTY  DECIMAL(9, 0),
    IN  P_STATUS    CHAR(1),
    OUT P_ERRCNT    DECIMAL(3, 0),
    OUT P_ERRORS    CHAR(1800) )
  LANGUAGE RPGLE
  PARAMETER STYLE GENERAL
  NOT DETERMINISTIC
  MODIFIES SQL DATA
  EXTERNAL NAME 'COM022LIB/ITEMSVC';

CREATE OR REPLACE PROCEDURE COM022LIB.ITEMSVC_API (
    IN P_ACTION    CHAR(1),
    IN P_ITEMNO    DECIMAL(7, 0),
    IN P_ITEMDESC  CHAR(50),
    IN P_CATEGORY  CHAR(20),
    IN P_UNITPRICE DECIMAL(9, 2),
    IN P_STOCKQTY  DECIMAL(9, 0),
    IN P_STATUS    CHAR(1) )
  LANGUAGE SQL
  MODIFIES SQL DATA
  DYNAMIC RESULT SETS 1
  SET OPTION COMMIT = *CHG
BEGIN
  DECLARE V_ERRCNT DECIMAL(3, 0) DEFAULT 0;
  DECLARE V_ERRORS CHAR(1800) DEFAULT ' ';
  DECLARE C1 CURSOR WITH RETURN TO CALLER FOR
    SELECT V_ERRCNT AS ERRCNT, V_ERRORS AS ERRORS FROM SYSIBM.SYSDUMMY1;

  -- The RPG finds its files through the LIBRARY LIST, and an ODBC job
  -- starts with the user's own current library (not this one): make
  -- this library current first, as COMSTART does on the 5250.
  CALL QSYS2.QCMDEXC('CHGCURLIB CURLIB(COM022LIB)');
  CALL COM022LIB.ITEMSVC_X(P_ACTION, P_ITEMNO, P_ITEMDESC, P_CATEGORY,
                           P_UNITPRICE, P_STOCKQTY, P_STATUS,
                           V_ERRCNT, V_ERRORS);
  OPEN C1;
END;
