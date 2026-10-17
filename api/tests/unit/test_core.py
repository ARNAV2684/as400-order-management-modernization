"""No IBM i needed: buffer layout, error mapping, paging, message substitution, money JSON."""

from decimal import Decimal

import pytest

from app.ibmi.buffers import (
    LINE_LEN,
    LINES_LEN,
    LineIn,
    build_lines,
    parse_errors,
    parse_lines,
    unzoned,
    zoned,
)
from app.ibmi.errmap import FIELDS, status_for
from app.messages import substitute
from app.repositories import page_args
from app.schemas import Item, OrderLine


def test_zoned_pads_and_rejects_overflow() -> None:
    assert zoned(5002, 7) == "0005002"
    assert zoned(0, 3) == "000"
    with pytest.raises(ValueError):
        zoned(10_000_000, 7)
    with pytest.raises(ValueError):
        zoned(-1, 7)


def test_unzoned_blank_is_zero() -> None:
    assert unzoned("         ") == 0
    assert unzoned("000065000") == 65000


def test_build_lines_layout() -> None:
    buf = build_lines([LineIn(0, "N", 5002, 2), LineIn(3, "C", 5003, 10)])
    assert len(buf) == LINES_LEN == 2200
    first = buf[:LINE_LEN]
    assert first[:18] == "000N00050020000002"
    assert first[18:68] == " " * 50                 # description: an output, sent blank
    assert first[68:] == "0" * 20                   # price + amount: zeros, never blanks
    assert buf[LINE_LEN:LINE_LEN + 18] == "003C00050030000010"
    # unused entries are numeric-safe too
    assert buf[2 * LINE_LEN:2 * LINE_LEN + 3] == "000"
    with pytest.raises(ValueError):
        build_lines([LineIn(0, "N", 1, 1)] * 26)


def test_parse_lines_reads_rpg_output() -> None:
    entry = ("001N00050020000002" + "WIRELESS MOUSE".ljust(50) + "000065000" + "00000130000")
    out = parse_lines(entry.ljust(LINES_LEN), 1)[0]
    assert (out.line_no, out.item_no, out.qty) == (1, 5002, 2)
    assert out.description == "WIRELESS MOUSE"
    assert out.price == Decimal("650.00") and out.amount == Decimal("1300.00")


def test_parse_errors() -> None:
    e = "COM0019" + "002" + "QTY".ljust(10) + "3".ljust(20) + "5008".ljust(20)
    hdr = "COM0010" + "000" + "CUSTNO".ljust(10) + " " * 40
    errs = parse_errors(e + hdr, 2)
    assert errs[0].msg_id == "COM0019" and errs[0].line == 2 and errs[0].field == "QTY"
    assert (errs[0].data1, errs[0].data2) == ("3", "5008")
    assert errs[1].line == 0 and FIELDS[errs[1].field] == "custNo"


@pytest.mark.parametrize(("ids", "code"), [
    (["COM0020", "COM0019"], 422), (["COM0005"], 409), (["COM0038"], 409),
    (["COM0039"], 409), (["COM0009"], 409), (["COM0023"], 404), (["COM0033"], 500),
    (["COM0033", "COM0038"], 500),
])
def test_status_for(ids: list[str], code: int) -> None:
    assert status_for(ids) == code


def test_substitute_trims_like_ibmi() -> None:
    assert substitute("Only &1 in stock for item &2.", "3   ", "5008") == \
        "Only 3 in stock for item 5008."


def test_page_args() -> None:
    assert page_args(1, 20, 0) == (1, 20, 0)
    assert page_args(9, 20, 45) == (3, 20, 40)        # clamped to the last page
    assert page_args(1, 500, 10) == (1, 100, 0)       # size capped at 100


def test_money_is_a_decimal_string() -> None:
    line = OrderLine(line_no=1, item_no=5002, description="X", qty=2,
                     price=Decimal("650"), amount=Decimal("1300.5"))
    assert line.model_dump(by_alias=True)["price"] == "650.00"
    assert line.model_dump(by_alias=True)["amount"] == "1300.50"
    item = Item.model_validate({"itemNo": 1, "unitPrice": "99.95"})
    assert item.unit_price == Decimal("99.95")
    assert item.model_dump(by_alias=True)["unitPrice"] == "99.95"
