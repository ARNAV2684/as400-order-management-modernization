      * ======================================================================
      * MENUPGM - Main menu: 1 Customer, 2 Item, 3 Order
      * Author: Arnav    Created: 2026-10-06
      *
      * Indicator map:
      *   03     F3 pressed (exit)
      *   50     Option in error (DSPATR RI PC on screen)
      *   98     Always on: message subfile shows '+' if more messages
      *
      * Runs in activation group COMAG (H-spec); COMSTART reclaims it
      * on exit. Messages go through COMUTIL (bound via COMBNDDIR).
      *
      * Change log:
      *   2026-10-06  Arnav  Created (Sprint 2, checkpoint 2B)
      *   2026-10-06  Arnav  Option 1 calls CUSTPGM (Sprint 2, 2C)
      *   2026-10-07  Arnav  Option 2 calls ITEMPGM (Sprint 3, 3B)
      *   2026-10-07  Arnav  Messages to queue PGMQ by name (3B fix)
      *   2026-10-09  Arnav  Option 3 calls ORDPGM (Sprint 4)
      *   2026-10-09  Arnav  Option 4 calls ORDINQ (Sprint 4, 4C)
      * ======================================================================
     H DFTACTGRP(*NO) ACTGRP('COMAG') BNDDIR('COMBNDDIR')
     H OPTION(*SRCSTMT:*NODEBUGIO)
     FMENUDSPF  CF   E             WORKSTN
      /COPY QRPGLESRC,COMPROTO
     D ExitApp         S              1A

        // PGMQ = this program's name = its main procedure's message queue.
        // SendMsg/ClearMsgs and the screen's message subfile all use it.
        PGMQ = 'MENUPGM';
        *in98 = *on;

        dow not *in03;
          write MSGCTL;
          exfmt MENU;

          // The user has seen the old messages: clear them before
          // deciding which new ones to send.
          ClearMsgs(PGMQ);
          *in50 = *off;

          if *in03;
            leave;
          endif;

          select;
          when OPTION = '1';
            // F3 inside CUSTPGM means "leave the whole app".
            CustPgm(ExitApp);
            if ExitApp = 'Y';
              leave;
            endif;
          when OPTION = '2';
            ItemPgm(ExitApp);
            if ExitApp = 'Y';
              leave;
            endif;
          when OPTION = '3';
            OrdPgm(ExitApp);
            if ExitApp = 'Y';
              leave;
            endif;
          when OPTION = '4';
            OrdInq(ExitApp);
            if ExitApp = 'Y';
              leave;
            endif;
          other;
            *in50 = *on;
            SendMsg(PGMQ : 'COM0001');
          endsl;
        enddo;

        *inlr = *on;
        return;
