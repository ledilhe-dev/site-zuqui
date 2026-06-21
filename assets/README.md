# Estrutura modular do CHECK DIARIO

O `index.html` contém somente a marcação da interface e referências externas.
Os arquivos são carregados como scripts clássicos, na mesma ordem do antigo
HTML monolítico, para preservar funções globais usadas nos atributos `onclick`.

## CSS

- `css/00-base.css`: estilos gerais e responsividade.
- `css/10-*` a `css/12-*`: camadas visuais e identidade.
- `css/20-schedule.css`: agenda e escalas.
- `css/95-patch-5.css`: componentes das folhas de contas e recebíveis.

## JavaScript

- `js/01-*` a `js/05-*`: Supabase, versão, estado, navegação e utilitários.
- `js/10-dashboard.js`: dashboard e painel personalizado.
- `js/20-*` a `js/23-*`: checklists, funcionários, acessos e e-mail.
- `js/30-*` a `js/32-*`: financeiro, contas a pagar e recebíveis.
- `js/40-login-preferences.js`: preferências da tela de login.
- `js/41-finance-vault-calendar.js`: calendário e cofre financeiro.
- `js/42-*` a `js/44-*`: loja, administração SaaS e perfis.
- `js/50-*` e `js/51-*`: tarefas e alertas rápidos.
- `js/60-timeclock.js`: ponto eletrônico e ajustes.
- `js/70-*` e `js/71-*`: relatórios e execuções.
- `js/78-init.js`: inicialização do núcleo original.
- `js/79-*` a `js/92-*`: extensões e correções compatíveis com o legado.

## Verificação

Execute na raiz do projeto:

```powershell
python tools\verify_modularization.py
```

O verificador compara todos os blocos extraídos com
`backup/codigo-antigo/index.monolith.backup.html`, verifica referências,
arquivos órfãos e sintaxe.

`manifest.json` é gerado automaticamente e usado pelo service worker para
disponibilizar todos os módulos offline e evitar versões misturadas no cache.
