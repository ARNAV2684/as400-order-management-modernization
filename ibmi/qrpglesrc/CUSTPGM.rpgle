      * ======================================================================
      * CUSTPGM - Customer maintenance (list, add, edit, delete)
      * Author: Arnav    Created: 2026-10-06
      *
      * Style: classic SUBROUTINES (BEGSR/EXSR) on purpose - ITEMPGM
      * (Sprint 3) does the same job with sub-procedures, for comparison.
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
      * so they never share storage with the screen fields. Without it,
      * the CHAIN that locks a record before UPDATE would overwrite what
      * the user typed. Data moves only in ToScreen / ToFile.
      *
      * Record locks: CSTMST is an update file, so a plain READ/CHAIN
      * locks the record. Reads for showing data use (N) = no lock; the
      * lock is taken only right before UPDATE/DELETE, never while a
      * person is looking at the screen.
      *
      * Row selection: every subfile row is checked by CHAIN on its row
      * number, not READC (READC misses an X left from an earlier error).
      *
      * Change log:
      *   2026-10-06  Arnav  Created (Sprint 2, checkpoint 2C)
      *   2026-10-06  Arnav  Add/Edit/Delete, PREFIX, locks* (Sprint 2, 2D)
      *   2026-10-07  Arnav  Messages to queue PGMQ by name (3B fix)
      * ======================================================================
     H DFTACTGRP(*NO) ACTGRP('COMAG') BNDDIR('COMBNDDIR')
     H OPTION(*SRCSTMT:*NODEBUGIO)
     FCUSTDSPF  CF   E             WORKSTN SFILE(CUSTSFL:Rrn)
     FCSTMST    UF A E           K DISK    PREFIX(F_)
      * Only asked 'does this customer have orders?' (SETLL + %EQUAL).
     FORDHDRL1  IF   E           K DISK    PREFIX(O_)
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
          read(n) CSTMST;
          dow not %eof(CSTMST);
            Rrn += 1;
            SEL = ' ';
            CUSTNO = F_CUSTNO;
            CUSTNAME = F_CUSTNAME;
            LCITY = F_CITY;
            STATUS = F_STATUS;
            write CUSTSFL;
            read(n) CSTMST;
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
            // (N): just looking - don't lock the record.
            chain(n) SelCust CSTMST;
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
        // Validate: check every field, send ALL errors at once
        // ----------------------------------------------------------
        begsr Validate;
          HasError = *off;

          if MODE = 'ADD';
            if CUSTNO <= 0;
              SendMsg(PGMQ : 'COM0004');
              *in51 = *on;
              HasError = *on;
            else;
              // SETLL + %EQUAL: "does this key exist?" without reading
              // the record (a CHAIN would load data we don't want).
              setll CUSTNO CSTMST;
              if %equal(CSTMST);
                SendMsg(PGMQ : 'COM0005');
                *in51 = *on;
                HasError = *on;
              endif;
            endif;
          endif;

          if CUSTNAME = *blanks;
            SendMsg(PGMQ : 'COM0007');
            *in52 = *on;
            HasError = *on;
          endif;

          if STATUS <> 'A' and STATUS <> 'I';
            SendMsg(PGMQ : 'COM0008');
            *in53 = *on;
            HasError = *on;
          endif;
        endsr;

        // ----------------------------------------------------------
        // SaveCust: WRITE (add) or lock + UPDATE (edit)
        // ----------------------------------------------------------
        begsr SaveCust;
          Saved = *off;

          if MODE = 'ADD';
            F_CUSTNO = CUSTNO;
            exsr ToFile;
            write(e) CSTREC;
            if %error;
              // 01021 = duplicate key: someone added this number between
              // our check and our write.
              if %status = 1021;
                SendMsg(PGMQ : 'COM0005');
                *in51 = *on;
              else;
                SendMsg(PGMQ : 'COM0033' : 'CSTMST');
              endif;
              leavesr;
            endif;

          else;
            // Lock the record only now, at the moment of the update.
            chain(e) SelCust CSTMST;
            if %error;
              // Typically locked by another job (status 01218).
              SendMsg(PGMQ : 'COM0033' : 'CSTMST');
              leavesr;
            endif;
            if not %found(CSTMST);
              SendMsg(PGMQ : 'COM0006');
              leavesr;
            endif;
            exsr ToFile;
            update(e) CSTREC;
            if %error;
              unlock CSTMST;
              SendMsg(PGMQ : 'COM0033' : 'CSTMST');
              leavesr;
            endif;
          endif;

          Saved = *on;
          SendMsg(PGMQ : 'COM0034');
        endsr;

        // ----------------------------------------------------------
        // DeleteCust: refuse if the customer has orders (D8), else DELETE
        // ----------------------------------------------------------
        begsr DeleteCust;
          Saved = *off;

          setll SelCust ORDHDRL1;
          if %equal(ORDHDRL1);
            SendMsg(PGMQ : 'COM0009');
            leavesr;
          endif;

          chain(e) SelCust CSTMST;
          if %error;
            SendMsg(PGMQ : 'COM0033' : 'CSTMST');
            leavesr;
          endif;
          if not %found(CSTMST);
            SendMsg(PGMQ : 'COM0006');
            leavesr;
          endif;

          // The ORDHDR_CUST_FK constraint (RESTRICT) would also refuse
          // this if an order arrived after our check - %ERROR, not a crash.
          delete(e) CSTREC;
          if %error;
            unlock CSTMST;
            SendMsg(PGMQ : 'COM0033' : 'CSTMST');
            leavesr;
          endif;

          Saved = *on;
          SendMsg(PGMQ : 'COM0035');
        endsr;

        // ----------------------------------------------------------
        // ToScreen / ToFile: the only places data moves between the
        // file (F_ fields) and the screen. CUSTNO is never changed by an
        // edit (decision A4), so ToFile leaves F_CUSTNO alone.
        // ----------------------------------------------------------
        begsr ToScreen;
          CUSTNO = F_CUSTNO;
          CUSTNAME = F_CUSTNAME;
          ADDRESS = F_ADDRESS;
          CITY = F_CITY;
          STATE = F_STATE;
          STATUS = F_STATUS;
        endsr;

        begsr ToFile;
          F_CUSTNAME = CUSTNAME;
          F_ADDRESS = ADDRESS;
          F_CITY = CITY;
          F_STATE = STATE;
          F_STATUS = STATUS;
        endsr;
