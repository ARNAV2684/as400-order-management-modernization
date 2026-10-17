      * ======================================================================
      * ITEMSVC - Item service: rules + writes for one item, no screen
      * Author: Arnav    Created: 2026-10-14
      *
      * Called by ITEMPGM (5250) and stored procedure ITEMSVC_X (web).
      * Actions: V validate new  U validate existing  A add  E edit
      *          D delete  (V / U never write or lock)
      * Errors: 60-byte entries (COMPROTO ErrEntT). ErrField: ITEMNO,
      * ITEMDESC, UNITPRICE, STOCKQTY, STATUS, DB.
      *
      * Rules moved here from ITEMPGM, unchanged: COM0011 / 0012 / 0014 /
      * 0015 / 0016 / 0008, delete blocked while on an order line (D8,
      * COM0017), COM0013 not found. Locked by another job -> COM0038.
      * ITMMST is journaled but changed here WITHOUT commit, as ITEMPGM
      * did (one-record change). An UPDATE fires the SQL price-change
      * trigger where the system allows one - this program doesn't need to know.
      *
      * Change log:
      *   2026-10-14  Arnav  Created (Sprint 8)
      * ======================================================================
     H DFTACTGRP(*NO) ACTGRP(*CALLER) OPTION(*SRCSTMT:*NODEBUGIO)
     FITMMST    UF A E           K DISK    PREFIX(F_)
      * Only asked 'is this item on any order line?' (SETLL + %EQUAL).
     FORDDTLL2  IF   E           K DISK    PREFIX(O_)
      /COPY QRPGLESRC,COMPROTO
      *
     D ITEMSVC         PI
     D  pAction                       1A   CONST
     D  pItemNo                       7P 0 CONST
     D  pItemDesc                    50A   CONST
     D  pCategory                    20A   CONST
     D  pUnitPrice                    9P 2 CONST
     D  pStockQty                     9P 0 CONST
     D  pStatus                       1A   CONST
     D  pErrCnt                       3P 0
     D  pErrors                            LIKEDS(ErrEntT) DIM(30)

        pErrCnt = 0;
        clear pErrors;

        select;
        when pAction = 'V' or pAction = 'A';
          Validate(*on);
          if pErrCnt = 0 and pAction = 'A';
            AddItem();
          endif;
        when pAction = 'U' or pAction = 'E';
          Validate(*off);
          if pErrCnt = 0 and pAction = 'E';
            EditItem();
          endif;
        when pAction = 'D';
          DeleteItem();
        other;
          AddErr('COM0033' : 'DB' : 'ACTION');
        endsl;

        *inlr = *on;
        return;

      *
      * ------------------------------------------------------------------
      * Validate - every field, ALL errors (pNew: the number must be free)
      * ------------------------------------------------------------------
     P Validate        B
     D Validate        PI
     D  pNew                          1N   CONST

        if pNew;
          if pItemNo <= 0;
            AddErr('COM0011' : 'ITEMNO');
          else;
            setll pItemNo ITMMST;
            if %equal(ITMMST);
              AddErr('COM0012' : 'ITEMNO');
            endif;
          endif;
        else;
          setll pItemNo ITMMST;
          if not %equal(ITMMST);
            AddErr('COM0013' : 'ITEMNO');
            return;
          endif;
        endif;

        if pItemDesc = *blanks;
          AddErr('COM0014' : 'ITEMDESC');
        endif;
        if pUnitPrice < 0;
          AddErr('COM0015' : 'UNITPRICE');
        endif;
        if pStockQty < 0;
          AddErr('COM0016' : 'STOCKQTY');
        endif;
        if pStatus <> 'A' and pStatus <> 'I';
          AddErr('COM0008' : 'STATUS');
        endif;
        return;

     P Validate        E
      *
      * ------------------------------------------------------------------
      * AddItem - WRITE; 01021 = someone added the number meanwhile
      * ------------------------------------------------------------------
     P AddItem         B
     D AddItem         PI

        F_ITEMNO = pItemNo;
        ToFile();
        write(e) ITMREC;
        if %error;
          if %status(ITMMST) = 1021;
            AddErr('COM0012' : 'ITEMNO');
          else;
            AddErr('COM0033' : 'DB' : 'ITMMST');
          endif;
        endif;
        return;

     P AddItem         E
      *
      * ------------------------------------------------------------------
      * EditItem - lock only now, then UPDATE (the number never changes)
      * ------------------------------------------------------------------
     P EditItem        B
     D EditItem        PI

        if not LockItem();
          return;
        endif;
        ToFile();
        update(e) ITMREC;
        if %error;
          unlock ITMMST;
          AddErr('COM0033' : 'DB' : 'ITMMST');
        endif;
        return;

     P EditItem        E
      *
      * ------------------------------------------------------------------
      * DeleteItem - refused while the item is on an order line (D8)
      * ------------------------------------------------------------------
     P DeleteItem      B
     D DeleteItem      PI

        setll pItemNo ORDDTLL2;
        if %equal(ORDDTLL2);
          AddErr('COM0017' : 'ITEMNO');
          return;
        endif;
        if not LockItem();
          return;
        endif;
        // FK ORDDTL -> ITMMST (RESTRICT) refuses it if a line appeared
        // after the check: %ERROR, not a crash.
        delete(e) ITMREC;
        if %error;
          unlock ITMMST;
          AddErr('COM0033' : 'DB' : 'ITMMST');
        endif;
        return;

     P DeleteItem      E
      *
      * ------------------------------------------------------------------
      * LockItem - CHAIN for update; *OFF (+ error) when locked / missing
      * ------------------------------------------------------------------
     P LockItem        B
     D LockItem        PI             1N

        chain(e) pItemNo ITMMST;
        if %error;
          if %status(ITMMST) = 1218;
            AddErr('COM0038' : 'DB' : 'Item ' + %char(pItemNo));
          else;
            AddErr('COM0033' : 'DB' : 'ITMMST');
          endif;
          return *off;
        endif;
        if not %found(ITMMST);
          AddErr('COM0013' : 'ITEMNO');
          return *off;
        endif;
        return *on;

     P LockItem        E
      *
      * ------------------------------------------------------------------
      * ToFile - parameters -> file fields (F_ITEMNO set only on add)
      * ------------------------------------------------------------------
     P ToFile          B
     D ToFile          PI

        F_ITEMDESC = pItemDesc;
        F_CATEGORY = pCategory;
        F_UNITPRICE = pUnitPrice;
        F_STOCKQTY = pStockQty;
        F_STATUS = pStatus;
        return;

     P ToFile          E
      *
      * ------------------------------------------------------------------
      * AddErr - one error entry (max 30); no line index for an item
      * ------------------------------------------------------------------
     P AddErr          B
     D AddErr          PI
     D  pMsgId                        7A   CONST
     D  pField                       10A   CONST
     D  pData1                       20A   CONST OPTIONS(*NOPASS)

        if pErrCnt >= 30;
          return;
        endif;
        pErrCnt += 1;
        pErrors(pErrCnt).MsgId = pMsgId;
        pErrors(pErrCnt).ErrLine = 0;
        pErrors(pErrCnt).ErrField = pField;
        pErrors(pErrCnt).MsgDta1 = *blanks;
        pErrors(pErrCnt).MsgDta2 = *blanks;
        if %parms >= 3;
          pErrors(pErrCnt).MsgDta1 = pData1;
        endif;
        return;

     P AddErr          E
