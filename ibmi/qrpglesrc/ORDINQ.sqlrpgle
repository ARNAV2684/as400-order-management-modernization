      * ======================================================================
      * ORDINQ - Order inquiry: SQL cursor + stored procedure
      * Author: Arnav    Created: 2026-10-06
      *
      * Compile: CRTSQLRPGI OBJ(COM022LIB/ORDINQ) SRCFILE(COM022LIB/QRPGLESRC)
      *            OBJTYPE(*PGM) COMMIT(*NONE) DBGVIEW(*SOURCE)
      *
      * Read-only inquiry (M2 extra): orders between two dates with a
      * minimum total.
      *   - the rows come from an SQL CURSOR over view ORDSUMV (Sprint 1),
      *     with the filters as HOST VARIABLES (:FromDate ...);
      *   - the summary line comes from stored procedure ORDSTATS.
      *
      * NAMING = *SYS (not *SQL like LOADDATA): unqualified names ORDSUMV
      * and ORDSTATS are found through the LIBRARY LIST (COMSTART makes
      * COM022LIB current). With *SQL they would mean the schema named
      * after the user profile - the SQL5051 trap from Sprint 1.
      *
      * Indicator map: 03 F3  12 F12  31-34 subfile  51 From date in error
      *                98 message subfile end marker
      *
      * Change log:
      *   2026-10-09  Arnav  Created (Sprint 4, checkpoint 4C)
      * ======================================================================
     H DFTACTGRP(*NO) ACTGRP('COMAG') BNDDIR('COMBNDDIR')
     H OPTION(*SRCSTMT:*NODEBUGIO)
     FORDINQF   CF   E             WORKSTN SFILE(INQSFL:Rrn)
      /COPY QRPGLESRC,COMPROTO
      *
      * Entry parameter (see prototype OrdInq in COMPROTO)
     D OrdInq          PI
     D  ExitApp                       1A
      *
      * Global
     D Rrn             S              4P 0
     D Done            S              1N
     D ExitReq         S              1N

        exec sql set option commit = *none, naming = *sys,
                            closqlcsr = *endmod;

        PGMQ = 'ORDINQ';
        *in98 = *on;

        // Default filter: the last 30 days (date arithmetic, M2 Day 17).
        TODT = %date();
        FROMDT = TODT - %days(30);
        MINTOT = 0;
        Search();

        dow not Done;
          write INQKEY;
          write MSGCTL;
          exfmt INQCTL;
          ClearMsgs(PGMQ);
          *in51 = *off;

          select;
          when *in03;
            ExitReq = *on;
            Done = *on;
          when *in12;
            Done = *on;
          when FROMDT > TODT;
            *in51 = *on;
            SendMsg(PGMQ : 'COM0041');
          other;
            Search();
          endsl;
        enddo;

        if ExitReq;
          ExitApp = 'Y';
        else;
          ExitApp = 'N';
        endif;
        *inlr = *on;
        return;

      *
      * ------------------------------------------------------------------
      * Search - load the subfile with an SQL cursor, then fill the
      * summary line by calling stored procedure ORDSTATS
      * ------------------------------------------------------------------
     P Search          B
     D Search          PI
      * Host variables: RPG fields used inside SQL (written :FromDate)
     D FromDate        S               D
     D ToDate          S               D
     D MinTotal        S             11P 2
     D OrdCount        S             10I 0
     D OrdTotal        S             13P 2
      * One fetched row; subfields in the cursor's SELECT order
     D Row             DS
     D  R_OrdNo                       7P 0
     D  R_Date                         D
     D  R_Name                       40A
     D  R_Lines                      10I 0
     D  R_Total                      11P 2

        *in31 = *off;
        *in32 = *off;
        *in33 = *on;
        write INQCTL;
        *in33 = *off;
        Rrn = 0;
        SCOUNT = 0;
        STOTAL = 0;

        FromDate = FROMDT;
        ToDate = TODT;
        MinTotal = MINTOT;

        // DECLARE only describes the query; OPEN runs it.
        exec sql declare C1 cursor for
                 select ORDNO, ORDDATE, CUSTNAME, LINECNT, TOTAMT
                   from ORDSUMV
                  where ORDDATE between :FromDate and :ToDate
                    and TOTAMT >= :MinTotal
                  order by ORDDATE, ORDNO;

        exec sql open C1;
        if SQLCODE < 0;
          SendMsg(PGMQ : 'COM0042' : MsgData2(SQLSTATE));
          return;
        endif;

        // FETCH hands over one row at a time; SQLCODE 100 = no more rows.
        exec sql fetch C1 into :Row;
        dow SQLCODE = 0;
          Rrn += 1;
          IORDNO = R_OrdNo;
          IDATE = %xlate('.' : '/' : %char(R_Date : *EUR));
          INAME = R_Name;
          ILINES = R_Lines;
          ITOTAL = R_Total;
          write INQSFL;
          exec sql fetch C1 into :Row;
        enddo;
        if SQLCODE < 0;
          SendMsg(PGMQ : 'COM0042' : MsgData2(SQLSTATE));
        endif;
        exec sql close C1;

        // The stored procedure: IN = the filters, OUT = count + total.
        exec sql call ORDSTATS(:FromDate, :ToDate, :MinTotal,
                               :OrdCount, :OrdTotal);
        if SQLCODE < 0;
          SendMsg(PGMQ : 'COM0042' : MsgData2(SQLSTATE));
        else;
          SCOUNT = OrdCount;
          STOTAL = OrdTotal;
        endif;

        *in31 = (Rrn > 0);
        *in32 = *on;
        *in34 = *on;
        if Rrn = 0;
          SendMsg(PGMQ : 'COM0037');
        endif;
        return;

     P Search          E
