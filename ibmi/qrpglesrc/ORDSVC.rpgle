      * ======================================================================
      * ORDSVC - Order service: every order rule, write and COMMIT - no screen
      * Author: Arnav    Created: 2026-10-14
      *
      * Called by ORDPGM (5250) and by stored procedure ORDSVC_X (web).
      * Both channels get the SAME rules (Sprint 8, modernization P1/P2).
      *
      * Actions (P_ACTION):
      *   VA validate add   VE validate edit  -> never write, never lock
      *   SA save add       SE save edit      DL delete
      *   CK return the order's fingerprint in P_CHKSUM (for stale edits)
      * Parameters: the Sprint 8 service design. Lines and
      * errors are fixed 88 / 60-byte entries with ZONED numbers, so the
      * web side can slice them as plain text.
      *
      * Lines (P_LINES, LACTION):
      *   N new (LINENO 0)  C keep / change qty (saved line)  D delete
      *   blank = N for LINENO 0, C otherwise. Rows with no item, no qty
      *   and LINENO 0 are empty rows and are skipped.
      * On edit the buffer must hold EVERY saved line (as ORDPGM's 25
      * rows and the web editor do); a different count = COM0039.
      *
      * Rules: the order-entry rules and messages, decisions A4 A5 A6 A10 A11 A12 and
      * E2-E6 - the same as ORDPGM had inline up to Sprint 7. All errors
      * are collected (max 30), each with its line index and field.
      *
      * ACTGRP(*CALLER): runs in the caller's activation group and so in
      * its commitment definition - COMSTART's STRCMTCTL on the 5250, the
      * ODBC connection's CMT=2 on the web. THIS program ends the
      * transaction: COMMIT after the last write, ROLBK on any failure.
      *
      * Locks: files are created WAITRCD(*IMMED), so a CHAIN for update on
      * a record another job holds fails at once with status 01218 ->
      * COM0038 (no waiting).
      * Fingerprint (decision Sprint 8): total in cents / line count /
      * sum of qty / sum of line no x qty - plain arithmetic instead of
      * an MD5 hash (handoff 3.6 fallback).
      * COMTSTFAIL (*DTAARA, 1 char): 'Y' makes every save fail on purpose
      * just before COMMIT -> ROLBK + COM0033 'TEST'. Rollback proof for
      * the web; blank by default.
      *
      * Change log:
      *   2026-10-14  Arnav  Created (Sprint 8)
      *   2026-10-15  Arnav  (E) on every read: a locked row = COM0038, not a
      *                      hang; line outputs reset before validation
      * ======================================================================
     H DFTACTGRP(*NO) ACTGRP(*CALLER) OPTION(*SRCSTMT:*NODEBUGIO)
     FORDHDR    UF A E           K DISK    COMMIT
     FORDDTLF   UF A E           K DISK    COMMIT
     FITMMST    UF   E           K DISK    PREFIX(I_) COMMIT
     FCSTMST    IF   E           K DISK    PREFIX(C_)
      /COPY QRPGLESRC,COMPROTO
      *
     D ORDSVC          PI
     D  pAction                       2A   CONST
     D  pOrdNo                        7P 0
     D  pOrdDate                     10A   CONST
     D  pCustNo                       7P 0 CONST
     D  pLineCnt                      3P 0 CONST
     D  pLines                             LIKEDS(OrdLineT) DIM(25)
     D  pTotal                       11P 2
     D  pCustName                    40A
     D  pErrCnt                       3P 0
     D  pErrors                            LIKEDS(ErrEntT) DIM(30)
     D  pChkSum                      32A
      *
      * Per line, filled by Validate for the save that follows
     D LAct            S              1A   DIM(25)
     D LSaved          S              1N   DIM(25)
     D LOldQty         S              7P 0 DIM(25)
      *
     D NLines          S              3P 0
     D Total           S             11P 2
     D Remaining       S              3P 0
      * The order date from P_ORDDATE (not 'OrdDate': that IS ORDHDR's
      * field ORDDATE - RPG names ignore case)
     D InDate          S               D   DATFMT(*ISO)
     D NxtOrdNo        S              7P 0 DTAARA('NXTORDNO')
     D TstFail         S              1A   DTAARA('COMTSTFAIL')

        pErrCnt = 0;
        clear pErrors;
        pTotal = 0;
        pCustName = *blanks;
        NLines = pLineCnt;
        if NLines > 25;
          NLines = 25;
        endif;

        select;
        when pAction = 'VA';
          Validate(*on);
        when pAction = 'VE';
          Validate(*off);
        when pAction = 'SA';
          SaveAdd();
        when pAction = 'SE';
          SaveEdit();
        when pAction = 'DL';
          DeleteOrd();
        when pAction = 'CK';
          chain(ne) pOrdNo ORDHDR;
          if %error;
            AddErr('COM0038' : 0 : 'ORDNO' : 'Order ' + %char(pOrdNo));
          elseif %found(ORDHDR);
            pChkSum = FingerPrint(pOrdNo : TOTAMT);
          else;
            AddErr('COM0023' : 0 : 'ORDNO');
          endif;
        other;
          AddErr('COM0031' : 0 : 'ACTION' : pAction);
        endsl;

        pTotal = Total;
        *inlr = *on;
        return;

      *
      * ------------------------------------------------------------------
      * Validate - header + every line; fills description / price / amount
      * and the total. Never writes, never locks (CHAIN(N) only).
      * pAdd *ON = new order, *OFF = edit of order pOrdNo.
      * ------------------------------------------------------------------
     P Validate        B
     D Validate        PI
     D  pAdd                          1N   CONST
     D i               S              3P 0
     D Act             S              1A
     D ItemOk          S              1N
     D QtyBad          S              1N
     D Avail           S              9P 0
     D SavedCnt        S              3P 0
     D SavedSeen       S              3P 0
     D OldPrice        S              9P 2
     D OldDesc         S             50A
      * Items already on this order (A5: no duplicates)
     D Seen            S              7S 0 DIM(25)
     D SeenCount       S              3P 0
     D Dup             S              1N

        Total = 0;
        Remaining = 0;

        // ---- header
        if pAdd;
          test(de) *iso pOrdDate;
          if %error;
            AddErr('COM0032' : 0 : 'ORDDATE');
          else;
            InDate = %date(pOrdDate : *iso);
          endif;
          if pCustNo <= 0;
            AddErr('COM0004' : 0 : 'CUSTNO');
          else;
            chain(n) pCustNo CSTMST;
            if not %found(CSTMST);
              AddErr('COM0006' : 0 : 'CUSTNO');
            else;
              pCustName = C_CUSTNAME;
              if C_STATUS <> 'A';
                AddErr('COM0010' : 0 : 'CUSTNO');
              endif;
            endif;
          endif;
        else;
          // Edit: header locked (A4); an inactive customer is fine (E3).
          chain(ne) pOrdNo ORDHDR;
          if %error;
            AddErr('COM0038' : 0 : 'ORDNO' : 'Order ' + %char(pOrdNo));
            return;
          endif;
          if not %found(ORDHDR);
            AddErr('COM0023' : 0 : 'ORDNO');
            return;
          endif;
          chain(n) CUSTNO CSTMST;
          if %found(CSTMST);
            pCustName = C_CUSTNAME;
          endif;
          setll pOrdNo ORDDTLF;
          reade(ne) pOrdNo ORDDTLF;
          dow not %error and not %eof(ORDDTLF);
            SavedCnt += 1;
            reade(ne) pOrdNo ORDDTLF;
          enddo;
          if %error;
            AddErr('COM0038' : 0 : 'ORDNO' : 'Order ' + %char(pOrdNo));
            return;
          endif;
          Remaining = SavedCnt;
        endif;

        // ---- lines
        for i = 1 to NLines;
          LAct(i) = ' ';
          LSaved(i) = (not pAdd and pLines(i).LineNo <> 0);
          LOldQty(i) = 0;
          // Outputs reset first: the caller may send blanks there (the web
          // does), and blanks in a zoned field are invalid decimal data.
          pLines(i).ItemDesc = *blanks;
          pLines(i).Price = 0;
          pLines(i).Amount = 0;

          // An empty row: nothing typed, nothing saved.
          if not LSaved(i) and pLines(i).ItemNo = 0 and pLines(i).Qty = 0;
            iter;
          endif;

          Act = pLines(i).LAction;
          if Act = ' ';
            if LSaved(i);
              Act = 'C';
            else;
              Act = 'N';
            endif;
          endif;
          // N only for a new row, C / D only for a saved line.
          if (Act <> 'N' and Act <> 'C' and Act <> 'D')
             or (Act = 'N' and LSaved(i))
             or (Act <> 'N' and not LSaved(i));
            AddErr('COM0031' : i : 'LACTION');
            iter;
          endif;
          LAct(i) = Act;

          if LSaved(i);
            SavedSeen += 1;
            chain(ne) (pOrdNo : pLines(i).LineNo) ORDDTLF;
            if %error;
              AddErr('COM0038' : i : 'LINES' : 'Order ' + %char(pOrdNo));
              iter;
            endif;
            if not %found(ORDDTLF);
              // The line was deleted by someone else meanwhile.
              AddErr('COM0039' : i : 'LINES' : %char(pOrdNo));
              iter;
            endif;
            LOldQty(i) = QTY;
            OldPrice = PRICE;
            OldDesc = ITEMDESC;
            // A4: a saved line's item can't change.
            pLines(i).ItemNo = ITEMNO;
            if Act = 'D';
              // E5: a deleted line is not a duplicate of anything.
              Remaining -= 1;
              pLines(i).ItemDesc = OldDesc;
              pLines(i).Price = OldPrice;
              iter;
            endif;
          else;
            Remaining += 1;
          endif;

          ItemOk = *off;
          QtyBad = *off;
          if pLines(i).ItemNo <= 0;
            AddErr('COM0011' : i : 'ITEMNO');
          else;
            // (E): ITMMST is under commit - a row another job is changing
            // makes even a no-lock read wait, then fail (01218). Found by
            // the ODBC lock test: without (E) ORDSVC stopped on an inquiry
            // message and the web call never came back.
            chain(ne) pLines(i).ItemNo ITMMST;
            if %error;
              AddErr('COM0038' : i : 'ITEMNO'
                    : 'Item ' + %char(pLines(i).ItemNo));
            elseif not %found(ITMMST);
              AddErr('COM0013' : i : 'ITEMNO');
            else;
              ItemOk = *on;
              // E2: a saved line keeps its price, a new one takes today's.
              if LSaved(i);
                pLines(i).ItemDesc = OldDesc;
                pLines(i).Price = OldPrice;
              else;
                pLines(i).ItemDesc = I_ITEMDESC;
                pLines(i).Price = I_UNITPRICE;
              endif;
              // A12: an inactive item may stay on a saved line with the
              // same or a lower quantity - never on a new line.
              if I_STATUS <> 'A';
                if not LSaved(i);
                  AddErr('COM0018' : i : 'ITEMNO'
                        : %char(pLines(i).ItemNo));
                elseif pLines(i).Qty > LOldQty(i);
                  AddErr('COM0018' : i : 'QTY' : %char(pLines(i).ItemNo));
                  QtyBad = *on;
                endif;
              endif;
              // Two IFs, not one AND: %LOOKUP must never run with 0
              // entries (no reliance on AND short-circuit).
              Dup = *off;
              if SeenCount > 0;
                Dup = (%lookup(pLines(i).ItemNo : Seen : 1 : SeenCount) > 0);
              endif;
              if Dup;
                AddErr('COM0021' : i : 'ITEMNO');
              else;
                SeenCount += 1;
                Seen(SeenCount) = pLines(i).ItemNo;
              endif;
            endif;
          endif;

          // E4: the saved qty is already off the stock.
          if pLines(i).Qty <= 0;
            AddErr('COM0020' : i : 'QTY');
            QtyBad = *on;
          elseif ItemOk;
            Avail = I_STOCKQTY + LOldQty(i);
            if pLines(i).Qty > Avail;
              AddErr('COM0019' : i : 'QTY' : %char(Avail)
                    : %char(pLines(i).ItemNo));
              QtyBad = *on;
            endif;
          endif;

          // Only for a valid qty (<= stock): no 11,2 overflow possible.
          if ItemOk and not QtyBad;
            pLines(i).Amount = pLines(i).Qty * pLines(i).Price;
            Total += pLines(i).Amount;
          endif;
        endfor;

        // Edit: the buffer must carry every saved line, or what the user
        // saw is no longer what is on file.
        if not pAdd and SavedSeen <> SavedCnt;
          AddErr('COM0039' : 0 : 'LINES' : %char(pOrdNo));
        endif;
        return;

     P Validate        E
      *
      * ------------------------------------------------------------------
      * SaveAdd - validate, then the A10 write sequence in ONE commit
      * ------------------------------------------------------------------
     P SaveAdd         B
     D SaveAdd         PI
     D i               S              3P 0
     D NewOrd          S              7P 0
      * NOT 'LineNo': RPG names ignore case, so a local LineNo would
      * HIDE the file field LINENO (it stayed 0 -> LINENO > 0 check
      * refused the line, status 01022).
     D NewLn           S              3P 0
     D Rc              S              1A

        Validate(*on);
        if pErrCnt > 0;
          return;
        endif;
        if Remaining = 0;
          AddErr('COM0022' : 0 : 'LINES');
          return;
        endif;

        // A11: the next number, locked; NOT under commit - a rolled-back
        // order leaves a gap.   Fixed-format:  C  *LOCK  IN  NxtOrdNo
        in *lock NxtOrdNo;
        NxtOrdNo += 1;
        NewOrd = NxtOrdNo;
        out NxtOrdNo;

        chain(ne) NewOrd ORDHDR;
        if %error or %found(ORDHDR);
          AddErr('COM0024' : 0 : 'ORDNO');
          return;
        endif;

        // A10: header first, with the final total (one 'A' audit row).
        ORDNO = NewOrd;
        ORDDATE = InDate;
        CUSTNO = pCustNo;
        STATUS = 'O';
        TOTAMT = Total;
        write(e) ORDHREC;
        if %error;
          Fail('COM0033' : 'ORDHDR' : %status(ORDHDR));
          return;
        endif;

        // A6: lines numbered 1..n, empty rows skipped.
        for i = 1 to NLines;
          if LAct(i) <> 'N';
            iter;
          endif;
          Rc = AdjStock(pLines(i).ItemNo : -pLines(i).Qty);
          if Rc <> ' ';
            StockFail(Rc : pLines(i).ItemNo);
            return;
          endif;
          NewLn += 1;
          ORDNO = NewOrd;
          LINENO = NewLn;
          ITEMNO = pLines(i).ItemNo;
          // The full 50-character description, from AdjStock's CHAIN.
          ITEMDESC = I_ITEMDESC;
          QTY = pLines(i).Qty;
          PRICE = pLines(i).Price;
          AMOUNT = pLines(i).Amount;
          write(e) ORDDREC;
          if %error;
            Fail('COM0033' : 'ORDDTL' : %status(ORDDTLF));
            return;
          endif;
          pLines(i).LineNo = NewLn;
        endfor;

        if TestFail();
          return;
        endif;
        commit;
        pOrdNo = NewOrd;
        return;

     P SaveAdd         E
      *
      * ------------------------------------------------------------------
      * SaveEdit - validate, then delete / change / add lines and update
      * the header total, in ONE commit
      * ------------------------------------------------------------------
     P SaveEdit        B
     D SaveEdit        PI
     D i               S              3P 0
     D MaxLine         S              3P 0
     D Changed         S              1N
     D Rc              S              1A

        Validate(*off);
        if pErrCnt > 0;
          return;
        endif;
        if Remaining = 0;
          // Every line marked D: use delete order instead.
          AddErr('COM0022' : 0 : 'LINES');
          return;
        endif;

        // E6: nothing changed -> nothing written (no empty 'U' row).
        for i = 1 to NLines;
          if LAct(i) = 'D' or LAct(i) = 'N'
             or (LAct(i) = 'C' and pLines(i).Qty <> LOldQty(i));
            Changed = *on;
          endif;
        endfor;
        if not Changed;
          return;
        endif;

        // The header is the gate: lock it first.
        chain(e) pOrdNo ORDHDR;
        if %error;
          if %status(ORDHDR) = 1218;
            Fail('COM0038' : 'Order ' + %char(pOrdNo));
          else;
            Fail('COM0033' : 'ORDHDR' : %status(ORDHDR));
          endif;
          return;
        endif;
        if not %found(ORDHDR);
          AddErr('COM0023' : 0 : 'ORDNO');
          return;
        endif;
        // Stale edit: the order changed since the user loaded it.
        if pChkSum <> *blanks
           and pChkSum <> FingerPrint(pOrdNo : TOTAMT);
          Fail('COM0039' : %char(pOrdNo));
          return;
        endif;

        // A6: new lines continue after the highest number (never reused).
        setll pOrdNo ORDDTLF;
        reade(ne) pOrdNo ORDDTLF;
        dow not %error and not %eof(ORDDTLF);
          MaxLine = LINENO;
          reade(ne) pOrdNo ORDDTLF;
        enddo;
        if %error;
          Fail('COM0038' : 'Order ' + %char(pOrdNo));
          return;
        endif;

        for i = 1 to NLines;
          select;
          when LAct(i) = 'D';
            //   Fixed-format two-field key:  C  LinKey  KLIST  (KFLD x2)
            chain(e) (pOrdNo : pLines(i).LineNo) ORDDTLF;
            if %error or not %found(ORDDTLF);
              Fail('COM0033' : 'ORDDTL' : %status(ORDDTLF));
              return;
            endif;
            delete(e) ORDDREC;
            if %error;
              Fail('COM0033' : 'ORDDTL' : %status(ORDDTLF));
              return;
            endif;
            Rc = AdjStock(pLines(i).ItemNo : LOldQty(i));
            if Rc <> ' ';
              StockFail(Rc : pLines(i).ItemNo);
              return;
            endif;

          when LAct(i) = 'C' and pLines(i).Qty <> LOldQty(i);
            chain(e) (pOrdNo : pLines(i).LineNo) ORDDTLF;
            if %error or not %found(ORDDTLF);
              Fail('COM0033' : 'ORDDTL' : %status(ORDDTLF));
              return;
            endif;
            QTY = pLines(i).Qty;
            // E2: PRICE stays the saved one.
            AMOUNT = QTY * PRICE;
            update(e) ORDDREC;
            if %error;
              Fail('COM0033' : 'ORDDTL' : %status(ORDDTLF));
              return;
            endif;
            // Net change: old 5, new 8 -> stock -3; old 5, new 2 -> +3.
            Rc = AdjStock(pLines(i).ItemNo : LOldQty(i) - pLines(i).Qty);
            if Rc <> ' ';
              StockFail(Rc : pLines(i).ItemNo);
              return;
            endif;

          when LAct(i) = 'N';
            Rc = AdjStock(pLines(i).ItemNo : -pLines(i).Qty);
            if Rc <> ' ';
              StockFail(Rc : pLines(i).ItemNo);
              return;
            endif;
            MaxLine += 1;
            ORDNO = pOrdNo;
            LINENO = MaxLine;
            ITEMNO = pLines(i).ItemNo;
            ITEMDESC = I_ITEMDESC;
            QTY = pLines(i).Qty;
            PRICE = pLines(i).Price;
            AMOUNT = pLines(i).Amount;
            write(e) ORDDREC;
            if %error;
              Fail('COM0033' : 'ORDDTL' : %status(ORDDTLF));
              return;
            endif;
            pLines(i).LineNo = MaxLine;
          endsl;
        endfor;

        // ONE header update (one 'U' audit row); still locked from the
        // gate CHAIN. %FIELDS: only TOTAMT is written back.
        TOTAMT = Total;
        update(e) ORDHREC %fields(TOTAMT);
        if %error;
          Fail('COM0033' : 'ORDHDR' : %status(ORDHDR));
          return;
        endif;

        if TestFail();
          return;
        endif;
        commit;
        return;

     P SaveEdit        E
      *
      * ------------------------------------------------------------------
      * DeleteOrd - stock back, lines, then the header (FK RESTRICT), in
      * ONE commit
      * ------------------------------------------------------------------
     P DeleteOrd       B
     D DeleteOrd       PI
     D Rc              S              1A

        chain(e) pOrdNo ORDHDR;
        if %error;
          if %status(ORDHDR) = 1218;
            Fail('COM0038' : 'Order ' + %char(pOrdNo));
          else;
            Fail('COM0033' : 'ORDHDR' : %status(ORDHDR));
          endif;
          return;
        endif;
        if not %found(ORDHDR);
          AddErr('COM0023' : 0 : 'ORDNO');
          return;
        endif;

        // READE without (N) = read AND lock each line before DELETE.
        setll pOrdNo ORDDTLF;
        reade(e) pOrdNo ORDDTLF;
        dow not %error and not %eof(ORDDTLF);
          Rc = AdjStock(ITEMNO : QTY);
          if Rc <> ' ';
            StockFail(Rc : ITEMNO);
            return;
          endif;
          delete(e) ORDDREC;
          if %error;
            Fail('COM0033' : 'ORDDTL' : %status(ORDDTLF));
            return;
          endif;
          reade(e) pOrdNo ORDDTLF;
        enddo;
        if %error;
          Fail('COM0033' : 'ORDDTL' : %status(ORDDTLF));
          return;
        endif;

        chain(e) pOrdNo ORDHDR;
        if not %error and %found(ORDHDR);
          delete(e) ORDHREC;
        endif;
        if %error or not %found(ORDHDR);
          Fail('COM0033' : 'ORDHDR' : %status(ORDHDR));
          return;
        endif;

        if TestFail();
          return;
        endif;
        commit;
        return;

     P DeleteOrd       E
      *
      * ------------------------------------------------------------------
      * AdjStock - add pDelta to an item's stock (negative = take), inside
      * the commit. Returns ' ' ok, 'L' locked by another job, 'E' error
      * (also: the stock >= 0 constraint refused it).
      * ------------------------------------------------------------------
     P AdjStock        B
     D AdjStock        PI             1A
     D  pItem                         7P 0 CONST
     D  pDelta                        9P 0 CONST

        chain(e) pItem ITMMST;
        if %error;
          if %status(ITMMST) = 1218;
            return 'L';
          endif;
          return 'E';
        endif;
        if not %found(ITMMST);
          return 'E';
        endif;
        I_STOCKQTY += pDelta;
        update(e) ITMREC;
        if %error;
          return 'E';
        endif;
        return ' ';

     P AdjStock        E
      *
      * ------------------------------------------------------------------
      * StockFail - ROLBK + the right message for an AdjStock failure
      * ------------------------------------------------------------------
     P StockFail       B
     D StockFail       PI
     D  pRc                           1A   CONST
     D  pItem                         7P 0 CONST

        if pRc = 'L';
          Fail('COM0038' : 'Item ' + %char(pItem));
        else;
          Fail('COM0033' : 'ITMMST');
        endif;
        return;

     P StockFail       E
      *
      * ------------------------------------------------------------------
      * TestFail - COMTSTFAIL = 'Y': fail on purpose just before COMMIT,
      * so a test can prove that ROLBK leaves nothing behind. *ON = failed.
      * ------------------------------------------------------------------
     P TestFail        B
     D TestFail        PI             1N

        in(e) TstFail;
        if %error;
          TstFail = ' ';
        endif;
        if TstFail = 'Y';
          Fail('COM0033' : 'TEST');
          return *on;
        endif;
        return *off;

     P TestFail        E
      *
      * ------------------------------------------------------------------
      * Fail - ROLBK everything since the last COMMIT, then add the error
      * (+ the file status in MsgDta2 when given)
      *   Fixed-format:  C                   ROLBK
      * ------------------------------------------------------------------
     P Fail            B
     D Fail            PI
     D  pMsgId                        7A   CONST
     D  pData1                       20A   CONST
     D  pStatus                       5P 0 CONST OPTIONS(*NOPASS)

        rolbk;
        // MsgDta2 = the file status (01021 duplicate key, 01022
        // constraint, 01218 locked ...): not in the message text, but
        // kept in the error entry for whoever has to find the cause.
        if %parms >= 3;
          AddErr(pMsgId : 0 : 'DB' : pData1 : %editc(pStatus : 'X'));
        else;
          AddErr(pMsgId : 0 : 'DB' : pData1);
        endif;
        return;

     P Fail            E
      *
      * ------------------------------------------------------------------
      * AddErr - one error entry (max 30 kept)
      * ------------------------------------------------------------------
     P AddErr          B
     D AddErr          PI
     D  pMsgId                        7A   CONST
     D  pLine                         3P 0 CONST
     D  pField                       10A   CONST
     D  pData1                       20A   CONST OPTIONS(*NOPASS)
     D  pData2                       20A   CONST OPTIONS(*NOPASS)

        if pErrCnt >= 30;
          return;
        endif;
        pErrCnt += 1;
        pErrors(pErrCnt).MsgId = pMsgId;
        pErrors(pErrCnt).ErrLine = pLine;
        pErrors(pErrCnt).ErrField = pField;
        pErrors(pErrCnt).MsgDta1 = *blanks;
        pErrors(pErrCnt).MsgDta2 = *blanks;
        if %parms >= 4;
          pErrors(pErrCnt).MsgDta1 = pData1;
        endif;
        if %parms >= 5;
          pErrors(pErrCnt).MsgDta2 = pData2;
        endif;
        return;

     P AddErr          E
      *
      * ------------------------------------------------------------------
      * FingerPrint - 'total in cents/lines/sum qty/sum lineno x qty' of
      * an order, from the file. pTot = its header total (passed in: the
      * header may be the record SaveEdit holds locked).
      * ------------------------------------------------------------------
     P FingerPrint     B
     D FingerPrint     PI            32A
     D  pOrd                          7P 0 CONST
     D  pTot                         11P 2 CONST
     D Cnt             S              5P 0
     D SumQty          S             11P 0
     D SumLQ           S             15P 0

        setll pOrd ORDDTLF;
        reade(ne) pOrd ORDDTLF;
        dow not %error and not %eof(ORDDTLF);
          Cnt += 1;
          SumQty += QTY;
          SumLQ += LINENO * QTY;
          reade(ne) pOrd ORDDTLF;
        enddo;
        // A line locked by another job's save: no fingerprint (it won't
        // match, so an edit gets COM0039 and reloads).
        if %error;
          return 'LOCKED';
        endif;
        return %char(%int(pTot * 100)) + '/' + %char(Cnt) + '/'
               + %char(SumQty) + '/' + %char(SumLQ);

     P FingerPrint     E
