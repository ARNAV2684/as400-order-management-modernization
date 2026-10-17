"""Settings from the repo's .env (git-ignored). Never log the password."""

import re
from functools import lru_cache
from pathlib import Path
from typing import Literal

from pydantic import SecretStr, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

REPO_ROOT = Path(__file__).resolve().parents[2]
_NAME = re.compile(r"^[A-Z][A-Z0-9_#@$]{0,9}$")

# The frozen green-screen baseline (tag greenscreen-v2). The web must never write there.
BASELINE_LIBRARY = "ARNAV27121"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=REPO_ROOT / ".env", extra="ignore")

    pub400_user: str
    pub400_pass: SecretStr
    pub400_lib: str = "ARNAV27122"
    # ORDAUDJV = audit derived from the journal (PUB400 refuses triggers); ORDAUD on a system
    # where the ORDTRG trigger is attached.
    com_audit_table: str = "ORDAUDJV"
    # The SSH tunnel entrance (tools/tunnel_pub400.sh).
    odbc_system: str = "127.0.0.1"
    # How to reach IBM i: "" = through the SSH tunnel (encrypted by SSH, the default);
    # "plain" = straight to PUB400 on 8471, UNENCRYPTED (queries and results readable on the way);
    # "tls" = straight to PUB400 on 9471 with SSL=1 (needs the server certificate trusted).
    pub400_direct: Literal["", "plain", "tls"] = ""
    # Only for direct modes. Lives in .env only, never in the repo.
    pub400_host: str = ""
    system_name: str = "PUB400"
    cors_origins: list[str] = ["http://localhost:5173", "http://127.0.0.1:5173"]

    @field_validator("pub400_lib", "com_audit_table")
    @classmethod
    def _object_name(cls, v: str) -> str:
        # The library and table names go into SQL text (they can't be ? parameters), so only a
        # valid IBM i name gets through.
        v = v.strip().upper()
        if not _NAME.match(v):
            raise ValueError(f"not a valid IBM i object name: {v!r}")
        return v

    @field_validator("pub400_lib")
    @classmethod
    def _not_baseline(cls, v: str) -> str:
        if v == BASELINE_LIBRARY:
            raise ValueError(f"{v} is the green-screen baseline; the API uses ARNAV27122")
        return v

    @model_validator(mode="after")
    def _direct_needs_host(self) -> "Settings":
        if self.pub400_direct and not self.pub400_host.strip():
            raise ValueError("PUB400_DIRECT is set, so PUB400_HOST must be set too")
        return self

    @property
    def connection_mode(self) -> Literal["tunnel", "direct-plain", "direct-tls"]:
        if not self.pub400_direct:
            return "tunnel"
        return "direct-tls" if self.pub400_direct == "tls" else "direct-plain"

    @property
    def db_endpoint(self) -> tuple[str, int]:
        """Where the database host server answers: the tunnel entrance, or PUB400 itself."""
        if not self.pub400_direct:
            return self.odbc_system, 8471
        return self.pub400_host.strip(), 9471 if self.pub400_direct == "tls" else 8471

    def connection_string(self) -> str:
        # NAM=1 system naming, CMT=2 commit level *CHG (the RPG ends each save with COMMIT).
        host, _ = self.db_endpoint
        return (
            "DRIVER={IBM i Access ODBC Driver};"
            f"SYSTEM={host};UID={self.pub400_user};"
            f"PWD={self.pub400_pass.get_secret_value()};NAM=1;CMT=2;"
            + ("SSL=1;" if self.pub400_direct == "tls" else "")
        )


@lru_cache
def get_settings() -> Settings:
    return Settings()  # type: ignore[call-arg]
