-- SOMENTE LEITURA. Execute manualmente no SQL Server da homologação Raffinato.
-- Confirma data/hora operacional sem alterar qualquer registro.
DECLARE @DataInicial date=DATEFROMPARTS(2026,10,31),@DataFinal date=DATEFROMPARTS(2026,10,31),@IdFilial int=1;
WITH Pedidos AS (
 SELECT T.NumeroComanda pedido,T.Data data_pedido,CONVERT(time(0),T.Hora) hora_pedido,
        V.Id id_venda,V.Data data_fechamento,CONVERT(time(0),V.Hora) hora_fechamento,V.ValorTotal,
        ROW_NUMBER() OVER(PARTITION BY V.Id,V.IdFilial ORDER BY VT.Id) rn
 FROM dbo.TeleEntrega T WITH(NOLOCK)
 JOIN dbo.VendaTeleEntrega VT WITH(NOLOCK) ON VT.IdTeleEntrega=T.Id AND VT.IdFilial=T.IdFilial
 JOIN dbo.Venda V WITH(NOLOCK) ON V.Id=VT.IdVenda AND V.IdFilial=VT.IdFilial
 WHERE T.IdFilial=@IdFilial AND T.Data>=@DataInicial AND T.Data<DATEADD(day,1,@DataFinal)
)
SELECT pedido,data_pedido,hora_pedido,id_venda,data_fechamento,hora_fechamento,ValorTotal
FROM Pedidos WHERE rn=1 AND pedido=4271;

WITH Base AS (
 SELECT V.Id,V.IdFilial,CONVERT(date,COALESCE(TE.Data,V.Data)) data_operacional,
        DATEPART(hour,CONVERT(time(0),COALESCE(TE.Hora,V.Hora))) hora_operacional,V.ValorTotal
 FROM dbo.Venda V WITH(NOLOCK)
 OUTER APPLY(SELECT TOP 1 T.Data,T.Hora FROM dbo.VendaTeleEntrega VT WITH(NOLOCK)
  JOIN dbo.TeleEntrega T WITH(NOLOCK) ON T.Id=VT.IdTeleEntrega AND T.IdFilial=VT.IdFilial
  WHERE VT.IdVenda=V.Id AND VT.IdFilial=V.IdFilial AND T.Data IS NOT NULL AND T.Hora IS NOT NULL ORDER BY VT.Id) TE
 WHERE V.IdFilial=@IdFilial AND CONVERT(date,COALESCE(TE.Data,V.Data))>=@DataInicial
 AND CONVERT(date,COALESCE(TE.Data,V.Data))<DATEADD(day,1,@DataFinal)
)
SELECT data_operacional,hora_operacional,COUNT(DISTINCT Id) pedidos,SUM(ValorTotal) valor
FROM Base GROUP BY data_operacional,hora_operacional ORDER BY data_operacional,hora_operacional;
