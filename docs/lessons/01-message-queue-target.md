# Lesson 1: Where does a message go? (the message queue target bug)

Found 2026-10-07, Sprint 3. Arnav saw no message on the item screens. The program's logic
was right, but every message silently disappeared.

## 1. The one fact to remember

Every entry on the **call stack** has its **own message queue** (an in-tray). That includes
every program *and* every sub-procedure. An in-tray exists only while its entry is running.
When a procedure returns, its in-tray and any messages in it are **destroyed**.

## 2. What the screen shows

The message subfile on line 24 shows the in-tray named in the screen field **PGMQ** (DDS
keyword `SFLPGMQ`). The sender and the screen must agree on **one** in-tray.

## 3. The bug

Before the fix:

- `SendMsg` sent to call stack `'*'` + 1, meaning "whoever called SendMsg".
- The screen used `PGMQ = '*'`, meaning "whoever does the `WRITE MSGCTL`".

```
CUSTPGM (subroutines)                  ITEMPGM (sub-procedures)
 CUSTPGM main  <- SendMsg put it here   ITEMPGM main
               <- screen read here       +- DoDetail   <- screen read HERE
               OK same in-tray               +- DeleteItem <- SendMsg put it HERE
                                               returns -> in-tray destroyed -> message gone
```

Subroutines (`BEGSR`) are **not** call-stack entries; they run inside the main procedure. So
CUSTPGM worked by luck. Sub-procedures **are** entries, so ITEMPGM lost everything.

## 4. The fix

Name the in-tray explicitly, and use the same name on both sides.

```rpgle
PGMQ = 'ITEMPGM';                    // = this program's main procedure
...
SendMsg(PGMQ : 'COM0017');           // COMUTIL: call stack entry named PGMQ, counter 0
ClearMsgs(PGMQ);
```

- The main procedure of program ITEMPGM is called ITEMPGM, and it lives as long as the program.
- The screen's PGMQ field holds the same name, so screen and sender always match, whichever
  procedure sends.

## 5. Two related rules

| Situation | Target |
|---|---|
| Message for **my own screen** (message subfile) | My program's name, counter 0 |
| Completion or error message for **whoever CALLed my program** (e.g. LOADDATA) | `*PGMBDY`, counter 1, which skips the hidden PEP |

Also, changing a procedure's **parameters** does **not** change a service program's signature.
The signature depends only on the export **names**. The binder can't warn you, so you must
recompile **every caller** yourself (we recompiled MENUPGM, CUSTPGM and ITEMPGM).

## 6. Check yourself

1. Why did CUSTPGM's messages work but ITEMPGM's didn't?
2. What happens to a sub-procedure's message queue when it returns?
3. What value does PGMQ hold now, and who uses it?
4. When would you still use `*PGMBDY` + 1?
5. Why didn't the service-program signature catch the parameter change?

**How it was proven:** a test program's sub-procedure sent COM0017 using the program's name, and
the main procedure then received COM0017 from its own in-tray.
