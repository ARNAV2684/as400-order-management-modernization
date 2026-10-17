      * ======================================================================
      * LOADDATA - Load sample data into the COM files (re-runnable)
      * Author: Arnav    Created: 2026-10-06
      *
      * Compile: CRTSQLRPGI OBJ(COM022LIB/LOADDATA) SRCFILE(COM022LIB/QRPGLESRC)
      *            OBJTYPE(*PGM) COMMIT(*NONE) DBGVIEW(*SOURCE)
      *
      * COM022LIB is hard-coded ON PURPOSE (SET OPTION DFTRDBCOL and the
      * data area name): this program DELETEs every row first, and
      * OLDLIB has an old CSTMST etc. A wrong library list must never
      * make it wipe those. Application programs will use *LIBL instead.
      *
      * Order of work follows the constraints from COMCST: delete
      * child-first, insert parent-first; line PRICE/AMOUNT come from
      * ITMMST so ORDDTL_AMT_CK (AMOUNT = QTY * PRICE) always holds.
      *
      * No commitment control (files are journaled only in Sprint 6), so
      * a failure part-way leaves partial data: fix the cause and re-run.
      *
      * Change log:
      *   2026-10-06  Arnav  Created (Sprint 1, checkpoint 1C)
      *   2026-10-06  Arnav  Messages to *PGMBDY, not * (PEP gotcha)
      *   2026-10-09  Arnav  Also clears ITMPRCH (Sprint 3, 3C)
      *   2026-10-15  Arnav  +5 customers, items, orders for more test cases
      * ======================================================================
     H DFTACTGRP(*NO) ACTGRP(*NEW) OPTION(*SRCSTMT:*NODEBUGIO)
      *
      * *VAR: the data area name comes from DtaAreaNm at run time.
     D NxtOrdNo        S              7P 0 DTAARA(*VAR:DtaAreaNm)
     D DtaAreaNm       S             21A   INZ('COM022LIB/NXTORDNO')
     D Step            S             30A   VARYING
     D nCust           S             10I 0
     D nItem           S             10I 0
     D nOrder          S             10I 0
     D nLine           S             10I 0
     D MsgText         S            200A   VARYING
      *
      * QMHSNDPM - Send Program Message API. Call stack '*PGMBDY' + 1 =
      * the real caller. NOT '*' + 1: in ILE that is the hidden program
      * entry procedure (_QRNP_PEP_LOADDATA), so the message would vanish
      * when the program ends.
     D SndPgmMsg       PR                  EXTPGM('QMHSNDPM')
     D  MsgId                         7A   CONST
     D  MsgFile                      20A   CONST
     D  MsgData                     200A   CONST OPTIONS(*VARSIZE)
     D  MsgDataLen                   10I 0 CONST
     D  MsgType                      10A   CONST
     D  CallStack                    10A   CONST
     D  CallStackCnt                 10I 0 CONST
     D  MsgKey                        4A
     D  ErrorCode                     8A
      * Bytes provided = 0: API errors come back as exceptions.
     D ApiError        DS
     D  BytesProv                    10I 0 INZ(0)
     D  BytesAvail                   10I 0
     D MsgKeyOut       S              4A
        // DFTRDBCOL: unqualified table names in this program's static SQL
        // resolve to COM022LIB, whatever the job's library list says.
        exec sql set option commit = *none, naming = *sql,
                            dftrdbcol = COM022LIB, closqlcsr = *endmod;

        // ------------------------------------------------ 1. clear
        Step = 'DELETE ORDDTL';
        exec sql delete from ORDDTL;
        exsr ChkSql;
        Step = 'DELETE ORDHDR';
        exec sql delete from ORDHDR;
        exsr ChkSql;
        Step = 'DELETE ORDAUD';
        exec sql delete from ORDAUD;
        exsr ChkSql;
        // Price-change log (Sprint 3C) - a reset clears history too.
        Step = 'DELETE ITMPRCH';
        exec sql delete from ITMPRCH;
        exsr ChkSql;
        Step = 'DELETE ITMMST';
        exec sql delete from ITMMST;
        exsr ChkSql;
        Step = 'DELETE CSTMST';
        exec sql delete from CSTMST;
        exsr ChkSql;

        // ------------------------------------------------ 2. masters
        // 2005 inactive: orders must be refused for it (COM0010).
        // 2007 = full 40-char name (truncated to 28 on ORDLIST);
        // 2008 inactive but HAS an order (edit allowed, E3; new refused);
        // 2009 no orders (the one customer that can be deleted);
        // 2010 several orders (customer filter, recent orders).
        Step = 'INSERT CSTMST';
        exec sql insert into CSTMST values
          (2001, 'ABC INDUSTRIES',    '12 ANDHERI EAST', 'MUMBAI',
                 'MAHARASHTRA', 'A'),
          (2002, 'SHARMA TRADERS',    '45 FC ROAD',      'PUNE',
                 'MAHARASHTRA', 'A'),
          (2003, 'GUPTA ELECTRONICS', '8 NEHRU PLACE',   'NEW DELHI',
                 'DELHI',       'A'),
          (2004, 'SAI ENTERPRISES',   '21 MG ROAD',      'BENGALURU',
                 'KARNATAKA',   'A'),
          (2005, 'OLD TIMES CO',      '3 MOUNT ROAD',    'CHENNAI',
                 'TAMIL NADU',  'I'),
          (2006, 'PATEL ELECTRONICS', '45 FC ROAD',      'PUNE',
                 'MAHARASHTRA', 'A'),
          (2007, 'NORTHERN STAR WHOLESALE DISTRIBUTORS LTD',
                 '9 KAROL BAGH',      'DELHI',     'DELHI',       'A'),
          (2008, 'KAPOOR & SONS',     '21 MI ROAD',      'JAIPUR',
                 'RAJASTHAN',   'I'),
          (2009, 'GREENLEAF SOLUTIONS', '88 MG ROAD',    'BENGALURU',
                 'KARNATAKA',   'A'),
          (2010, 'MEHTA RETAIL',      '3 LINKING ROAD',  'MUMBAI',
                 'MAHARASHTRA', 'A');
        exsr ChkSql;

        // 5005 stock 0 (COM0019), 5007 inactive (COM0018),
        // 5004 / 5008 low stock (dashboard "low stock" later).
        // 5009 high value; 5010 paise price (7 x 5.50 = 38.50);
        // 5011 exactly 5 = the low-stock line; 5012 sold out by order
        // 10005; 5013 inactive, never ordered (deletable, COM0018).
        // New items' stock is the stock AFTER the sample orders, so a
        // reset shows the same cases as the live data.
        Step = 'INSERT ITMMST';
        exec sql insert into ITMMST values
          (5001, 'LAPTOP 14 INCH',     'COMPUTERS',   45000.00,  20, 'A'),
          (5002, 'WIRELESS MOUSE',     'ACCESSORIES',   650.00, 150, 'A'),
          (5003, 'KEYBOARD',           'ACCESSORIES',  1200.00,  80, 'A'),
          (5004, '24 INCH MONITOR',    'DISPLAYS',     9500.00,   4, 'A'),
          (5005, 'LASER PRINTER',      'PRINTERS',    12000.00,   0, 'A'),
          (5006, 'USB PEN DRIVE 64GB', 'STORAGE',       450.00, 300, 'A'),
          (5007, 'WEBCAM HD',          'ACCESSORIES',  2500.00,  15, 'I'),
          (5008, 'HEADSET',            'ACCESSORIES',  1800.00,   3, 'A'),
          (5009, 'WORKSTATION 32GB',   'COMPUTERS', 125000.00,   9, 'A'),
          (5010, 'USB CABLE TYPE C',   'ACCESSORIES',     5.50, 492, 'A'),
          (5011, 'DOCKING STATION',    'ACCESSORIES',  8500.00,   5, 'A'),
          (5012, 'GRAPHICS TABLET',    'ACCESSORIES', 22000.00,   0, 'A'),
          (5013, 'FLOPPY DRIVE (OLD)', 'LEGACY',        300.00,  25, 'I');
        exsr ChkSql;

        // ------------------------------------------------ 3. orders
        // Headers first with total 0 (ORDDTL_ORD_FK needs the parent);
        // the real totals are computed from the lines in step 4.
        Step = 'INSERT ORDHDR';
        exec sql insert into ORDHDR values
          (10001, '2026-09-28', 2001, 'O', 0),
          (10002, '2026-10-01', 2002, 'O', 0),
          (10003, '2026-10-05', 2010, 'O', 0),
          (10004, '2026-10-08', 2010, 'O', 0),
          (10005, '2026-10-11', 2006, 'O', 0),
          (10006, '2026-10-13', 2008, 'O', 0),
          (10007, '2026-10-15', 2007, 'O', 0);
        exsr ChkSql;

        // 10003 = the largest order; 10004 = 8 lines (two pages of 5
        // on the 5250); 10007 = paise amounts (7 x 5.50).
        // Description and price are COPIED from ITMMST, as the order
        // program will do. The join silently drops a line whose item
        // doesn't exist, so the line count is verified in step 5.
        Step = 'INSERT ORDDTL';
        exec sql insert into ORDDTL
                   (ORDNO, LINENO, ITEMNO, ITEMDESC, QTY, PRICE, AMOUNT)
          select v.ORDNO, v.LINENO, i.ITEMNO, i.ITEMDESC,
                 v.QTY, i.UNITPRICE, v.QTY * i.UNITPRICE
            from (values (10001, 1, 5001,  2),
                         (10001, 2, 5002,  5),
                         (10001, 3, 5003,  3),
                         (10002, 1, 5004,  2),
                         (10002, 2, 5006, 10),
                         (10002, 3, 5002,  4),
                         (10002, 4, 5008,  1),
                         (10003, 1, 5009,  1),
                         (10004, 1, 5001,  1),
                         (10004, 2, 5002,  1),
                         (10004, 3, 5003,  1),
                         (10004, 4, 5004,  1),
                         (10004, 5, 5006,  1),
                         (10004, 6, 5008,  1),
                         (10004, 7, 5010,  1),
                         (10004, 8, 5011,  1),
                         (10005, 1, 5012,  1),
                         (10006, 1, 5002,  2),
                         (10007, 1, 5010,  7),
                         (10007, 2, 5003,  1))
                 as v (ORDNO, LINENO, ITEMNO, QTY)
            join ITMMST i on i.ITEMNO = v.ITEMNO;
        exsr ChkSql;

        // ------------------------------------------------ 4. totals
        // Correlated subquery: one SUM per header row.
        Step = 'UPDATE ORDHDR totals';
        exec sql update ORDHDR h
                    set TOTAMT = (select coalesce(sum(d.AMOUNT), 0)
                                    from ORDDTL d
                                   where d.ORDNO = h.ORDNO);
        exsr ChkSql;

        // ------------------------------------------------ 5. verify
        Step = 'COUNT rows';
        exec sql select (select count(*) from CSTMST),
                        (select count(*) from ITMMST),
                        (select count(*) from ORDHDR),
                        (select count(*) from ORDDTL)
                   into :nCust, :nItem, :nOrder, :nLine
                   from SYSIBM.SYSDUMMY1;
        exsr ChkSql;
        if nCust <> 10 or nItem <> 13 or nOrder <> 7 or nLine <> 20;
          MsgText = 'LOADDATA: unexpected row counts - customers '
                  + %char(nCust) + ', items ' + %char(nItem)
                  + ', orders ' + %char(nOrder)
                  + ', lines ' + %char(nLine);
          exsr SendEscape;
        endif;

        // ------------------------------------------------ 6. data area
        // Orders 10001-10007 now exist, so the next real one is 10008.
        // Fixed-format equivalent:  C     *LOCK     IN        NxtOrdNo
        // OUT writes the value back AND releases the *LOCK.
        Step = 'NXTORDNO';
        in *lock NxtOrdNo;
        NxtOrdNo = 10007;
        out NxtOrdNo;

        MsgText = 'LOADDATA: ' + %char(nCust) + ' customers, '
                + %char(nItem) + ' items, ' + %char(nOrder)
                + ' orders (' + %char(nLine) + ' lines) loaded. '
                + 'NXTORDNO = ' + %char(NxtOrdNo) + '.';
        SndPgmMsg('CPF9897' : 'QCPFMSG   *LIBL' : MsgText
                 : %len(MsgText) : '*COMP' : '*PGMBDY' : 1 : MsgKeyOut
                 : ApiError);

        *inlr = *on;
        return;

        // ----------------------------------------------------------
        // ChkSql: stop on any SQLSTATE outside class 00 (ok),
        // 01 (warning) or 02 (no rows - normal for DELETE on empty).
        // ----------------------------------------------------------
        begsr ChkSql;
          if %subst(SQLSTATE : 1 : 2) <> '00'
            and %subst(SQLSTATE : 1 : 2) <> '01'
            and %subst(SQLSTATE : 1 : 2) <> '02';
            MsgText = 'LOADDATA failed at ' + Step + ': SQLSTATE '
                    + SQLSTATE + ', SQLCODE ' + %char(SQLCODE)
                    + '. Fix the cause and re-run';
            exsr SendEscape;
          endif;
        endsr;

        // ----------------------------------------------------------
        // SendEscape: *ESCAPE to the caller ends this program at once
        // and makes the CALL fail, so a script can't miss the error.
        // CPF9898 is '&1.' - the text must not end with its own '.'.
        // ----------------------------------------------------------
        begsr SendEscape;
          SndPgmMsg('CPF9898' : 'QCPFMSG   *LIBL' : MsgText
                   : %len(MsgText) : '*ESCAPE' : '*PGMBDY' : 1 : MsgKeyOut
                   : ApiError);
        endsr;
