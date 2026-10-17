      * ======================================================================
      * COMPROTO - Prototypes for COMUTIL and the COM programs
      * Author: Arnav    Created: 2026-10-06
      *
      * /COPY this member into every COM program. It tells the compiler
      * each procedure's / program's name and parameters, so a wrong call
      * (missing or wrong-type parameter) fails at COMPILE time.
      * COMUTIL copies it too, so the compiler also checks that the
      * procedures really match these prototypes.
      *
      * Change log:
      *   2026-10-06  Arnav  Created (Sprint 2, checkpoint 2A)
      *   2026-10-06  Arnav  CustPgm program prototype (Sprint 2, 2C)
      *   2026-10-07  Arnav  MsgData2, ItemPgm (Sprint 3)
      *   2026-10-07  Arnav  PgmQ first parm of SendMsg/ClearMsgs (3B fix)
      *   2026-10-09  Arnav  OrdPgm program prototype (Sprint 4)
      *   2026-10-09  Arnav  OrdInq program prototype (Sprint 4, 4C)
      * ======================================================================
      *
      * ============================== COMUTIL procedures
      *
      * SendMsg: put message MsgId from COMMSGF into message queue PgmQ.
      * PgmQ = the program's own name, the same value as the screen's
      * PGMQ field, so the message subfile (line 24) shows it.
      * MsgData fills &1 (bytes 1-20) and &2 (21-40).
      * Example:  SendMsg(PGMQ : 'COM0019' : MsgData2(%char(Stk) : ...));
     D SendMsg         PR
     D  PgmQ                         10A   CONST
     D  MsgId                         7A   CONST
     D  MsgData                      40A   CONST OPTIONS(*NOPASS)
      *
      * ClearMsgs: remove all messages from message queue PgmQ, so the
      * next screen starts with an empty message line.
     D ClearMsgs       PR
     D  PgmQ                         10A   CONST
      *
      * MsgData2: build the 40-byte message data for &1 and &2 - Value1
      * goes in bytes 1-20, Value2 in 21-40 (each padded with blanks).
     D MsgData2        PR            40A
     D  Value1                       20A   CONST
     D  Value2                       20A   CONST OPTIONS(*NOPASS)
      *
      * ============================== COM programs (called with CALLP)
      *
      * ExitApp comes back 'Y' when the user pressed F3 (leave the whole
      * application), else 'N'.
     D CustPgm         PR                  EXTPGM('CUSTPGM')
     D  ExitApp                       1A
     D ItemPgm         PR                  EXTPGM('ITEMPGM')
     D  ExitApp                       1A
     D OrdPgm          PR                  EXTPGM('ORDPGM')
     D  ExitApp                       1A
     D OrdInq          PR                  EXTPGM('ORDINQ')
     D  ExitApp                       1A
