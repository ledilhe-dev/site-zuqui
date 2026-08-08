# Conector Raffinato

O CheckDiário é hospedado na internet, enquanto o SQL Server do Raffinato fica na rede privada do Radmin VPN. Este conector local faz a ponte de forma somente leitura, sem publicar credenciais no site.

## Primeira execução

1. Execute `iniciar-conector.ps1`.
2. O iniciador importa automaticamente as credenciais da ferramenta anterior quando ela estiver na pasta original. Se não encontrá-la, edite `credentials.local.json` com servidor, banco, usuário e senha.
3. Execute novamente `iniciar-conector.ps1` e mantenha a janela aberta.
4. No CheckDiário, abra **Integrações > Raffinato**.

O serviço aceita conexões apenas do próprio computador (`127.0.0.1`) e somente das origens listadas na configuração.

## Requisitos de rede

- Radmin VPN conectado à mesma rede do servidor Raffinato.
- Microsoft ODBC Driver 17 ou 18 for SQL Server instalado.
- SQL Server permitindo conexões TCP/IP e autenticação SQL.
- Firewall liberando a porta da instância. Para instância nomeada, libere o SQL Server Browser/UDP 1434 ou use uma porta TCP fixa no formato `IP,PORTA`.

O botão **Testar conexão** verifica driver, VPN/rede, autenticação, banco selecionado e leitura da tabela `DocumentoFiscal` antes de liberar o salvamento.
