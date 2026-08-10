"""Conector local e somente leitura entre o CheckDiário e o Raffinato.

O processo escuta exclusivamente no loopback. A comunicação com o SQL Server
acontece pela rede do computador (inclusive Radmin VPN); credenciais nunca são
enviadas ao navegador.
"""

from __future__ import annotations

import json
import logging
import os
import sys
import base64
import ctypes
import threading
import time
import webbrowser
import urllib.request
import urllib.error
from urllib.parse import urlparse
from ctypes import wintypes
from datetime import date, datetime, timedelta
from decimal import Decimal
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any

import pyodbc


BASE_DIR = Path(sys.executable).resolve().parent if getattr(sys, "frozen", False) else Path(__file__).resolve().parent
LOCAL_CONFIG_PATH = BASE_DIR / "credentials.local.json"
LEGACY_CONFIG_PATH = BASE_DIR.parents[2] / "FACULDADE" / "PROJETOS TESTES" / "credentials.json"
CONFIG_PATH = Path(os.environ.get(
    "CHECKDIARIO_RAFFINATO_CONFIG",
    LOCAL_CONFIG_PATH if LOCAL_CONFIG_PATH.exists() else LEGACY_CONFIG_PATH,
))
HOST = "127.0.0.1"
PORT = int(os.environ.get("CHECKDIARIO_RAFFINATO_PORT", "8766"))
CONNECTOR_VERSION = "1.6.3"
MAX_BODY_BYTES = 16_384
MAX_INTERVAL_DAYS = 366
STORE_CONFIG_PATH = BASE_DIR / "integracoes-raffinato.dat"
DEFAULT_ALLOWED_ORIGINS = [
    "https://checkdiario.com.br",
    "https://www.checkdiario.com.br",
    "http://localhost:8000",
    "http://127.0.0.1:8000",
]
SUPABASE_URL = "https://tqfoxqbmslxoynrasltl.supabase.co"
SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRxZm94cWJtc2x4b3lucmFzbHRsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY1OTU0NDgsImV4cCI6MjA5MjE3MTQ0OH0.2pFQGzMKyYe6P30txCFLCVcNO-Nwjk-zEWknZwNXz88"
RELAY_URL = f"{SUPABASE_URL}/functions/v1/raffinato-relay"

logging.basicConfig(
    filename=BASE_DIR / "raffinato-bridge.log",
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(message)s",
    encoding="utf-8",
)
logger = logging.getLogger("raffinato_bridge")
MUTEX_HANDLE = None

SQL_SANGRIAS = """
WITH MovimentosCaixa AS (
    SELECT
        DF.Id, DF.IdFilial, DF.IdUsuario, DF.IdUsuarioAutorizadorSangria,
        DF.Motivo, DF.ValorTotal, DF.TipoComprovanteNaoFiscal,
        CASE WHEN DF.TipoComprovanteNaoFiscal = 1 THEN 'SANGRIA'
             WHEN DF.TipoComprovanteNaoFiscal = 4 THEN 'RETIRADA' END AS TipoMovimento,
        CASE WHEN DF.TipoComprovanteNaoFiscal = 1 THEN 'Pagamento de despesa'
             WHEN DF.TipoComprovanteNaoFiscal = 4 THEN 'Retirada para cofre' END AS Finalidade,
        DATETIMEFROMPARTS(
            YEAR(DF.Data), MONTH(DF.Data), DAY(DF.Data),
            DATEPART(HOUR, DF.Hora), DATEPART(MINUTE, DF.Hora),
            DATEPART(SECOND, DF.Hora), DATEPART(MILLISECOND, DF.Hora)
        ) AS DataHora
    FROM dbo.DocumentoFiscal DF
    WHERE DF.Tipo = 'CN'
      AND DF.TipoComprovanteNaoFiscal IN (1, 4)
      AND ISNULL(DF.Cancelado, 0) = 0
      AND DF.IdUsuarioAutorizadorSangria IS NOT NULL
)
SELECT
    Id, IdFilial, IdUsuario, IdUsuarioAutorizadorSangria,
    Motivo, ValorTotal, TipoComprovanteNaoFiscal, TipoMovimento, Finalidade, DataHora,
    CONVERT(VARCHAR(8), DataHora, 108) AS hora_formatada,
    CONVERT(VARCHAR(10), DataHora, 103) AS data_formatada
FROM MovimentosCaixa
WHERE DataHora >= ? AND DataHora < ? AND IdFilial = ?
ORDER BY DataHora;
"""

SQL_FORMAS_PAGAMENTO = "SELECT Id AS id, Nome AS nome FROM dbo.FormaPagamento ORDER BY Nome;"

SQL_FATURAMENTO = """
SELECT FP.Id AS id_forma_pagamento, FP.Nome AS forma_pagamento,
 SUM(ISNULL(FCFP.ValorMovimento,0)) valor_movimento, SUM(ISNULL(FCFP.ValorAbertura,0)) valor_abertura,
 SUM(ISNULL(FCFP.ValorSuprimento,0)) valor_suprimento, SUM(ISNULL(FCFP.ValorSangria,0)) valor_sangria,
 SUM(ISNULL(FCFP.ValorApurado,0)) valor_apurado, SUM(ISNULL(FCFP.ValorConfirmado,0)) valor_confirmado
FROM dbo.FechamentoCaixa FC
JOIN dbo.FechamentoCaixaFormaPagamento FCFP ON FCFP.IdFechamentoCaixa=FC.Id
JOIN dbo.FormaPagamento FP ON FP.Id=FCFP.IdFormaPagamento
WHERE FC.Data>=? AND FC.Data<? AND FC.IdFilial=? AND (? IS NULL OR FP.Id=?)
GROUP BY FP.Id,FP.Nome ORDER BY FP.Nome;
"""

SQL_FATURAMENTO_EVOLUCAO = """
SELECT CONVERT(date,FC.Data) data,FP.Id id_forma_pagamento,FP.Nome forma_pagamento,
 SUM(ISNULL(FCFP.ValorMovimento,0)) valor_movimento
FROM dbo.FechamentoCaixa FC JOIN dbo.FechamentoCaixaFormaPagamento FCFP ON FCFP.IdFechamentoCaixa=FC.Id
JOIN dbo.FormaPagamento FP ON FP.Id=FCFP.IdFormaPagamento
WHERE FC.Data>=? AND FC.Data<? AND FC.IdFilial=? AND (? IS NULL OR FP.Id=?)
GROUP BY CONVERT(date,FC.Data),FP.Id,FP.Nome ORDER BY data,FP.Nome;
"""

SQL_FATURAMENTO_TOTALIZADOR = """
SELECT
 SUM(ISNULL(FCFP.ValorMovimento,0)) AS total_valor_movimento,
 SUM(ISNULL(FCFP.ValorAbertura,0)) AS total_abertura,
 SUM(ISNULL(FCFP.ValorSuprimento,0)) AS total_suprimento,
 SUM(ISNULL(FCFP.ValorSangria,0)) AS total_sangria,
 SUM(ISNULL(FCFP.ValorApurado,0)) AS total_apurado,
 SUM(ISNULL(FCFP.ValorConfirmado,0)) AS total_confirmado
FROM dbo.FechamentoCaixa FC
JOIN dbo.FechamentoCaixaFormaPagamento FCFP ON FCFP.IdFechamentoCaixa=FC.Id
WHERE FC.Data>=? AND FC.Data<? AND FC.IdFilial=?;
"""

SQL_PRODUTOS = """
SELECT P.Id codigo,P.Nome produto,A.Id id_agrupamento,A.Nome agrupamento,
 SUM(ISNULL(I.Quantidade,0)) quantidade,
 CAST(CASE WHEN SUM(ISNULL(I.Quantidade,0))<>0 THEN SUM(ISNULL(I.ValorTotal,0))/SUM(ISNULL(I.Quantidade,0)) ELSE 0 END AS decimal(19,4)) preco_medio,
 SUM(ISNULL(I.ValorTotal,0)) total_faturado
FROM dbo.DocumentoFiscal D JOIN dbo.ItemDocumentoFiscal I ON I.IdDocumentoFiscal=D.Id
JOIN dbo.Produto P ON P.Id=I.IdProduto LEFT JOIN dbo.Agrupamento A ON A.Id=P.IdAgrupamento
WHERE D.Data>=? AND D.Data<? AND D.IdFilial=? AND ISNULL(D.Cancelado,0)=0
 AND (? IS NULL OR P.Id=?) AND (? IS NULL OR A.Id=?)
GROUP BY P.Id,P.Nome,A.Id,A.Nome ORDER BY total_faturado DESC;
"""

SQL_VENDAS_ANALISE = """
WITH Itens AS (
 SELECT D.Id id_documento_fiscal,CONVERT(date,D.Data) data,P.Id codigo,P.Nome produto,
  A.Id id_agrupamento,A.Nome agrupamento,SUM(CAST(ISNULL(I.Quantidade,0) AS decimal(19,6))) quantidade,
  SUM(CAST(ISNULL(I.ValorTotal,0) AS decimal(19,4))) faturamento_produto
 FROM dbo.DocumentoFiscal D JOIN dbo.ItemDocumentoFiscal I ON I.IdDocumentoFiscal=D.Id
 JOIN dbo.Produto P ON P.Id=I.IdProduto LEFT JOIN dbo.Agrupamento A ON A.Id=P.IdAgrupamento
 WHERE D.Data>=? AND D.Data<? AND D.IdFilial=? AND ISNULL(D.Cancelado,0)=0
  AND (? IS NULL OR P.Id=? OR P.Nome LIKE ?) AND (? IS NULL OR A.Id=?)
 GROUP BY D.Id,CONVERT(date,D.Data),P.Id,P.Nome,A.Id,A.Nome
), Pagamentos AS (
 SELECT F.IdDocumentoFiscal id_documento_fiscal,FP.Id id_forma_pagamento,FP.Nome forma_pagamento,
  SUM(CAST(ISNULL(F.Valor,0)-ISNULL(F.ValorTroco,0) AS decimal(19,4))) valor_pagamento
 FROM dbo.FormaPagamentoCupomFiscal F JOIN dbo.FormaPagamento FP ON FP.Id=F.IdFormaPagamento
 WHERE (? IS NULL OR FP.Id=?) GROUP BY F.IdDocumentoFiscal,FP.Id,FP.Nome
), PagamentosComTotal AS (
 SELECT *,SUM(valor_pagamento) OVER(PARTITION BY id_documento_fiscal) total_pagamentos FROM Pagamentos
)
SELECT I.data,I.id_documento_fiscal,I.codigo,I.produto,I.id_agrupamento,I.agrupamento,
 CAST(I.quantidade*P.valor_pagamento/NULLIF(P.total_pagamentos,0) AS decimal(19,6)) quantidade_atribuida,
 CAST(CASE WHEN I.quantidade<>0 THEN I.faturamento_produto/I.quantidade ELSE 0 END AS decimal(19,4)) preco_medio,
 I.faturamento_produto,P.id_forma_pagamento,P.forma_pagamento,
 CAST(I.faturamento_produto*P.valor_pagamento/NULLIF(P.total_pagamentos,0) AS decimal(19,4)) valor_atribuido
FROM Itens I JOIN PagamentosComTotal P ON P.id_documento_fiscal=I.id_documento_fiscal
ORDER BY I.data,I.produto,P.forma_pagamento;
"""


class DataBlob(ctypes.Structure):
    _fields_ = [("cbData", wintypes.DWORD), ("pbData", ctypes.POINTER(ctypes.c_char))]


def protect_bytes(value: bytes) -> bytes:
    """Protege dados com DPAPI, vinculados ao usuário atual do Windows."""
    source = ctypes.create_string_buffer(value)
    source_blob = DataBlob(len(value), ctypes.cast(source, ctypes.POINTER(ctypes.c_char)))
    output_blob = DataBlob()
    if not ctypes.windll.crypt32.CryptProtectData(
        ctypes.byref(source_blob), "CheckDiario Raffinato", None, None, None, 0,
        ctypes.byref(output_blob),
    ):
        raise ctypes.WinError()
    try:
        return ctypes.string_at(output_blob.pbData, output_blob.cbData)
    finally:
        ctypes.windll.kernel32.LocalFree(output_blob.pbData)


def unprotect_bytes(value: bytes) -> bytes:
    source = ctypes.create_string_buffer(value)
    source_blob = DataBlob(len(value), ctypes.cast(source, ctypes.POINTER(ctypes.c_char)))
    output_blob = DataBlob()
    if not ctypes.windll.crypt32.CryptUnprotectData(
        ctypes.byref(source_blob), None, None, None, None, 0, ctypes.byref(output_blob),
    ):
        raise ctypes.WinError()
    try:
        return ctypes.string_at(output_blob.pbData, output_blob.cbData)
    finally:
        ctypes.windll.kernel32.LocalFree(output_blob.pbData)


def load_store_configs() -> dict[str, dict[str, Any]]:
    if not STORE_CONFIG_PATH.exists():
        return {}
    encrypted = base64.b64decode(STORE_CONFIG_PATH.read_bytes())
    return json.loads(unprotect_bytes(encrypted).decode("utf-8"))


def save_store_configs(configs: dict[str, dict[str, Any]]) -> None:
    raw = json.dumps(configs, ensure_ascii=False).encode("utf-8")
    STORE_CONFIG_PATH.write_bytes(base64.b64encode(protect_bytes(raw)))


def validate_store_id(value: Any) -> str:
    store_id = str(value or "").strip()
    if not store_id or len(store_id) > 80 or not all(char.isalnum() or char in "-_" for char in store_id):
        raise ValueError("Loja inválida.")
    return store_id


def config_from_body(body: dict[str, Any], base: dict[str, Any] | None = None) -> dict[str, Any]:
    base = base or {}
    config = {
        "server": str(body.get("server") or base.get("server") or "").strip(),
        "database": str(body.get("database") or base.get("database") or "").strip(),
        "uid": str(body.get("uid") or base.get("uid") or "").strip(),
        "pwd": str(body.get("pwd") or base.get("pwd") or ""),
        "driver": str(body.get("driver") or base.get("driver") or "{ODBC Driver 17 for SQL Server}").strip(),
        "empresa_id": str(body.get("empresa_id") or base.get("empresa_id") or "").strip(),
        "relay_token": str(body.get("relay_token") or base.get("relay_token") or "").strip(),
    }
    missing = [key for key in ("server", "database", "uid", "pwd") if not config[key]]
    if missing:
        raise ValueError(f"Preencha: {', '.join(missing)}.")
    if any(len(str(value)) > 256 for value in config.values()):
        raise ValueError("Um dos campos excede o tamanho permitido.")
    return config


def relay_post(payload: dict[str, Any], timeout: int = 30) -> dict[str, Any]:
    request = urllib.request.Request(
        RELAY_URL,
        data=json.dumps(payload, ensure_ascii=False).encode("utf-8"),
        headers={
            "Content-Type": "application/json",
            "apikey": SUPABASE_ANON_KEY,
            "Authorization": f"Bearer {SUPABASE_ANON_KEY}",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            return json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"Relay HTTP {exc.code}: {detail[:500]}") from exc


def sync_period(config: dict[str, Any], start: datetime, end: datetime) -> None:
    result = query_sangrias(config, start, end + timedelta(seconds=1), resolve_raffinato_filial(config, {}))
    relay_post({
        "action": "sync", "token": config["relay_token"],
        "inicio": start.strftime("%Y-%m-%d"), "fim": end.strftime("%Y-%m-%d"),
        "items": result["items"],
    }, timeout=45)


def relay_sync_loop(stop_event: threading.Event) -> None:
    full_synced: set[str] = set()
    while not stop_event.is_set():
        try:
            configs = load_store_configs()
        except Exception:
            logger.exception("Nao foi possivel carregar configuracoes para sincronizacao")
            stop_event.wait(30)
            continue
        for store_id, config in configs.items():
            if not config.get("relay_token") or not config.get("empresa_id"):
                continue
            try:
                now = datetime.now()
                if store_id not in full_synced:
                    cursor = (now - timedelta(days=366)).replace(hour=0, minute=0, second=0, microsecond=0)
                    while cursor.date() <= now.date() and not stop_event.is_set():
                        chunk_end = min(cursor + timedelta(days=30), now.replace(hour=23, minute=59, second=59, microsecond=0))
                        sync_period(config, cursor, chunk_end)
                        cursor = (chunk_end + timedelta(seconds=1)).replace(hour=0, minute=0, second=0, microsecond=0)
                    full_synced.add(store_id)
                else:
                    sync_period(config, (now - timedelta(days=1)).replace(hour=0, minute=0, second=0, microsecond=0), now.replace(hour=23, minute=59, second=59, microsecond=0))
                logger.info("Sincronizacao externa concluida para loja %s", store_id)
            except Exception:
                logger.exception("Falha na sincronizacao externa da loja %s", store_id)
        stop_event.wait(60)


def get_store_config(store_id: str) -> dict[str, Any]:
    config = load_store_configs().get(store_id)
    if config:
        return config
    # Compatibilidade inicial com a ferramenta antiga para a primeira loja.
    return load_config()


def test_connection(config: dict[str, Any]) -> dict[str, Any]:
    installed = list(pyodbc.drivers())
    driver_name = resolve_driver(config).strip("{}")
    steps = [{"key": "driver", "ok": driver_name in installed, "label": f"Driver ODBC: {driver_name}"}]
    if not steps[0]["ok"]:
        raise RuntimeError(f"Driver '{driver_name}' não instalado. Instale o Microsoft ODBC Driver 17 ou 18 for SQL Server.")
    started = datetime.now()
    with pyodbc.connect(connection_string(config)) as connection:
        cursor = connection.cursor()
        cursor.execute("SELECT DB_NAME() AS banco, @@SERVERNAME AS servidor")
        identity = cursor.fetchone()
        steps.extend([
            {"key": "vpn", "ok": True, "label": "Servidor alcançado pela rede/VPN"},
            {"key": "auth", "ok": True, "label": "Autenticação SQL aceita"},
            {"key": "database", "ok": True, "label": f"Banco selecionado: {identity.banco}"},
        ])
        cursor.execute("SELECT TOP 1 motivo, valortotal FROM DocumentoFiscal WHERE TipoComprovanteNaoFiscal = 1")
        cursor.fetchone()
        steps.append({"key": "read", "ok": True, "label": "Leitura de sangrias autorizada"})
    elapsed = max(1, round((datetime.now() - started).total_seconds() * 1000))
    return {"ok": True, "steps": steps, "latencia_ms": elapsed, "servidor": str(identity.servidor or config["server"]), "banco": str(identity.banco)}


def load_config() -> dict[str, Any]:
    if not CONFIG_PATH.exists():
        raise RuntimeError(
            f"Configuração não encontrada: {CONFIG_PATH}. "
            "Copie credentials.example.json para credentials.local.json e preencha os dados."
        )
    config = json.loads(CONFIG_PATH.read_text(encoding="utf-8"))
    required = ("server", "database", "uid", "pwd")
    missing = [key for key in required if not str(config.get(key, "")).strip()]
    if missing:
        raise RuntimeError(f"Campos obrigatórios ausentes: {', '.join(missing)}")
    if not config.get("allowed_origins"):
        config["allowed_origins"] = DEFAULT_ALLOWED_ORIGINS
    return config


def connection_string(config: dict[str, Any]) -> str:
    driver = resolve_driver(config)
    return (
        f"DRIVER={driver};SERVER={config['server']};DATABASE={config['database']};"
        f"UID={config['uid']};PWD={config['pwd']};Encrypt=no;TrustServerCertificate=yes;"
        "Connection Timeout=8;ApplicationIntent=ReadOnly;"
    )


def resolve_driver(config: dict[str, Any]) -> str:
    installed = list(pyodbc.drivers())
    requested = str(config.get("driver") or "{ODBC Driver 17 for SQL Server}").strip("{}")
    if requested in installed:
        return "{" + requested + "}"
    for candidate in ("ODBC Driver 18 for SQL Server", "ODBC Driver 17 for SQL Server"):
        if candidate in installed:
            return "{" + candidate + "}"
    return "{" + requested + "}"


def parse_datetime(value: Any, field: str) -> datetime:
    try:
        return datetime.fromisoformat(str(value))
    except (TypeError, ValueError) as exc:
        raise ValueError(f"{field} inválido.") from exc


def query_sangrias(config: dict[str, Any], start: datetime, end_exclusive: datetime, filial: int) -> dict[str, Any]:
    if end_exclusive <= start:
        raise ValueError("O fim do período deve ser posterior ao início.")
    if (end_exclusive - start).days > MAX_INTERVAL_DAYS:
        raise ValueError(f"O período máximo é de {MAX_INTERVAL_DAYS} dias.")

    with pyodbc.connect(connection_string(config)) as connection:
        cursor = connection.cursor()
        logger.info("SQL EXECUTADA: SQL_SANGRIAS | inicio=%s | fim_exclusivo=%s | id_filial=%s", start.isoformat(), end_exclusive.isoformat(), filial)
        cursor.execute(SQL_SANGRIAS, start, end_exclusive, filial)
        rows = cursor.fetchall()

    items: list[dict[str, Any]] = []
    total = Decimal("0")
    total_sangrias = Decimal("0")
    total_retiradas = Decimal("0")
    for row in rows:
        value = Decimal(str(row.valortotal or 0))
        total += value
        tipo = int(row.TipoComprovanteNaoFiscal)
        if tipo == 4:
            total_retiradas += value
        else:
            total_sangrias += value
        items.append({
            "id": str(row.Id),
            "id_filial": str(row.IdFilial or ""),
            "id_usuario": str(row.IdUsuario or ""),
            "id_usuario_autorizador": str(row.IdUsuarioAutorizadorSangria or ""),
            "motivo": str(row.motivo or "Sem motivo"),
            "valor": float(value),
            "hora": row.hora_formatada,
            "data": row.data_formatada,
            "data_hora": row.DataHora.isoformat(),
            "tipo_comprovante_nao_fiscal": tipo,
            "tipo_movimento": str(row.TipoMovimento),
            "finalidade": str(row.Finalidade),
        })
    return {
        "items": items, "total": float(total), "quantidade": len(items),
        "total_sangrias": float(total_sangrias),
        "quantidade_sangrias": sum(1 for item in items if item["tipo_comprovante_nao_fiscal"] == 1),
        "total_retiradas": float(total_retiradas),
        "quantidade_retiradas": sum(1 for item in items if item["tipo_comprovante_nao_fiscal"] == 4),
    }


def decimal_json(value: Any) -> Any:
    if isinstance(value, Decimal):
        return float(value)
    if isinstance(value, (datetime, date)):
        return value.isoformat()
    return value


def rows_as_dicts(cursor: Any) -> list[dict[str, Any]]:
    columns = [str(column[0]).lower() for column in cursor.description]
    return [{key: decimal_json(value) for key, value in zip(columns, row)} for row in cursor.fetchall()]


def resolve_raffinato_filial(config: dict[str, Any], body: dict[str, Any]) -> int:
    value = body.get("id_filial") or config.get("id_filial") or 1
    filial = int(value)
    if filial <= 0:
        raise ValueError("Filial Raffinato inválida.")
    return filial


def query_formas_pagamento(config: dict[str, Any]) -> dict[str, Any]:
    with pyodbc.connect(connection_string(config)) as connection:
        cursor = connection.cursor(); cursor.execute(SQL_FORMAS_PAGAMENTO)
        return {"formas": rows_as_dicts(cursor)}


def query_faturamento(config: dict[str, Any], body: dict[str, Any]) -> dict[str, Any]:
    start = parse_datetime(body.get("inicio"), "Início")
    end = parse_datetime(body.get("fim_exclusivo"), "Fim exclusivo")
    filial = resolve_raffinato_filial(config, body)
    payment = int(body["id_forma_pagamento"]) if body.get("id_forma_pagamento") else None
    with pyodbc.connect(connection_string(config)) as connection:
        logger.info("SQL EXECUTADA: SQL_FATURAMENTO | inicio=%s | fim_exclusivo=%s | id_filial=%s | forma=%s", start.isoformat(), end.isoformat(), filial, payment)
        cursor = connection.cursor(); cursor.execute(SQL_FATURAMENTO, start, end, filial, payment, payment)
        rows = rows_as_dicts(cursor)
        logger.info("SQL EXECUTADA: SQL_FATURAMENTO_TOTALIZADOR | inicio=%s | fim_exclusivo=%s | id_filial=%s", start.isoformat(), end.isoformat(), filial)
        cursor.execute(SQL_FATURAMENTO_TOTALIZADOR, start, end, filial)
        total_row = rows_as_dicts(cursor)[0]
        totals = {
            "valor_movimento": float(total_row.get("total_valor_movimento") or 0),
            "valor_abertura": float(total_row.get("total_abertura") or 0),
            "valor_suprimento": float(total_row.get("total_suprimento") or 0),
            "valor_sangria": float(total_row.get("total_sangria") or 0),
            "valor_apurado": float(total_row.get("total_apurado") or 0),
            "valor_confirmado": float(total_row.get("total_confirmado") or 0),
        }
        logger.info("SQL EXECUTADA: SQL_FATURAMENTO_EVOLUCAO | inicio=%s | fim_exclusivo=%s | id_filial=%s | forma=%s", start.isoformat(), end.isoformat(), filial, payment)
        cursor.execute(SQL_FATURAMENTO_EVOLUCAO, start, end, filial, payment, payment)
        evolution = rows_as_dicts(cursor)
    return {"formas_pagamento": rows, "totalizadores": totals, "evolucao": evolution}


def query_produtos(config: dict[str, Any], body: dict[str, Any]) -> dict[str, Any]:
    start = parse_datetime(body.get("inicio"), "Início"); end = parse_datetime(body.get("fim_exclusivo"), "Fim exclusivo")
    filial = resolve_raffinato_filial(config, body); product = int(body["id_produto"]) if body.get("id_produto") else None; group = int(body["id_agrupamento"]) if body.get("id_agrupamento") else None
    with pyodbc.connect(connection_string(config)) as connection:
        cursor=connection.cursor(); cursor.execute(SQL_PRODUTOS,start,end,filial,product,product,group,group)
        return {"items":rows_as_dicts(cursor)}


def query_vendas_analise(config: dict[str, Any], body: dict[str, Any]) -> dict[str, Any]:
    start=parse_datetime(body.get("inicio"),"Início"); end=parse_datetime(body.get("fim_exclusivo"),"Fim exclusivo")
    filial=resolve_raffinato_filial(config,body); product_text=str(body.get("produto") or body.get("id_produto") or "").strip(); product=int(product_text) if product_text.isdigit() else None; product_filter=product_text or None; product_like=f"%{product_text}%" if product_text else None; group=int(body["id_agrupamento"]) if body.get("id_agrupamento") else None; payment=int(body["id_forma_pagamento"]) if body.get("id_forma_pagamento") else None
    with pyodbc.connect(connection_string(config)) as connection:
        cursor=connection.cursor(); cursor.execute(SQL_VENDAS_ANALISE,start,end,filial,product_filter,product,product_like,group,group,payment,payment)
        items=rows_as_dicts(cursor)
    return {"items":items,"rateio":"proporcional_decimal","filial":filial}


class Handler(BaseHTTPRequestHandler):
    server_version = "CheckDiarioRaffinato/1.6"

    def route_path(self) -> str:
        path = urlparse(self.path).path.rstrip("/")
        return path or "/"

    def log_message(self, fmt: str, *args: Any) -> None:
        logger.info("%s %s", self.address_string(), fmt % args)

    def allowed_origin(self) -> str | None:
        origin = self.headers.get("Origin", "")
        allowed = set(self.server.config.get("allowed_origins") or [])  # type: ignore[attr-defined]
        if origin in allowed:
            return origin
        try:
            parsed = urlparse(origin)
            hostname = (parsed.hostname or "").lower()
            if parsed.scheme == "https" and (hostname == "checkdiario.com.br" or hostname.endswith(".checkdiario.com.br")):
                return origin
        except ValueError:
            pass
        return None

    def send_cors_headers(self) -> None:
        origin = self.allowed_origin()
        if origin:
            self.send_header("Access-Control-Allow-Origin", origin)
            self.send_header("Vary", "Origin")
            # Necessário para uma página HTTPS acessar o loopback do computador.
            self.send_header("Access-Control-Allow-Private-Network", "true")

    def send_json(self, status: int, payload: dict[str, Any]) -> None:
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_cors_headers()
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def reject_origin(self) -> bool:
        if self.headers.get("Origin") and not self.allowed_origin():
            self.send_json(403, {"error": "Origem não autorizada."})
            return True
        return False

    def do_OPTIONS(self) -> None:  # noqa: N802
        if self.reject_origin():
            return
        self.send_response(204)
        self.send_cors_headers()
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Max-Age", "600")
        self.end_headers()

    def do_GET(self) -> None:  # noqa: N802
        if self.reject_origin():
            return
        if self.route_path() == "/health":
            self.send_json(200, {"ok": True, "service": "raffinato-bridge", "version": CONNECTOR_VERSION, "port": 8766, "tray": True, "external_sync": True})
            return
        self.send_json(404, {"error": "Rota não encontrada."})

    def do_POST(self) -> None:  # noqa: N802
        if self.reject_origin():
            return
        allowed_paths = {
            "/api/sangrias",
            "/api/raffinato/formas-pagamento",
            "/api/raffinato/faturamento",
            "/api/raffinato/produtos",
            "/api/raffinato/vendas-analise",
            "/api/integracoes/raffinato/testar",
            "/api/integracoes/raffinato/salvar",
            "/api/integracoes/raffinato/excluir",
            "/api/integracoes/raffinato/parear",
        }
        route = self.route_path()
        if route not in allowed_paths:
            self.send_json(404, {"error": "Rota não encontrada."})
            return
        try:
            length = int(self.headers.get("Content-Length", "0"))
            if length <= 0 or length > MAX_BODY_BYTES:
                raise ValueError("Requisição inválida.")
            body = json.loads(self.rfile.read(length).decode("utf-8"))
            logger.info(
                "ROTA RECEBIDA: %s | VERSAO DO CONECTOR: %s | IDFILIAL RECEBIDO: %s | DATA INICIAL RECEBIDA: %s | DATA FINAL RECEBIDA: %s",
                route, CONNECTOR_VERSION, body.get("id_filial"), body.get("inicio"), body.get("fim_exclusivo") or body.get("fim"),
            )
            if route == "/api/integracoes/raffinato/testar":
                store_id = validate_store_id(body.get("loja_id"))
                saved = load_store_configs().get(store_id, {})
                result = test_connection(config_from_body(body, saved))
                self.send_json(200, result)
                return
            if route == "/api/integracoes/raffinato/salvar":
                store_id = validate_store_id(body.get("loja_id"))
                saved = load_store_configs().get(store_id, {})
                config = config_from_body(body, saved)
                result = test_connection(config)
                configs = load_store_configs()
                configs[store_id] = config
                save_store_configs(configs)
                result["referencia_segredo"] = f"dpapi:{store_id}"
                self.send_json(200, result)
                return
            if route == "/api/integracoes/raffinato/excluir":
                store_id = validate_store_id(body.get("loja_id"))
                configs = load_store_configs()
                configs.pop(store_id, None)
                save_store_configs(configs)
                self.send_json(200, {"ok": True})
                return
            if route == "/api/integracoes/raffinato/parear":
                store_id = validate_store_id(body.get("loja_id"))
                configs = load_store_configs()
                config = configs.get(store_id) or get_store_config(store_id)
                token = str(body.get("relay_token") or "").strip()
                empresa_id = str(body.get("empresa_id") or "").strip()
                if len(token) < 40 or not empresa_id:
                    raise ValueError("Pareamento remoto invalido.")
                config["relay_token"] = token
                config["empresa_id"] = empresa_id
                configs[store_id] = config
                save_store_configs(configs)
                self.send_json(200, {"ok": True})
                return
            if route.startswith("/api/raffinato/"):
                store_id = validate_store_id(body.get("loja_id"))
                config = get_store_config(store_id)
                if route == "/api/raffinato/formas-pagamento":
                    result = query_formas_pagamento(config)
                elif route == "/api/raffinato/faturamento":
                    result = query_faturamento(config, body)
                elif route == "/api/raffinato/produtos":
                    result = query_produtos(config, body)
                else:
                    result = query_vendas_analise(config, body)
                self.send_json(200, result)
                return
            start = parse_datetime(body.get("inicio"), "Início")
            raw_end_exclusive = body.get("fim_exclusivo")
            end = parse_datetime(raw_end_exclusive or body.get("fim"), "Fim")
            if not raw_end_exclusive:
                end += timedelta(seconds=1)
            store_id = validate_store_id(body.get("loja_id"))
            config = get_store_config(store_id)
            filial = resolve_raffinato_filial(config, body)
            result = query_sangrias(config, start, end, filial)
            self.send_json(200, result)
        except (ValueError, json.JSONDecodeError) as exc:
            self.send_json(400, {"error": str(exc)})
        except pyodbc.Error as exc:
            logger.exception("Falha de conexão/consulta ao Raffinato")
            self.send_json(503, {"error": f"Erro SQL Raffinato: {exc}"})
        except Exception as exc:
            logger.exception("Falha inesperada")
            self.send_json(500, {"error": f"Falha interna no conector Raffinato: {type(exc).__name__}: {exc}"})


def show_windows_message(title: str, message: str, error: bool = False) -> None:
    flags = 0x10 if error else 0x40
    ctypes.windll.user32.MessageBoxW(None, message, title, flags)


def acquire_single_instance() -> bool:
    """Impede mais de um conector por sessão do Windows."""
    global MUTEX_HANDLE
    MUTEX_HANDLE = ctypes.windll.kernel32.CreateMutexW(None, False, "Local\\CheckDiarioRaffinatoConnector")
    if not MUTEX_HANDLE:
        show_windows_message("Conector Raffinato", "Não foi possível criar o controle de instância.", True)
        return False
    if ctypes.windll.kernel32.GetLastError() == 183:
        show_windows_message("Conector Raffinato", "O conector já está em execução na bandeja do Windows.")
        ctypes.windll.kernel32.CloseHandle(MUTEX_HANDLE)
        MUTEX_HANDLE = None
        return False
    return True


def create_tray_image():
    from PIL import Image, ImageDraw
    image = Image.new("RGBA", (64, 64), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)
    draw.rounded_rectangle((4, 4, 60, 60), radius=16, fill=(249, 115, 22, 255))
    draw.text((18, 21), "SR", fill="white", stroke_width=1)
    return image


def run_tray(server: ThreadingHTTPServer) -> None:
    import pystray

    def show_status(icon, _item):
        icon.notify(f"Ativo em 127.0.0.1:{PORT} · versão {CONNECTOR_VERSION}", "Conector Raffinato")

    def open_checkdiario(_icon, _item):
        webbrowser.open("https://checkdiario.com.br")

    def open_diagnostic(_icon, _item):
        webbrowser.open(f"http://127.0.0.1:{PORT}/health")

    def exit_connector(icon, _item):
        server.shutdown()
        icon.stop()

    menu = pystray.Menu(
        pystray.MenuItem("Conector ativo", show_status, default=True),
        pystray.MenuItem("Abrir CheckDiário", open_checkdiario),
        pystray.MenuItem("Ver diagnóstico", open_diagnostic),
        pystray.Menu.SEPARATOR,
        pystray.MenuItem("Encerrar conector", exit_connector),
    )
    icon = pystray.Icon("checkdiario-raffinato", create_tray_image(), "Conector Raffinato · Ativo", menu)
    icon.run()


def main() -> int:
    if not acquire_single_instance():
        return 0
    config = {"allowed_origins": DEFAULT_ALLOWED_ORIGINS}
    try:
        server = ThreadingHTTPServer((HOST, PORT), Handler)
    except OSError as exc:
        logger.exception("Não foi possível iniciar o conector")
        show_windows_message("Conector Raffinato", f"Não foi possível usar a porta {PORT}.\n\n{exc}", True)
        return 1
    server.config = config  # type: ignore[attr-defined]
    server_thread = threading.Thread(target=server.serve_forever, name="raffinato-http", daemon=True)
    server_thread.start()
    sync_stop_event = threading.Event()
    sync_thread = threading.Thread(target=relay_sync_loop, args=(sync_stop_event,), name="raffinato-relay", daemon=True)
    sync_thread.start()
    try:
        run_tray(server)
    except KeyboardInterrupt:
        server.shutdown()
    except Exception as exc:
        logger.exception("Falha na bandeja do Windows")
        show_windows_message("Conector Raffinato", f"Falha ao iniciar o ícone da bandeja.\n\n{exc}", True)
        server.shutdown()
        return 1
    finally:
        sync_stop_event.set()
        server.server_close()
        if MUTEX_HANDLE:
            ctypes.windll.kernel32.CloseHandle(MUTEX_HANDLE)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
