"""Build and parse ORDSVC's fixed-width buffers (COMPROTO OrdLineT / ErrEntT).

Line entry, 88 bytes:  LINENO 3S0 | LACTION 1A | ITEMNO 7S0 | QTY 7S0 |
                       ITEMDESC 50A | PRICE 9S2 | AMOUNT 11S2        (x 25 = CHAR(2200))
Error entry, 60 bytes: MSGID 7A | ERRLINE 3S0 | ERRFIELD 10A | MSGDTA1 20A | MSGDTA2 20A
                                                                      (x 30 = CHAR(1800))
Numbers are ZONED: plain digits, no sign or decimal point (9S2 650.00 -> "000065000").
Outputs are sent as zeros, never blanks - blanks in a zoned field are invalid decimal data.
"""

from dataclasses import dataclass
from decimal import Decimal

LINE_LEN = 88
MAX_LINES = 25
LINES_LEN = LINE_LEN * MAX_LINES
ERR_LEN = 60
MAX_ERRORS = 30


def zoned(value: int, digits: int) -> str:
    if value < 0 or len(str(value)) > digits:
        raise ValueError(f"{value} does not fit a {digits}-digit zoned field")
    return str(value).zfill(digits)


def unzoned(text: str) -> int:
    """Blank (an output the RPG didn't fill) reads as 0."""
    text = text.strip()
    return int(text) if text else 0


def cents(text: str) -> Decimal:
    return Decimal(unzoned(text)) / 100


@dataclass(frozen=True)
class LineIn:
    line_no: int
    action: str  # N C D
    item_no: int
    qty: int


@dataclass(frozen=True)
class LineOut:
    line_no: int
    action: str
    item_no: int
    qty: int
    description: str
    price: Decimal
    amount: Decimal


@dataclass(frozen=True)
class ErrOut:
    msg_id: str
    line: int  # 1-based index into the lines; 0 = header
    field: str
    data1: str
    data2: str


def build_lines(lines: list[LineIn]) -> str:
    if len(lines) > MAX_LINES:
        raise ValueError(f"at most {MAX_LINES} lines")
    out = []
    for ln in lines:
        entry = (zoned(ln.line_no, 3) + ln.action[:1].ljust(1) + zoned(ln.item_no, 7)
                 + zoned(ln.qty, 7) + " " * 50 + "0" * 9 + "0" * 11)
        assert len(entry) == LINE_LEN
        out.append(entry)
    # Unused entries: zeros in every numeric field too.
    empty = "000" + " " + "0" * 7 + "0" * 7 + " " * 50 + "0" * 9 + "0" * 11
    out += [empty] * (MAX_LINES - len(lines))
    return "".join(out)


def parse_lines(buf: str, count: int) -> list[LineOut]:
    buf = buf.ljust(LINES_LEN)
    result = []
    for i in range(count):
        e = buf[i * LINE_LEN:(i + 1) * LINE_LEN]
        result.append(LineOut(
            line_no=unzoned(e[0:3]), action=e[3:4], item_no=unzoned(e[4:11]),
            qty=unzoned(e[11:18]), description=e[18:68].strip(),
            price=cents(e[68:77]), amount=cents(e[77:88]),
        ))
    return result


def parse_errors(buf: str, count: int) -> list[ErrOut]:
    buf = buf.ljust(ERR_LEN * MAX_ERRORS)
    result = []
    for i in range(min(int(count), MAX_ERRORS)):
        e = buf[i * ERR_LEN:(i + 1) * ERR_LEN]
        result.append(ErrOut(msg_id=e[0:7].strip(), line=unzoned(e[7:10]),
                             field=e[10:20].strip(), data1=e[20:40].strip(),
                             data2=e[40:60].strip()))
    return result
