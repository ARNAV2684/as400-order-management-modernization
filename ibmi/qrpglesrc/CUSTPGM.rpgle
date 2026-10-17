      * ======================================================================
      * CUSTPGM - Customer maintenance (list, add, edit, delete)
      * Author: Arnav    Created: 2026-10-06
      *
      * Style: classic SUBROUTINES (BEGSR/EXSR) on purpose - ITEMPGM
      * (Sprint 3) does the same job with sub-procedures, for comparison.
      *
      * Sprint 8: the rules and writes moved to CUSTSVC (also called by
      * the web). CUSTPGM keeps the screen: list, detail, and turning
      * CUSTSVC's errors into messages + field highlights (CallSvc).
      *
      * Indicator map (same numbers as CUSTDSPF):
      *   03 F3=Exit app  05 F5=Add  06 F6=Edit  07 F7=Delete
      *   10 F10=Save/Confirm  12 F12=Back
      *   31 SFLDSP  32 SFLDSPCTL  33 SFLCLR  34 SFLEND
      *   41 protect Cust No  42 protect other fields
      *   51 Cust No in error  52 Name in error  53 Status in error
      *   98 message subfile end marker
      *
      * PREFIX(F_) on CSTMST: the file's fields are F_CUSTNO, F_CITY...
      * so they never share storage with the screen fields; data moves
      * from file to screen only in ToScreen.
      *
      * CSTMST is INPUT only now (Sprint 8): CUSTSVC takes the lock right
      * before its UPDATE / DELETE, so reading here never locks anything.
      *
      * Row selection: every subfile row is checked by CHAIN on its row
      * number, not READC (READC misses an X left from an earlier error).
      *
      * Change log:
      *   2026-10-06  Arnav  Created (Sprint 2, checkpoint 2C)
      *   2026-10-06  Arnav  Add/Edit/Delete, PREFIX, locks* (Sprint 2, 2D)
      *   2026-10-07  Arnav  Messages to queue PGMQ by name (3B fix)
      *   2026-10-14  Arnav  Rules + writes moved to CUSTSVC (Sprint 8)
      * ======================================================================
     H DFTACTGRP(*NO) ACTGRP('COMAG') BNDDIR('COMBNDDIR')
     H OPTION(*SRCSTMT:*NODEBUGIO)
     FCUSTDSPF  CF   E             WORKSTN SFILE(CUSTSFL:Rrn)
     FCSTMST    IF   E           K DISK    PREFIX(F_)
      /COPY QRPGLESRC,COMPROTO
      *
      * Entry parameter (see prototype CustPgm in COMPROTO)
     D CustPgm         PI
     D  ExitApp                       1A
      *
     D Rrn             S              4P 0
     D RowCount        S              4P 0
     D Row             S              4P 0
     D SelCount        S              4P 0
     D SelCust         S              7P 0
     D BadSel          S              1N
     D Done            S              1N
     D DtlDone         S              1N
     D HasError        S              1N
     D Saved           S              1N
      * CUSTSVC's action, errors and the customer number it works on
     D SvcAct          S              1A
     D SvcCust         S              7P 0
     D ErrCnt          S              3P 0
     D Errs            DS                  LIKEDS(ErrEntT) DIM(30)
     D i               S              3P 0

        ExitApp = 'N';
        // PGMQ = this program's name = its main procedure's message queue.
        // SendMsg/ClearMsgs and the screen's message subfile all use it.
        PGMQ = 'CUSTPGM';
        *in98 = *on;
        exsr LoadList;

        dow not Done;
          write CUSTKEY;
          write MSGCTL;
          exfmt CUSTCTL;
          ClearMsgs(PGMQ);

          select;
          when *in03;
            ExitApp = 'Y';
            Done = *on;
          when *in12;
            Done = *on;
          when *in05;
            MODE = 'ADD';
            exsr DoDetail;
            exsr LoadList;
          other;
            exsr CheckSel;
          endsl;
        enddo;

        *inlr = *on;
        return;

        // ----------------------------------------------------------
        // LoadList: clear the subfile, then one row per customer
        // ----------------------------------------------------------
        begsr LoadList;
          *in31 = *off;
          *in32 = *off;
          *in33 = *on;
          write CUSTCTL;
          *in33 = *off;

          Rrn = 0;
          setll *loval CSTMST;
          read CSTMST;
          dow not %eof(CSTMST);
            Rrn += 1;
            SEL = ' ';
            CUSTNO = F_CUSTNO;
            CUSTNAME = F_CUSTNAME;
            LCITY = F_CITY;
            STATUS = F_STATUS;
            write CUSTSFL;
            read CSTMST;
          enddo;

          RowCount = Rrn;
          // SFLDSP with zero rows is an error, so only when rows exist.
          *in31 = (RowCount > 0);
          *in32 = *on;
          *in34 = *on;
        endsr;

        // ----------------------------------------------------------
        // CheckSel: count the X's, then Enter=Display F6=Edit F7=Delete
        // ----------------------------------------------------------
        begsr CheckSel;
          SelCount = 0;
          BadSel = *off;

          for Row = 1 to RowCount;
            chain Row CUSTSFL;
            if SEL = 'X';
              SelCount += 1;
              SelCust = CUSTNO;
            elseif SEL <> ' ';
              BadSel = *on;
            endif;
          endfor;

          select;
          when BadSel;
            SendMsg(PGMQ : 'COM0036');
          when SelCount > 1;
            SendMsg(PGMQ : 'COM0003');
          when SelCount = 0;
            // Plain Enter with nothing selected: just show the list again.
            if *in06 or *in07;
              SendMsg(PGMQ : 'COM0002');
            endif;
          other;
            if *in06;
              MODE = 'EDIT';
            elseif *in07;
              MODE = 'DELETE';
            else;
              MODE = 'DISPLAY';
            endif;
            exsr DoDetail;
            // Back from the detail: reload (fresh data, X's cleared).
            exsr LoadList;
          endsl;
        endsr;

        // ----------------------------------------------------------
        // DoDetail: show one customer in MODE (ADD/EDIT/DISPLAY/DELETE)
        // ----------------------------------------------------------
        begsr DoDetail;
          *in51 = *off;
          *in52 = *off;
          *in53 = *off;

          if MODE = 'ADD';
            CUSTNO = 0;
            CUSTNAME = *blanks;
            ADDRESS = *blanks;
            CITY = *blanks;
            STATE = *blanks;
            STATUS = 'A';
          else;
            chain SelCust CSTMST;
            if not %found(CSTMST);
              // Deleted by someone else since the list was loaded.
              SendMsg(PGMQ : 'COM0006');
              leavesr;
            endif;
            exsr ToScreen;
          endif;

          // 41 = number locked (everything but ADD, decision A4 style);
          // 42 = all other fields locked (DISPLAY and DELETE).
          *in41 = (MODE <> 'ADD');
          *in42 = (MODE = 'DISPLAY' or MODE = 'DELETE');

          select;
          when MODE = 'DISPLAY';
            LEGEND = 'Enter or F12=Back  F3=Exit';
          when MODE = 'DELETE';
            LEGEND = 'F10=Confirm delete  F12=Cancel  F3=Exit';
          other;
            LEGEND = 'Enter=Check  F10=Save  F12=Cancel  F3=Exit';
          endsl;

          DtlDone = *off;
          dow not DtlDone;
            write MSGCTL;
            exfmt CUSTDTL;
            ClearMsgs(PGMQ);
            *in51 = *off;
            *in52 = *off;
            *in53 = *off;

            select;
            when *in03;
              ExitApp = 'Y';
              Done = *on;
              DtlDone = *on;
            when *in12 or MODE = 'DISPLAY';
              DtlDone = *on;
            when MODE = 'DELETE';
              if *in10;
                exsr DeleteCust;
                DtlDone = Saved;
              endif;
            other;
              // ADD / EDIT: Enter only checks; F10 checks, then saves.
              exsr Validate;
              if not HasError and *in10;
                exsr SaveCust;
                DtlDone = Saved;
              endif;
            endsl;
          enddo;
        endsr;

        // ----------------------------------------------------------
        // Validate: CUSTSVC checks every field (V new / U existing)
        // ----------------------------------------------------------
        begsr Validate;
          if MODE = 'ADD';
            SvcAct = 'V';
          else;
            SvcAct = 'U';
          endif;
          exsr CallSvc;
          HasError = (ErrCnt > 0);
        endsr;

        // ----------------------------------------------------------
        // SaveCust: CUSTSVC adds (A) or locks + updates (E)
        // ----------------------------------------------------------
        begsr SaveCust;
          if MODE = 'ADD';
            SvcAct = 'A';
          else;
            SvcAct = 'E';
          endif;
          exsr CallSvc;
          Saved = (ErrCnt = 0);
          if Saved;
            SendMsg(PGMQ : 'COM0034');
          endif;
        endsr;

        // ----------------------------------------------------------
        // DeleteCust: CUSTSVC refuses while the customer has orders (D8)
        // ----------------------------------------------------------
        begsr DeleteCust;
          SvcAct = 'D';
          exsr CallSvc;
          Saved = (ErrCnt = 0);
          if Saved;
            SendMsg(PGMQ : 'COM0035');
          endif;
        endsr;

        // ----------------------------------------------------------
        // CallSvc: the screen fields -> CUSTSVC; every error back as a
        // message, and its field highlighted (51 / 52 / 53)
        //   Fixed-format:  C   CALL 'CUSTSVC'  +  PARM lines
        // ----------------------------------------------------------
        begsr CallSvc;
          // Edit / delete work on the selected customer; the number on
          // the screen is protected then anyway (ind 41).
          if MODE = 'ADD';
            SvcCust = CUSTNO;
          else;
            SvcCust = SelCust;
          endif;
          CustSvc(SvcAct : SvcCust : CUSTNAME : ADDRESS : CITY : STATE
                 : STATUS : ErrCnt : Errs);
          for i = 1 to ErrCnt;
            SendMsg(PGMQ : Errs(i).MsgId
                   : Errs(i).MsgDta1 + Errs(i).MsgDta2);
            select;
            when Errs(i).ErrField = 'CUSTNO';
              *in51 = *on;
            when Errs(i).ErrField = 'CUSTNAME';
              *in52 = *on;
            when Errs(i).ErrField = 'STATUS';
              *in53 = *on;
            endsl;
          endfor;
        endsr;

        // ----------------------------------------------------------
        // ToScreen: the only place data moves from the file (F_ fields)
        // to the screen. (Screen -> file is CUSTSVC's job now.)
        // ----------------------------------------------------------
        begsr ToScreen;
          CUSTNO = F_CUSTNO;
          CUSTNAME = F_CUSTNAME;
          ADDRESS = F_ADDRESS;
          CITY = F_CITY;
          STATE = F_STATE;
          STATUS = F_STATUS;
        endsr;
