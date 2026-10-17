"""COM message texts, read from message file COMMSGF on IBM i (QSYS2.MESSAGE_FILE_DATA).

Loaded on first use and cached for the life of the process (the texts only change when
CRTCOMMSG is re-run). &1 / &2 are filled from the RPG's MsgDta1 / MsgDta2.
"""

import threading

import pyodbc

from . import db
from .errors import API_TEXTS, api_text

_lock = threading.Lock()
_texts: dict[str, str] = {}


def load(conn: pyodbc.Connection) -> dict[str, str]:
    with _lock:
        if not _texts:
            found = db.rows(
                conn,
                "SELECT MESSAGE_ID, MESSAGE_TEXT FROM QSYS2.MESSAGE_FILE_DATA "
                "WHERE MESSAGE_FILE_LIBRARY = ? AND MESSAGE_FILE = 'COMMSGF'",
                (db.lib(),),
                "SELECT QSYS2.MESSAGE_FILE_DATA (COMMSGF)",
            )
            _texts.update({r[0].strip(): (r[1] or "").strip() for r in found})
        return dict(_texts)


def text(conn: pyodbc.Connection, msg_id: str, data1: str = "", data2: str = "") -> str:
    """The message with &1 / &2 substituted (blank data trimmed, as IBM i does for *CHAR)."""
    texts = load(conn)
    template = texts.get(msg_id) or (api_text(msg_id) if msg_id in API_TEXTS else None) or msg_id
    return substitute(template, data1, data2)


def substitute(template: str, data1: str = "", data2: str = "") -> str:
    return template.replace("&1", data1.strip()).replace("&2", data2.strip())


def all_messages(conn: pyodbc.Connection) -> list[dict[str, str]]:
    merged = {**{k: api_text(k) for k in API_TEXTS}, **load(conn)}
    return [{"id": k, "text": v} for k, v in sorted(merged.items())]
