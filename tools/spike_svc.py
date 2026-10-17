"""Sprint 8 spike: call the RPG service programs from Python, the way the
web API will (Sprint 8 design).

    sh tools/tunnel_pub400.sh          # once
    python tools/spike_svc.py

Needs in .env (git-ignored):  PUB400_USER, PUB400_PASS, PUB400_LIB
(PUB400_LIB = ARNAV27122, the modern copy - never the green-screen
baseline ARNAV27121).

What it proves, step by step:
  1. VA on a bad order  -> several errors, each with its line and field
  2. SA on a good order -> new order number, stock taken
  3. forced failure     -> COMTSTFAIL = 'Y': COM0033 TEST and NOTHING left
                           behind (no order, stock unchanged) = the RPG's
                           ROLBK works inside the ODBC transaction
  4. stale edit         -> CK fingerprint; SE with a wrong one -> COM0039;
                           SE with the right one -> saved
  5. DL                 -> order gone, stock back
  6. audit              -> ORDAUDJV shows A / U / D with AUDSRC = WEB
  7. delete blocking    -> CUSTSVC D on a customer with orders -> COM0009
"""
import os
import sys

import pyodbc
from dotenv import load_dotenv

load_dotenv()
USER = os.environ.get("PUB400_USER", "")
PWD = os.environ.get("PUB400_PASS", "")
LIB = os.environ.get("PUB400_LIB", "ARNAV27122")
if not USER or not PWD:
    sys.exit("Set PUB400_USER and PUB400_PASS in .env first.")
if LIB == "ARNAV27121":
    sys.exit("ARNAV27121 is the green-screen baseline - use ARNAV27122.")

conn = pyodbc.connect(
    "DRIVER={IBM i Access ODBC Driver};SYSTEM=127.0.0.1;"
    f"UID={USER};PWD={PWD};NAM=1;CMT=2;",   # system naming, commit *CHG
    autocommit=False)
# A hang on the server (e.g. an RPG program waiting on an inquiry message)
# becomes an error here after 2 minutes instead of blocking forever.
conn.timeout = 120
cur = conn.cursor()
MSG = {r[0]: r[1] for r in cur.execute(
    "SELECT MESSAGE_ID, MESSAGE_TEXT FROM QSYS2.MESSAGE_FILE_DATA "
    "WHERE MESSAGE_FILE_LIBRARY = ? AND MESSAGE_FILE = 'COMMSGF'", LIB)}
conn.commit()
failures = 0


def check(ok, text):
    global failures
    print(("  PASS  " if ok else "  FAIL  ") + text)
    if not ok:
        failures += 1


# ---------------------------------------------------------- buffers
def line(item, qty, lineno=0, action="N"):
    """One 88-byte line entry: zoned numbers, outputs left blank."""
    return f"{lineno:03d}{action}{item:07d}{qty:07d}" + " " * 70


def lines_buf(entries):
    return "".join(entries).ljust(2200)


def num(text):
    """A zoned number from the buffer; blank = 0."""
    return int(text) if text.strip() else 0


def parse_lines(buf, n):
    out = []
    for i in range(n):
        e = buf[i * 88:(i + 1) * 88]
        out.append(dict(lineno=num(e[0:3]), item=num(e[4:11]),
                        qty=num(e[11:18]), desc=e[18:68].strip(),
                        price=num(e[68:77]) / 100,
                        amount=num(e[77:88]) / 100))
    return out


def parse_errors(buf, n):
    errs = []
    for i in range(int(n)):
        e = buf[i * 60:(i + 1) * 60]
        msgid, d1, d2 = e[0:7], e[20:40].strip(), e[40:60].strip()
        text = MSG.get(msgid, msgid).replace("&1", d1).replace("&2", d2)
        errs.append(dict(msgid=msgid, line=num(e[7:10]),
                         field=e[10:20].strip(), text=text))
    return errs


def ordsvc(action, ordno=0, date="2026-10-14", cust=0, entries=(),
           chksum=""):
    cur.execute(f"CALL {LIB}.ORDSVC_API(?, ?, ?, ?, ?, ?, ?)",
                action, ordno, date, cust, len(entries),
                lines_buf(entries), chksum.ljust(32))
    r = cur.fetchone()
    res = dict(ordno=int(r.ORDNO), total=float(r.TOTAL),
               custname=r.CUSTNAME.strip(),
               errors=parse_errors(r.ERRORS, r.ERRCNT),
               lines=parse_lines(r.LINES, len(entries)),
               chksum=r.CHKSUM.strip())
    conn.commit()   # ends the SQL statement's unit of work (RPG already did)
    return res


def stock(item):
    v = cur.execute(f"SELECT STOCKQTY FROM {LIB}.ITMMST WHERE ITEMNO = ?",
                    item).fetchone()[0]
    conn.commit()
    return int(v)


def count_orders():
    v = cur.execute(f"SELECT COUNT(*) FROM {LIB}.ORDHDR").fetchone()[0]
    conn.commit()
    return int(v)


def set_testfail(value):
    cur.execute("CALL QSYS2.QCMDEXC(?)",
                f"CHGDTAARA DTAARA({LIB}/COMTSTFAIL) VALUE('{value}')")
    conn.commit()


def one(sql, *args):
    v = cur.execute(sql, *args).fetchone()
    conn.commit()
    return v


print(f"Sprint 8 spike - ORDSVC / CUSTSVC via ODBC, library {LIB}\n")

print("1. validate a bad order (VA)")
r = ordsvc("VA", cust=2005, entries=[line(5007, 1), line(5008, 4),
                                     line(9999, 1), line(5002, 0)])
for e in r["errors"]:
    print(f"        line {e['line']} {e['field']:<8} {e['msgid']} {e['text']}")
cur_lib = one("SELECT SCHEMA_NAME FROM QSYS2.LIBRARY_LIST_INFO "
              "WHERE TYPE = 'CURRENT'")[0].strip()
check(cur_lib == LIB, f"the door made {cur_lib} the current library "
      "(the RPG finds its files through the library list)")
ids = {(e["msgid"], e["line"]) for e in r["errors"]}
check({("COM0010", 0), ("COM0018", 1), ("COM0019", 2), ("COM0013", 3),
       ("COM0020", 4)} <= ids, "all 5 errors, each on its own line/field")

print("\n2. save a good order (SA)")
s2, s3 = stock(5002), stock(5003)
good = [line(5002, 2), line(5003, 1)]
r = ordsvc("SA", cust=2001, entries=good)
new = r["ordno"]
check(not r["errors"] and new > 0, f"order {new} created, total {r['total']}")
check(stock(5002) == s2 - 2 and stock(5003) == s3 - 1, "stock taken")

print("\n3. forced failure -> rollback (COMTSTFAIL = Y)")
before = count_orders()
s2b = stock(5002)
set_testfail("Y")
try:
    r = ordsvc("SA", cust=2001, entries=good)
finally:
    set_testfail(" ")
check([e["msgid"] for e in r["errors"]] == ["COM0033"],
      "COM0033: " + (r["errors"][0]["text"] if r["errors"] else "-"))
check(count_orders() == before, "no order left behind")
check(stock(5002) == s2b, "stock unchanged")

print(f"\n4. stale edit on order {new}")
ck = ordsvc("CK", ordno=new)["chksum"]
print(f"        fingerprint {ck}")
edit = [line(5002, 3, lineno=1, action="C"), line(5003, 1, lineno=2,
                                                  action="C")]
r = ordsvc("SE", ordno=new, entries=edit, chksum="0/0/0/0")
check([e["msgid"] for e in r["errors"]] == ["COM0039"],
      "wrong fingerprint -> COM0039")
r = ordsvc("SE", ordno=new, entries=edit, chksum=ck)
check(not r["errors"], f"right fingerprint -> saved, total {r['total']}")
check(stock(5002) == s2 - 3, "stock follows the net change (+1 taken)")

print(f"\n5. delete order {new} (DL)")
r = ordsvc("DL", ordno=new)
check(not r["errors"], "deleted")
check(stock(5002) == s2 and stock(5003) == s3, "stock fully returned")

print(f"\n6. audit trail of order {new} (ORDAUDJV)")
rows = cur.execute(f"SELECT ACTION, AUDUSER, AUDSRC FROM {LIB}.ORDAUDJV "
                   "WHERE ORDNO = ? ORDER BY JRNSEQ", new).fetchall()
conn.commit()
for a in rows:
    print(f"        {a.ACTION}  {a.AUDUSER.strip():<10} {a.AUDSRC.strip()}")
check([a.ACTION for a in rows] == ["A", "U", "D"]
      and all(a.AUDSRC.strip() == "WEB" for a in rows),
      "A, U, D - all from WEB (the rolled-back save left no row)")

print("\n7. delete blocking (CUSTSVC D on customer 2001)")
cur.execute(f"CALL {LIB}.CUSTSVC_API(?, ?, ?, ?, ?, ?, ?)",
            "D", 2001, "", "", "", "", "A")
r = cur.fetchone()
conn.commit()
errs = parse_errors(r.ERRORS, r.ERRCNT)
check([e["msgid"] for e in errs] == ["COM0009"],
      "COM0009: " + (errs[0]["text"] if errs else "-"))

def custsvc(action, cust, name="", addr="", city="", state="", status="A"):
    cur.execute(f"CALL {LIB}.CUSTSVC_API(?, ?, ?, ?, ?, ?, ?)",
                action, cust, name, addr, city, state, status)
    r = cur.fetchone()
    conn.commit()
    return parse_errors(r.ERRORS, r.ERRCNT)


def itemsvc(action, item, desc="", cat="", price=0, stockq=0, status="A"):
    cur.execute(f"CALL {LIB}.ITEMSVC_API(?, ?, ?, ?, ?, ?, ?)",
                action, item, desc, cat, price, stockq, status)
    r = cur.fetchone()
    conn.commit()
    return parse_errors(r.ERRORS, r.ERRCNT)


def ids(errs):
    return [e["msgid"] for e in errs]


print("\n8. CUSTSVC: validate, add, duplicate, edit, delete (customer 2006)")
e = custsvc("V", 0, "", status="X")
check(ids(e) == ["COM0004", "COM0007", "COM0008"],
      "bad customer -> " + ", ".join(ids(e)))
check(custsvc("A", 2006, "SPIKE TEST CUSTOMER", city="MUMBAI") == [],
      "customer 2006 added")
check(ids(custsvc("V", 2006, "AGAIN")) == ["COM0005"],
      "same number again -> COM0005")
check(custsvc("E", 2006, "SPIKE TEST RENAMED", city="PUNE") == [],
      "customer 2006 edited")
r = one(f"SELECT CUSTNAME, CITY FROM {LIB}.CSTMST WHERE CUSTNO = 2006")
check(r.CUSTNAME.strip() == "SPIKE TEST RENAMED" and r.CITY.strip() == "PUNE",
      "the edit is on file")
check(custsvc("D", 2006) == [], "customer 2006 deleted")

print("\n9. ITEMSVC: validate, add, edit, blocked delete, delete (item 5009)")
e = itemsvc("V", 0, "", price=-1, stockq=-1, status="X")
check(ids(e) == ["COM0011", "COM0014", "COM0015", "COM0016", "COM0008"],
      "bad item -> " + ", ".join(ids(e)))
check(itemsvc("A", 5009, "SPIKE TEST ITEM", "TEST", 99.50, 10) == [],
      "item 5009 added")
check(itemsvc("E", 5009, "SPIKE TEST ITEM", "TEST", 120.00, 12) == [],
      "item 5009 edited")
r = one(f"SELECT UNITPRICE, STOCKQTY FROM {LIB}.ITMMST WHERE ITEMNO = 5009")
check(float(r.UNITPRICE) == 120.0 and int(r.STOCKQTY) == 12,
      "the edit is on file")
check(ids(itemsvc("D", 5001)) == ["COM0017"],
      "delete 5001 (on order lines) -> COM0017")
check(itemsvc("D", 5009) == [], "item 5009 deleted")

print("\n10. record locks (COM0038): a second connection holds item 5002")
conn2 = pyodbc.connect(
    "DRIVER={IBM i Access ODBC Driver};SYSTEM=127.0.0.1;"
    f"UID={USER};PWD={PWD};NAM=1;CMT=2;", autocommit=False)
conn2.timeout = 120
cur2 = conn2.cursor()
cur2.execute(f"UPDATE {LIB}.ITMMST SET STOCKQTY = STOCKQTY "
             "WHERE ITEMNO = 5002")       # not committed: the row stays locked
try:
    before = count_orders()
    r = ordsvc("SA", cust=2001, entries=[line(5002, 1)])
    check(ids(r["errors"]) == ["COM0038"],
          "save needing item 5002 -> " + (r["errors"][0]["text"]
                                          if r["errors"] else "no error"))
    check(count_orders() == before, "nothing saved while locked")
    # Its own current values: even if the lock were missed, nothing changes.
    it = cur.execute(f"SELECT ITEMDESC, CATEGORY, UNITPRICE, STOCKQTY, STATUS "
                     f"FROM {LIB}.ITMMST WHERE ITEMNO = 5002 WITH NC").fetchone()
    e = itemsvc("E", 5002, it.ITEMDESC, it.CATEGORY, it.UNITPRICE,
                it.STOCKQTY, it.STATUS)
    check(ids(e) == ["COM0038"], "edit item 5002 -> COM0038")
finally:
    conn2.rollback()
    conn2.close()
r = ordsvc("SA", cust=2001, entries=[line(5002, 1)])
check(not r["errors"], f"after the lock is gone the save works: order "
      f"{r['ordno']}")
check(not ordsvc("DL", ordno=r["ordno"])["errors"], "and is deleted again")

print("\nRESULT:", "ALL PASS" if failures == 0 else f"{failures} FAILED")
sys.exit(1 if failures else 0)
