      * ======================================================================
      * ORDRPT - Order summary report: one line per customer (batch)
      * Author: Arnav    Created: 2026-10-13
      *
      * Compile: CRTSQLRPGI OBJ(COM022LIB/ORDRPT) SRCFILE(COM022LIB/QRPGLESRC)
      *            OBJTYPE(*PGM) COMMIT(*NONE) DBGVIEW(*SOURCE)
      * Run (batch, decision S4):
      *   SBMJOB CMD(CALL PGM(COM022LIB/ORDRPT)) JOB(ORDRPT)
      *   WRKSPLF -> option 5 on ORDRPTF to read it.
      *   PUB400: add JOBQ(QGPL/QBATCH). The user's own job queue feeds a
      *   subsystem without a matching routing entry: the job ends at once
      *   with CPC1117 and prints nothing.
      * Amounts follow the system decimal format: PUB400 prints 96.850,00.
      *
      * Extra beyond the PDF (M2): an SQL cursor with GROUP BY feeding a
      * printer file. The database does the grouping; RPG only prints the
      * rows and adds the grand total.
      *   - only customers WITH orders (the cursor starts from ORDHDR);
      *   - highest total value first.
      * Page overflow: indicator Overflow (OFLIND) turns on when a line is
      * printed on/after the overflow line (OVRFLW(60) on CRTPRTF) -> the
      * heading again. A NAMED indicator: RPG IV has no *INOF (RNF2014) -
      * only *INOA-*INOG / *INOV, or a 1N field like this one.
      *
      * NAMING = *SYS: ORDHDR / CSTMST through the library list. SBMJOB
      * gives the batch job the submitter's library list (INLLIBL(*CURRENT)
      * by default), so it finds the same library as the interactive job.
      *
      * Ends with *COMP 'n customers, m orders printed' to the caller, or
      * *ESCAPE on an SQL error (*PGMBDY + 1 - the LOADDATA lesson).
      *
      * Change log:
      *   2026-10-13  Arnav  Created (Sprint 7, checkpoint 7B)
      * ======================================================================
     H DFTACTGRP(*NO) ACTGRP(*NEW) OPTION(*SRCSTMT:*NODEBUGIO)
     FORDRPTF   O    E             PRINTER OFLIND(Overflow)
      *
      * One fetched row (same order as the SELECT list)
     D Row             DS
     D  CustNo                        7P 0
     D  CustName                     40A
     D  OrdCount                     10I 0
     D  OrdTotal                     13P 2
     D  OrdAvg                       13P 2
      *
     D Overflow        S              1N
     D NumCust         S              5P 0
     D NumOrd          S              7P 0
     D GrandTot        S             15P 2
     D Step            S             10A
     D MsgText         S            200A
      *
      * QMHSNDPM - completion / escape message to the caller
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
     D ApiError        DS
     D  BytesProv                    10I 0 INZ(0)
     D  BytesAvail                   10I 0
     D MsgKeyOut       S              4A

        exec sql set option commit = *none, naming = *sys,
                            closqlcsr = *endmod;

        // GROUP BY: one result row per customer - COUNT / SUM / AVG are
        // worked out by the database. LEFT JOIN: an order whose customer
        // is missing still prints (FK makes that impossible today).
        exec sql declare C1 cursor for
          select h.CUSTNO,
                 coalesce(c.CUSTNAME, '*** customer not found ***'),
                 count(*),
                 sum(h.TOTAMT),
                 cast(avg(h.TOTAMT) as decimal(13, 2))
            from ORDHDR h
            left join CSTMST c on c.CUSTNO = h.CUSTNO
           group by h.CUSTNO, c.CUSTNAME
           order by sum(h.TOTAMT) desc, h.CUSTNO;

        Step = 'OPEN';
        exec sql open C1;
        exsr ChkSql;

        ULINE = *all'-';
        write HDR;

        Step = 'FETCH';
        exec sql fetch C1 into :Row;
        // SQLSTATE class '00' = row, '01' = row with a warning,
        // '02' = no more rows.
        dow %subst(SQLSTATE : 1 : 2) < '02';
          if Overflow;
            write HDR;
            Overflow = *off;
          endif;
          RCUSTNO = CustNo;
          RNAME = CustName;
          RCOUNT = OrdCount;
          RTOTAL = OrdTotal;
          RAVG = OrdAvg;
          write DTL;

          NumCust += 1;
          NumOrd += OrdCount;
          GrandTot += OrdTotal;
          exec sql fetch C1 into :Row;
        enddo;
        exsr ChkSql;
        exec sql close C1;

        GCUST = NumCust;
        GCOUNT = NumOrd;
        GTOTAL = GrandTot;
        if NumOrd > 0;
          GAVG = %dech(GrandTot / NumOrd : 13 : 2);
        else;
          GAVG = 0;
        endif;
        if Overflow;
          write HDR;
          Overflow = *off;
        endif;
        write TOT;

        MsgText = 'ORDRPT: ' + %char(NumCust) + ' customers, ' +
                  %char(NumOrd) + ' orders printed (spooled file ORDRPTF).';
        SndPgmMsg('CPF9897' : 'QCPFMSG   *LIBL' : MsgText
                 : %len(%trimr(MsgText)) : '*COMP'
                 : '*PGMBDY' : 1 : MsgKeyOut : ApiError);
        *inlr = *on;
        return;

      * ------------------------------------------------------------------
      * ChkSql - stop with an *ESCAPE on any SQL error ('02' = end of rows
      * is not an error)
      * ------------------------------------------------------------------
        begsr ChkSql;
          if %subst(SQLSTATE : 1 : 2) > '02';
            MsgText = 'ORDRPT: SQL error at ' + %trim(Step) +
                      ' - SQLSTATE ' + SQLSTATE + '.';
            SndPgmMsg('CPF9898' : 'QCPFMSG   *LIBL' : MsgText
                     : %len(%trimr(MsgText)) : '*ESCAPE'
                     : '*PGMBDY' : 1 : MsgKeyOut : ApiError);
          endif;
        endsr;
