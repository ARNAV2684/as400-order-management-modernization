      * ======================================================================
      * ORDTRG - Audit trigger on ORDHDR: one ORDAUD row per add / change /
      *          delete of an order header
      * Author: Arnav    Created: 2026-10-13
      *
      * Attached by ADDTRG (ADDPFTRG, *AFTER, *INSERT / *UPDATE / *DELETE).
      * The database CALLs this program itself after every change to
      * ORDHDR - from ORDPGM, LOADDATA, STRSQL, DFU or the web alike.
      *
      * Parameters (fixed by the system): the trigger buffer + its length.
      *   Insert -> 'A', ORDNO from the NEW image
      *   Update -> 'U', ORDNO from the NEW image
      *   Delete -> 'D', ORDNO from the OLD image (there is no new one)
      * The images are found through OFFSETS in the buffer: pointer =
      * buffer address + offset, and an EXTNAME(ORDHDR) DS laid on it.
      *
      * ACTGRP(*CALLER): runs in the caller's activation group, inside its
      * transaction - so the audit row is committed / rolled back with the
      * order (PDF: a rolled-back order leaves no audit row).
      *
      * ORDAUD is opened by the program (USROPN) with COMMIT(CmtOn), CmtOn
      * set from the buffer's commit lock level BEFORE the open (decision
      * S1): under commit only when the caller's change is. LOADDATA and
      * STRSQL change ORDHDR without commitment control; a COMMIT open
      * would fail there (CPF4293) and so block their change.
      * Opened + closed on every call: the next caller may differ.
      *
      * If the audit row can't be written: *ESCAPE to the caller (decision
      * S2) -> the database refuses the ORDHDR change itself (CPF502B to
      * the program that made it; ORDPGM: %ERROR -> ROLBK + COM0033).
      *
      * PUB400 refuses ADDPFTRG (CPD0032): there ORDTRG is compiled but not
      * attached, and the audit comes from the journal view ORDAUDJV.
      *
      * Change log:
      *   2026-10-13  Arnav  Created (Sprint 7, checkpoint 7A)
      * ======================================================================
     H DFTACTGRP(*NO) ACTGRP(*CALLER) OPTION(*SRCSTMT:*NODEBUGIO)
     FORDAUD    O    E             DISK    USROPN COMMIT(CmtOn)
      *
      * Trigger buffer: the fixed part, positions as IBM documents them.
      * The record images follow it, at TOldOff / TNewOff.
     D TrgBufT         DS                  QUALIFIED TEMPLATE
     D  TFile                  1     10A
     D  TLib                  11     20A
     D  TMbr                  21     30A
      *  '1' insert  '2' delete  '3' update  ('4' read - not used)
     D  TEvent                31     31A
     D  TTime                 32     32A
      *  '0' *NONE (no commit)  '1' *CHG  '2' *CS  '3' *ALL
     D  TCmtLvl               33     33A
     D  TOldOff               49     52I 0
     D  TOldLen               53     56I 0
     D  TNewOff               65     68I 0
     D  TNewLen               69     72I 0
      *
      * Entry parameters (prototype + interface of this program)
     D ORDTRG          PR                  EXTPGM('ORDTRG')
     D  pBuf                               LIKEDS(TrgBufT)
     D  pBufLen                      10I 0
     D ORDTRG          PI
     D  pBuf                               LIKEDS(TrgBufT)
     D  pBufLen                      10I 0
      *
      * The before / after images in ORDHDR's own layout. PREFIX: O_ORDNO /
      * N_ORDNO, so they don't clash with ORDAUD's ORDNO.
     D OldRec        E DS                  EXTNAME(ORDHDR) PREFIX(O_)
     D                                     BASED(pOld)
     D NewRec        E DS                  EXTNAME(ORDHDR) PREFIX(N_)
     D                                     BASED(pNew)
      *
     D CmtOn           S              1N
     D AudOrd          S              7P 0
     D AudAct          S              1A
     D CurUser         S             10A   INZ(*USER)
      *
      * QMHSNDPM - send the *ESCAPE that makes the database refuse the change
     D SndPgmMsg       PR                  EXTPGM('QMHSNDPM')
     D  MsgId                         7A   CONST
     D  MsgF                         20A   CONST
     D  MsgDta                      200A   CONST
     D  MsgDtaLen                    10I 0 CONST
     D  MsgType                      10A   CONST
     D  CallStk                      10A   CONST
     D  CallStkCtr                   10I 0 CONST
     D  MsgKey                        4A
     D  ApiErr                        8A
     D MsgKey          S              4A
     D ApiErr          DS             8
     D  ErrProv                1      4I 0 INZ(0)
     D ErrText         S            200A

        // Pointer = start of the buffer + the offset the system gives.
        pOld = %addr(pBuf) + pBuf.TOldOff;
        pNew = %addr(pBuf) + pBuf.TNewOff;

        select;
        when pBuf.TEvent = '1';
          AudAct = 'A';
          AudOrd = N_ORDNO;
        when pBuf.TEvent = '3';
          AudAct = 'U';
          AudOrd = N_ORDNO;
        when pBuf.TEvent = '2';
          AudAct = 'D';
          AudOrd = O_ORDNO;
        other;
          // Not an event we audit (ADDTRG never registers others).
          *inlr = *on;
          return;
        endsl;

        // Decision S1: set BEFORE the open - COMMIT(CmtOn) is read there.
        CmtOn = (pBuf.TCmtLvl <> '0');
        open(e) ORDAUD;
        if %error;
          Fail('ORDTRG: ORDAUD could not be opened - change refused.');
        endif;

        ORDNO = AudOrd;
        ACTION = AudAct;
        AUDDATE = %date();
        AUDTIME = %time();
        AUDUSER = CurUser;
        write(e) ORDAREC;
        if %error;
          close(e) ORDAUD;
          Fail('ORDTRG: audit row not written - change refused.');
        endif;

        // Closing does not commit: under commit the row stays pending
        // until the caller's COMMIT (or disappears with its ROLBK).
        close(e) ORDAUD;
        *inlr = *on;
        return;

      *
      * ------------------------------------------------------------------
      * Fail - *ESCAPE to whoever made the ORDHDR change. *PGMBDY + 1 =
      * the caller of this program (lesson 1: not '*' + 1). The program
      * ends here: an escape message never returns.
      * ------------------------------------------------------------------
     P Fail            B
     D Fail            PI
     D  pText                       200A   CONST

        ErrText = pText;
        SndPgmMsg('CPF9898' : 'QCPFMSG   *LIBL' : ErrText
                 : %len(%trimr(ErrText)) : '*ESCAPE'
                 : '*PGMBDY' : 1 : MsgKey : ApiErr);
        return;

     P Fail            E
