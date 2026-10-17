      * ======================================================================
      * ORDPGM - Order maintenance: list, search, display, add, edit, delete
      * Author: Arnav    Created: 2026-10-06
      *
      * Sprint 4: list, search, display. Sprint 5: ADD (F5). Sprint 6:
      * DELETE (F7, 6B) and EDIT (F6, 6C).
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
      * Files:
      *   ORDHDR   UPDATE + ADD (write new headers, delete orders)
      *   ORDHDRL1 orders by CUSTNO (search); shares format ORDHREC with
      *            ORDHDR -> RENAME(ORDHREC:ORDHREC1)
      *   ORDDTLF  UPDATE + ADD (read, write and delete one order's lines)
      *   ITMMST   UPDATE (stock); PREFIX(I_) - ITEMNO / ITEMDESC / STATUS
      *            would otherwise clash with ORDDTLF's and ORDHDR's
      *   CSTMST   input; PREFIX(C_) - CUSTNO / STATUS would clash
      *   ORDHDR and ORDDTLF share ORDNO on purpose (same order).
      *
      * Commitment control (Sprint 6): ORDHDR, ORDDTLF and ITMMST are opened
      * with COMMIT, so a save is all-or-nothing - COMMIT at the end, ROLBK
      * on any failure. COMSTART starts it (STRCMTCTL); without it the
      * files can't open (CPF4293).
      * On an UPDATE file every plain READ / CHAIN / READE locks the record,
      * and under commit (LCKLVL(*CHG)) a lock taken for a change is held
      * until COMMIT / ROLBK. So every read that only SHOWS data uses (N).
      *
      * Change log:
      *   2026-10-09  Arnav  Created (Sprint 4, checkpoints 4A + 4B)
      *   2026-10-09  Arnav  Add order: validate, save, stock (Sprint 5)
      *   2026-10-12  Arnav  COMMIT files + COMMIT / ROLBK in SaveOrder (6A)
      *   2026-10-13  Arnav  Delete order (F7), files UF + (N) reads (6B)
      *   2026-10-13  Arnav  Edit order (F6): EditOrder, SaveEdit (6C)
      *   2026-10-15  Arnav  Fix: local LineNo hid LINENO in SaveOrder/SaveEdit
      * ======================================================================
     H DFTACTGRP(*NO) ACTGRP('COMAG') BNDDIR('COMBNDDIR')
     H OPTION(*SRCSTMT:*NODEBUGIO)
     FORDDSPF   CF   E             WORKSTN SFILE(ORDSFL:LRrn)
     F                                     SFILE(LINSFL:DRrn)
     FORDHDR    UF A E           K DISK    COMMIT
     FORDHDRL1  IF   E           K DISK    RENAME(ORDHREC:ORDHREC1)
     FORDDTLF   UF A E           K DISK    COMMIT
     FITMMST    UF   E           K DISK    PREFIX(I_) COMMIT
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
     D LineCount       S              3P 0
     D Done            S              1N
     D ExitReq         S              1N
      * Last order number used (data area, read + locked in SaveOrder)
     D NxtOrdNo        S              7P 0 DTAARA('NXTORDNO')
      * Highest line number of the order being edited (A6: new = max + 1)
     D EdMaxLine       S              3P 0

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
          // (N): ORDHDR is an update file - a plain READ would lock every
          // order in the list.   Fixed-format:  C   READ(N)  ORDHDR
          read(n) ORDHDR;
          dow not %eof(ORDHDR);
            AddListRow();
            read(n) ORDHDR;
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

        // (N): only showing - DeleteOrder locks it when F10 is pressed,
        // so the order isn't held locked while the user reads the screen.
        chain(n) pOrd ORDHDR;
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
        reade(n) pOrd ORDDTLF;
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
          reade(n) pOrd ORDDTLF;
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
      * DeleteOrder - F10 in DELETE mode: give each line's stock back,
      * delete the lines, then the header; all in ONE commit.
      * Returns *ON when deleted.
      * ------------------------------------------------------------------
     P DeleteOrder     B
     D DeleteOrder     PI             1N
     D  pOrd                          7P 0 CONST

        // 1. Lock the header first: it is the "gate" to the order, so a
        //    second clerk deleting the same order waits here.
        chain(e) pOrd ORDHDR;
        if %error;
          // 01218 = locked by another job (record wait time exceeded).
          rolbk;
          SendMsg(PGMQ : 'COM0033' : MsgData2('ORDHDR'));
          return *off;
        endif;
        if not %found(ORDHDR);
          // Deleted by someone else since this screen was shown.
          SendMsg(PGMQ : 'COM0023');
          return *off;
        endif;

        // 2. Every line: lock it, give its stock back, delete it.
        //    READE without (N) on an update file = read AND lock.
        setll pOrd ORDDTLF;
        reade(e) pOrd ORDDTLF;
        dow not %error and not %eof(ORDDTLF);
          chain(e) ITEMNO ITMMST;
          if %error or not %found(ITMMST);
            rolbk;
            SendMsg(PGMQ : 'COM0033' : MsgData2('ITMMST'));
            return *off;
          endif;
          I_STOCKQTY += QTY;
          update(e) ITMREC;
          if %error;
            rolbk;
            SendMsg(PGMQ : 'COM0033' : MsgData2('ITMMST'));
            return *off;
          endif;

          // DELETE removes the record just read (and locked) by READE.
          //   Fixed-format:  C                   DELETE    ORDDREC
          delete(e) ORDDREC;
          if %error;
            rolbk;
            SendMsg(PGMQ : 'COM0033' : MsgData2('ORDDTL'));
            return *off;
          endif;
          reade(e) pOrd ORDDTLF;
        enddo;
        if %error;
          rolbk;
          SendMsg(PGMQ : 'COM0033' : MsgData2('ORDDTL'));
          return *off;
        endif;

        // 3. The header LAST: the foreign key ORDDTL -> ORDHDR (RESTRICT)
        //    refuses to delete a header that still has lines. It is still
        //    locked from step 1; this CHAIN repositions on it for DELETE.
        chain(e) pOrd ORDHDR;
        if not %error and %found(ORDHDR);
          delete(e) ORDHREC;
        endif;
        if %error or not %found(ORDHDR);
          rolbk;
          SendMsg(PGMQ : 'COM0033' : MsgData2('ORDHDR'));
          return *off;
        endif;

        commit;
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
     D HasError        S              1N

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
            // Enter = check only; F10 = check, then save if all is fine.
            HasError = ValidateOrder();
            if not HasError and *in10;
              AddDone = SaveOrder();
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
     D HasError        S              1N

        // (N): only showing; SaveEdit locks the order at F10 (E7).
        chain(n) pOrd ORDHDR;
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
        EdMaxLine = 0;
        setll pOrd ORDDTLF;
        reade(n) pOrd ORDDTLF;
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
          // ORDDTLF is keyed ORDNO + LINENO, so the last line read has
          // the highest line number (deleted numbers are never reused).
          EdMaxLine = LINENO;
          reade(n) pOrd ORDDTLF;
        enddo;
        // Then blank rows up to 25 for new lines.
        AddBlankRows();
        ShowLines();

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
            HasError = ValidateOrder();
            if not HasError and *in10;
              EditDone = SaveEdit(pOrd);
            endif;
          endsl;
        enddo;
        return;

     P EditOrder       E
      *
      * ------------------------------------------------------------------
      * ValidateOrder - check the header and every non-blank row, fill
      * description / price / amount / total; send ALL errors. Returns
      * *ON when at least one error was found.
      * ------------------------------------------------------------------
     P ValidateOrder   B
     D ValidateOrder   PI             1N
     D HasError        S              1N
     D Row             S              4P 0
     D Total           S             11P 2
     D ItemFound       S              1N
     D Saved           S              1N
     D Avail           S              9P 0
      * Items already on this order (decision A5: no duplicates)
     D Seen            S              7P 0 DIM(25)
     D SeenCount       S              3P 0
     D Dup             S              1N

        // ---- header: checked in ADD only. In EDIT it is locked (A4), and
        //      an old order may keep a customer now inactive (E3).
        *in51 = *off;
        HNAME = *blanks;
        if HMODE = 'EDIT';
          HNAME = CustName(HCUSTNO);
        elseif HCUSTNO <= 0;
          SendMsg(PGMQ : 'COM0004');
          *in51 = *on;
          HasError = *on;
        else;
          chain HCUSTNO CSTMST;
          if not %found(CSTMST);
            SendMsg(PGMQ : 'COM0006');
            *in51 = *on;
            HasError = *on;
          else;
            HNAME = C_CUSTNAME;
            if C_STATUS <> 'A';
              SendMsg(PGMQ : 'COM0010');
              *in51 = *on;
              HasError = *on;
            endif;
          endif;
        endif;

        // ---- lines: read back every row, check it, store the result
        LineCount = 0;
        for Row = 1 to 25;
          chain Row LINSFL;
          // Fresh per row: these indicators are saved WITH the row.
          *in61 = *off;
          *in62 = *off;
          *in63 = *off;
          // DLINE <> 0: a line already saved on this order (EDIT only).
          // It keeps its own description and price (E2).
          Saved = (DLINE <> 0);
          if not Saved;
            DDESC = *blanks;
            DPRICE = 0;
          endif;
          DAMT = 0;

          if Saved and DOPT = 'D';
            // Marked for delete: no checks, not counted, and not a
            // duplicate - its item may be added again on a new row (E5).
            update LINSFL;
            iter;
          endif;
          if DOPT <> ' ';
            SendMsg(PGMQ : 'COM0031');
            *in63 = *on;
          endif;

          if DITEM <> 0 or DQTY <> 0;
            LineCount += 1;
            ItemFound = *off;

            if DITEM <= 0;
              SendMsg(PGMQ : 'COM0011');
              *in61 = *on;
            else;
              // (N): ITMMST is an update file - only looking here.
              chain(n) DITEM ITMMST;
              if not %found(ITMMST);
                SendMsg(PGMQ : 'COM0013');
                *in61 = *on;
              else;
                ItemFound = *on;
                if not Saved;
                  DDESC = I_ITEMDESC;
                  DPRICE = I_UNITPRICE;
                endif;
                // A12: an inactive item may stay on a saved line, with the
                // same or a lower quantity - never on a new one.
                if I_STATUS <> 'A';
                  if not Saved;
                    SendMsg(PGMQ : 'COM0018' : MsgData2(%char(DITEM)));
                    *in61 = *on;
                  elseif DQTY > DOLDQTY;
                    SendMsg(PGMQ : 'COM0018' : MsgData2(%char(DITEM)));
                    *in62 = *on;
                  endif;
                endif;
                // %LOOKUP: position of DITEM among the first SeenCount
                // entries of Seen, 0 = not there.
                if SeenCount = 0;
                  Dup = *off;
                else;
                  Dup = (%lookup(DITEM : Seen : 1 : SeenCount) > 0);
                endif;
                if Dup;
                  SendMsg(PGMQ : 'COM0021');
                  *in61 = *on;
                else;
                  SeenCount += 1;
                  Seen(SeenCount) = DITEM;
                endif;
              endif;
            endif;

            // E4: a saved line's quantity is already off the stock, so it
            // may have stock + its saved qty (DOLDQTY is 0 on a new row).
            if DQTY <= 0;
              SendMsg(PGMQ : 'COM0020');
              *in62 = *on;
            elseif ItemFound;
              Avail = I_STOCKQTY + DOLDQTY;
              if DQTY > Avail;
                SendMsg(PGMQ : 'COM0019'
                       : MsgData2(%char(Avail) : %char(DITEM)));
                *in62 = *on;
              endif;
            endif;

            // Only for a valid quantity (<= stock): an absurd qty x price
            // could overflow the 11,2 amount and crash the program.
            if ItemFound and not *in62;
              DAMT = DQTY * DPRICE;
              Total += DAMT;
            endif;
          endif;

          if *in61 or *in62 or *in63;
            HasError = *on;
          endif;
          update LINSFL;
        endfor;

        HTOTAL = Total;
        return HasError;

     P ValidateOrder   E
      *
      * ------------------------------------------------------------------
      * SaveOrder - write the order (PDF write sequence, decision A10).
      * Returns *ON when saved. ValidateOrder has just run without errors.
      * ------------------------------------------------------------------
     P SaveOrder       B
     D SaveOrder       PI             1N
     D NewOrd          S              7P 0
     D Row             S              4P 0
      * NOT 'LineNo': RPG names ignore case, so a local LineNo HIDES
      * the file field LINENO (it stayed 0 -> CHECK LINENO > 0 refused
      * the line: COM0033 ORDDTL, status 01022).
     D NewLn           S              3P 0

        if LineCount = 0;
          SendMsg(PGMQ : 'COM0022');
          return *off;
        endif;

        // 1. Next order number. *LOCK: a second clerk's IN *LOCK waits
        //    here until our OUT, so two orders never get the same number.
        //    Fixed-format:  C     *LOCK     IN        NxtOrdNo
        //    The data area is NOT under commitment control (A11): if the
        //    save fails later, this number stays used - a gap, by design.
        in *lock NxtOrdNo;
        NxtOrdNo += 1;
        NewOrd = NxtOrdNo;
        out NxtOrdNo;

        // 2. Safety net (PDF test 2): the number must be free. (N): just
        //    looking - nothing to lock when it isn't there anyway.
        chain(n) NewOrd ORDHDR;
        if %found(ORDHDR);
          SendMsg(PGMQ : 'COM0024');
          return *off;
        endif;

        // 3. Header FIRST, with the FINAL total (A10): the Sprint 7 audit
        //    trigger then logs exactly one 'A' for a new order.
        //    From here on every failure ROLBKs; the data area stays +1
        //    (not under commit, A11) - a rolled-back order leaves a gap.
        ORDNO = NewOrd;
        ORDDATE = HORDDATE;
        CUSTNO = HCUSTNO;
        STATUS = 'O';
        TOTAMT = HTOTAL;
        write(e) ORDHREC;
        if %error;
          // Undo everything since the last COMMIT (here: nothing yet,
          // but the pattern is the same everywhere).
          //   Fixed-format:  C                   ROLBK
          rolbk;
          SendMsg(PGMQ : 'COM0033' : MsgData2('ORDHDR'));
          return *off;
        endif;

        // 4. The lines, numbered 1..n in screen order, blank rows skipped
        //    (A6) - and each item's stock reduced (D6).
        for Row = 1 to 25;
          chain Row LINSFL;
          if DITEM = 0;
            iter;
          endif;
          NewLn += 1;

          // Lock the item (stock update follows). Its full 50-character
          // description comes from here: the screen shows only 28.
          chain(e) DITEM ITMMST;
          if %error or not %found(ITMMST);
            // Takes back the header and every line / stock change so far.
            rolbk;
            SendMsg(PGMQ : 'COM0033' : MsgData2('ITMMST'));
            return *off;
          endif;

          ORDNO = NewOrd;
          LINENO = NewLn;
          ITEMNO = DITEM;
          ITEMDESC = I_ITEMDESC;
          QTY = DQTY;
          // The price the clerk saw and accepted, so the line amounts add
          // up exactly to the header total written above.
          PRICE = DPRICE;
          AMOUNT = DQTY * DPRICE;
          write(e) ORDDREC;
          if %error;
            // ROLBK also releases the item lock (no UNLOCK needed).
            rolbk;
            SendMsg(PGMQ : 'COM0033' : MsgData2('ORDDTL'));
            return *off;
          endif;

          // ITMMST_STK_CK (stock >= 0) refuses this if another order took
          // the stock meanwhile - it arrives here as %ERROR.
          I_STOCKQTY -= DQTY;
          update(e) ITMREC;
          if %error;
            // ROLBK also releases the item lock (no UNLOCK needed).
            rolbk;
            SendMsg(PGMQ : 'COM0033' : MsgData2('ITMMST'));
            return *off;
          endif;
        endfor;

        // All written: make it permanent and release every lock.
        //   Fixed-format:  C                   COMMIT
        commit;
        SendMsg(PGMQ : 'COM0025' : MsgData2(%char(NewOrd)));
        return *on;

     P SaveOrder       E
      *
      * ------------------------------------------------------------------
      * SaveEdit - write an edited order in ONE commit. ValidateOrder has
      * just run without errors. Returns *ON when done (back to the list).
      * ------------------------------------------------------------------
     P SaveEdit        B
     D SaveEdit        PI             1N
     D  pOrd                          7P 0 CONST
     D Row             S              4P 0
      * NOT 'LineNo': RPG names ignore case, so a local LineNo HIDES
      * the file field LINENO (it stayed 0 -> CHECK LINENO > 0 refused
      * the line: COM0033 ORDDTL, status 01022).
     D NewLn           S              3P 0
     D Changed         S              1N

        if LineCount = 0;
          // Every line marked D: an order keeps at least one line - to
          // remove it completely, use F7=Delete on the list.
          SendMsg(PGMQ : 'COM0022');
          return *off;
        endif;

        // E6: nothing changed -> write nothing (no empty 'U' audit row).
        for Row = 1 to 25;
          chain Row LINSFL;
          if DLINE <> 0 and (DOPT = 'D' or DQTY <> DOLDQTY);
            Changed = *on;
          elseif DLINE = 0 and DITEM <> 0;
            Changed = *on;
          endif;
        endfor;
        if not Changed;
          return *on;
        endif;

        // 1. Lock the header first: the "gate", as in DeleteOrder.
        chain(e) pOrd ORDHDR;
        if %error;
          return Undo('ORDHDR');
        endif;
        if not %found(ORDHDR);
          SendMsg(PGMQ : 'COM0023');
          return *off;
        endif;

        // 2. Every row: delete, change or add the line; stock by the
        //    net change, all inside this commit.
        NewLn = EdMaxLine;
        for Row = 1 to 25;
          chain Row LINSFL;
          select;
          when DLINE <> 0 and DOPT = 'D';
            // Two-field key (ORDNO, LINENO). Fixed-format equivalent:
            //   C     LinKey        KLIST
            //   C                   KFLD                    pOrd
            //   C                   KFLD                    DLINE
            //   C     LinKey        CHAIN     ORDDTLF
            chain(e) (pOrd : DLINE) ORDDTLF;
            if %error or not %found(ORDDTLF);
              return Undo('ORDDTL');
            endif;
            delete(e) ORDDREC;
            if %error;
              return Undo('ORDDTL');
            endif;
            // Its whole saved quantity goes back to stock.
            if not AdjStock(DITEM : DOLDQTY);
              return Undo('ITMMST');
            endif;

          when DLINE <> 0 and DQTY <> DOLDQTY;
            chain(e) (pOrd : DLINE) ORDDTLF;
            if %error or not %found(ORDDTLF);
              return Undo('ORDDTL');
            endif;
            QTY = DQTY;
            // PRICE stays the saved one (E2).
            AMOUNT = QTY * PRICE;
            update(e) ORDDREC;
            if %error;
              return Undo('ORDDTL');
            endif;
            // Net change: old 5, new 8 -> stock -3; old 5, new 2 -> +3.
            if not AdjStock(DITEM : DOLDQTY - DQTY);
              return Undo('ITMMST');
            endif;

          when DLINE = 0 and DITEM <> 0;
            // Stock first: AdjStock's CHAIN also brings the item's full
            // 50-character description for the new line.
            if not AdjStock(DITEM : -DQTY);
              return Undo('ITMMST');
            endif;
            NewLn += 1;
            ORDNO = pOrd;
            LINENO = NewLn;
            ITEMNO = DITEM;
            ITEMDESC = I_ITEMDESC;
            QTY = DQTY;
            PRICE = DPRICE;
            AMOUNT = DQTY * DPRICE;
            write(e) ORDDREC;
            if %error;
              return Undo('ORDDTL');
            endif;
          endsl;
        endfor;

        // 3. The header's new total in ONE update (Sprint 7: one 'U'
        //    audit row). Still locked from step 1; %FIELDS writes back
        //    only TOTAMT.
        TOTAMT = HTOTAL;
        update(e) ORDHREC %fields(TOTAMT);
        if %error;
          return Undo('ORDHDR');
        endif;

        commit;
        SendMsg(PGMQ : 'COM0027' : MsgData2(%char(pOrd)));
        return *on;

     P SaveEdit        E
      *
      * ------------------------------------------------------------------
      * AdjStock - add pDelta to an item's stock (negative = take), inside
      * the current commit. Returns *OFF when it failed.
      * ------------------------------------------------------------------
     P AdjStock        B
     D AdjStock        PI             1N
     D  pItem                         7P 0 CONST
     D  pDelta                        9P 0 CONST

        chain(e) pItem ITMMST;
        if %error or not %found(ITMMST);
          return *off;
        endif;
        I_STOCKQTY += pDelta;
        // ITMMST_STK_CK (stock >= 0) refuses a negative result: %ERROR.
        update(e) ITMREC;
        return not %error;

     P AdjStock        E
      *
      * ------------------------------------------------------------------
      * Undo - ROLBK + COM0033 for pFile. Returns *OFF, so a save can end
      * with 'return Undo(...)'.
      * ------------------------------------------------------------------
     P Undo            B
     D Undo            PI             1N
     D  pFile                        10A   CONST

        rolbk;
        SendMsg(PGMQ : 'COM0033' : MsgData2(pFile));
        return *off;

     P Undo            E
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
