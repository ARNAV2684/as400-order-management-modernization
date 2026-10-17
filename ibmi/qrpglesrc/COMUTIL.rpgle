      * ======================================================================
      * COMUTIL - Shared utility procedures (service program)
      * Author: Arnav    Created: 2026-10-06
      *
      * Build (module -> service program; programs then bind to it):
      *   CRTRPGMOD MODULE(COM022LIB/COMUTIL) SRCFILE(COM022LIB/QRPGLESRC)
      *             DBGVIEW(*SOURCE)
      *   CRTSRVPGM SRVPGM(COM022LIB/COMUTIL) MODULE(COM022LIB/COMUTIL)
      *             EXPORT(*SRCFILE) SRCFILE(COM022LIB/QSRVSRC)
      *             SRCMBR(COMUTIL) ACTGRP(*CALLER)
      *
      * NOMAIN: no main procedure - this module is only a box of procedures
      * for other programs; it can never be CALLed on its own.
      *
      * Message target = PgmQ, a call stack entry NAME with counter 0. Each
      * screen program passes its own name (its main procedure), the same
      * value its display file shows in SFLPGMQ - so sender and screen
      * always use ONE message queue, whichever procedure sends. ('*' + 1,
      * used before, meant "my caller": wrong when the caller is a
      * sub-procedure, whose queue disappears when it returns.)
      *
      * Change log:
      *   2026-10-06  Arnav  Created (Sprint 2, checkpoint 2A)
      *   2026-10-07  Arnav  MsgData2 (Sprint 3, checkpoint 3A)
      *   2026-10-07  Arnav  PgmQ parameter: target queue by name (3B fix)
      * ======================================================================
     H NOMAIN
      *
      * Our own prototypes: lets the compiler check the PIs below.
      /COPY QRPGLESRC,COMPROTO
      *
      * IBM APIs - used only inside this module, not exported.
      * QMHSNDPM = Send Program Message.
     D SndPgmMsg       PR                  EXTPGM('QMHSNDPM')
     D  MsgId                         7A   CONST
     D  MsgFile                      20A   CONST
     D  MsgData                      40A   CONST
     D  MsgDataLen                   10I 0 CONST
     D  MsgType                      10A   CONST
     D  CallStack                    10A   CONST
     D  CallStackCnt                 10I 0 CONST
     D  MsgKey                        4A
     D  ErrorCode                     8A
      * QMHRMVPM = Remove Program Messages.
     D RmvPgmMsg       PR                  EXTPGM('QMHRMVPM')
     D  CallStack                    10A   CONST
     D  CallStackCnt                 10I 0 CONST
     D  MsgKey                        4A   CONST
     D  MsgsToRmv                    10A   CONST
     D  ErrorCode                     8A
      * Bytes provided = 0: if an API fails, it signals an exception.
     D ApiError        DS
     D  BytesProv                    10I 0 INZ(0)
     D  BytesAvail                   10I 0
      *
      * ------------------------------------------------------------------
      * SendMsg - send COMMSGF message MsgId to message queue PgmQ
      * ------------------------------------------------------------------
     P SendMsg         B                   EXPORT
     D SendMsg         PI
     D  PgmQ                         10A   CONST
     D  MsgId                         7A   CONST
     D  MsgData                      40A   CONST OPTIONS(*NOPASS)
     D Data            S             40A
     D MsgKey          S              4A

        // *NOPASS: MsgData may be left out; never touch it unless passed.
        Data = *blanks;
        if %parms >= 3;
          Data = MsgData;
        endif;

        // *INFO: an ordinary message that the message subfile shows.
        // *LIBL: COMSTART makes COM022LIB the current library.
        // Counter 0 = the entry named PgmQ itself (not one above it).
        SndPgmMsg(MsgId : 'COMMSGF   *LIBL' : Data : %size(Data)
                 : '*INFO' : PgmQ : 0 : MsgKey : ApiError);
        return;

     P SendMsg         E
      *
      * ------------------------------------------------------------------
      * ClearMsgs - remove all messages from message queue PgmQ
      * ------------------------------------------------------------------
     P ClearMsgs       B                   EXPORT
     D ClearMsgs       PI
     D  PgmQ                         10A   CONST

        // Message key blank + '*ALL' = remove every message in the queue.
        RmvPgmMsg(PgmQ : 0 : *blanks : '*ALL' : ApiError);
        return;

     P ClearMsgs       E
      *
      * ------------------------------------------------------------------
      * MsgData2 - message data for &1 (bytes 1-20) and &2 (21-40)
      * ------------------------------------------------------------------
     P MsgData2        B                   EXPORT
     D MsgData2        PI            40A
     D  Value1                       20A   CONST
     D  Value2                       20A   CONST OPTIONS(*NOPASS)
     D Result          S             40A

        Result = Value1;
        if %parms >= 2;
          %subst(Result : 21 : 20) = Value2;
        endif;
        return Result;

     P MsgData2        E
