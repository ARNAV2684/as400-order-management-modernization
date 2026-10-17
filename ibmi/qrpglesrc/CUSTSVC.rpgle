      * ======================================================================
      * CUSTSVC - Customer service: rules + writes for one customer, no screen
      * Author: Arnav    Created: 2026-10-14
      *
      * Called by CUSTPGM (5250) and stored procedure CUSTSVC_X (web).
      * Actions (P_ACTION):
      *   V validate as a new customer   U validate an existing one
      *   A add   E edit   D delete       (V / U never write or lock)
      * Errors: the same 60-byte entries as ORDSVC (COMPROTO ErrEntT).
      * Fields named in ErrField: CUSTNO, CUSTNAME, STATUS, DB.
      *
      * Rules moved here from CUSTPGM, unchanged: COM0004 / 0005 / 0007 /
      * 0008, delete blocked by orders (D8, COM0009), COM0006 not found.
      * Lock held by another job (status 01218) -> COM0038.
      * CSTMST is not journaled and not under commit (one-record changes,
      * as in CUSTPGM): no COMMIT here.
      *
      * Change log:
      *   2026-10-14  Arnav  Created (Sprint 8)
      * ======================================================================
     H DFTACTGRP(*NO) ACTGRP(*CALLER) OPTION(*SRCSTMT:*NODEBUGIO)
     FCSTMST    UF A E           K DISK    PREFIX(F_)
      * Only asked 'does this customer have orders?' (SETLL + %EQUAL).
     FORDHDRL1  IF   E           K DISK    PREFIX(O_)
      /COPY QRPGLESRC,COMPROTO
      *
     D CUSTSVC         PI
     D  pAction                       1A   CONST
     D  pCustNo                       7P 0 CONST
     D  pCustName                    40A   CONST
     D  pAddress                     50A   CONST
     D  pCity                        30A   CONST
     D  pState                       20A   CONST
     D  pStatus                       1A   CONST
     D  pErrCnt                       3P 0
     D  pErrors                            LIKEDS(ErrEntT) DIM(30)

        pErrCnt = 0;
        clear pErrors;

        select;
        when pAction = 'V' or pAction = 'A';
          Validate(*on);
          if pErrCnt = 0 and pAction = 'A';
            AddCust();
          endif;
        when pAction = 'U' or pAction = 'E';
          Validate(*off);
          if pErrCnt = 0 and pAction = 'E';
            EditCust();
          endif;
        when pAction = 'D';
          DeleteCust();
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
          if pCustNo <= 0;
            AddErr('COM0004' : 'CUSTNO');
          else;
            setll pCustNo CSTMST;
            if %equal(CSTMST);
              AddErr('COM0005' : 'CUSTNO');
            endif;
          endif;
        else;
          setll pCustNo CSTMST;
          if not %equal(CSTMST);
            AddErr('COM0006' : 'CUSTNO');
            return;
          endif;
        endif;

        if pCustName = *blanks;
          AddErr('COM0007' : 'CUSTNAME');
        endif;
        if pStatus <> 'A' and pStatus <> 'I';
          AddErr('COM0008' : 'STATUS');
        endif;
        return;

     P Validate        E
      *
      * ------------------------------------------------------------------
      * AddCust - WRITE; 01021 = someone added the number meanwhile
      * ------------------------------------------------------------------
     P AddCust         B
     D AddCust         PI

        F_CUSTNO = pCustNo;
        ToFile();
        write(e) CSTREC;
        if %error;
          if %status(CSTMST) = 1021;
            AddErr('COM0005' : 'CUSTNO');
          else;
            AddErr('COM0033' : 'DB' : 'CSTMST');
          endif;
        endif;
        return;

     P AddCust         E
      *
      * ------------------------------------------------------------------
      * EditCust - lock only now, then UPDATE (the number never changes)
      * ------------------------------------------------------------------
     P EditCust        B
     D EditCust        PI

        if not LockCust();
          return;
        endif;
        ToFile();
        update(e) CSTREC;
        if %error;
          unlock CSTMST;
          AddErr('COM0033' : 'DB' : 'CSTMST');
        endif;
        return;

     P EditCust        E
      *
      * ------------------------------------------------------------------
      * DeleteCust - refused while the customer has orders (D8)
      * ------------------------------------------------------------------
     P DeleteCust      B
     D DeleteCust      PI

        setll pCustNo ORDHDRL1;
        if %equal(ORDHDRL1);
          AddErr('COM0009' : 'CUSTNO');
          return;
        endif;
        if not LockCust();
          return;
        endif;
        // FK ORDHDR -> CSTMST (RESTRICT) refuses it if an order arrived
        // after the check: %ERROR, not a crash.
        delete(e) CSTREC;
        if %error;
          unlock CSTMST;
          AddErr('COM0033' : 'DB' : 'CSTMST');
        endif;
        return;

     P DeleteCust      E
      *
      * ------------------------------------------------------------------
      * LockCust - CHAIN for update; *OFF (+ error) when locked / missing
      * ------------------------------------------------------------------
     P LockCust        B
     D LockCust        PI             1N

        chain(e) pCustNo CSTMST;
        if %error;
          if %status(CSTMST) = 1218;
            AddErr('COM0038' : 'DB' : 'Customer ' + %char(pCustNo));
          else;
            AddErr('COM0033' : 'DB' : 'CSTMST');
          endif;
          return *off;
        endif;
        if not %found(CSTMST);
          AddErr('COM0006' : 'CUSTNO');
          return *off;
        endif;
        return *on;

     P LockCust        E
      *
      * ------------------------------------------------------------------
      * ToFile - parameters -> file fields (F_CUSTNO set only on add)
      * ------------------------------------------------------------------
     P ToFile          B
     D ToFile          PI

        F_CUSTNAME = pCustName;
        F_ADDRESS = pAddress;
        F_CITY = pCity;
        F_STATE = pState;
        F_STATUS = pStatus;
        return;

     P ToFile          E
      *
      * ------------------------------------------------------------------
      * AddErr - one error entry (max 30); no line index for a customer
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
