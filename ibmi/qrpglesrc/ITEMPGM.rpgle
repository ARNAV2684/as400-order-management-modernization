      * ======================================================================
      * ITEMPGM - Item maintenance (list, add, edit, delete)
      * Author: Arnav    Created: 2026-10-06
      *
      * Same job as CUSTPGM, written with SUB-PROCEDURES instead of
      * subroutines (M2 Day 19) - compare the two programs side by side:
      *   - a procedure has PARAMETERS:   DoDetail('EDIT' : 5003)
      *   - it can RETURN a value:        if Validate(pMode) ...
      *   - its variables are LOCAL:      HandleSel's counters can't be
      *                                   changed by any other procedure
      * Files, screen fields and *IN indicators stay global (shared).
      *
      * Indicator map (same numbers as ITEMDSPF):
      *   03 F3  05 F5  06 F6  07 F7  10 F10  12 F12
      *   31 SFLDSP  32 SFLDSPCTL  33 SFLCLR  34 SFLEND
      *   41 protect Item No  42 protect other fields
      *   51 Item No  52 Description  53 Status  54 Price  55 Stock (errors)
      *   98 message subfile end marker
      *
      * PREFIX(F_) on ITMMST and PREFIX(O_) on ORDDTLL2: no field is
      * shared with the screen (same reason as in CUSTPGM - a locking
      * CHAIN must never overwrite what the user typed).
      * Reads for showing use (N); the lock is taken only right before
      * UPDATE / DELETE.
      *
      * Change log:
      *   2026-10-07  Arnav  Created (Sprint 3, checkpoint 3B)
      *   2026-10-07  Arnav  Messages to queue PGMQ by name (3B fix)
      * ======================================================================
     H DFTACTGRP(*NO) ACTGRP('COMAG') BNDDIR('COMBNDDIR')
     H OPTION(*SRCSTMT:*NODEBUGIO)
     FITEMDSPF  CF   E             WORKSTN SFILE(ITEMSFL:Rrn)
     FITMMST    UF A E           K DISK    PREFIX(F_)
      * Only asked 'is this item on any order line?' (SETLL + %EQUAL).
     FORDDTLL2  IF   E           K DISK    PREFIX(O_)
      /COPY QRPGLESRC,COMPROTO
      *
      * Entry parameter (see prototype ItemPgm in COMPROTO)
     D ItemPgm         PI
     D  ExitApp                       1A
      *
      * Global: needed by more than one procedure
     D Rrn             S              4P 0
     D RowCount        S              4P 0
     D Done            S              1N
     D ExitReq         S              1N

        // PGMQ = this program's name = its main procedure's message queue.
        // SendMsg/ClearMsgs and the screen's message subfile all use it.
        PGMQ = 'ITEMPGM';
        *in98 = *on;
        LoadList();

        dow not Done;
          write ITEMKEY;
          write MSGCTL;
          exfmt ITEMCTL;
          ClearMsgs(PGMQ);

          select;
          when *in03;
            ExitReq = *on;
            Done = *on;
          when *in12;
            Done = *on;
          when *in05;
            DoDetail('ADD' : 0);
            LoadList();
          other;
            HandleSel();
          endsl;
        enddo;

        // ExitReq can be set deep inside DoDetail; the parameter is
        // answered here, in the main procedure, which owns it.
        if ExitReq;
          ExitApp = 'Y';
        else;
          ExitApp = 'N';
        endif;
        *inlr = *on;
        return;

      *
      * ------------------------------------------------------------------
      * LoadList - clear the subfile, then one row per item
      * ------------------------------------------------------------------
     P LoadList        B
     D LoadList        PI

        *in31 = *off;
        *in32 = *off;
        *in33 = *on;
        write ITEMCTL;
        *in33 = *off;

        Rrn = 0;
        setll *loval ITMMST;
        read(n) ITMMST;
        dow not %eof(ITMMST);
          Rrn += 1;
          SEL = ' ';
          ITEMNO = F_ITEMNO;
          LDESC = F_ITEMDESC;
          UNITPRICE = F_UNITPRICE;
          STOCKQTY = F_STOCKQTY;
          STATUS = F_STATUS;
          write ITEMSFL;
          read(n) ITMMST;
        enddo;

        RowCount = Rrn;
        *in31 = (RowCount > 0);
        *in32 = *on;
        *in34 = *on;
        return;

     P LoadList        E
      *
      * ------------------------------------------------------------------
      * HandleSel - count the X's; Enter=Display F6=Edit F7=Delete
      * Its counters are LOCAL: nothing outside can change them.
      * ------------------------------------------------------------------
     P HandleSel       B
     D HandleSel       PI
     D Row             S              4P 0
     D SelCount        S              4P 0
     D SelItem         S              7P 0
     D BadSel          S              1N

        for Row = 1 to RowCount;
          chain Row ITEMSFL;
          if SEL = 'X';
            SelCount += 1;
            SelItem = ITEMNO;
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
          if *in06 or *in07;
            SendMsg(PGMQ : 'COM0002');
          endif;
        other;
          if *in06;
            DoDetail('EDIT' : SelItem);
          elseif *in07;
            DoDetail('DELETE' : SelItem);
          else;
            DoDetail('DISPLAY' : SelItem);
          endif;
          LoadList();
        endsl;
        return;

     P HandleSel       E
      *
      * ------------------------------------------------------------------
      * DoDetail - one item in mode pMode (ADD/EDIT/DISPLAY/DELETE)
      * pMode / pItem: 'p' because MODE and ITEMNO are already screen
      * field names (RPG names are not case-sensitive).
      * ------------------------------------------------------------------
     P DoDetail        B
     D DoDetail        PI
     D  pMode                         8A   CONST
     D  pItem                         7P 0 CONST
     D DtlDone         S              1N

        *in51 = *off;
        *in52 = *off;
        *in53 = *off;
        *in54 = *off;
        *in55 = *off;
        MODE = pMode;

        if pMode = 'ADD';
          ITEMNO = 0;
          ITEMDESC = *blanks;
          CATEGORY = *blanks;
          UNITPRICE = 0;
          STOCKQTY = 0;
          STATUS = 'A';
        else;
          chain(n) pItem ITMMST;
          if not %found(ITMMST);
            SendMsg(PGMQ : 'COM0013');
            return;
          endif;
          ToScreen();
        endif;

        *in41 = (pMode <> 'ADD');
        *in42 = (pMode = 'DISPLAY' or pMode = 'DELETE');

        select;
        when pMode = 'DISPLAY';
          LEGEND = 'Enter or F12=Back  F3=Exit';
        when pMode = 'DELETE';
          LEGEND = 'F10=Confirm delete  F12=Cancel  F3=Exit';
        other;
          LEGEND = 'Enter=Check  F10=Save  F12=Cancel  F3=Exit';
        endsl;

        dow not DtlDone;
          write MSGCTL;
          exfmt ITEMDTL;
          ClearMsgs(PGMQ);
          *in51 = *off;
          *in52 = *off;
          *in53 = *off;
          *in54 = *off;
          *in55 = *off;

          select;
          when *in03;
            ExitReq = *on;
            Done = *on;
            DtlDone = *on;
          when *in12 or pMode = 'DISPLAY';
            DtlDone = *on;
          when pMode = 'DELETE';
            if *in10;
              DtlDone = DeleteItem(pItem);
            endif;
          other;
            // A procedure CALL inside an IF: Validate returns *ON when
            // it found errors.
            if not Validate(pMode) and *in10;
              DtlDone = SaveItem(pMode : pItem);
            endif;
          endsl;
        enddo;
        return;

     P DoDetail        E
      *
      * ------------------------------------------------------------------
      * Validate - check every field, send ALL errors; returns *ON when
      * at least one error was found
      * ------------------------------------------------------------------
     P Validate        B
     D Validate        PI             1N
     D  pMode                         8A   CONST
     D HasError        S              1N

        if pMode = 'ADD';
          if ITEMNO <= 0;
            SendMsg(PGMQ : 'COM0011');
            *in51 = *on;
            HasError = *on;
          else;
            setll ITEMNO ITMMST;
            if %equal(ITMMST);
              SendMsg(PGMQ : 'COM0012');
              *in51 = *on;
              HasError = *on;
            endif;
          endif;
        endif;

        if ITEMDESC = *blanks;
          SendMsg(PGMQ : 'COM0014');
          *in52 = *on;
          HasError = *on;
        endif;

        if UNITPRICE < 0;
          SendMsg(PGMQ : 'COM0015');
          *in54 = *on;
          HasError = *on;
        endif;

        if STOCKQTY < 0;
          SendMsg(PGMQ : 'COM0016');
          *in55 = *on;
          HasError = *on;
        endif;

        if STATUS <> 'A' and STATUS <> 'I';
          SendMsg(PGMQ : 'COM0008');
          *in53 = *on;
          HasError = *on;
        endif;

        return HasError;

     P Validate        E
      *
      * ------------------------------------------------------------------
      * SaveItem - WRITE (add) or lock + UPDATE (edit); returns *ON when
      * saved
      * ------------------------------------------------------------------
     P SaveItem        B
     D SaveItem        PI             1N
     D  pMode                         8A   CONST
     D  pItem                         7P 0 CONST

        if pMode = 'ADD';
          F_ITEMNO = ITEMNO;
          ToFile();
          write(e) ITMREC;
          if %error;
            // 01021 = duplicate key (added by someone else meanwhile).
            if %status = 1021;
              SendMsg(PGMQ : 'COM0012');
              *in51 = *on;
            else;
              SendMsg(PGMQ : 'COM0033' : 'ITMMST');
            endif;
            return *off;
          endif;

        else;
          chain(e) pItem ITMMST;
          if %error;
            SendMsg(PGMQ : 'COM0033' : 'ITMMST');
            return *off;
          endif;
          if not %found(ITMMST);
            SendMsg(PGMQ : 'COM0013');
            return *off;
          endif;
          ToFile();
          // In 3C an SQL trigger on ITMMST logs this UPDATE if the price
          // changed - this program doesn't need to know.
          update(e) ITMREC;
          if %error;
            unlock ITMMST;
            SendMsg(PGMQ : 'COM0033' : 'ITMMST');
            return *off;
          endif;
        endif;

        SendMsg(PGMQ : 'COM0034');
        return *on;

     P SaveItem        E
      *
      * ------------------------------------------------------------------
      * DeleteItem - refuse if the item is on any order line (D8), else
      * DELETE; returns *ON when deleted
      * ------------------------------------------------------------------
     P DeleteItem      B
     D DeleteItem      PI             1N
     D  pItem                         7P 0 CONST

        setll pItem ORDDTLL2;
        if %equal(ORDDTLL2);
          SendMsg(PGMQ : 'COM0017');
          return *off;
        endif;

        chain(e) pItem ITMMST;
        if %error;
          SendMsg(PGMQ : 'COM0033' : 'ITMMST');
          return *off;
        endif;
        if not %found(ITMMST);
          SendMsg(PGMQ : 'COM0013');
          return *off;
        endif;

        // ORDDTL_ITM_FK (RESTRICT) also refuses this if a line appeared
        // after our check - it arrives here as %ERROR.
        delete(e) ITMREC;
        if %error;
          unlock ITMMST;
          SendMsg(PGMQ : 'COM0033' : 'ITMMST');
          return *off;
        endif;

        SendMsg(PGMQ : 'COM0035');
        return *on;

     P DeleteItem      E
      *
      * ------------------------------------------------------------------
      * ToScreen / ToFile - the only places data moves between the file
      * (F_ fields) and the screen. ITEMNO is never changed by an edit.
      * ------------------------------------------------------------------
     P ToScreen        B
     D ToScreen        PI

        ITEMNO = F_ITEMNO;
        ITEMDESC = F_ITEMDESC;
        CATEGORY = F_CATEGORY;
        UNITPRICE = F_UNITPRICE;
        STOCKQTY = F_STOCKQTY;
        STATUS = F_STATUS;
        return;

     P ToScreen        E
     P ToFile          B
     D ToFile          PI

        F_ITEMDESC = ITEMDESC;
        F_CATEGORY = CATEGORY;
        F_UNITPRICE = UNITPRICE;
        F_STOCKQTY = STOCKQTY;
        F_STATUS = STATUS;
        return;

     P ToFile          E
