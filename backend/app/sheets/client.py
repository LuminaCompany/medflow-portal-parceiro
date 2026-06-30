"""Cliente Google Sheets — autentica Service Account e lê as 3 abas (research D1).

A planilha é privada; a Service Account tem acesso de Leitor. A chave JSON vem do
ambiente (`GOOGLE_SERVICE_ACCOUNT_JSON`), nunca do código nem do frontend.
"""

import json

from google.oauth2.service_account import Credentials
from googleapiclient.discovery import build

from app.config import Settings

_SCOPES = ["https://www.googleapis.com/auth/spreadsheets.readonly"]


class SheetsClient:
    """Lê intervalos brutos das abas. Camada fina sobre a Sheets API."""

    def __init__(self, settings: Settings) -> None:
        self._settings = settings
        self._service = None  # lazy: só constrói ao primeiro uso

    def _get_service(self):
        if self._service is None:
            info = json.loads(self._settings.google_service_account_json)
            creds = Credentials.from_service_account_info(info, scopes=_SCOPES)
            # cache_discovery=False evita warning/IO de disco em runtime serverless/container.
            self._service = build("sheets", "v4", credentials=creds, cache_discovery=False)
        return self._service

    def _read_tab(self, tab_name: str) -> list[list[str]]:
        """Lê todas as células preenchidas de uma aba (por nome)."""
        result = (
            self._get_service()
            .spreadsheets()
            .values()
            .get(
                spreadsheetId=self._settings.sheet_id,
                range=tab_name,
                valueRenderOption="UNFORMATTED_VALUE",
                dateTimeRenderOption="FORMATTED_STRING",
            )
            .execute()
        )
        return [[_to_str(c) for c in row] for row in result.get("values", [])]

    def read_solicitacoes(self) -> list[list[str]]:
        return self._read_tab(self._settings.sheet_tab_solicitacoes)

    def read_cadastro(self) -> list[list[str]]:
        return self._read_tab(self._settings.sheet_tab_cadastro)

    def read_base(self) -> list[list[str]]:
        return self._read_tab(self._settings.sheet_tab_base)


def _to_str(cell: object) -> str:
    """Normaliza célula para string (a API pode devolver número/bool em UNFORMATTED)."""
    if cell is None:
        return ""
    if isinstance(cell, bool):
        return "TRUE" if cell else "FALSE"
    return str(cell)
