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
import sqlite3
import threading
import time
import webbrowser
from contextlib import closing
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
CONNECTOR_VERSION = "1.6.21"
CACHE_SCHEMA_VERSION = 2
MAX_BODY_BYTES = 16_384
MAX_INTERVAL_DAYS = 366
STORE_CONFIG_PATH = BASE_DIR / "integracoes-raffinato.dat"
CACHE_PATH = BASE_DIR / "raffinato-relatorios-cache.sqlite3"
CACHE_SYNC_LOCK = threading.Lock()
CACHE_REFRESH_EVENT = threading.Event()
CACHE_REQUEST_LOCK = threading.Lock()
CACHE_REQUESTS: dict[str, set[date]] = {}
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
SET NOCOUNT ON;
DROP TABLE IF EXISTS #IdsDia;
SELECT DF.Id INTO #IdsDia
FROM dbo.DocumentoFiscal DF WITH (NOLOCK)
WHERE DF.Data >= ? AND DF.Data < ?;
CREATE UNIQUE CLUSTERED INDEX IX_IdsDia ON #IdsDia (Id);
SELECT DF.Id,DF.IdFilial,DF.Data,CONVERT(TIME(0),DF.Hora) AS Hora,
 CASE WHEN DF.TipoComprovanteNaoFiscal=1 THEN 'SANGRIA' WHEN DF.TipoComprovanteNaoFiscal=4 THEN 'RETIRADA' END AS TipoMovimento,
 DF.TipoComprovanteNaoFiscal,DF.Motivo,DF.ValorTotal,DF.IdUsuario,DF.IdUsuarioAutorizadorSangria
FROM #IdsDia X
JOIN dbo.DocumentoFiscal DF WITH (NOLOCK) ON DF.Id=X.Id
WHERE DF.IdFilial=? AND DF.Tipo='CN' AND DF.TipoComprovanteNaoFiscal IN (1,4)
 AND ISNULL(DF.Cancelado,0)=0 AND DF.IdUsuarioAutorizadorSangria IS NOT NULL
ORDER BY DF.Data,DF.Hora;
DROP TABLE IF EXISTS #IdsDia;
"""

SQL_FORMAS_PAGAMENTO = "SELECT Id AS id,LTRIM(RTRIM(Nome)) AS nome FROM dbo.FormaPagamento WITH(NOLOCK) WHERE ISNULL(LTRIM(RTRIM(Nome)),'')<>'' ORDER BY Nome;"
SQL_AGRUPAMENTOS = "SELECT Id AS id,LTRIM(RTRIM(Nome)) AS nome FROM dbo.Agrupamento WITH(NOLOCK) WHERE ISNULL(LTRIM(RTRIM(Nome)),'')<>'' ORDER BY Nome;"
SQL_PRODUTOS_CATALOGO = """
SELECT P.Id AS id,LTRIM(RTRIM(P.Nome)) AS nome,P.IdAgrupamento AS id_agrupamento,
 LTRIM(RTRIM(A.Nome)) AS agrupamento
FROM dbo.Produto P WITH(NOLOCK)
LEFT JOIN dbo.Agrupamento A WITH(NOLOCK) ON A.Id=P.IdAgrupamento
WHERE ISNULL(LTRIM(RTRIM(P.Nome)),'')<>''
ORDER BY P.Nome;
"""

SQL_FATURAMENTO = """
SET NOCOUNT ON;
DROP TABLE IF EXISTS #FechamentosPeriodo;
SELECT FC.Id INTO #FechamentosPeriodo
FROM dbo.FechamentoCaixa FC WITH (NOLOCK)
WHERE FC.Data>=? AND FC.Data<? AND FC.IdFilial=?;
CREATE UNIQUE CLUSTERED INDEX IX_FechamentosPeriodo ON #FechamentosPeriodo(Id);
SELECT FP.Id AS id_forma_pagamento, FP.Nome AS forma_pagamento,
 SUM(ISNULL(FCFP.ValorMovimento,0)) valor_movimento, SUM(ISNULL(FCFP.ValorAbertura,0)) valor_abertura,
 SUM(ISNULL(FCFP.ValorSuprimento,0)) valor_suprimento, SUM(ISNULL(FCFP.ValorSangria,0)) valor_sangria,
 SUM(ISNULL(FCFP.ValorApurado,0)) valor_apurado, SUM(ISNULL(FCFP.ValorConfirmado,0)) valor_confirmado
FROM #FechamentosPeriodo X
JOIN dbo.FechamentoCaixaFormaPagamento FCFP WITH (NOLOCK) ON FCFP.IdFechamentoCaixa=X.Id
JOIN dbo.FormaPagamento FP WITH (NOLOCK) ON FP.Id=FCFP.IdFormaPagamento
WHERE (? IS NULL OR FP.Id=?)
GROUP BY FP.Id,FP.Nome ORDER BY FP.Nome;
DROP TABLE IF EXISTS #FechamentosPeriodo;
"""

SQL_FATURAMENTO_EVOLUCAO = """
SET NOCOUNT ON;
DROP TABLE IF EXISTS #FechamentosPeriodo;
SELECT FC.Id,CONVERT(date,FC.Data) AS Data INTO #FechamentosPeriodo
FROM dbo.FechamentoCaixa FC WITH (NOLOCK)
WHERE FC.Data>=? AND FC.Data<? AND FC.IdFilial=?;
CREATE UNIQUE CLUSTERED INDEX IX_FechamentosPeriodo ON #FechamentosPeriodo(Id);
SELECT CONVERT(date,FC.Data) data,FP.Id id_forma_pagamento,FP.Nome forma_pagamento,
 SUM(ISNULL(FCFP.ValorMovimento,0)) valor_movimento
FROM #FechamentosPeriodo FC
JOIN dbo.FechamentoCaixaFormaPagamento FCFP WITH (NOLOCK) ON FCFP.IdFechamentoCaixa=FC.Id
JOIN dbo.FormaPagamento FP WITH (NOLOCK) ON FP.Id=FCFP.IdFormaPagamento
WHERE (? IS NULL OR FP.Id=?)
GROUP BY FC.Data,FP.Id,FP.Nome ORDER BY data,FP.Nome;
DROP TABLE IF EXISTS #FechamentosPeriodo;
"""

SQL_FATURAMENTO_DIARIO = """
SET NOCOUNT ON;
DROP TABLE IF EXISTS #IdsFaturamento;
SELECT DF.Id,CONVERT(date,DF.Data) data INTO #IdsFaturamento
FROM dbo.DocumentoFiscal DF WITH(NOLOCK)
WHERE DF.Data>=? AND DF.Data<? AND DF.IdFilial=? AND ISNULL(DF.Cancelado,0)=0;
CREATE UNIQUE CLUSTERED INDEX IX_IdsFaturamento ON #IdsFaturamento(Id);
SELECT X.data,FP.Id id_forma_pagamento,FP.Nome forma_pagamento,
 SUM(ISNULL(FPCF.Valor,0)-ISNULL(FPCF.ValorTroco,0)) valor_movimento
FROM #IdsFaturamento X
JOIN dbo.FormaPagamentoCupomFiscal FPCF WITH(NOLOCK) ON FPCF.IdDocumentoFiscal=X.Id
JOIN dbo.FormaPagamento FP WITH(NOLOCK) ON FP.Id=FPCF.IdFormaPagamento
GROUP BY X.data,FP.Id,FP.Nome ORDER BY X.data,FP.Nome;
SELECT CONVERT(date,FC.Data) data,FP.Id id_forma_pagamento,FP.Nome forma_pagamento,
 SUM(ISNULL(FCFP.ValorAbertura,0)) valor_abertura,SUM(ISNULL(FCFP.ValorSuprimento,0)) valor_suprimento,
 SUM(ISNULL(FCFP.ValorSangria,0)) valor_sangria,SUM(ISNULL(FCFP.ValorApurado,0)) valor_apurado,
 SUM(ISNULL(FCFP.ValorConfirmado,0)) valor_confirmado
FROM dbo.FechamentoCaixa FC WITH(NOLOCK)
JOIN dbo.FechamentoCaixaFormaPagamento FCFP WITH(NOLOCK) ON FCFP.IdFechamentoCaixa=FC.Id
JOIN dbo.FormaPagamento FP WITH(NOLOCK) ON FP.Id=FCFP.IdFormaPagamento
WHERE FC.Data>=? AND FC.Data<? AND FC.IdFilial=?
GROUP BY CONVERT(date,FC.Data),FP.Id,FP.Nome ORDER BY data,FP.Nome;
SELECT CONVERT(date,A.Data) data,SUM(ISNULL(A.ValorTroco,0)) valor_abertura,
 CASE WHEN ISNULL((SELECT SUM(ISNULL(DS.ValorTotal,0)) FROM dbo.DocumentoFiscal DS WITH(NOLOCK)
   WHERE DS.Data>=CONVERT(date,A.Data) AND DS.Data<DATEADD(day,1,CONVERT(date,A.Data)) AND DS.IdFilial=?
   AND DS.Tipo='CN' AND DS.TipoComprovanteNaoFiscal=2 AND ISNULL(DS.Cancelado,0)=0),0)>SUM(ISNULL(A.ValorTroco,0))
 THEN ISNULL((SELECT SUM(ISNULL(DS.ValorTotal,0)) FROM dbo.DocumentoFiscal DS WITH(NOLOCK)
   WHERE DS.Data>=CONVERT(date,A.Data) AND DS.Data<DATEADD(day,1,CONVERT(date,A.Data)) AND DS.IdFilial=?
   AND DS.Tipo='CN' AND DS.TipoComprovanteNaoFiscal=2 AND ISNULL(DS.Cancelado,0)=0),0)-SUM(ISNULL(A.ValorTroco,0)) ELSE 0 END valor_suprimento,
 ISNULL((SELECT SUM(CASE WHEN DF.TipoComprovanteNaoFiscal=1 THEN ISNULL(DF.ValorTotal,0) ELSE 0 END)
   FROM dbo.DocumentoFiscal DF WITH(NOLOCK) WHERE DF.Data>=CONVERT(date,A.Data) AND DF.Data<DATEADD(day,1,CONVERT(date,A.Data))
   AND DF.IdFilial=? AND DF.Tipo='CN' AND DF.TipoComprovanteNaoFiscal IN(1,4) AND ISNULL(DF.Cancelado,0)=0
   AND DF.IdUsuarioAutorizadorSangria IS NOT NULL),0) valor_sangria,
 ISNULL((SELECT SUM(CASE WHEN DF.TipoComprovanteNaoFiscal=4 THEN ISNULL(DF.ValorTotal,0) ELSE 0 END)
   FROM dbo.DocumentoFiscal DF WITH(NOLOCK) WHERE DF.Data>=CONVERT(date,A.Data) AND DF.Data<DATEADD(day,1,CONVERT(date,A.Data))
   AND DF.IdFilial=? AND DF.Tipo='CN' AND DF.TipoComprovanteNaoFiscal IN(1,4) AND ISNULL(DF.Cancelado,0)=0
   AND DF.IdUsuarioAutorizadorSangria IS NOT NULL),0) valor_retirada,
 ISNULL((SELECT SUM(ISNULL(F.Valor,0)-ISNULL(F.ValorTroco,0)) FROM dbo.FormaPagamentoCupomFiscal F WITH(NOLOCK)
   JOIN dbo.DocumentoFiscal D WITH(NOLOCK) ON D.Id=F.IdDocumentoFiscal
   WHERE F.IdAberturaCaixa IN(SELECT AO.Id FROM dbo.AberturaCaixa AO WITH(NOLOCK) WHERE AO.Data=CONVERT(date,A.Data) AND AO.IdFilial=? AND AO.IdFechamentoCaixa IS NULL)
   AND ISNULL(D.Cancelado,0)=0),0) movimento_aberto
FROM dbo.AberturaCaixa A WITH(NOLOCK)
WHERE A.Data>=? AND A.Data<? AND A.IdFilial=? AND A.IdFechamentoCaixa IS NULL
GROUP BY CONVERT(date,A.Data);
SELECT CONVERT(date,DF.Data) data,SUM(ISNULL(DF.ValorTotal,0)) valor_retirada
FROM dbo.DocumentoFiscal DF WITH(NOLOCK)
WHERE DF.Data>=? AND DF.Data<? AND DF.IdFilial=? AND DF.Tipo='CN' AND DF.TipoComprovanteNaoFiscal=4
 AND ISNULL(DF.Cancelado,0)=0 AND DF.IdUsuarioAutorizadorSangria IS NOT NULL
GROUP BY CONVERT(date,DF.Data);
DROP TABLE IF EXISTS #IdsFaturamento;
"""

SQL_PRODUTOS = """
SET NOCOUNT ON;
DROP TABLE IF EXISTS #IdsVendas;
SELECT D.Id,CONVERT(date,D.Data) AS Data,D.Hora,D.EhContingencia,
 CAST(ISNULL((SELECT SUM(ISNULL(FX.Valor,0)-ISNULL(FX.ValorTroco,0)) FROM dbo.FormaPagamentoCupomFiscal FX WITH(NOLOCK) WHERE FX.IdDocumentoFiscal=D.Id AND (? IS NULL OR FX.IdFormaPagamento=?)),0) AS decimal(19,4)) valor_documento,
 CAST(CASE WHEN ? IS NULL THEN 1 ELSE
   ISNULL((SELECT SUM(ISNULL(FR.Valor,0)-ISNULL(FR.ValorTroco,0)) FROM dbo.FormaPagamentoCupomFiscal FR WITH(NOLOCK) WHERE FR.IdDocumentoFiscal=D.Id AND FR.IdFormaPagamento=?),0)
   /NULLIF((SELECT SUM(ISNULL(FT.Valor,0)-ISNULL(FT.ValorTroco,0)) FROM dbo.FormaPagamentoCupomFiscal FT WITH(NOLOCK) WHERE FT.IdDocumentoFiscal=D.Id),0) END AS decimal(19,8)) fator_pagamento,
 CASE WHEN EXISTS(SELECT 1 FROM dbo.ItemDocumentoFiscal IX WITH(NOLOCK) WHERE IX.IdDocumentoFiscal=D.Id) THEN 1 ELSE 0 END tem_item
INTO #IdsVendas FROM dbo.DocumentoFiscal D WITH (NOLOCK)
WHERE D.Data>=? AND D.Data<? AND D.IdFilial=? AND ISNULL(D.Cancelado,0)=0
 AND EXISTS(SELECT 1 FROM dbo.FormaPagamentoCupomFiscal FE WITH(NOLOCK) WHERE FE.IdDocumentoFiscal=D.Id AND (? IS NULL OR FE.IdFormaPagamento=?))
 AND DATEADD(SECOND,DATEDIFF(SECOND,CAST('00:00:00' AS time),CAST(D.Hora AS time)),CAST(CONVERT(date,D.Data) AS datetime2))>=?
 AND DATEADD(SECOND,DATEDIFF(SECOND,CAST('00:00:00' AS time),CAST(D.Hora AS time)),CAST(CONVERT(date,D.Data) AS datetime2))<?;
CREATE UNIQUE CLUSTERED INDEX IX_IdsVendas ON #IdsVendas(Id);
SELECT P.Id codigo,P.Nome produto,A.Id id_agrupamento,A.Nome agrupamento,
 SUM(ISNULL(I.Quantidade,0)*X.fator_pagamento) quantidade,
 CAST(CASE WHEN SUM(ISNULL(I.Quantidade,0))<>0 THEN SUM(ISNULL(I.ValorTotal,0))/SUM(ISNULL(I.Quantidade,0)) ELSE 0 END AS decimal(19,4)) preco_medio,
 SUM(ISNULL(I.ValorTotal,0)*X.fator_pagamento) total_faturado
FROM #IdsVendas X JOIN dbo.ItemDocumentoFiscal I WITH (NOLOCK) ON I.IdDocumentoFiscal=X.Id
JOIN dbo.Produto P WITH (NOLOCK) ON P.Id=I.IdProduto LEFT JOIN dbo.Agrupamento A WITH (NOLOCK) ON A.Id=P.IdAgrupamento
WHERE (? IS NULL OR P.Id=? OR P.Nome LIKE ?) AND (? IS NULL OR A.Id=?)
GROUP BY P.Id,P.Nome,A.Id,A.Nome ORDER BY total_faturado DESC;
SELECT X.Data data,SUM(ISNULL(I.ValorTotal,0)*X.fator_pagamento) total_faturado,SUM(ISNULL(I.Quantidade,0)*X.fator_pagamento) quantidade
FROM #IdsVendas X JOIN dbo.ItemDocumentoFiscal I WITH (NOLOCK) ON I.IdDocumentoFiscal=X.Id
GROUP BY X.Data ORDER BY data;
SELECT X.Id id_documento_fiscal,X.Data data,X.Hora hora,X.EhContingencia,X.valor_documento,
 FP.Id id_forma_pagamento,FP.Nome forma_pagamento,
 SUM(CAST(ISNULL(F.Valor,0)-ISNULL(F.ValorTroco,0) AS decimal(19,4))) valor
FROM #IdsVendas X
JOIN dbo.FormaPagamentoCupomFiscal F WITH(NOLOCK) ON F.IdDocumentoFiscal=X.Id
JOIN dbo.FormaPagamento FP WITH(NOLOCK) ON FP.Id=F.IdFormaPagamento
WHERE ISNULL(X.EhContingencia,0)=1 AND (? IS NULL OR F.IdFormaPagamento=?)
GROUP BY X.Id,X.Data,X.Hora,X.EhContingencia,X.valor_documento,FP.Id,FP.Nome
ORDER BY X.Data,X.Hora,X.Id,FP.Nome;
SELECT
 SUM(CASE WHEN X.tem_item=1 THEN X.valor_documento ELSE 0 END) total_documentos_produtos,
 SUM(CASE WHEN ISNULL(X.EhContingencia,0)=1 THEN X.valor_documento ELSE 0 END) total_contingencia,
 SUM(X.valor_documento) total_financeiro,
 SUM(CASE WHEN X.tem_item=0 AND ISNULL(X.EhContingencia,0)=0 THEN X.valor_documento ELSE 0 END) diferenca_nao_explicada,
 COUNT(*) documentos_financeiro,
 SUM(CASE WHEN X.tem_item=1 THEN 1 ELSE 0 END) documentos_produtos,
 SUM(CASE WHEN ISNULL(X.EhContingencia,0)=1 THEN 1 ELSE 0 END) documentos_contingencia
FROM #IdsVendas X;
DROP TABLE IF EXISTS #IdsVendas;
"""

SQL_MOVIMENTO_FATURAMENTO_PERIODO = """
SET NOCOUNT ON;
SELECT CONVERT(date,D.Data) data,FP.Id id_forma_pagamento,FP.Nome forma_pagamento,
 SUM(CAST(ISNULL(F.Valor,0)-ISNULL(F.ValorTroco,0) AS decimal(19,4))) valor_movimento,
 COUNT(DISTINCT D.Id) quantidade_documentos,
 MIN(DATEADD(SECOND,DATEDIFF(SECOND,CAST('00:00:00' AS time),CAST(D.Hora AS time)),CAST(CONVERT(date,D.Data) AS datetime2))) primeiro_documento,
 MAX(DATEADD(SECOND,DATEDIFF(SECOND,CAST('00:00:00' AS time),CAST(D.Hora AS time)),CAST(CONVERT(date,D.Data) AS datetime2))) ultimo_documento
FROM dbo.DocumentoFiscal D WITH(NOLOCK)
JOIN dbo.FormaPagamentoCupomFiscal F WITH(NOLOCK) ON F.IdDocumentoFiscal=D.Id
JOIN dbo.FormaPagamento FP WITH(NOLOCK) ON FP.Id=F.IdFormaPagamento
WHERE D.Data>=? AND D.Data<? AND D.IdFilial=? AND ISNULL(D.Cancelado,0)=0
 AND DATEADD(SECOND,DATEDIFF(SECOND,CAST('00:00:00' AS time),CAST(D.Hora AS time)),CAST(CONVERT(date,D.Data) AS datetime2))>=?
 AND DATEADD(SECOND,DATEDIFF(SECOND,CAST('00:00:00' AS time),CAST(D.Hora AS time)),CAST(CONVERT(date,D.Data) AS datetime2))<?
 AND (? IS NULL OR FP.Id=?)
GROUP BY CONVERT(date,D.Data),FP.Id,FP.Nome
ORDER BY data,FP.Nome;
"""

SQL_CONTAGEM_DOCUMENTOS_PERIODO = """
SELECT COUNT(DISTINCT D.Id) quantidade_documentos,
 MIN(DATEADD(SECOND,DATEDIFF(SECOND,CAST('00:00:00' AS time),CAST(D.Hora AS time)),CAST(CONVERT(date,D.Data) AS datetime2))) primeiro_documento,
 MAX(DATEADD(SECOND,DATEDIFF(SECOND,CAST('00:00:00' AS time),CAST(D.Hora AS time)),CAST(CONVERT(date,D.Data) AS datetime2))) ultimo_documento
FROM dbo.DocumentoFiscal D WITH(NOLOCK)
WHERE D.Data>=? AND D.Data<? AND D.IdFilial=? AND ISNULL(D.Cancelado,0)=0
 AND DATEADD(SECOND,DATEDIFF(SECOND,CAST('00:00:00' AS time),CAST(D.Hora AS time)),CAST(CONVERT(date,D.Data) AS datetime2))>=?
 AND DATEADD(SECOND,DATEDIFF(SECOND,CAST('00:00:00' AS time),CAST(D.Hora AS time)),CAST(CONVERT(date,D.Data) AS datetime2))<?
 AND EXISTS(SELECT 1 FROM dbo.FormaPagamentoCupomFiscal F WITH(NOLOCK)
   WHERE F.IdDocumentoFiscal=D.Id AND (? IS NULL OR F.IdFormaPagamento=?));
"""

SQL_PRODUTOS_DIARIO = """
SET NOCOUNT ON;
SELECT CONVERT(date,D.Data) data,P.Id codigo,P.Nome produto,A.Id id_agrupamento,A.Nome agrupamento,
 SUM(ISNULL(I.Quantidade,0)) quantidade,SUM(ISNULL(I.ValorTotal,0)) total_faturado
FROM dbo.DocumentoFiscal D WITH (NOLOCK)
JOIN dbo.ItemDocumentoFiscal I WITH (NOLOCK) ON I.IdDocumentoFiscal=D.Id
JOIN dbo.Produto P WITH (NOLOCK) ON P.Id=I.IdProduto
LEFT JOIN dbo.Agrupamento A WITH (NOLOCK) ON A.Id=P.IdAgrupamento
WHERE D.Data>=? AND D.Data<? AND D.IdFilial=? AND ISNULL(D.Cancelado,0)=0
GROUP BY CONVERT(date,D.Data),P.Id,P.Nome,A.Id,A.Nome;
"""

SQL_BASE_CANONICA_SYNC = """
SET NOCOUNT ON;
SELECT D.Id id_documento_fiscal,D.IdFilial id_filial,CONVERT(date,D.Data) data,
 CONVERT(varchar(8),CAST(D.Hora AS time),108) hora,D.Tipo tipo,
 CAST(CASE WHEN ISNULL(D.EhContingencia,0)=1 THEN 1 ELSE 0 END AS bit) eh_contingencia,
 CASE WHEN EXISTS(SELECT 1 FROM dbo.VendaCupomFiscal VCF WITH(NOLOCK) JOIN dbo.VendaTeleEntrega VTE WITH(NOLOCK) ON VTE.IdVenda=VCF.IdVenda WHERE VCF.IdDocumentoFiscal=D.Id) THEN 'DELIVERY'
      WHEN EXISTS(SELECT 1 FROM dbo.VendaCupomFiscal VCF WITH(NOLOCK) LEFT JOIN dbo.VendaMesa VM WITH(NOLOCK) ON VM.IdVenda=VCF.IdVenda LEFT JOIN dbo.VendaCartaoConsumo VC WITH(NOLOCK) ON VC.IdVenda=VCF.IdVenda WHERE VCF.IdDocumentoFiscal=D.Id AND (VM.IdVenda IS NOT NULL OR VC.IdVenda IS NOT NULL)) THEN 'CARTAO_MESA'
      ELSE 'VENDA_RAPIDA' END modulo_venda,
 FP.Id id_forma_pagamento,FP.Nome forma_pagamento,
 SUM(CAST(ISNULL(F.Valor,0)-ISNULL(F.ValorTroco,0) AS decimal(19,4))) valor_pagamento
FROM dbo.DocumentoFiscal D WITH(NOLOCK)
JOIN dbo.FormaPagamentoCupomFiscal F WITH(NOLOCK) ON F.IdDocumentoFiscal=D.Id
JOIN dbo.FormaPagamento FP WITH(NOLOCK) ON FP.Id=F.IdFormaPagamento
WHERE D.Data>=? AND D.Data<? AND D.IdFilial=? AND ISNULL(D.Cancelado,0)=0
GROUP BY D.Id,D.IdFilial,CONVERT(date,D.Data),D.Hora,D.Tipo,D.EhContingencia,FP.Id,FP.Nome;
SELECT D.Id id_documento_fiscal,D.IdFilial id_filial,CONVERT(date,D.Data) data,
 CONVERT(varchar(8),CAST(D.Hora AS time),108) hora,COALESCE(P.Id,I.IdProduto) codigo,
 COALESCE(P.Nome,CONCAT('Produto ',I.IdProduto)) produto,A.Id id_agrupamento,A.Nome agrupamento,
 SUM(CAST(ISNULL(I.Quantidade,0) AS decimal(19,6))) quantidade,
 SUM(CAST(ISNULL(I.ValorTotal,0) AS decimal(19,4))) total_faturado
FROM dbo.DocumentoFiscal D WITH(NOLOCK)
JOIN dbo.ItemDocumentoFiscal I WITH(NOLOCK) ON I.IdDocumentoFiscal=D.Id
LEFT JOIN dbo.Produto P WITH(NOLOCK) ON P.Id=I.IdProduto
LEFT JOIN dbo.Agrupamento A WITH(NOLOCK) ON A.Id=P.IdAgrupamento
WHERE D.Data>=? AND D.Data<? AND D.IdFilial=? AND ISNULL(D.Cancelado,0)=0
 AND EXISTS(SELECT 1 FROM dbo.FormaPagamentoCupomFiscal F WITH(NOLOCK) WHERE F.IdDocumentoFiscal=D.Id)
GROUP BY D.Id,D.IdFilial,CONVERT(date,D.Data),D.Hora,P.Id,P.Nome,I.IdProduto,A.Id,A.Nome;
"""

SQL_VENDAS_ANALISE = """
SET NOCOUNT ON;
DROP TABLE IF EXISTS #IdsVendas;
SELECT D.Id,CONVERT(date,D.Data) AS Data,CAST('VENDA_RAPIDA' AS varchar(20)) modulo_venda INTO #IdsVendas
FROM dbo.DocumentoFiscal D WITH (NOLOCK)
WHERE D.Data>=? AND D.Data<? AND D.IdFilial=? AND ISNULL(D.Cancelado,0)=0
 AND DATEADD(SECOND,DATEDIFF(SECOND,CAST('00:00:00' AS time),CAST(D.Hora AS time)),CAST(CONVERT(date,D.Data) AS datetime2))>=?
 AND DATEADD(SECOND,DATEDIFF(SECOND,CAST('00:00:00' AS time),CAST(D.Hora AS time)),CAST(CONVERT(date,D.Data) AS datetime2))<?;
CREATE UNIQUE CLUSTERED INDEX IX_IdsVendas ON #IdsVendas(Id);
WITH Modulos AS (
 SELECT VCF.IdDocumentoFiscal,
  MAX(CASE WHEN VTE.IdVenda IS NOT NULL THEN 2 WHEN VM.IdVenda IS NOT NULL OR VC.IdVenda IS NOT NULL THEN 1 ELSE 0 END) tipo
 FROM #IdsVendas X
 JOIN dbo.VendaCupomFiscal VCF WITH(NOLOCK) ON VCF.IdDocumentoFiscal=X.Id
 LEFT JOIN dbo.VendaTeleEntrega VTE WITH(NOLOCK) ON VTE.IdVenda=VCF.IdVenda
 LEFT JOIN dbo.VendaMesa VM WITH(NOLOCK) ON VM.IdVenda=VCF.IdVenda
 LEFT JOIN dbo.VendaCartaoConsumo VC WITH(NOLOCK) ON VC.IdVenda=VCF.IdVenda
 GROUP BY VCF.IdDocumentoFiscal
)
UPDATE X SET modulo_venda=CASE M.tipo WHEN 2 THEN 'DELIVERY' WHEN 1 THEN 'CARTAO_MESA' ELSE 'VENDA_RAPIDA' END
FROM #IdsVendas X JOIN Modulos M ON M.IdDocumentoFiscal=X.Id;
WITH Itens AS (
 SELECT D.Id id_documento_fiscal,D.Data data,D.modulo_venda,P.Id codigo,P.Nome produto,
  A.Id id_agrupamento,A.Nome agrupamento,SUM(CAST(ISNULL(I.Quantidade,0) AS decimal(19,6))) quantidade,
  SUM(CAST(ISNULL(I.ValorTotal,0) AS decimal(19,4))) faturamento_produto
 FROM #IdsVendas D JOIN dbo.ItemDocumentoFiscal I WITH (NOLOCK) ON I.IdDocumentoFiscal=D.Id
 JOIN dbo.Produto P WITH (NOLOCK) ON P.Id=I.IdProduto LEFT JOIN dbo.Agrupamento A WITH (NOLOCK) ON A.Id=P.IdAgrupamento
 WHERE (? IS NULL OR P.Id=? OR P.Nome LIKE ?) AND (? IS NULL OR A.Id=?)
 GROUP BY D.Id,D.Data,D.modulo_venda,P.Id,P.Nome,A.Id,A.Nome
), Pagamentos AS (
 SELECT F.IdDocumentoFiscal id_documento_fiscal,FP.Id id_forma_pagamento,FP.Nome forma_pagamento,
  SUM(CAST(ISNULL(F.Valor,0)-ISNULL(F.ValorTroco,0) AS decimal(19,4))) valor_pagamento
 FROM #IdsVendas X JOIN dbo.FormaPagamentoCupomFiscal F WITH (NOLOCK) ON F.IdDocumentoFiscal=X.Id
 JOIN dbo.FormaPagamento FP WITH (NOLOCK) ON FP.Id=F.IdFormaPagamento
 WHERE (? IS NULL OR FP.Id=?) GROUP BY F.IdDocumentoFiscal,FP.Id,FP.Nome
), PagamentosComTotal AS (
 SELECT *,SUM(valor_pagamento) OVER(PARTITION BY id_documento_fiscal) total_pagamentos FROM Pagamentos
)
SELECT I.data,I.id_documento_fiscal,I.modulo_venda,I.codigo,I.produto,I.id_agrupamento,I.agrupamento,
 CAST(I.quantidade*P.valor_pagamento/NULLIF(P.total_pagamentos,0) AS decimal(19,6)) quantidade_atribuida,
 CAST(CASE WHEN I.quantidade<>0 THEN I.faturamento_produto/I.quantidade ELSE 0 END AS decimal(19,4)) preco_medio,
 I.faturamento_produto,P.id_forma_pagamento,P.forma_pagamento,
 CAST(I.faturamento_produto*P.valor_pagamento/NULLIF(P.total_pagamentos,0) AS decimal(19,4)) valor_atribuido
FROM Itens I JOIN PagamentosComTotal P ON P.id_documento_fiscal=I.id_documento_fiscal
ORDER BY I.data,I.produto,P.forma_pagamento;
DROP TABLE IF EXISTS #IdsVendas;
"""

SQL_PAYMENT_SOURCE_COUNTS = """
SET NOCOUNT ON; DROP TABLE IF EXISTS #IdsVendas;
SELECT D.Id INTO #IdsVendas FROM dbo.DocumentoFiscal D WITH(NOLOCK)
WHERE D.Data>=? AND D.Data<? AND D.IdFilial=? AND ISNULL(D.Cancelado,0)=0;
CREATE UNIQUE CLUSTERED INDEX IX_IdsVendas ON #IdsVendas(Id);
SELECT 'FormaPagamentoCupomFiscal' origem,COUNT(*) registros,SUM(ISNULL(F.Valor,0)-ISNULL(F.ValorTroco,0)) valor
FROM #IdsVendas X JOIN dbo.FormaPagamentoCupomFiscal F WITH(NOLOCK) ON F.IdDocumentoFiscal=X.Id
HAVING COUNT(*)>0;
DROP TABLE IF EXISTS #IdsVendas;
"""

SQL_VENDAS_STATUS = """
SET NOCOUNT ON;
WITH VendasBase AS (
 SELECT V.Id,V.Data,V.IdFilial,V.ValorTotal,
  CASE WHEN EXISTS(SELECT 1 FROM dbo.VendaTeleEntrega T WITH(NOLOCK) WHERE T.IdVenda=V.Id) THEN 'DELIVERY'
       WHEN EXISTS(SELECT 1 FROM dbo.VendaMesa M WITH(NOLOCK) WHERE M.IdVenda=V.Id)
         OR EXISTS(SELECT 1 FROM dbo.VendaCartaoConsumo C WITH(NOLOCK) WHERE C.IdVenda=V.Id) THEN 'CARTAO_MESA'
       ELSE 'VENDA_RAPIDA' END modulo_venda,
  CAST(CASE WHEN EXISTS(SELECT 1 FROM dbo.VendaTeleEntrega T WITH(NOLOCK) WHERE T.IdVenda=V.Id AND T.Aberto=1)
         OR EXISTS(SELECT 1 FROM dbo.VendaMesa M WITH(NOLOCK) WHERE M.IdVenda=V.Id AND M.Aberto=1)
         OR EXISTS(SELECT 1 FROM dbo.VendaCartaoConsumo C WITH(NOLOCK) WHERE C.IdVenda=V.Id AND C.Aberto=1) THEN 1 ELSE 0 END AS bit) aberto
 FROM dbo.Venda V WITH(NOLOCK) WHERE V.IdFilial=?
), Documentos AS (
 SELECT DISTINCT VCF.IdVenda,D.Id id_documento_fiscal,D.Data
 FROM dbo.VendaCupomFiscal VCF WITH(NOLOCK)
 JOIN dbo.DocumentoFiscal D WITH(NOLOCK) ON D.Id=VCF.IdDocumentoFiscal
 WHERE D.Data>=? AND D.Data<? AND D.IdFilial=? AND ISNULL(D.Cancelado,0)=0
), Pagamentos AS (
 SELECT F.IdDocumentoFiscal,SUM(CAST(ISNULL(F.Valor,0)-ISNULL(F.ValorTroco,0) AS decimal(19,4))) valor
 FROM dbo.FormaPagamentoCupomFiscal F WITH(NOLOCK)
 JOIN Documentos D ON D.id_documento_fiscal=F.IdDocumentoFiscal
 GROUP BY F.IdDocumentoFiscal
)
SELECT CONVERT(date,D.Data) data,V.Id id_venda,CONVERT(varchar(30),D.id_documento_fiscal) id_documento_fiscal,
 V.modulo_venda,V.aberto,CAST(1 AS bit) faturado,CAST(ISNULL(P.valor,0) AS decimal(19,4)) valor
FROM Documentos D JOIN VendasBase V ON V.Id=D.IdVenda
LEFT JOIN Pagamentos P ON P.IdDocumentoFiscal=D.id_documento_fiscal
UNION ALL
SELECT CONVERT(date,V.Data),V.Id,'',V.modulo_venda,V.aberto,CAST(0 AS bit),CAST(ISNULL(V.ValorTotal,0) AS decimal(19,4))
FROM VendasBase V
WHERE V.Data>=? AND V.Data<? AND NOT EXISTS(
 SELECT 1 FROM dbo.VendaCupomFiscal VCF WITH(NOLOCK)
 JOIN dbo.DocumentoFiscal D WITH(NOLOCK) ON D.Id=VCF.IdDocumentoFiscal
 WHERE VCF.IdVenda=V.Id AND ISNULL(D.Cancelado,0)=0
);
"""

# Delivery em aberto nasce em TeleEntrega. Nao pode depender de DocumentoFiscal,
# pois o documento so existe depois da finalizacao no frente de caixa.
SQL_DELIVERIES_ABERTOS = """
SET NOCOUNT ON;
SELECT CONVERT(date,T.Data) data,CONVERT(varchar(8),CAST(T.Hora AS time),108) hora,
 T.NumeroComanda pedido,T.Id id_tele_entrega,T.IdFilial id_filial,
 T.IdStatus id_status,S.NomeStatus status,
 CAST(SUM(ISNULL(PD.Valor,0)) AS decimal(19,4)) valor,
 CAST(0 AS bit) cancelado,CAST(0 AS bit) finalizado,
 CAST(NULL AS bigint) id_documento_fiscal
FROM dbo.TeleEntrega T WITH(NOLOCK)
JOIN dbo.PagamentoDelivery PD WITH(NOLOCK) ON PD.IdTeleEntrega=T.Id AND ISNULL(PD.Cancelado,0)=0
JOIN dbo.StatusDelivery S WITH(NOLOCK) ON S.Id=T.IdStatus
WHERE T.IdFilial=?
 AND DATEADD(SECOND,DATEDIFF(SECOND,CAST('00:00:00' AS time),CAST(T.Hora AS time)),CAST(CONVERT(date,T.Data) AS datetime2))>=?
 AND DATEADD(SECOND,DATEDIFF(SECOND,CAST('00:00:00' AS time),CAST(T.Hora AS time)),CAST(CONVERT(date,T.Data) AS datetime2))<?
 AND T.IdStatus=1
GROUP BY CONVERT(date,T.Data),T.Hora,T.NumeroComanda,T.Id,T.IdFilial,T.IdStatus,S.NomeStatus
ORDER BY data,hora,pedido;
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
    billing=query_faturamento_diario(config,start.date(),end.date()+timedelta(days=1),resolve_raffinato_filial(config,{}))
    relay_post({
        "action":"billing_sync","token":config["relay_token"],
        "inicio":start.strftime("%Y-%m-%d"),"fim":end.strftime("%Y-%m-%d"),"items":billing,
    },timeout=45)
    filial=resolve_raffinato_filial(config,{})
    with pyodbc.connect(connection_string(config),timeout=8) as connection:
        connection.timeout=60
        cursor=connection.cursor()
        cursor.execute(SQL_PRODUTOS_DIARIO,start.date(),end.date()+timedelta(days=1),filial)
        products=rows_as_dicts(cursor)
    relay_post({
        "action":"products_sync","token":config["relay_token"],
        "inicio":start.strftime("%Y-%m-%d"),"fim":end.strftime("%Y-%m-%d"),"items":products,
    },timeout=90)
    with pyodbc.connect(connection_string(config),timeout=8) as connection:
        connection.timeout=90; cursor=connection.cursor()
        cursor.execute(SQL_BASE_CANONICA_SYNC,start.date(),end.date()+timedelta(days=1),filial,
                       start.date(),end.date()+timedelta(days=1),filial)
        documents=rows_as_dicts(cursor); canonical_items=[]
        while cursor.nextset():
            if cursor.description:
                canonical_items=rows_as_dicts(cursor); break
    open_deliveries=query_deliveries_abertos(config,start,end+timedelta(seconds=1),filial)
    relay_post({
        "action":"canonical_sync","token":config["relay_token"],
        "inicio":start.strftime("%Y-%m-%d"),"fim":end.strftime("%Y-%m-%d"),
        "documents":documents,"items":canonical_items,"open_deliveries":open_deliveries,
    },timeout=120)


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
            acquired = False
            try:
                acquired = CACHE_SYNC_LOCK.acquire(timeout=1)
                if not acquired:
                    continue
                now = datetime.now()
                sync_metadados_remotos(store_id,config,resolve_raffinato_filial(config,{}))
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
            finally:
                if acquired:
                    CACHE_SYNC_LOCK.release()
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

    sql_started = time.perf_counter()
    sql_start_date = start.date()
    sql_end_date = end_exclusive.date() if end_exclusive.time() == datetime.min.time() else end_exclusive.date() + timedelta(days=1)
    with pyodbc.connect(connection_string(config), timeout=8) as connection:
        connection.timeout = 30
        cursor = connection.cursor()
        logger.info("SQL EXECUTADA: SQL_SANGRIAS | inicio=%s | fim_exclusivo=%s | id_filial=%s", start.isoformat(), end_exclusive.isoformat(), filial)
        cursor.execute(SQL_SANGRIAS, sql_start_date, sql_end_date, filial)
        rows = rows_as_dicts(cursor)
    logger.info("TEMPO SQL: SQL_SANGRIAS %.3fs | registros=%s", time.perf_counter() - sql_started, len(rows))

    items: list[dict[str, Any]] = []
    total = Decimal("0")
    total_sangrias = Decimal("0")
    total_retiradas = Decimal("0")
    for row in rows:
        raw_date = row.get("data")
        row_date = raw_date.date() if isinstance(raw_date, datetime) else (datetime.fromisoformat(raw_date).date() if isinstance(raw_date, str) else raw_date)
        raw_time = row.get("hora")
        row_time = raw_time if hasattr(raw_time, "hour") else datetime.strptime(str(raw_time).split(".")[0], "%H:%M:%S").time()
        row_datetime = datetime.combine(row_date, row_time)
        if row_datetime < start or row_datetime >= end_exclusive:
            continue
        value = Decimal(str(row.get("valortotal") or 0))
        total += value
        tipo = int(row.get("tipocomprovantenaofiscal") or 0)
        if tipo == 4:
            total_retiradas += value
        else:
            total_sangrias += value
        items.append({
            "id": str(row.get("id") or ""),
            "id_filial": str(row.get("idfilial") or ""),
            "id_usuario": str(row.get("idusuario") or ""),
            "id_usuario_autorizador": str(row.get("idusuarioautorizadorsangria") or ""),
            "motivo": str(row.get("motivo") or "Sem motivo"),
            "valor": float(value),
            "hora": row_time.strftime("%H:%M:%S"),
            "data": row_date.strftime("%d/%m/%Y"),
            "data_hora": row_datetime.isoformat(),
            "tipo_comprovante_nao_fiscal": tipo,
            "tipo_movimento": str(row.get("tipomovimento") or ""),
            "finalidade": "Retirada para cofre" if tipo == 4 else "Pagamento de despesa",
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


def friendly_sql_error(error: Exception) -> str:
    message = str(error)
    lowered = message.lower()
    if "18456" in message or "falha de logon" in lowered or "login failed" in lowered:
        return "Usuario ou senha do banco invalidos. Confira os dados e tente novamente."
    if "08001" in message or "server not found" in lowered or "servidor nao encontrado" in lowered:
        return "Nao foi possivel localizar o servidor Raffinato. Verifique a instancia SQL e a conexao de rede/VPN."
    return "Nao foi possivel consultar o banco Raffinato. Consulte o log tecnico do conector."


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


def query_metadados_catalogo(config: dict[str, Any], filial: int) -> dict[str, Any]:
    with pyodbc.connect(connection_string(config), timeout=8) as connection:
        connection.timeout=45;cursor=connection.cursor()
        cursor.execute(SQL_AGRUPAMENTOS);agrupamentos=rows_as_dicts(cursor)
        cursor.execute(SQL_PRODUTOS_CATALOGO);produtos=rows_as_dicts(cursor)
        cursor.execute(SQL_FORMAS_PAGAMENTO);formas=rows_as_dicts(cursor)
    return {"id_filial":filial,"agrupamentos":agrupamentos,"produtos":produtos,"formas_pagamento":formas,
            "sincronizado_em":datetime.now().isoformat(timespec="seconds")}


def sync_metadados_remotos(store_id: str, config: dict[str, Any], filial: int) -> dict[str, Any]:
    metadata=query_metadados_catalogo(config,filial)
    if config.get("relay_token") and config.get("empresa_id"):
        relay_post({"action":"metadata_sync","token":config["relay_token"],**metadata},timeout=90)
    return metadata


def query_faturamento_diario(config: dict[str, Any], start_date: date, end_date: date, filial: int) -> list[dict[str, Any]]:
    """Movimento transacional para todos os dias; fechamento apenas para valores finais."""
    params = (start_date, end_date, filial, start_date, end_date, filial,
              filial, filial, filial, filial, filial, start_date, end_date, filial,
              start_date, end_date, filial)
    with pyodbc.connect(connection_string(config), timeout=8) as connection:
        connection.timeout = 45
        cursor = connection.cursor(); cursor.execute(SQL_FATURAMENTO_DIARIO, *params)
        result_sets: list[list[dict[str, Any]]] = []
        while True:
            if cursor.description:
                result_sets.append(rows_as_dicts(cursor))
            if not cursor.nextset():
                break
    movements = result_sets[0] if result_sets else []
    closings = result_sets[1] if len(result_sets) > 1 else []
    open_days = result_sets[2] if len(result_sets) > 2 else []
    withdrawals = result_sets[3] if len(result_sets) > 3 else []
    rows: dict[tuple[str, int], dict[str, Any]] = {}
    for item in movements:
        key = (str(item["data"]), int(item["id_forma_pagamento"]))
        rows[key] = {**item, "valor_abertura":0, "valor_suprimento":0, "valor_sangria":0,
                     "valor_retirada":0, "valor_apurado":0, "valor_confirmado":0,
                     "caixa_aberto":False, "valor_confirmado_disponivel":False}
    for item in closings:
        key = (str(item["data"]), int(item["id_forma_pagamento"]))
        row = rows.setdefault(key, {"data":item["data"], "id_forma_pagamento":item["id_forma_pagamento"],
          "forma_pagamento":item["forma_pagamento"], "valor_movimento":0, "valor_retirada":0, "caixa_aberto":False})
        for field in ("valor_abertura","valor_suprimento","valor_sangria","valor_apurado","valor_confirmado"):
            row[field] = float(row.get(field) or 0) + float(item.get(field) or 0)
        row["valor_confirmado_disponivel"] = True
    for opened in open_days:
        day = str(opened["data"])
        candidates = [row for (row_day, _), row in rows.items() if row_day == day]
        cash = next((row for row in candidates if "DINHEIRO" in str(row.get("forma_pagamento") or "").upper()), None)
        if cash is None:
            cash = {"data":day, "id_forma_pagamento":1, "forma_pagamento":"Dinheiro", "valor_movimento":0,
                    "valor_abertura":0, "valor_suprimento":0, "valor_sangria":0, "valor_retirada":0,
                    "valor_apurado":0, "valor_confirmado":0, "valor_confirmado_disponivel":False}
            rows[(day, 1)] = cash
        abertura=float(opened.get("valor_abertura") or 0); suprimento=float(opened.get("valor_suprimento") or 0); sangria=float(opened.get("valor_sangria") or 0)
        retirada=float(opened.get("valor_retirada") or 0); movimento_aberto=float(opened.get("movimento_aberto") or 0)
        cash["valor_abertura"] = float(cash.get("valor_abertura") or 0) + abertura
        cash["valor_suprimento"] = float(cash.get("valor_suprimento") or 0) + suprimento
        cash["valor_sangria"] = float(cash.get("valor_sangria") or 0) + sangria
        cash["valor_retirada"] = float(cash.get("valor_retirada") or 0) + retirada
        cash["valor_apurado"] = float(cash.get("valor_apurado") or 0) + movimento_aberto + abertura + suprimento - sangria - retirada
        cash["caixa_aberto"] = True
    open_dates={str(item["data"]) for item in open_days}
    for withdrawal in withdrawals:
        day=str(withdrawal["data"])
        if day in open_dates:
            continue
        candidates=[row for (row_day,_),row in rows.items() if row_day==day]
        cash=next((row for row in candidates if "DINHEIRO" in str(row.get("forma_pagamento") or "").upper()),None)
        if cash is not None:
            cash["valor_retirada"]=float(cash.get("valor_retirada") or 0)+float(withdrawal.get("valor_retirada") or 0)
    return sorted(rows.values(), key=lambda item:(str(item["data"]), str(item["forma_pagamento"])))


def query_faturamento(config: dict[str, Any], body: dict[str, Any]) -> dict[str, Any]:
    start = parse_datetime(body.get("inicio"), "Início")
    end = parse_datetime(body.get("fim_exclusivo"), "Fim exclusivo")
    filial = resolve_raffinato_filial(config, body)
    payment = int(body["id_forma_pagamento"]) if body.get("id_forma_pagamento") else None
    sql_started = time.perf_counter()
    logger.info("SQL EXECUTADA: FATURAMENTO_HIBRIDO | inicio=%s | fim_exclusivo=%s | id_filial=%s | forma=%s", start.isoformat(), end.isoformat(), filial, payment)
    coarse_end=end.date()+timedelta(days=1) if end.time()!=datetime.min.time() else end.date()
    daily = query_faturamento_diario(config, start.date(), coarse_end, filial)
    if payment is not None:
        daily = [item for item in daily if int(item["id_forma_pagamento"]) == payment]
    with pyodbc.connect(connection_string(config), timeout=8) as connection:
        connection.timeout=30; cursor=connection.cursor(); cursor.execute(
            SQL_MOVIMENTO_FATURAMENTO_PERIODO,start.date(),coarse_end,filial,start,end,payment,payment
        ); movement_rows=rows_as_dicts(cursor)
        cursor.execute(SQL_CONTAGEM_DOCUMENTOS_PERIODO,start.date(),coarse_end,filial,start,end,payment,payment)
        period_rows=rows_as_dicts(cursor);period_info=period_rows[0] if period_rows else {}
    movement_by_key={(str(item["data"]),int(item["id_forma_pagamento"])):item for item in movement_rows}
    for item in daily:
        exact=movement_by_key.get((str(item["data"]),int(item["id_forma_pagamento"])))
        item["valor_movimento"]=float(exact.get("valor_movimento") or 0) if exact else 0
    existing={(str(item["data"]),int(item["id_forma_pagamento"])) for item in daily}
    for exact in movement_rows:
        key=(str(exact["data"]),int(exact["id_forma_pagamento"]))
        if key not in existing:
            daily.append({**exact,"valor_abertura":0,"valor_suprimento":0,"valor_sangria":0,
                          "valor_retirada":0,"valor_apurado":0,"valor_confirmado":0,
                          "caixa_aberto":False,"valor_confirmado_disponivel":False})
    grouped: dict[int, dict[str, Any]] = {}
    for item in daily:
        target=grouped.setdefault(int(item["id_forma_pagamento"]), {"id_forma_pagamento":item["id_forma_pagamento"],"forma_pagamento":item["forma_pagamento"]})
        for key in ("valor_movimento","valor_abertura","valor_suprimento","valor_sangria","valor_retirada","valor_apurado","valor_confirmado"):
            target[key]=float(target.get(key) or 0)+float(item.get(key) or 0)
        target["caixa_aberto"]=bool(target.get("caixa_aberto")) or bool(item.get("caixa_aberto"))
        target["valor_confirmado_disponivel"]=bool(target.get("valor_confirmado_disponivel")) or bool(item.get("valor_confirmado_disponivel"))
    rows=list(grouped.values())
    evolution=[{"data":item["data"],"id_forma_pagamento":item["id_forma_pagamento"],"forma_pagamento":item["forma_pagamento"],"valor_movimento":item["valor_movimento"]} for item in movement_rows]
    keys = ("valor_movimento","valor_abertura","valor_suprimento","valor_sangria","valor_apurado","valor_confirmado")
    totals = {key: sum(float(row.get(key) or 0) for row in rows) for key in keys}
    logger.info("TEMPO SQL: FATURAMENTO %.3fs | formas=%s | evolucao=%s", time.perf_counter() - sql_started, len(rows), len(evolution))
    open_cash=any(bool(item.get("caixa_aberto")) for item in daily); has_closed=any(bool(item.get("valor_confirmado_disponivel")) for item in daily)
    if open_cash and not has_closed: totals["valor_confirmado"] = None
    totals["valor_retirada"] = sum(float(row.get("valor_retirada") or 0) for row in rows)
    first=period_info.get("primeiro_documento");last=period_info.get("ultimo_documento")
    return {"formas_pagamento": rows, "totalizadores": totals, "evolucao": evolution,
            "caixa_aberto":open_cash, "valor_confirmado_parcial":open_cash and has_closed,
            "periodo":{"inicio":start.isoformat(),"fim_exclusivo":end.isoformat(),
                       "primeiro_documento":first,"ultimo_documento":last,
                       "quantidade_documentos":int(period_info.get("quantidade_documentos") or 0)}}


def query_produtos(config: dict[str, Any], body: dict[str, Any]) -> dict[str, Any]:
    start = parse_datetime(body.get("inicio"), "Início"); end = parse_datetime(body.get("fim_exclusivo"), "Fim exclusivo")
    filial = resolve_raffinato_filial(config, body); product_text=str(body.get("produto") or body.get("id_produto") or "").strip(); product=int(product_text) if product_text.isdigit() else None; product_filter=product_text or None; product_like=f"%{product_text}%" if product_text else None; group = int(body["id_agrupamento"]) if body.get("id_agrupamento") else None; payment=int(body["id_forma_pagamento"]) if body.get("id_forma_pagamento") else None
    sql_started=time.perf_counter()
    coarse_end=end.date()+timedelta(days=1) if end.time()!=datetime.min.time() else end.date()
    with pyodbc.connect(connection_string(config), timeout=8) as connection:
        connection.timeout=30; cursor=connection.cursor(); cursor.execute(
            SQL_PRODUTOS,payment,payment,payment,payment,
            start.date(),coarse_end,filial,payment,payment,start,end,
            product_filter,product,product_like,group,group,payment,payment
        )
        items=rows_as_dicts(cursor); evolution=[]; contingencias=[]; conciliacao={}
        while cursor.nextset():
            if cursor.description:
                evolution=rows_as_dicts(cursor); break
        while cursor.nextset():
            if cursor.description:
                contingencias=rows_as_dicts(cursor); break
        while cursor.nextset():
            if cursor.description:
                rows=rows_as_dicts(cursor); conciliacao=rows[0] if rows else {}; break
    total_produtos=sum(float(item.get("total_faturado") or 0) for item in items)
    total_financeiro=float(conciliacao.get("total_financeiro") or 0)
    total_contingencia=float(conciliacao.get("total_contingencia") or 0)
    total_produtos=round(total_produtos,2); total_financeiro=round(total_financeiro,2); total_contingencia=round(total_contingencia,2)
    ajustes=round(total_financeiro-total_contingencia-total_produtos,2)
    totals={
        "faturamento":total_financeiro,
        "produtos_identificados":total_produtos,
        "contingencia":total_contingencia,
        "ajustes_pedido":ajustes,
        "total_reconciliado":round(total_produtos+total_contingencia+ajustes,2),
        "diferenca_conciliacao":round(total_financeiro-(total_produtos+total_contingencia+ajustes),2),
        "quantidade":sum(float(item.get("quantidade") or 0) for item in items),
        "produtos":len(items),
        "documentos_financeiro":int(conciliacao.get("documentos_financeiro") or 0),
        "documentos_produtos":int(conciliacao.get("documentos_produtos") or 0),
        "documentos_contingencia":int(conciliacao.get("documentos_contingencia") or 0),
        "diferenca_nao_explicada":float(conciliacao.get("diferenca_nao_explicada") or 0),
    }
    logger.info("TEMPO SQL: PRODUTOS %.3fs | produtos=%s",time.perf_counter()-sql_started,len(items))
    return {"schema_version":3,"items":items,"evolucao":evolution,"contingencias":contingencias,"totalizadores":totals,
            "periodo":{"inicio":start.isoformat(),"fim_exclusivo":end.isoformat()}}


def query_vendas_analise(config: dict[str, Any], body: dict[str, Any]) -> dict[str, Any]:
    start=parse_datetime(body.get("inicio"),"Início"); end=parse_datetime(body.get("fim_exclusivo"),"Fim exclusivo")
    filial=resolve_raffinato_filial(config,body); product_text=str(body.get("produto") or body.get("id_produto") or "").strip(); product=int(product_text) if product_text.isdigit() else None; product_filter=product_text or None; product_like=f"%{product_text}%" if product_text else None; group=int(body["id_agrupamento"]) if body.get("id_agrupamento") else None; payment=int(body["id_forma_pagamento"]) if body.get("id_forma_pagamento") else None
    sql_started=time.perf_counter()
    coarse_end=end.date()+timedelta(days=1) if end.time()!=datetime.min.time() else end.date()
    try:
        with pyodbc.connect(connection_string(config), timeout=8) as connection:
            connection.timeout=60; cursor=connection.cursor(); cursor.execute(SQL_VENDAS_ANALISE,start.date(),coarse_end,filial,start,end,product_filter,product,product_like,group,group,payment,payment)
            items=rows_as_dicts(cursor)
    except pyodbc.Error:
        logger.exception("Relação transacional de pagamentos indisponível; retornando produtos sem rateio")
        base = query_produtos(config, {
            "inicio": start.isoformat(), "fim_exclusivo": end.isoformat(), "id_filial": filial,
            "id_produto": product, "id_agrupamento": group,
        })["items"]
        items = [{
            **item, "data": start.date().isoformat(), "id_documento_fiscal": "",
            "quantidade_atribuida": item.get("quantidade", 0),
            "faturamento_produto": item.get("total_faturado", 0),
            "id_forma_pagamento": "", "forma_pagamento": "Relação não configurada",
            "valor_atribuido": item.get("total_faturado", 0),
        } for item in base]
        return {
            "success": False, "code": "PAYMENT_RELATION_NOT_CONFIGURED",
            "message": "Relação transacional de formas de pagamento ainda não identificada.",
            "items": items, "rateio": None, "filial": filial,
        }
    logger.info("TEMPO SQL: VENDAS_ANALISE %.3fs | registros=%s",time.perf_counter()-sql_started,len(items))
    return {"schema_version":3,"items":items,"fontes_pagamento":[{"origem":"FormaPagamentoCupomFiscal"}],"rateio":"proporcional_decimal","filial":filial,
            "periodo":{"inicio":start.isoformat(),"fim_exclusivo":end.isoformat()}}


def query_vendas_analise_completa(config: dict[str, Any], body: dict[str, Any]) -> dict[str, Any]:
    analysis=query_vendas_analise(config,body)
    canonical=query_produtos(config,body)
    items=analysis.get("items",[])
    dimensions=[{"id_documento":str(x.get("id_documento_fiscal") or ""),"codigo":x.get("codigo"),
                 "id_agrupamento":x.get("id_agrupamento"),"id_forma_pagamento":x.get("id_forma_pagamento"),
                 "modulo_venda":x.get("modulo_venda")} for x in items]
    modules:dict[str,dict[str,Any]]={}
    for item in items:
        module=str(item.get("modulo_venda") or "VENDA_RAPIDA")
        row=modules.setdefault(module,{"modulo_venda":module,"valor":0.0,"documentos":set()})
        row["valor"]+=float(item.get("valor_atribuido") or 0);row["documentos"].add(str(item.get("id_documento_fiscal") or ""))
    billed=[{"modulo_venda":key,"valor":round(value["valor"],2),"quantidade":len(value["documentos"])} for key,value in modules.items()]
    start=parse_datetime(body.get("inicio"),"Início");end=parse_datetime(body.get("fim_exclusivo"),"Fim exclusivo")
    filial=resolve_raffinato_filial(config,body)
    statuses=query_vendas_status(config,start.date(),end.date()+timedelta(days=1) if end.time()!=datetime.min.time() else end.date(),filial)
    deliveries=query_deliveries_abertos(config,start,end,filial)
    open_rows:dict[str,dict[str,Any]]={}
    for item in statuses:
        if str(item.get("modulo_venda")) != "DELIVERY" and bool(item.get("aberto")) and not bool(item.get("faturado")):
            module=str(item.get("modulo_venda") or "VENDA_RAPIDA");row=open_rows.setdefault(module,{"modulo_venda":module,"quantidade":0,"valor":0.0})
            row["quantidade"]+=1;row["valor"]+=float(item.get("valor") or 0)
    if deliveries:
        open_rows["DELIVERY"]={"modulo_venda":"DELIVERY","quantidade":len(deliveries),
                               "valor":round(sum(float(x.get("valor") or 0) for x in deliveries),2)}
    totals=canonical["totalizadores"];open_total=round(sum(float(x["valor"]) for x in open_rows.values()),2)
    return {**analysis,"documentos_dimensao":dimensions,"contingencias":canonical.get("contingencias",[]),
            "totalizadores_canonicos":totals,"operacoes_abertas":list(open_rows.values()),"modulos_faturados":billed,
            "totais_operacionais":{"recebido":totals["faturamento"],"em_aberto":open_total,"previsto":round(totals["faturamento"]+open_total,2)},
            "cache_version":3,"duplicidades":0,"cobertura":{"completa":True},"origem_consulta":"sql_canonico_horario"}


def query_vendas_status(config: dict[str, Any], start: date, end_exclusive: date, filial: int) -> list[dict[str, Any]]:
    with pyodbc.connect(connection_string(config), timeout=8) as connection:
        connection.timeout=45;cursor=connection.cursor();cursor.execute(
            SQL_VENDAS_STATUS,filial,start,end_exclusive,filial,start,end_exclusive
        )
        return rows_as_dicts(cursor)


def query_deliveries_abertos(config: dict[str, Any], start: datetime, end_exclusive: datetime, filial: int) -> list[dict[str, Any]]:
    with pyodbc.connect(connection_string(config), timeout=8) as connection:
        connection.timeout=45;cursor=connection.cursor()
        cursor.execute(SQL_DELIVERIES_ABERTOS,filial,start,end_exclusive)
        return rows_as_dicts(cursor)


def cache_connection() -> sqlite3.Connection:
    connection = sqlite3.connect(CACHE_PATH, timeout=10)
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA journal_mode=WAL")
    connection.execute("PRAGMA synchronous=NORMAL")
    connection.executescript("""
    CREATE TABLE IF NOT EXISTS cache_schema (
      id INTEGER PRIMARY KEY CHECK(id=1), version INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS cache_meta (
      loja_id TEXT PRIMARY KEY, ultima_sincronizacao TEXT, ultima_data TEXT,
      ultimo_documento INTEGER DEFAULT 0, status TEXT, mensagem TEXT
    );
    CREATE TABLE IF NOT EXISTS cache_dias_sincronizados (
      loja_id TEXT NOT NULL, id_filial INTEGER NOT NULL, data TEXT NOT NULL,
      sincronizado_em TEXT NOT NULL,
      PRIMARY KEY(loja_id,id_filial,data)
    );
    CREATE TABLE IF NOT EXISTS produtos_diario (
      loja_id TEXT NOT NULL, id_filial INTEGER NOT NULL, data TEXT NOT NULL,
      id_produto TEXT NOT NULL, produto TEXT NOT NULL, id_agrupamento TEXT,
      agrupamento TEXT, quantidade REAL NOT NULL, faturamento REAL NOT NULL,
      sincronizado_em TEXT NOT NULL,
      PRIMARY KEY(loja_id,id_filial,data,id_produto)
    );
    CREATE TABLE IF NOT EXISTS produto_pagamento_diario (
      loja_id TEXT NOT NULL, id_filial INTEGER NOT NULL, data TEXT NOT NULL,
      id_produto TEXT NOT NULL, produto TEXT NOT NULL, id_agrupamento TEXT,
      agrupamento TEXT, id_forma_pagamento TEXT NOT NULL, forma_pagamento TEXT NOT NULL,
      quantidade_rateada REAL NOT NULL, valor_rateado REAL NOT NULL,
      sincronizado_em TEXT NOT NULL,
      PRIMARY KEY(loja_id,id_filial,data,id_produto,id_forma_pagamento)
    );
    CREATE TABLE IF NOT EXISTS documentos_diario (
      loja_id TEXT NOT NULL, id_filial INTEGER NOT NULL, data TEXT NOT NULL,
      id_documento TEXT NOT NULL,
      PRIMARY KEY(loja_id,id_filial,data,id_documento)
    );
    CREATE TABLE IF NOT EXISTS produto_pagamento_modulo_diario (
      loja_id TEXT NOT NULL, id_filial INTEGER NOT NULL, data TEXT NOT NULL,
      id_produto TEXT NOT NULL, produto TEXT NOT NULL, id_agrupamento TEXT,
      agrupamento TEXT, id_forma_pagamento TEXT NOT NULL, forma_pagamento TEXT NOT NULL,
      modulo_venda TEXT NOT NULL, quantidade_rateada REAL NOT NULL, valor_rateado REAL NOT NULL,
      sincronizado_em TEXT NOT NULL,
      PRIMARY KEY(loja_id,id_filial,data,id_produto,id_forma_pagamento,modulo_venda)
    );
    CREATE TABLE IF NOT EXISTS documento_dimensao_diario (
      loja_id TEXT NOT NULL, id_filial INTEGER NOT NULL, data TEXT NOT NULL,
      id_documento TEXT NOT NULL, id_produto TEXT NOT NULL,
      id_agrupamento TEXT NOT NULL, id_forma_pagamento TEXT NOT NULL, modulo_venda TEXT NOT NULL,
      PRIMARY KEY(loja_id,id_filial,data,id_documento,id_produto,id_agrupamento,id_forma_pagamento,modulo_venda)
    );
    CREATE TABLE IF NOT EXISTS vendas_status_diario (
      loja_id TEXT NOT NULL, id_filial INTEGER NOT NULL, data TEXT NOT NULL,
      id_venda TEXT NOT NULL, id_documento_fiscal TEXT NOT NULL,
      modulo_venda TEXT NOT NULL, aberto INTEGER NOT NULL, faturado INTEGER NOT NULL,
      valor REAL NOT NULL, sincronizado_em TEXT NOT NULL,
      PRIMARY KEY(loja_id,id_filial,data,id_venda,id_documento_fiscal)
    );
    CREATE INDEX IF NOT EXISTS ix_produtos_periodo ON produtos_diario(loja_id,id_filial,data);
    CREATE INDEX IF NOT EXISTS ix_cruzamento_periodo ON produto_pagamento_diario(loja_id,id_filial,data);
    CREATE INDEX IF NOT EXISTS ix_cruzamento_modulo_periodo ON produto_pagamento_modulo_diario(loja_id,id_filial,data);
    CREATE INDEX IF NOT EXISTS ix_documento_dimensao_periodo ON documento_dimensao_diario(loja_id,id_filial,data);
    CREATE INDEX IF NOT EXISTS ix_vendas_status_periodo ON vendas_status_diario(loja_id,id_filial,data,aberto,faturado);
    """)
    schema_row = connection.execute("SELECT version FROM cache_schema WHERE id=1").fetchone()
    if not schema_row or int(schema_row["version"]) != CACHE_SCHEMA_VERSION:
        with connection:
            for table in (
                "cache_dias_sincronizados", "produtos_diario", "produto_pagamento_diario",
                "documentos_diario", "produto_pagamento_modulo_diario",
                "documento_dimensao_diario", "vendas_status_diario",
            ):
                connection.execute(f"DELETE FROM {table}")
            connection.execute(
                "UPDATE cache_meta SET status='pendente',mensagem='Cache atualizado; aguardando reconstrução',ultima_data=NULL"
            )
            connection.execute(
                "INSERT INTO cache_schema(id,version) VALUES(1,?) ON CONFLICT(id) DO UPDATE SET version=excluded.version",
                (CACHE_SCHEMA_VERSION,),
            )
        logger.info("CACHE INVALIDADO: schema atualizado para versao %s", CACHE_SCHEMA_VERSION)
    return connection


def set_cache_meta(store_id: str, **values: Any) -> None:
    with closing(cache_connection()) as cache, cache:
        current = cache.execute("SELECT * FROM cache_meta WHERE loja_id=?", (store_id,)).fetchone()
        data = dict(current) if current else {"loja_id":store_id,"ultima_sincronizacao":None,"ultima_data":None,"ultimo_documento":0,"status":"pendente","mensagem":""}
        data.update(values)
        cache.execute("""INSERT INTO cache_meta(loja_id,ultima_sincronizacao,ultima_data,ultimo_documento,status,mensagem)
          VALUES(:loja_id,:ultima_sincronizacao,:ultima_data,:ultimo_documento,:status,:mensagem)
          ON CONFLICT(loja_id) DO UPDATE SET ultima_sincronizacao=excluded.ultima_sincronizacao,
          ultima_data=excluded.ultima_data,ultimo_documento=excluded.ultimo_documento,status=excluded.status,mensagem=excluded.mensagem""", data)


def sync_cache_day(store_id: str, config: dict[str, Any], day: date, filial: int = 1) -> None:
    start = datetime.combine(day, datetime.min.time()); end = start + timedelta(days=1)
    set_cache_meta(store_id, status="sincronizando", mensagem=f"Sincronizando {day.isoformat()}")
    body = {"inicio":start.isoformat(),"fim_exclusivo":end.isoformat(),"id_filial":filial}
    products = query_produtos(config, body)
    cross = query_vendas_analise(config, body)
    sale_status = query_vendas_status(config, day, day + timedelta(days=1), filial)
    now_iso = datetime.now().isoformat(timespec="seconds")
    cross_grouped: dict[tuple[str,str,str], dict[str,Any]] = {}
    document_ids:set[str]=set()
    document_dimensions:set[tuple[str,str,str,str,str]]=set()
    if cross.get("success", True):
        for item in cross.get("items", []):
            if item.get("id_documento_fiscal") is not None:
                document_ids.add(str(item["id_documento_fiscal"]))
            module=str(item.get("modulo_venda") or "VENDA_RAPIDA")
            key=(str(item.get("codigo") or ""),str(item.get("id_forma_pagamento") or ""),module)
            if not all(key): continue
            if item.get("id_documento_fiscal") is not None:
                document_dimensions.add((str(item["id_documento_fiscal"]),key[0],str(item.get("id_agrupamento") or ""),key[1],module))
            row=cross_grouped.setdefault(key,{**item,"quantidade_rateada":0.0,"valor_rateado":0.0})
            row["quantidade_rateada"]+=float(item.get("quantidade_atribuida") or 0)
            row["valor_rateado"]+=float(item.get("valor_atribuido") or 0)
    with closing(cache_connection()) as cache, cache:
        cache.execute("DELETE FROM produtos_diario WHERE loja_id=? AND id_filial=? AND data=?",(store_id,filial,day.isoformat()))
        cache.execute("DELETE FROM documentos_diario WHERE loja_id=? AND id_filial=? AND data=?",(store_id,filial,day.isoformat()))
        cache.execute("DELETE FROM produto_pagamento_modulo_diario WHERE loja_id=? AND id_filial=? AND data=?",(store_id,filial,day.isoformat()))
        cache.execute("DELETE FROM documento_dimensao_diario WHERE loja_id=? AND id_filial=? AND data=?",(store_id,filial,day.isoformat()))
        cache.execute("DELETE FROM vendas_status_diario WHERE loja_id=? AND id_filial=? AND data=?",(store_id,filial,day.isoformat()))
        cache.executemany("""INSERT INTO produtos_diario VALUES(?,?,?,?,?,?,?,?,?,?)""",[
          (store_id,filial,day.isoformat(),str(x.get("codigo") or ""),str(x.get("produto") or ""),str(x.get("id_agrupamento") or ""),str(x.get("agrupamento") or ""),float(x.get("quantidade") or 0),float(x.get("total_faturado") or 0),now_iso)
          for x in products.get("items",[]) if x.get("codigo") is not None
        ])
        cache.executemany("INSERT INTO documentos_diario VALUES(?,?,?,?)",[
          (store_id,filial,day.isoformat(),document_id) for document_id in document_ids
        ])
        cache.executemany("INSERT INTO produto_pagamento_modulo_diario VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)",[
          (store_id,filial,day.isoformat(),str(x.get("codigo") or ""),str(x.get("produto") or ""),str(x.get("id_agrupamento") or ""),str(x.get("agrupamento") or ""),str(x.get("id_forma_pagamento") or ""),str(x.get("forma_pagamento") or ""),str(x.get("modulo_venda") or "VENDA_RAPIDA"),x["quantidade_rateada"],x["valor_rateado"],now_iso)
          for x in cross_grouped.values()
        ])
        cache.executemany("INSERT INTO documento_dimensao_diario VALUES(?,?,?,?,?,?,?,?)",[
          (store_id,filial,day.isoformat(),document_id,product_id,group_id,payment_id,module)
          for document_id,product_id,group_id,payment_id,module in document_dimensions
        ])
        cache.executemany("INSERT INTO vendas_status_diario VALUES(?,?,?,?,?,?,?,?,?,?)",[
          (store_id,filial,day.isoformat(),str(x.get("id_venda") or ""),str(x.get("id_documento_fiscal") or ""),
           str(x.get("modulo_venda") or "VENDA_RAPIDA"),int(bool(x.get("aberto"))),int(bool(x.get("faturado"))),float(x.get("valor") or 0),now_iso)
          for x in sale_status if x.get("id_venda") is not None
        ])
        cache.execute("""INSERT INTO cache_dias_sincronizados VALUES(?,?,?,?)
          ON CONFLICT(loja_id,id_filial,data) DO UPDATE SET sincronizado_em=excluded.sincronizado_em""",
          (store_id,filial,day.isoformat(),now_iso))
    set_cache_meta(store_id,ultima_sincronizacao=now_iso,ultima_data=day.isoformat(),status="sincronizado",mensagem="Sincronizado")


def sync_cache_period(store_id:str,config:dict[str,Any],start_day:date,end_exclusive:date,filial:int=1) -> None:
    """Sincroniza até sete dias em uma única consulta e mantém agregados separados por dia."""
    if end_exclusive<=start_day or (end_exclusive-start_day).days>7:
        raise ValueError("O bloco de cache deve conter entre 1 e 7 dias.")
    set_cache_meta(store_id,status="sincronizando",mensagem=f"Sincronizando {start_day.isoformat()} a {(end_exclusive-timedelta(days=1)).isoformat()}")
    body={"inicio":datetime.combine(start_day,datetime.min.time()).isoformat(),"fim_exclusivo":datetime.combine(end_exclusive,datetime.min.time()).isoformat(),"id_filial":filial}
    cross=query_vendas_analise(config,body)
    sale_status=query_vendas_status(config,start_day,end_exclusive,filial)
    if not cross.get("success",True):
        raise RuntimeError(cross.get("message") or "Não foi possível sincronizar o cruzamento.")
    by_day:dict[str,list[dict[str,Any]]]={}
    for item in cross.get("items",[]):
        item_day=str(item.get("data") or "")[:10]
        if item_day:by_day.setdefault(item_day,[]).append(item)
    status_by_day:dict[str,list[dict[str,Any]]]={}
    for item in sale_status:
        item_day=str(item.get("data") or "")[:10]
        if item_day:status_by_day.setdefault(item_day,[]).append(item)
    now_iso=datetime.now().isoformat(timespec="seconds");cursor=start_day
    with closing(cache_connection()) as cache,cache:
        while cursor<end_exclusive:
            day_iso=cursor.isoformat();rows=by_day.get(day_iso,[])
            products:dict[str,dict[str,Any]]={};cross_rows:dict[tuple[str,str,str],dict[str,Any]]={};documents:set[str]=set();dimensions:set[tuple[str,str,str,str,str]]=set()
            for item in rows:
                product_id=str(item.get("codigo") or "");payment_id=str(item.get("id_forma_pagamento") or "");module=str(item.get("modulo_venda") or "VENDA_RAPIDA");group_id=str(item.get("id_agrupamento") or "");document_id=str(item.get("id_documento_fiscal") or "")
                if not product_id or not payment_id:continue
                product=products.setdefault(product_id,{**item,"quantidade":0.0,"faturamento":0.0});product["quantidade"]+=float(item.get("quantidade_atribuida") or 0);product["faturamento"]+=float(item.get("valor_atribuido") or 0)
                key=(product_id,payment_id,module);grouped=cross_rows.setdefault(key,{**item,"quantidade_rateada":0.0,"valor_rateado":0.0});grouped["quantidade_rateada"]+=float(item.get("quantidade_atribuida") or 0);grouped["valor_rateado"]+=float(item.get("valor_atribuido") or 0)
                if document_id:documents.add(document_id);dimensions.add((document_id,product_id,group_id,payment_id,module))
            # Uma leitura vazia durante o fechamento nao pode apagar um snapshot
            # historico valido. Dias recebidos com dados continuam substituidos
            # normalmente; cache miss agenda nova leitura pelo conector.
            day_status=status_by_day.get(day_iso,[])
            if not rows and not day_status:
                logger.warning("CACHE PRESERVADO: fonte vazia para loja=%s filial=%s data=%s",store_id,filial,day_iso)
                cursor+=timedelta(days=1)
                continue
            for table in ("produtos_diario","produto_pagamento_modulo_diario","documentos_diario","documento_dimensao_diario","vendas_status_diario"):
                cache.execute(f"DELETE FROM {table} WHERE loja_id=? AND id_filial=? AND data=?",(store_id,filial,day_iso))
            cache.executemany("INSERT INTO produtos_diario VALUES(?,?,?,?,?,?,?,?,?,?)",[(store_id,filial,day_iso,pid,str(x.get("produto") or ""),str(x.get("id_agrupamento") or ""),str(x.get("agrupamento") or ""),x["quantidade"],x["faturamento"],now_iso) for pid,x in products.items()])
            cache.executemany("INSERT INTO produto_pagamento_modulo_diario VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)",[(store_id,filial,day_iso,str(x.get("codigo") or ""),str(x.get("produto") or ""),str(x.get("id_agrupamento") or ""),str(x.get("agrupamento") or ""),str(x.get("id_forma_pagamento") or ""),str(x.get("forma_pagamento") or ""),str(x.get("modulo_venda") or "VENDA_RAPIDA"),x["quantidade_rateada"],x["valor_rateado"],now_iso) for x in cross_rows.values()])
            cache.executemany("INSERT INTO documentos_diario VALUES(?,?,?,?)",[(store_id,filial,day_iso,x) for x in documents])
            cache.executemany("INSERT INTO documento_dimensao_diario VALUES(?,?,?,?,?,?,?,?)",[(store_id,filial,day_iso,*x) for x in dimensions])
            cache.executemany("INSERT INTO vendas_status_diario VALUES(?,?,?,?,?,?,?,?,?,?)",[(store_id,filial,day_iso,str(x.get("id_venda") or ""),str(x.get("id_documento_fiscal") or ""),str(x.get("modulo_venda") or "VENDA_RAPIDA"),int(bool(x.get("aberto"))),int(bool(x.get("faturado"))),float(x.get("valor") or 0),now_iso) for x in day_status if x.get("id_venda") is not None])
            cache.execute("""INSERT INTO cache_dias_sincronizados VALUES(?,?,?,?) ON CONFLICT(loja_id,id_filial,data) DO UPDATE SET sincronizado_em=excluded.sincronizado_em""",(store_id,filial,day_iso,now_iso))
            cursor+=timedelta(days=1)
    set_cache_meta(store_id,ultima_sincronizacao=now_iso,ultima_data=(end_exclusive-timedelta(days=1)).isoformat(),status="sincronizado",mensagem="Sincronizado")


def request_cache_refresh() -> None:
    CACHE_REFRESH_EVENT.set()


def request_cache_range(store_id:str,start:date,end_exclusive:date) -> None:
    first=max(start,end_exclusive-timedelta(days=MAX_INTERVAL_DAYS))
    with CACHE_REQUEST_LOCK:
        requested=CACHE_REQUESTS.setdefault(store_id,set())
        cursor=first
        while cursor<end_exclusive:
            requested.add(cursor);cursor+=timedelta(days=1)
    CACHE_REFRESH_EVENT.set()


def cache_coverage(store_id:str,filial:int,start:str,end:str) -> dict[str,Any]:
    start_date=date.fromisoformat(start);end_date=date.fromisoformat(end);expected=max(0,(end_date-start_date).days)
    with closing(cache_connection()) as cache, cache:
        rows=cache.execute("SELECT data FROM cache_dias_sincronizados WHERE loja_id=? AND id_filial=? AND data>=? AND data<? ORDER BY data",(store_id,filial,start,end)).fetchall()
    synced={date.fromisoformat(row[0]) for row in rows};missing=[];cursor=start_date
    while cursor<end_date:
        if cursor not in synced:missing.append(cursor)
        cursor+=timedelta(days=1)
    if missing:request_cache_range(store_id,start_date,end_date)
    return {"completa":not missing,"dias_sincronizados":len(synced),"dias_solicitados":expected,"dias_pendentes":len(missing),"percentual":round((len(synced)/expected*100) if expected else 100,1)}


def cache_sync_loop(stop_event: threading.Event) -> None:
    initialized:set[str]=set()
    while not stop_event.is_set():
        try:
            for store_id,config in load_store_configs().items():
                if not CACHE_SYNC_LOCK.acquire(blocking=False): continue
                try:
                    today=date.today()
                    with CACHE_REQUEST_LOCK:
                        pending=CACHE_REQUESTS.get(store_id,set())
                        anchor=max(pending) if pending else None
                        requested=[anchor-timedelta(days=n) for n in range(7) if anchor and anchor-timedelta(days=n) in pending]
                        pending.difference_update(requested)
                    days=requested or [today-timedelta(days=n) for n in range(3)]
                    if store_id in initialized and not requested:days=[today,today-timedelta(days=1)]
                    filial=resolve_raffinato_filial(config,{})
                    if len(days)>1 and not stop_event.is_set():
                        sync_cache_period(store_id,config,min(days),max(days)+timedelta(days=1),filial)
                    else:
                        for day in days:
                            if stop_event.is_set(): break
                            sync_cache_day(store_id,config,day,filial)
                    initialized.add(store_id)
                    if not requested:
                        with closing(cache_connection()) as cache, cache:
                            earliest=cache.execute("SELECT MIN(data) FROM cache_dias_sincronizados WHERE loja_id=?",(store_id,)).fetchone()[0]
                        backfill=(date.fromisoformat(earliest)-timedelta(days=1)) if earliest else today-timedelta(days=3)
                        if backfill>=today-timedelta(days=MAX_INTERVAL_DAYS) and not stop_event.is_set(): sync_cache_day(store_id,config,backfill,resolve_raffinato_filial(config,{}))
                except Exception as exc:
                    logger.exception("Falha na sincronizacao do cache da loja %s",store_id)
                    set_cache_meta(store_id,status="erro",mensagem=str(exc)[:240])
                finally: CACHE_SYNC_LOCK.release()
        except Exception: logger.exception("Falha no ciclo de cache Raffinato")
        with CACHE_REQUEST_LOCK: has_pending=any(CACHE_REQUESTS.values())
        if not has_pending:
            CACHE_REFRESH_EVENT.clear(); CACHE_REFRESH_EVENT.wait(60)


def cache_status(store_id:str) -> dict[str,Any]:
    with closing(cache_connection()) as cache, cache:
        row=cache.execute("SELECT * FROM cache_meta WHERE loja_id=?",(store_id,)).fetchone()
        groups=[dict(x) for x in cache.execute("SELECT DISTINCT id_agrupamento id,nome FROM (SELECT id_agrupamento,agrupamento nome FROM produtos_diario WHERE loja_id=?) WHERE id_agrupamento<>'' ORDER BY nome",(store_id,))]
        payments=[dict(x) for x in cache.execute("SELECT DISTINCT id_forma_pagamento id,forma_pagamento nome FROM produto_pagamento_modulo_diario WHERE loja_id=? ORDER BY forma_pagamento",(store_id,))]
    return {"cache":dict(row) if row else {"status":"pendente"},"agrupamentos":groups,"formas_pagamento":payments}


def query_cached_products(store_id:str,body:dict[str,Any]) -> dict[str,Any]:
    start=parse_datetime(body.get("inicio"),"Início").date().isoformat(); end=parse_datetime(body.get("fim_exclusivo"),"Fim exclusivo").date().isoformat(); filial=int(body.get("id_filial") or 1)
    product=str(body.get("produto") or "").strip(); group=str(body.get("id_agrupamento") or "").strip()
    sql="""SELECT id_produto codigo,produto,id_agrupamento,agrupamento,SUM(quantidade) quantidade,SUM(faturamento) total_faturado FROM produtos_diario WHERE loja_id=? AND id_filial=? AND data>=? AND data<?"""; params:list[Any]=[store_id,filial,start,end]
    if product: sql+=" AND (id_produto=? OR produto LIKE ?)";params.extend([product,f"%{product}%"])
    if group: sql+=" AND id_agrupamento=?";params.append(group)
    sql+=" GROUP BY id_produto,produto,id_agrupamento,agrupamento ORDER BY total_faturado DESC"
    with closing(cache_connection()) as cache, cache:
        items=[dict(x) for x in cache.execute(sql,params)]
        evolution=[dict(x) for x in cache.execute("SELECT data,SUM(faturamento) total_faturado,SUM(quantidade) quantidade FROM produtos_diario WHERE loja_id=? AND id_filial=? AND data>=? AND data<? GROUP BY data ORDER BY data",(store_id,filial,start,end))]
    for x in items:x["preco_medio"]=x["total_faturado"]/x["quantidade"] if x["quantidade"] else 0
    status=cache_status(store_id)["cache"];coverage=cache_coverage(store_id,filial,start,end)
    return {"items":items,"evolucao":evolution,"totalizadores":{"faturamento":sum(x["total_faturado"] for x in items),"quantidade":sum(x["quantidade"] for x in items),"produtos":len(items)},"cache":status,"cobertura":coverage}


def query_cached_cross(store_id:str,body:dict[str,Any]) -> dict[str,Any]:
    start=parse_datetime(body.get("inicio"),"Início").date().isoformat(); end=parse_datetime(body.get("fim_exclusivo"),"Fim exclusivo").date().isoformat(); filial=int(body.get("id_filial") or 1)
    product=str(body.get("produto") or "").strip(); group=str(body.get("id_agrupamento") or "").strip(); payment=str(body.get("id_forma_pagamento") or "").strip(); module=str(body.get("modulo_venda") or "").strip()
    sql="""SELECT data,id_produto codigo,produto,id_agrupamento,agrupamento,id_forma_pagamento,forma_pagamento,modulo_venda,SUM(quantidade_rateada) quantidade_atribuida,SUM(valor_rateado) valor_atribuido,SUM(valor_rateado) faturamento_produto FROM produto_pagamento_modulo_diario WHERE loja_id=? AND id_filial=? AND data>=? AND data<?""";params:list[Any]=[store_id,filial,start,end]
    if product:sql+=" AND (id_produto=? OR produto LIKE ?)";params.extend([product,f"%{product}%"])
    if group:sql+=" AND id_agrupamento=?";params.append(group)
    if payment:sql+=" AND id_forma_pagamento=?";params.append(payment)
    if module:sql+=" AND modulo_venda=?";params.append(module)
    sql+=" GROUP BY data,id_produto,produto,id_agrupamento,agrupamento,id_forma_pagamento,forma_pagamento,modulo_venda ORDER BY data,produto,forma_pagamento,modulo_venda"
    with closing(cache_connection()) as cache, cache:
        items=[dict(x) for x in cache.execute(sql,params)]
        dim_sql="SELECT data,id_documento,id_produto codigo,id_agrupamento,id_forma_pagamento,modulo_venda FROM documento_dimensao_diario WHERE loja_id=? AND id_filial=? AND data>=? AND data<?";dim_params:list[Any]=[store_id,filial,start,end]
        if product.isdigit():dim_sql+=" AND id_produto=?";dim_params.append(product)
        if payment:dim_sql+=" AND id_forma_pagamento=?";dim_params.append(payment)
        if group:dim_sql+=" AND id_agrupamento=?";dim_params.append(group)
        if module:dim_sql+=" AND modulo_venda=?";dim_params.append(module)
        dimensions=[dict(x) for x in cache.execute(dim_sql,dim_params)]
        if product and not product.isdigit():
            valid_products={str(x["codigo"]) for x in items}
            dimensions=[x for x in dimensions if str(x["codigo"]) in valid_products]
        documentos=len({x["id_documento"] for x in dimensions})
        operacoes_abertas=[dict(x) for x in cache.execute("""SELECT modulo_venda,COUNT(DISTINCT id_venda) quantidade,SUM(valor) valor
          FROM vendas_status_diario WHERE loja_id=? AND id_filial=? AND data>=? AND data<? AND aberto=1 AND faturado=0
          GROUP BY modulo_venda ORDER BY modulo_venda""",(store_id,filial,start,end))]
        faturado_sql="""SELECT modulo_venda,COUNT(DISTINCT id_documento_fiscal) quantidade,SUM(valor) valor
          FROM vendas_status_diario WHERE loja_id=? AND id_filial=? AND data>=? AND data<? AND faturado=1"""
        faturado_params:list[Any]=[store_id,filial,start,end]
        if module:
            faturado_sql+=" AND modulo_venda=?";faturado_params.append(module)
        faturado_sql+=" GROUP BY modulo_venda ORDER BY modulo_venda"
        modulos_faturados=[dict(x) for x in cache.execute(faturado_sql,faturado_params)]
        duplicidades=cache.execute("""SELECT COUNT(*) FROM (SELECT data,id_venda,id_documento_fiscal,COUNT(*) quantidade
          FROM vendas_status_diario WHERE loja_id=? AND id_filial=? AND data>=? AND data<?
          GROUP BY data,id_venda,id_documento_fiscal HAVING COUNT(*)>1)""",(store_id,filial,start,end)).fetchone()[0]
        total_recebido=round(sum(float(x.get("valor") or 0) for x in modulos_faturados),2)
        total_em_aberto=round(sum(float(x.get("valor") or 0) for x in operacoes_abertas),2)
    for x in items:x["preco_medio"]=x["valor_atribuido"]/x["quantidade_atribuida"] if x["quantidade_atribuida"] else 0;x["id_documento_fiscal"]="agregado"
    return {"items":items,"documentos_dimensao":dimensions,"operacoes_abertas":operacoes_abertas,
      "cache_version":CACHE_SCHEMA_VERSION,
      "modulos_faturados":modulos_faturados,"totais_operacionais":{"recebido":total_recebido,
      "em_aberto":total_em_aberto,"previsto":round(total_recebido+total_em_aberto,2)},
      "duplicidades":duplicidades,"rateio":"cache_diario_modulo_decimal","totalizadores":{"documentos":documentos},
      "cache":cache_status(store_id)["cache"],"cobertura":cache_coverage(store_id,filial,start,end)}


def query_annual_history(config:dict[str,Any],body:dict[str,Any]) -> dict[str,Any]:
    filial=resolve_raffinato_filial(config,body);started=time.perf_counter()
    sql="""SELECT CONVERT(date,MIN(D.Data)) primeira_data,CONVERT(date,MAX(D.Data)) ultima_data
      FROM dbo.DocumentoFiscal D WITH(NOLOCK) WHERE D.IdFilial=? AND ISNULL(D.Cancelado,0)=0
      AND EXISTS(SELECT 1 FROM dbo.FormaPagamentoCupomFiscal F WITH(NOLOCK) WHERE F.IdDocumentoFiscal=D.Id);
      SELECT DISTINCT YEAR(D.Data) ano FROM dbo.DocumentoFiscal D WITH(NOLOCK) WHERE D.IdFilial=? AND ISNULL(D.Cancelado,0)=0
      AND EXISTS(SELECT 1 FROM dbo.FormaPagamentoCupomFiscal F WITH(NOLOCK) WHERE F.IdDocumentoFiscal=D.Id) ORDER BY ano;"""
    with pyodbc.connect(connection_string(config),timeout=8) as connection:
        connection.timeout=30;cursor=connection.cursor();cursor.execute(sql,filial,filial);bounds=rows_as_dicts(cursor)[0]
        while cursor.nextset():
            if cursor.description: years=rows_as_dicts(cursor);break
        else:years=[]
    logger.info("TEMPO SQL: COMPARATIVO HISTORICO %.3fs",time.perf_counter()-started)
    return {"schema_version":2,"primeira_data":bounds.get("primeira_data"),"ultima_data":bounds.get("ultima_data"),"anos":[int(x["ano"]) for x in years]}


def query_annual_summary_sql(config:dict[str,Any],body:dict[str,Any],first:int,last:int) -> dict[str,Any]:
    filial=resolve_raffinato_filial(config,body);start=date(first,1,1);end=date(last+1,1,1);module=str(body.get("modulo_venda") or "");started=time.perf_counter()
    sql="""SET NOCOUNT ON;DROP TABLE IF EXISTS #ARDocs;
      SELECT D.Id,CONVERT(date,D.Data) data,CASE WHEN EXISTS(SELECT 1 FROM dbo.VendaCupomFiscal VCF WITH(NOLOCK) JOIN dbo.VendaTeleEntrega VTE WITH(NOLOCK) ON VTE.IdVenda=VCF.IdVenda WHERE VCF.IdDocumentoFiscal=D.Id) THEN 'DELIVERY' WHEN EXISTS(SELECT 1 FROM dbo.VendaCupomFiscal VCF WITH(NOLOCK) LEFT JOIN dbo.VendaMesa VM WITH(NOLOCK) ON VM.IdVenda=VCF.IdVenda LEFT JOIN dbo.VendaCartaoConsumo VC WITH(NOLOCK) ON VC.IdVenda=VCF.IdVenda WHERE VCF.IdDocumentoFiscal=D.Id AND (VM.IdVenda IS NOT NULL OR VC.IdVenda IS NOT NULL)) THEN 'CARTAO_MESA' ELSE 'VENDA_RAPIDA' END modulo_venda,
      SUM(CAST(ISNULL(F.Valor,0)-ISNULL(F.ValorTroco,0) AS decimal(19,4))) faturamento INTO #ARDocs FROM dbo.DocumentoFiscal D WITH(NOLOCK) JOIN dbo.FormaPagamentoCupomFiscal F WITH(NOLOCK) ON F.IdDocumentoFiscal=D.Id WHERE D.Data>=? AND D.Data<? AND D.IdFilial=? AND ISNULL(D.Cancelado,0)=0 GROUP BY D.Id,D.Data;
      CREATE UNIQUE CLUSTERED INDEX IX_ARDocs ON #ARDocs(Id);
      SELECT YEAR(data) ano,MONTH(data) mes,SUM(faturamento) faturamento,COUNT(*) vendas FROM #ARDocs WHERE (?='' OR modulo_venda=?) GROUP BY YEAR(data),MONTH(data) ORDER BY ano,mes;
      SELECT X.modulo_venda,YEAR(X.data) ano,MONTH(X.data) mes,SUM(X.faturamento) faturamento FROM #ARDocs X WHERE (?='' OR X.modulo_venda=?) GROUP BY X.modulo_venda,YEAR(X.data),MONTH(X.data) ORDER BY ano,mes,X.modulo_venda;
      SELECT YEAR(X.data) ano,MONTH(X.data) mes,SUM(CAST(ISNULL(I.Quantidade,0) AS decimal(19,6))) quantidade FROM #ARDocs X JOIN dbo.ItemDocumentoFiscal I WITH(NOLOCK) ON I.IdDocumentoFiscal=X.Id WHERE (?='' OR X.modulo_venda=?) GROUP BY YEAR(X.data),MONTH(X.data);
      DROP TABLE IF EXISTS #ARDocs;"""
    with pyodbc.connect(connection_string(config),timeout=8) as connection:
        connection.timeout=90;cursor=connection.cursor();cursor.execute(sql,start,end,filial,module,module,module,module,module,module);monthly=rows_as_dicts(cursor);modules=[];quantities=[]
        while cursor.nextset():
            if cursor.description:modules=rows_as_dicts(cursor);break
        while cursor.nextset():
            if cursor.description:quantities=rows_as_dicts(cursor);break
    qty={(int(x["ano"]),int(x["mes"])):float(x.get("quantidade") or 0) for x in quantities}
    for x in monthly:x["quantidade"]=qty.get((int(x["ano"]),int(x["mes"])),0);x["ticket_medio"]=float(x.get("faturamento") or 0)/int(x.get("vendas") or 1)
    if not module or module=="DELIVERY":
        by_month={(int(x["ano"]),int(x["mes"])):x for x in monthly}
        for delivery in query_deliveries_abertos(config,datetime.combine(start,datetime.min.time()),datetime.combine(end,datetime.min.time()),filial):
            raw=delivery.get("data");day=raw if isinstance(raw,date) else date.fromisoformat(str(raw)[:10]);key=(day.year,day.month);row=by_month.setdefault(key,{"ano":day.year,"mes":day.month,"faturamento":0.0,"vendas":0,"quantidade":0.0,"ticket_medio":0.0});row["faturamento"]+=float(delivery.get("valor") or 0);row["vendas"]+=1
            module_row=next((x for x in modules if x.get("modulo_venda")=="DELIVERY" and int(x["ano"])==day.year and int(x["mes"])==day.month),None)
            if not module_row:module_row={"modulo_venda":"DELIVERY","ano":day.year,"mes":day.month,"faturamento":0.0};modules.append(module_row)
            module_row["faturamento"]+=float(delivery.get("valor") or 0)
        monthly=sorted(by_month.values(),key=lambda x:(int(x["ano"]),int(x["mes"])))
        for x in monthly:x["ticket_medio"]=float(x.get("faturamento") or 0)/int(x.get("vendas") or 1)
    totals=[{"modulo_venda":name,"faturamento":sum(float(x.get("faturamento") or 0) for x in modules if x.get("modulo_venda")==name)} for name in ("VENDA_RAPIDA","DELIVERY","CARTAO_MESA")]
    logger.info("TEMPO SQL: COMPARATIVO RESUMO %.3fs | meses=%s",time.perf_counter()-started,len(monthly))
    return {"schema_version":2,"meses":monthly,"modulos":modules,"modulos_totais":totals,"agrupamentos":cache_status(validate_store_id(body.get("loja_id"))).get("agrupamentos",[]),"tempo_ms":round((time.perf_counter()-started)*1000)}


def query_annual_detail_sql(config:dict[str,Any],body:dict[str,Any],first:int,last:int) -> dict[str,Any]:
    filial=resolve_raffinato_filial(config,body);year=int(body.get("ano") or last);month=int(body.get("mes") or 0);start=date(year,month or 1,1);end=date(year+1,1,1) if not month or month==12 else date(year,month+1,1);module=str(body.get("modulo_venda") or "");group=str(body.get("id_agrupamento") or "");product=str(body.get("produto") or "").strip();weekday=body.get("dia_semana");hour=body.get("hora");limit=min(20,max(10,int(body.get("limite") or 10)));started=time.perf_counter()
    doc_filters=[];doc_params:list[Any]=[]
    if module:doc_filters.append("modulo_venda=?");doc_params.append(module)
    if weekday is not None:doc_filters.append("((DATEDIFF(day,'19000107',data)%7)+7)%7=?");doc_params.append(int(weekday))
    if hour is not None:doc_filters.append("DATEPART(hour,hora)=?");doc_params.append(int(hour))
    item_filter="";item_values:list[Any]=[]
    if group:item_filter+=" AND CONVERT(varchar(40),P.IdAgrupamento)=?";item_values.append(group)
    if product:item_filter+=" AND (CONVERT(varchar(40),P.Id)=? OR P.Nome LIKE ?)";item_values.extend([product,f"%{product}%"])
    sql="""SET NOCOUNT ON;DROP TABLE IF EXISTS #ARDocs;SELECT D.Id,CONVERT(date,D.Data) data,CAST(D.Hora AS time) hora,CASE WHEN EXISTS(SELECT 1 FROM dbo.VendaCupomFiscal VCF WITH(NOLOCK) JOIN dbo.VendaTeleEntrega VTE WITH(NOLOCK) ON VTE.IdVenda=VCF.IdVenda WHERE VCF.IdDocumentoFiscal=D.Id) THEN 'DELIVERY' WHEN EXISTS(SELECT 1 FROM dbo.VendaCupomFiscal VCF WITH(NOLOCK) LEFT JOIN dbo.VendaMesa VM WITH(NOLOCK) ON VM.IdVenda=VCF.IdVenda LEFT JOIN dbo.VendaCartaoConsumo VC WITH(NOLOCK) ON VC.IdVenda=VCF.IdVenda WHERE VCF.IdDocumentoFiscal=D.Id AND (VM.IdVenda IS NOT NULL OR VC.IdVenda IS NOT NULL)) THEN 'CARTAO_MESA' ELSE 'VENDA_RAPIDA' END modulo_venda,SUM(CAST(ISNULL(F.Valor,0)-ISNULL(F.ValorTroco,0) AS decimal(19,4))) faturamento INTO #ARDocs FROM dbo.DocumentoFiscal D WITH(NOLOCK) JOIN dbo.FormaPagamentoCupomFiscal F WITH(NOLOCK) ON F.IdDocumentoFiscal=D.Id WHERE D.Data>=? AND D.Data<? AND D.IdFilial=? AND ISNULL(D.Cancelado,0)=0 GROUP BY D.Id,D.Data,D.Hora;CREATE UNIQUE CLUSTERED INDEX IX_ARDocs ON #ARDocs(Id);"""
    params:list[Any]=[start,end,filial]
    if doc_filters:sql+=" DELETE FROM #ARDocs WHERE NOT ("+" AND ".join(doc_filters)+");";params.extend(doc_params)
    if item_filter:sql+=f"DELETE X FROM #ARDocs X WHERE NOT EXISTS(SELECT 1 FROM dbo.ItemDocumentoFiscal I WITH(NOLOCK) JOIN dbo.Produto P WITH(NOLOCK) ON P.Id=I.IdProduto WHERE I.IdDocumentoFiscal=X.Id{item_filter});";params.extend(item_values)
    item_base=f" FROM #ARDocs X JOIN dbo.ItemDocumentoFiscal I WITH(NOLOCK) ON I.IdDocumentoFiscal=X.Id JOIN dbo.Produto P WITH(NOLOCK) ON P.Id=I.IdProduto LEFT JOIN dbo.Agrupamento A WITH(NOLOCK) ON A.Id=P.IdAgrupamento WHERE 1=1{item_filter}"
    sql+=f"SELECT TOP {limit} P.Id id,P.Nome nome,SUM(I.ValorTotal) faturamento,SUM(I.Quantidade) quantidade{item_base} GROUP BY P.Id,P.Nome ORDER BY faturamento DESC;"
    sql+=f"SELECT TOP {limit} P.Id id,P.Nome nome,SUM(I.ValorTotal) faturamento,SUM(I.Quantidade) quantidade{item_base} GROUP BY P.Id,P.Nome ORDER BY quantidade DESC;"
    sql+=f"SELECT TOP 15 COALESCE(CONVERT(varchar(40),A.Id),'SEM_GRUPO') id,COALESCE(A.Nome,'Sem agrupamento') nome,SUM(I.ValorTotal) faturamento{item_base} GROUP BY A.Id,A.Nome ORDER BY faturamento DESC;"
    params.extend(item_values*3)
    sql+="SELECT data,SUM(faturamento) faturamento,COUNT(*) vendas FROM #ARDocs GROUP BY data ORDER BY data;SELECT ((DATEDIFF(day,'19000107',data)%7)+7)%7 dia_semana,SUM(faturamento) faturamento,COUNT(*) vendas FROM #ARDocs GROUP BY ((DATEDIFF(day,'19000107',data)%7)+7)%7 ORDER BY dia_semana;SELECT DATEPART(hour,hora) hora,SUM(faturamento) faturamento,COUNT(*) vendas FROM #ARDocs GROUP BY DATEPART(hour,hora) ORDER BY hora;DROP TABLE IF EXISTS #ARDocs;"
    sets=[]
    with pyodbc.connect(connection_string(config),timeout=8) as connection:
        connection.timeout=90;cursor=connection.cursor();cursor.execute(sql,*params)
        while True:
            if cursor.description:sets.append(rows_as_dicts(cursor))
            if not cursor.nextset():break
    while len(sets)<6:sets.append([])
    products,products_qty,groups,days,weekdays,hours=sets[:6]
    for rows in (weekdays,hours):
        for x in rows:x["ticket_medio"]=float(x.get("faturamento") or 0)/int(x.get("vendas") or 1)
    logger.info("TEMPO SQL: COMPARATIVO DETALHE %.3fs | ano=%s mes=%s",time.perf_counter()-started,year,month)
    return {"schema_version":2,"produtos":products,"produtos_quantidade":products_qty,"agrupamentos":groups,"dias":days,"dias_semana":weekdays,"horarios":hours,"tempo_ms":round((time.perf_counter()-started)*1000)}


def query_annual_product_sql(config:dict[str,Any],body:dict[str,Any],first:int,last:int) -> dict[str,Any]:
    filial=resolve_raffinato_filial(config,body);product=str(body.get("id_produto") or "");
    if not product:raise ValueError("Selecione um produto.")
    started=time.perf_counter();sql="""SELECT YEAR(D.Data) ano,MONTH(D.Data) mes,SUM(CAST(ISNULL(I.ValorTotal,0) AS decimal(19,4))) faturamento,SUM(CAST(ISNULL(I.Quantidade,0) AS decimal(19,6))) quantidade,COUNT(DISTINCT D.Id) vendas
      FROM dbo.DocumentoFiscal D WITH(NOLOCK) JOIN dbo.ItemDocumentoFiscal I WITH(NOLOCK) ON I.IdDocumentoFiscal=D.Id
      WHERE D.Data>=? AND D.Data<? AND D.IdFilial=? AND ISNULL(D.Cancelado,0)=0 AND CONVERT(varchar(40),I.IdProduto)=?
      AND EXISTS(SELECT 1 FROM dbo.FormaPagamentoCupomFiscal F WITH(NOLOCK) WHERE F.IdDocumentoFiscal=D.Id)
      GROUP BY YEAR(D.Data),MONTH(D.Data) ORDER BY ano,mes;"""
    with pyodbc.connect(connection_string(config),timeout=8) as connection:
        connection.timeout=60;cursor=connection.cursor();cursor.execute(sql,date(first,1,1),date(last+1,1,1),filial,product);rows=rows_as_dicts(cursor)
    for x in rows:x["ticket_medio"]=float(x.get("faturamento") or 0)/int(x.get("vendas") or 1)
    logger.info("TEMPO SQL: COMPARATIVO PRODUTO %.3fs | produto=%s",time.perf_counter()-started,product)
    return {"schema_version":2,"meses":rows,"tempo_ms":round((time.perf_counter()-started)*1000)}


def query_annual_comparison(store_id:str,body:dict[str,Any],config:dict[str,Any]|None=None) -> dict[str,Any]:
    """Retorna somente agregados; nenhum documento/item individual sai do conector."""
    if str(body.get("mode") or "") == "history":
        if not config: raise ValueError("Historico requer conexao local ao Raffinato.")
        return query_annual_history(config,body)
    first=max(1900,int(body.get("ano_inicial") or date.today().year-1));last=min(2100,int(body.get("ano_final") or date.today().year))
    if last<first: raise ValueError("Intervalo de anos invalido.")
    if str(body.get("mode") or "summary") == "summary" and config and not body.get("id_agrupamento") and not body.get("produto"):
        return query_annual_summary_sql(config,body,first,last)
    if str(body.get("mode") or "") == "detail" and config:
        return query_annual_detail_sql(config,body,first,last)
    if str(body.get("mode") or "") == "product" and config:
        return query_annual_product_sql(config,body,first,last)
    start=f"{first:04d}-01-01";end=f"{last+1:04d}-01-01";filial=int(body.get("id_filial") or 1);module=str(body.get("modulo_venda") or "");group=str(body.get("id_agrupamento") or "");product=str(body.get("produto") or "").strip();mode=str(body.get("mode") or "summary")
    product_where="";product_params:list[Any]=[]
    if module: product_where+=" AND modulo_venda=?";product_params.append(module)
    if group: product_where+=" AND id_agrupamento=?";product_params.append(group)
    if product: product_where+=" AND (id_produto=? OR produto LIKE ?)";product_params.extend([product,f"%{product}%"])
    with closing(cache_connection()) as cache,cache:
        if group or product:
            monthly=[dict(x) for x in cache.execute(f"""SELECT CAST(substr(data,1,4) AS INTEGER) ano,CAST(substr(data,6,2) AS INTEGER) mes,
              SUM(valor_rateado) faturamento,COUNT(DISTINCT data||':'||id_produto) vendas,SUM(quantidade_rateada) quantidade
              FROM produto_pagamento_modulo_diario WHERE loja_id=? AND id_filial=? AND data>=? AND data<?{product_where}
              GROUP BY substr(data,1,4),substr(data,6,2) ORDER BY ano,mes""",[store_id,filial,start,end,*product_params])]
        else:
            status_where=" AND modulo_venda=?" if module else "";status_params=[module] if module else []
            monthly=[dict(x) for x in cache.execute(f"""SELECT CAST(substr(data,1,4) AS INTEGER) ano,CAST(substr(data,6,2) AS INTEGER) mes,
              SUM(valor) faturamento,COUNT(DISTINCT id_venda||':'||id_documento_fiscal) vendas,0 quantidade
              FROM vendas_status_diario WHERE loja_id=? AND id_filial=? AND data>=? AND data<? AND (faturado=1 OR (modulo_venda='DELIVERY' AND aberto=1)){status_where}
              GROUP BY substr(data,1,4),substr(data,6,2) ORDER BY ano,mes""",[store_id,filial,start,end,*status_params])]
            qty={(int(x["ano"]),int(x["mes"])):float(x["quantidade"] or 0) for x in map(dict,cache.execute(f"""SELECT CAST(substr(data,1,4) AS INTEGER) ano,CAST(substr(data,6,2) AS INTEGER) mes,SUM(quantidade_rateada) quantidade
              FROM produto_pagamento_modulo_diario WHERE loja_id=? AND id_filial=? AND data>=? AND data<?{product_where} GROUP BY substr(data,1,4),substr(data,6,2)""",[store_id,filial,start,end,*product_params]))}
            for row in monthly:row["quantidade"]=qty.get((int(row["ano"]),int(row["mes"])),0)
        for row in monthly:row["ticket_medio"]=float(row["faturamento"] or 0)/int(row["vendas"] or 1)
        modules=[dict(x) for x in cache.execute("""SELECT modulo_venda,CAST(substr(data,1,4) AS INTEGER) ano,CAST(substr(data,6,2) AS INTEGER) mes,SUM(valor) faturamento
          FROM vendas_status_diario WHERE loja_id=? AND id_filial=? AND data>=? AND data<? AND (faturado=1 OR (modulo_venda='DELIVERY' AND aberto=1))
          GROUP BY modulo_venda,substr(data,1,4),substr(data,6,2) ORDER BY ano,mes,modulo_venda""",(store_id,filial,start,end))]
        module_totals=[{"modulo_venda":name,"faturamento":sum(float(x["faturamento"] or 0) for x in modules if x["modulo_venda"]==name)} for name in ("VENDA_RAPIDA","DELIVERY","CARTAO_MESA")]
        if mode=="summary":
            groups=[dict(x) for x in cache.execute("SELECT DISTINCT id_agrupamento id,agrupamento nome FROM produtos_diario WHERE loja_id=? AND id_agrupamento<>'' ORDER BY agrupamento",(store_id,))]
            return {"schema_version":1,"meses":monthly,"modulos":modules,"modulos_totais":module_totals,"agrupamentos":groups}
        if mode=="product":
            pid=str(body.get("id_produto") or "");
            if not pid: raise ValueError("Selecione um produto.")
            rows=[dict(x) for x in cache.execute("""SELECT CAST(substr(data,1,4) AS INTEGER) ano,CAST(substr(data,6,2) AS INTEGER) mes,SUM(faturamento) faturamento,SUM(quantidade) quantidade
              FROM produtos_diario WHERE loja_id=? AND id_filial=? AND data>=? AND data<? AND id_produto=? GROUP BY substr(data,1,4),substr(data,6,2) ORDER BY ano,mes""",(store_id,filial,start,end,pid))]
            return {"schema_version":1,"meses":rows}
        year=int(body.get("ano") or last);month=int(body.get("mes") or 0);period_start=f"{year:04d}-{month:02d}-01" if month else f"{year:04d}-01-01";period_end=(date(year+1,1,1) if not month else (date(year+1,1,1) if month==12 else date(year,month+1,1))).isoformat();limit=min(20,max(10,int(body.get("limite") or 10)))
        products=[dict(x) for x in cache.execute(f"""SELECT id_produto id,produto nome,SUM(valor_rateado) faturamento,SUM(quantidade_rateada) quantidade FROM produto_pagamento_modulo_diario
          WHERE loja_id=? AND id_filial=? AND data>=? AND data<?{product_where} GROUP BY id_produto,produto ORDER BY faturamento DESC LIMIT ?""",[store_id,filial,period_start,period_end,*product_params,limit])]
        products_quantity=[dict(x) for x in cache.execute(f"""SELECT id_produto id,produto nome,SUM(valor_rateado) faturamento,SUM(quantidade_rateada) quantidade FROM produto_pagamento_modulo_diario
          WHERE loja_id=? AND id_filial=? AND data>=? AND data<?{product_where} GROUP BY id_produto,produto ORDER BY quantidade DESC LIMIT ?""",[store_id,filial,period_start,period_end,*product_params,limit])]
        groups=[dict(x) for x in cache.execute(f"""SELECT id_agrupamento id,COALESCE(NULLIF(agrupamento,''),'Sem agrupamento') nome,SUM(valor_rateado) faturamento FROM produto_pagamento_modulo_diario
          WHERE loja_id=? AND id_filial=? AND data>=? AND data<?{product_where} GROUP BY id_agrupamento,agrupamento ORDER BY faturamento DESC LIMIT 15""",[store_id,filial,period_start,period_end,*product_params])]
        days=[dict(x) for x in cache.execute("""SELECT data,SUM(valor) faturamento,COUNT(DISTINCT id_venda||':'||id_documento_fiscal) vendas FROM vendas_status_diario
          WHERE loja_id=? AND id_filial=? AND data>=? AND data<? AND (faturado=1 OR (modulo_venda='DELIVERY' AND aberto=1)) GROUP BY data ORDER BY data""",(store_id,filial,period_start,period_end))]
        return {"schema_version":1,"produtos":products,"produtos_quantidade":products_quantity,"agrupamentos":groups,"dias":days}


class Handler(BaseHTTPRequestHandler):
    server_version = "CheckDiarioRaffinato/1.6.21"

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
            "/api/raffinato/comparativo-anual",
            "/api/raffinato/cache-status",
            "/api/raffinato/cache-refresh",
            "/api/integracoes/raffinato/testar",
            "/api/integracoes/raffinato/senha",
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
            if route == "/api/integracoes/raffinato/senha":
                store_id = validate_store_id(body.get("loja_id"))
                saved = load_store_configs().get(store_id)
                if not saved or not saved.get("pwd"):
                    raise ValueError("Senha SQL não encontrada no conector desta loja.")
                self.send_json(200, {"pwd":saved["pwd"]})
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
                request_cache_refresh()
                self.send_json(200, {"ok": True})
                return
            if route.startswith("/api/raffinato/"):
                store_id = validate_store_id(body.get("loja_id"))
                config = get_store_config(store_id)
                if route == "/api/raffinato/cache-status":
                    result = cache_status(store_id)
                elif route == "/api/raffinato/cache-refresh":
                    if body.get("inicio") and body.get("fim_exclusivo"):
                        request_cache_range(store_id,parse_datetime(body["inicio"],"Inicio").date(),parse_datetime(body["fim_exclusivo"],"Fim").date())
                        result={"ok":True,"message":"Sincronizacao do periodo solicitada."}
                    else:
                        filial=resolve_raffinato_filial(config,body)
                        with CACHE_SYNC_LOCK:
                            sync_cache_day(store_id,config,date.today(),filial)
                            sync_metadados_remotos(store_id,config,filial)
                        result={"ok":True,"message":"Dados de hoje atualizados.","cache_version":CACHE_SCHEMA_VERSION}
                elif route == "/api/raffinato/metadados":
                    result = query_metadados_catalogo(config,resolve_raffinato_filial(config,body))
                elif route == "/api/raffinato/formas-pagamento":
                    result = query_formas_pagamento(config)
                elif route == "/api/raffinato/faturamento":
                    result = query_faturamento(config, body)
                    analysis = query_cached_cross(store_id, body)
                    result["operacoes_abertas"] = analysis["operacoes_abertas"]
                    result["valor_em_aberto"] = analysis["totais_operacionais"]["em_aberto"]
                    result["cache_version"] = CACHE_SCHEMA_VERSION
                elif route == "/api/raffinato/produtos":
                    # Produtos e contingencia precisam respeitar Data + Hora. O cache
                    # diario legado nao possui granularidade suficiente para isso.
                    result = query_produtos(config, body)
                elif route == "/api/raffinato/comparativo-anual":
                    result = query_annual_comparison(store_id, body, config)
                else:
                    result = query_vendas_analise_completa(config, body)
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
            self.send_json(503, {"error": friendly_sql_error(exc)})
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
    cache_thread = threading.Thread(target=cache_sync_loop, args=(sync_stop_event,), name="raffinato-cache", daemon=True)
    cache_thread.start()
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
