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
      *   2026-10-14  Arnav  SVC programs + line / error layouts (Sprint 8)
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
      *
      * ============================== Service programs (Sprint 8)
      *
      * No screen: the rules, writes and COMMIT live here, called by the
      * 5250 programs AND by the web (stored procedures ORDSVC_X ...).
      * Layouts: the Sprint 8 service design (ORDSVC parameters). Numbers inside
      * the entries are ZONED (S) so the web can slice them as text.
      *
      * One order line, 88 bytes (25 of them = SQL CHAR(2200))
     D OrdLineT        DS                  QUALIFIED TEMPLATE
     D  LineNo                        3S 0
     D  LAction                       1A
     D  ItemNo                        7S 0
     D  Qty                           7S 0
     D  ItemDesc                     50A
     D  Price                         9S 2
     D  Amount                       11S 2
      *
      * One error, 60 bytes (30 of them = SQL CHAR(1800)). ErrLine: the
      * line index it belongs to (0 = header); ErrField: CUSTNO, QTY ...
     D ErrEntT         DS                  QUALIFIED TEMPLATE
     D  MsgId                         7A
     D  ErrLine                       3S 0
     D  ErrField                     10A
     D  MsgDta1                      20A
     D  MsgDta2                      20A
      *
      * Actions VA VE SA SE DL CK - see ORDSVC's header
     D OrdSvc          PR                  EXTPGM('ORDSVC')
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
      * Actions V validate add, U validate edit, A add, E edit, D delete
     D CustSvc         PR                  EXTPGM('CUSTSVC')
     D  pAction                       1A   CONST
     D  pCustNo                       7P 0 CONST
     D  pCustName                    40A   CONST
     D  pAddress                     50A   CONST
     D  pCity                        30A   CONST
     D  pState                       20A   CONST
     D  pStatus                       1A   CONST
     D  pErrCnt                       3P 0
     D  pErrors                            LIKEDS(ErrEntT) DIM(30)
      *
     D ItemSvc         PR                  EXTPGM('ITEMSVC')
     D  pAction                       1A   CONST
     D  pItemNo                       7P 0 CONST
     D  pItemDesc                    50A   CONST
     D  pCategory                    20A   CONST
     D  pUnitPrice                    9P 2 CONST
     D  pStockQty                     9P 0 CONST
     D  pStatus                       1A   CONST
     D  pErrCnt                       3P 0
     D  pErrors                            LIKEDS(ErrEntT) DIM(30)
