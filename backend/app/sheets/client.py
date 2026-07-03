"""Cliente Google Sheets — autentica Service Account e lê as 3 abas (research D1).

A planilha é privada; a Service Account tem acesso de Leitor. A chave JSON vem do
ambiente (`GOOGLE_SERVICE_ACCOUNT_JSON`), nunca do código nem do frontend.
"""

import json

import google_auth_httplib2
import httplib2
from google.oauth2.service_account import Credentials
from googleapiclient.discovery import build

from app.config import Settings

_SCOPES = ["https://www.googleapis.com/auth/spreadsheets.readonly"]

# Timeout de rede (s) da chamada ao Sheets. Crucial: o load FRIO roda sob o lock do cache —
# sem timeout (httplib2 default = infinito) uma conexão pendurada travaria TODAS as requisições.
_HTTP_TIMEOUT_S = 30
# Retenta erros transitórios (429/5xx) com backoff exponencial embutido do googleapiclient.
_NUM_RETRIES = 3


class SheetsClient:
    """Lê intervalos brutos das abas. Camada fina sobre a Sheets API."""

    def __init__(self, settings: Settings) -> None:
        self._settings = settings
        self._service = None  # lazy: só constrói ao primeiro uso

    def _get_service(self):
        if self._service is None:
            info = json.loads(self._settings.google_service_account_json)
            creds = Credentials.from_service_account_info(info, scopes=_SCOPES)
            # HTTP com timeout explícito (o build default não tem) — evita lock preso pra sempre.
            authed_http = google_auth_httplib2.AuthorizedHttp(
                creds, http=httplib2.Http(timeout=_HTTP_TIMEOUT_S)
            )
            # cache_discovery=False evita warning/IO de disco em runtime serverless/container.
            # static_discovery=True usa o doc de discovery embutido na lib → sem round-trip de
            # rede pra montar o cliente (economia no cold start do container).
            self._service = build(
                "sheets",
                "v4",
                http=authed_http,
                cache_discovery=False,
                static_discovery=True,
            )
        return self._service

    def read_all(self) -> tuple[list[list[str]], list[list[str]], list[list[str]]]:
        """Lê as 3 abas numa ÚNICA chamada (`batchGet`) → (solicitacoes, cadastro, base).

        Um round-trip HTTP em vez de 3 sequenciais — corta a latência do reload do
        dataset (o gargalo no fim de cada janela de TTL). A ordem de `valueRanges`
        acompanha a ordem dos `ranges` pedidos (contrato da API). `fields` poda tudo
        menos os valores; a resposta já vem gzip (httplib2 negocia por padrão).
        """
        s = self._settings
        result = (
            self._get_service()
            .spreadsheets()
            .values()
            .batchGet(
                spreadsheetId=s.sheet_id,
                ranges=[
                    s.sheet_tab_solicitacoes,
                    s.sheet_tab_cadastro,
                    s.sheet_tab_base,
                ],
                valueRenderOption="UNFORMATTED_VALUE",
                dateTimeRenderOption="FORMATTED_STRING",
                fields="valueRanges(values)",
            )
            .execute(num_retries=_NUM_RETRIES)
        )
        ranges = result.get("valueRanges", [])

        def _rows(i: int) -> list[list[str]]:
            values = ranges[i].get("values", []) if i < len(ranges) else []
            return [[_to_str(c) for c in row] for row in values]

        return _rows(0), _rows(1), _rows(2)


def _to_str(cell: object) -> str:
    """Normaliza célula para string (a API pode devolver número/bool em UNFORMATTED)."""
    if cell is None:
        return ""
    if isinstance(cell, bool):
        return "TRUE" if cell else "FALSE"
    return str(cell)
