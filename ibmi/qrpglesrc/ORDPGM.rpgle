      * ======================================================================
      * ORDPGM - Order maintenance: list, search, display, add, edit, delete
      * Author: Arnav    Created: 2026-10-06
      *
      * Sprint 4: list, search, display. Sprint 5: ADD (F5). Sprint 6:
      * DELETE (F7, 6B) and EDIT (F6, 6C).
      * Sprint 8: ONLY THE SCREEN is left here. Every order rule, write,
      * stock change and COMMIT / ROLBK lives in ORDSVC, which the web
      * calls too (one set of rules for both channels). ORDPGM moves the
      * 25 rows into ORDSVC's line buffer and its errors back onto the
      * rows (CallSvc). Up to Sprint 7 the same logic sat here inline.
      * Written with sub-procedures (like ITEMPGM).
      *
      * Indicator map (same numbers as ORDDSPF):
      *   03 F3  05 F5  06 F6  07 F7  10 F10  12 F12
      *   31-34 order list subfile   36-39 order lines subfile
      *   41 protect header inputs  42 protect line inputs (per row)
      *   43 saved line in EDIT: Item No protected, Opt open (per row)
      *   44 '(assigned on save)'   51 Customer No error
      *   61 / 62 / 63 a row's Item No / Qty / Opt error (per row)
      *   98 message end
      *
      * Files (all INPUT now - the list and the display only read):
      *   ORDHDR   orders by number
      *   ORDHDRL1 orders by CUSTNO (search); shares format ORDHREC with
      *            ORDHDR -> RENAME(ORDHREC:ORDHREC1)
      *   ORDDTLF  one order's lines
      *   CSTMST   names; PREFIX(C_) - CUSTNO / STATUS would clash
      *   ORDHDR and ORDDTLF share ORDNO on purpose (same order).
      *
      * Commitment control (Sprint 6) is still started by COMSTART and is
      * used by ORDSVC, which runs in this activation group (*CALLER):
      * ORDSVC opens its files with COMMIT and ends each save with COMMIT
      * or ROLBK itself.
      * Stale edits (decision E7, closed in Sprint 8): EditOrder asks
      * ORDSVC for the order's fingerprint (CK) when it loads the order;
      * F10 sends it back with SE, and ORDSVC refuses with COM0039 if
      * another clerk changed the order meanwhile.
      *
      * Change log:
      *   2026-10-09  Arnav  Created (Sprint 4, checkpoints 4A + 4B)
      *   2026-10-09  Arnav  Add order: validate, save, stock (Sprint 5)
      *   2026-10-12  Arnav  COMMIT files + COMMIT / ROLBK in SaveOrder (6A)
      *   2026-10-13  Arnav  Delete order (F7), files UF + (N) reads (6B)
      *   2026-10-13  Arnav  Edit order (F6): EditOrder, SaveEdit (6C)
      *   2026-10-14  Arnav  Rules + writes moved to ORDSVC; CallSvc (S8)
      * ======================================================================
     H DFTACTGRP(*NO) ACTGRP('COMAG') BNDDIR('COMBNDDIR')
     H OPTION(*SRCSTMT:*NODEBUGIO)
     FORDDSPF   CF   E             WORKSTN SFILE(ORDSFL:LRrn)
     F                                     SFILE(LINSFL:DRrn)
     FORDHDR    IF   E           K DISK
     FORDHDRL1  IF   E           K DISK    RENAME(ORDHREC:ORDHREC1)
     FORDDTLF   IF   E           K DISK
     FCSTMST    IF   E           K DISK    PREFIX(C_)
      /COPY QRPGLESRC,COMPROTO
      *
      * Entry parameter (see prototype OrdPgm in COMPROTO)
     D OrdPgm          PI
     D  ExitApp                       1A
      *
      * Global: needed by more than one procedure
     D LRrn            S              4P 0
     D DRrn            S              4P 0
     D RowCount        S              4P 0
     D LastSrch        S              7P 0
     D Done            S              1N
     D ExitReq         S              1N
      * ORDSVC's parameters (layouts in COMPROTO)
     D SvcOrd          S              7P 0
     D SvcLines        DS                  LIKEDS(OrdLineT) DIM(25)
     D SvcTotal        S             11P 2
     D SvcName         S             40A
     D SvcErrCnt       S              3P 0
     D SvcErrs         DS                  LIKEDS(ErrEntT) DIM(30)
      * Fingerprint of the order being edited, as it was loaded
     D EdChkSum        S             32A

        PGMQ = 'ORDPGM';
        *in98 = *on;
        SRCHCUST = 0;
        LoadList();

        dow not Done;
          write ORDKEY;
          write MSGCTL;
          exfmt ORDCTL;
          ClearMsgs(PGMQ);

          select;
          when *in03;
            ExitReq = *on;
            Done = *on;
          when *in12;
            Done = *on;
          when *in05;
            AddOrder();
            LoadList();
          when SRCHCUST <> LastSrch;
            // A new search value: show the new list, ignore any X typed
            // on the old one.
            LoadList();
          other;
            HandleSel();
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
      * LoadList - all orders (search blank) or one customer's orders
      * ------------------------------------------------------------------
     P LoadList        B
     D LoadList        PI

        *in31 = *off;
        *in32 = *off;
        *in33 = *on;
        write ORDCTL;
        *in33 = *off;
        LRrn = 0;

        if SRCHCUST = 0;
          setll *loval ORDHDR;
          read ORDHDR;
          dow not %eof(ORDHDR);
            AddListRow();
            read ORDHDR;
          enddo;
        else;
          // READE = "read the next record only if it still has this key":
          // stops by itself at the first order of another customer.
          setll SRCHCUST ORDHDRL1;
          reade SRCHCUST ORDHDRL1;
          dow not %eof(ORDHDRL1);
            AddListRow();
            reade SRCHCUST ORDHDRL1;
          enddo;
        endif;

        RowCount = LRrn;
        LastSrch = SRCHCUST;
        *in31 = (RowCount > 0);
        *in32 = *on;
        *in34 = *on;
        if RowCount = 0;
          SendMsg(PGMQ : 'COM0037');
        endif;
        return;

     P LoadList        E
      *
      * ------------------------------------------------------------------
      * AddListRow - one subfile row from the order header just read
      * (ORDHDR or ORDHDRL1 - same fields, same format)
      * ------------------------------------------------------------------
     P AddListRow      B
     D AddListRow      PI

        LRrn += 1;
        SEL = ' ';
        LORDNO = ORDNO;
        LDATE = FmtDate(ORDDATE);
        LCUSTNO = CUSTNO;
        LNAME = CustName(CUSTNO);
        LTOTAL = TOTAMT;
        write ORDSFL;
        return;

     P AddListRow      E
      *
      * ------------------------------------------------------------------
      * HandleSel - count the X's; Enter=Display, F6=Edit, F7=Delete
      * ------------------------------------------------------------------
     P HandleSel       B
     D HandleSel       PI
     D Row             S              4P 0
     D SelCount        S              4P 0
     D SelOrd          S              7P 0
     D BadSel          S              1N

        for Row = 1 to RowCount;
          chain Row ORDSFL;
          if SEL = 'X';
            SelCount += 1;
            SelOrd = LORDNO;
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
        when *in06;
          EditOrder(SelOrd);
          LoadList();
        when *in07;
          ShowOrder(SelOrd : 'DELETE');
          LoadList();
        other;
          ShowOrder(SelOrd : 'DISPLAY');
          LoadList();
        endsl;
        return;

     P HandleSel       E
      *
      * ------------------------------------------------------------------
      * ShowOrder - header + lines of one order, read-only. pMode DISPLAY
      * or DELETE (DELETE: same screen, F10 confirms the delete).
      * ------------------------------------------------------------------
     P ShowOrder       B
     D ShowOrder       PI
     D  pOrd                          7P 0 CONST
     D  pMode                         8A   CONST

        // Input file: reading never locks (ORDSVC locks at F10).
        chain pOrd ORDHDR;
        if not %found(ORDHDR);
          // Deleted by someone else since the list was loaded.
          SendMsg(PGMQ : 'COM0023');
          return;
        endif;

        HMODE = pMode;
        HORDNO = ORDNO;
        HORDDATE = ORDDATE;
        HCUSTNO = CUSTNO;
        HNAME = CustName(CUSTNO);
        HSTATUS = STATUS;
        HTOTAL = TOTAMT;
        if pMode = 'DELETE';
          LEGEND = 'F10=Confirm delete  F12=Cancel  F3=Exit  ' +
                   'PageUp/PageDown=Scroll lines';
        else;
          LEGEND = 'PageUp/PageDown=Scroll lines  Enter or F12=Back  ' +
                   'F3=Exit';
        endif;
        *in44 = *off;
        *in41 = *on;
        *in51 = *off;

        ClearLines();
        // 42 on BEFORE each WRITE: every row is stored protected.
        *in42 = *on;
        *in43 = *off;
        *in61 = *off;
        *in62 = *off;
        *in63 = *off;
        DOPT = ' ';

        setll pOrd ORDDTLF;
        reade pOrd ORDDTLF;
        // DRrn < 25: the subfile holds 25 rows (SFLSIZ) - an order never
        // has more (AddOrder can't save more), this just keeps it safe.
        dow not %eof(ORDDTLF) and DRrn < 25;
          DRrn += 1;
          DLINE = LINENO;
          DITEM = ITEMNO;
          DDESC = ITEMDESC;
          DQTY = QTY;
          DPRICE = PRICE;
          DAMT = AMOUNT;
          write LINSFL;
          reade pOrd ORDDTLF;
        enddo;
        ShowLines();

        // One EXFMT: Page Up / Page Down are handled by the system
        // without coming back here; any other key returns.
        write LINFTR;
        write MSGCTL;
        exfmt LINCTL;
        ClearMsgs(PGMQ);

        select;
        when *in03;
          ExitReq = *on;
          Done = *on;
        when *in10 and pMode = 'DELETE';
          // The result (COM0026 / COM0033 / COM0023) shows on the list.
          DeleteOrder(pOrd);
        endsl;
        return;

     P ShowOrder       E
      *
      * ------------------------------------------------------------------
      * DeleteOrder - F10 in DELETE mode: ORDSVC does the whole delete
      * (stock back, lines, header, COMMIT). Returns *ON when deleted.
      * ------------------------------------------------------------------
     P DeleteOrder     B
     D DeleteOrder     PI             1N
     D  pOrd                          7P 0 CONST
     D Chk             S             32A

        SvcOrd = pOrd;
        clear SvcLines;
        OrdSvc('DL' : SvcOrd : ' ' : 0 : 0 : SvcLines : SvcTotal
              : SvcName : SvcErrCnt : SvcErrs : Chk);
        if SvcErrCnt > 0;
          ShowErrs();
          return *off;
        endif;
        SendMsg(PGMQ : 'COM0026' : MsgData2(%char(pOrd)));
        return *on;

     P DeleteOrder     E
      *
      * ------------------------------------------------------------------
      * AddOrder - F5: a blank order; Enter checks, F10 checks + saves
      * ------------------------------------------------------------------
     P AddOrder        B
     D AddOrder        PI
     D AddDone         S              1N

        HMODE = 'ADD';
        HORDNO = 0;
        HORDDATE = %date();
        HCUSTNO = 0;
        HNAME = *blanks;
        HSTATUS = 'O';
        HTOTAL = 0;
        LEGEND = 'Enter=Check  F10=Save  F12=Cancel  F3=Exit  ' +
                 'PageUp/PageDown=more lines';
        *in44 = *on;
        *in41 = *off;
        *in51 = *off;

        // 25 empty, open rows (option B: the system pages through them).
        ClearLines();
        AddBlankRows();
        ShowLines();

        dow not AddDone;
          write LINFTR;
          write MSGCTL;
          exfmt LINCTL;
          ClearMsgs(PGMQ);

          select;
          when *in03;
            ExitReq = *on;
            Done = *on;
            AddDone = *on;
          when *in12;
            // Nothing was written yet: cancelling leaves no trace.
            AddDone = *on;
          other;
            // Enter = check only (VA); F10 = check + save in ONE call
            // (SA) - ORDSVC validates again before it writes.
            if *in10;
              if CallSvc('SA' : 0) = 0;
                SendMsg(PGMQ : 'COM0025' : MsgData2(%char(SvcOrd)));
                AddDone = *on;
              endif;
            else;
              CallSvc('VA' : 0);
            endif;
          endsl;
        enddo;
        return;

     P AddOrder        E
      *
      * ------------------------------------------------------------------
      * EditOrder - F6: change a saved line's Qty, D = delete it, add new
      * lines in the blank rows. Header locked (A4). Enter checks, F10
      * checks + saves; nothing is written before F10.
      * ------------------------------------------------------------------
     P EditOrder       B
     D EditOrder       PI
     D  pOrd                          7P 0 CONST
     D EditDone        S              1N

        // Input file: reading never locks; ORDSVC locks at F10.
        chain pOrd ORDHDR;
        if not %found(ORDHDR);
          SendMsg(PGMQ : 'COM0023');
          return;
        endif;

        HMODE = 'EDIT';
        HORDNO = ORDNO;
        HORDDATE = ORDDATE;
        HCUSTNO = CUSTNO;
        HNAME = CustName(CUSTNO);
        HSTATUS = STATUS;
        HTOTAL = TOTAMT;
        LEGEND = 'Enter=Check  F10=Save  F12=Cancel  F3=Exit  ' +
                 'Opt D=Delete line  PageUp/PageDown';
        *in44 = *off;
        *in41 = *on;
        *in51 = *off;

        // Saved lines first, each with 43 on: Item No locked, Opt open.
        ClearLines();
        *in42 = *off;
        *in43 = *on;
        *in61 = *off;
        *in62 = *off;
        *in63 = *off;
        setll pOrd ORDDTLF;
        reade pOrd ORDDTLF;
        dow not %eof(ORDDTLF) and DRrn < 25;
          DRrn += 1;
          DOPT = ' ';
          DLINE = LINENO;
          DITEM = ITEMNO;
          DDESC = ITEMDESC;
          DQTY = QTY;
          DOLDQTY = QTY;
          DPRICE = PRICE;
          DAMT = AMOUNT;
          write LINSFL;
          reade pOrd ORDDTLF;
        enddo;
        // Then blank rows up to 25 for new lines.
        AddBlankRows();
        ShowLines();

        // The fingerprint of the order as loaded (stale-edit check, E7).
        SvcOrd = pOrd;
        EdChkSum = *blanks;
        OrdSvc('CK' : SvcOrd : ' ' : 0 : 0 : SvcLines : SvcTotal
              : SvcName : SvcErrCnt : SvcErrs : EdChkSum);

        dow not EditDone;
          write LINFTR;
          write MSGCTL;
          exfmt LINCTL;
          ClearMsgs(PGMQ);

          select;
          when *in03;
            ExitReq = *on;
            Done = *on;
            EditDone = *on;
          when *in12;
            EditDone = *on;
          other;
            if not *in10;
              CallSvc('VE' : pOrd);
            elseif not EdChanged();
              // E6: nothing changed - nothing to save, quietly back.
              EditDone = *on;
            elseif CallSvc('SE' : pOrd) = 0;
              SendMsg(PGMQ : 'COM0027' : MsgData2(%char(pOrd)));
              EditDone = *on;
            endif;
          endsl;
        enddo;
        return;

     P EditOrder       E
      *
      * ------------------------------------------------------------------
      * CallSvc - the 25 rows -> ORDSVC (pAct VA VE SA SE), then its
      * results back onto the screen. Row n = line entry n, so an error's
      * line index IS the subfile row to highlight. Returns the number
      * of errors (0 = fine / saved).
      * ------------------------------------------------------------------
     P CallSvc         B
     D CallSvc         PI             3P 0
     D  pAct                          2A   CONST
     D  pOrd                          7P 0 CONST
     D Row             S              4P 0
     D i               S              3P 0
     D Chk             S             32A
     D DateTxt         S             10A

        clear SvcLines;
        for Row = 1 to 25;
          chain Row LINSFL;
          SvcLines(Row).LineNo = DLINE;
          SvcLines(Row).ItemNo = DITEM;
          SvcLines(Row).Qty = DQTY;
          if DLINE = 0;
            SvcLines(Row).LAction = 'N';
          elseif DOPT = ' ';
            SvcLines(Row).LAction = 'C';
          else;
            // D - or a wrong value, which ORDSVC answers with COM0031.
            SvcLines(Row).LAction = DOPT;
          endif;
        endfor;

        SvcOrd = pOrd;
        if pAct = 'SE';
          Chk = EdChkSum;
        endif;
        DateTxt = %char(HORDDATE : *ISO);
        OrdSvc(pAct : SvcOrd : DateTxt : HCUSTNO : 25 : SvcLines
              : SvcTotal : SvcName : SvcErrCnt : SvcErrs : Chk);

        HNAME = SvcName;
        HTOTAL = SvcTotal;
        *in51 = *off;
        for i = 1 to SvcErrCnt;
          if SvcErrs(i).ErrLine = 0 and SvcErrs(i).ErrField = 'CUSTNO';
            *in51 = *on;
          endif;
        endfor;

        // COM0023 = the order is gone: ORDSVC stopped before the lines,
        // so leave the rows as they are.
        if not (SvcErrCnt > 0 and SvcErrs(1).MsgId = 'COM0023');
          for Row = 1 to 25;
            chain Row LINSFL;
            DDESC = SvcLines(Row).ItemDesc;
            DPRICE = SvcLines(Row).Price;
            DAMT = SvcLines(Row).Amount;
            // Each row keeps its own indicators (stored WITH the row):
            // 43 = a saved line, 61-63 = this row's errors.
            *in42 = *off;
            *in43 = (DLINE <> 0);
            *in61 = *off;
            *in62 = *off;
            *in63 = *off;
            for i = 1 to SvcErrCnt;
              if SvcErrs(i).ErrLine = Row;
                select;
                when SvcErrs(i).ErrField = 'ITEMNO';
                  *in61 = *on;
                when SvcErrs(i).ErrField = 'QTY';
                  *in62 = *on;
                when SvcErrs(i).ErrField = 'LACTION';
                  *in63 = *on;
                endsl;
              endif;
            endfor;
            update LINSFL;
          endfor;
        endif;

        ShowErrs();
        return SvcErrCnt;

     P CallSvc         E
      *
      * ------------------------------------------------------------------
      * EdChanged - did the user change anything in EDIT? (E6: F10 with no
      * change saves nothing and adds no 'U' audit row)
      * ------------------------------------------------------------------
     P EdChanged       B
     D EdChanged       PI             1N
     D Row             S              4P 0

        for Row = 1 to 25;
          chain Row LINSFL;
          if DLINE <> 0 and (DOPT <> ' ' or DQTY <> DOLDQTY);
            return *on;
          endif;
          if DLINE = 0 and (DITEM <> 0 or DQTY <> 0);
            return *on;
          endif;
        endfor;
        return *off;

     P EdChanged       E
      *
      * ------------------------------------------------------------------
      * ShowErrs - every ORDSVC error to the message line (&1 = MsgDta1,
      * &2 = MsgDta2: exactly the 40 bytes SendMsg expects)
      * ------------------------------------------------------------------
     P ShowErrs        B
     D ShowErrs        PI
     D i               S              3P 0

        for i = 1 to SvcErrCnt;
          SendMsg(PGMQ : SvcErrs(i).MsgId
                 : SvcErrs(i).MsgDta1 + SvcErrs(i).MsgDta2);
        endfor;
        return;

     P ShowErrs        E
      *
      * ------------------------------------------------------------------
      * AddBlankRows - empty, open rows from the next rrn up to 25
      * ------------------------------------------------------------------
     P AddBlankRows    B
     D AddBlankRows    PI

        *in42 = *off;
        *in43 = *off;
        *in61 = *off;
        *in62 = *off;
        *in63 = *off;
        DOPT = ' ';
        DLINE = 0;
        DITEM = 0;
        DDESC = *blanks;
        DQTY = 0;
        DOLDQTY = 0;
        DPRICE = 0;
        DAMT = 0;
        dow DRrn < 25;
          DRrn += 1;
          write LINSFL;
        enddo;
        return;

     P AddBlankRows    E
      *
      * ------------------------------------------------------------------
      * ClearLines / ShowLines - empty the lines subfile; switch it on
      * ------------------------------------------------------------------
     P ClearLines      B
     D ClearLines      PI

        *in36 = *off;
        *in37 = *off;
        *in38 = *on;
        write LINCTL;
        *in38 = *off;
        DRrn = 0;
        return;

     P ClearLines      E
     P ShowLines       B
     D ShowLines       PI

        *in36 = (DRrn > 0);
        *in37 = *on;
        *in39 = *on;
        return;

     P ShowLines       E
      *
      * ------------------------------------------------------------------
      * CustName - customer name for a number (blank if not found)
      * ------------------------------------------------------------------
     P CustName        B
     D CustName        PI            40A
     D  pCust                         7P 0 CONST

        chain pCust CSTMST;
        if %found(CSTMST);
          return C_CUSTNAME;
        endif;
        return *blanks;

     P CustName        E
      *
      * ------------------------------------------------------------------
      * FmtDate - date as dd/mm/yyyy (*EUR gives dd.mm.yyyy)
      * ------------------------------------------------------------------
     P FmtDate         B
     D FmtDate         PI            10A
     D  pDate                          D   CONST

        return %xlate('.' : '/' : %char(pDate : *EUR));

     P FmtDate         E
