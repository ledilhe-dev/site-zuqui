# PROBLEMA CRÍTICO — Admin Flag e Vinculação de Lojas

## 🔴 Situação Atual (ERRADA)

Patrick está sendo tratado como ADMINISTRADOR DO SISTEMA quando deveria ser um funcionário normal.

### Diagrama do Fluxo Errado

```
LOGIN → Patrick
   ↓
Busca funcionário na tabela "funcionarios"
   ├─ nome: Patrick
   ├─ perfis.codigo: "ADM" ou "MASTER" ← Problema!
   └─ é_administrador: false (não marcado) ← Ignorado!
   ↓
verificação ERRADA: usuarioEhAdministrador()
   return tipo === 'admin' || codigo === 'ADM' || codigo === 'MASTER'
        ↑ Retorna true porque tem código "ADM"!
   ↓
Patrick ganha acesso ao painel ADM ❌ ERRADO!
```

### Por Que Isso Acontece?

1. **Confusão entre Perfil e Flag de Admin**
   - Perfil "Administrador" (código ADM/MASTER) = Define permissões NA LOJA
   - Flag `é_administrador` = Define se pode acessar painel ADM de FUNCIONALIDADES DA LOJA
   
2. **Consulta Incompleta no Login**
   ```javascript
   // LINHA 32552-32554 em index.html
   .select('*, perfis(nome, codigo, permissoes)')
   // ↑ NÃO traz é_administrador!
   ```

3. **Verificação de Admin Errada**
   ```javascript
   // LINHA 12149
   return usuarioSistemaLogado?.tipo === 'admin' || 
          codigo === 'ADM' || 
          codigo === 'MASTER';
   // ↑ Dá acesso a qualquer um com perfil ADM!
   ```

---

## ✅ SOLUÇÃO

### Passo 1: Corrigir a Consulta no Login

**ANTES (Linha 32552):**
```javascript
.select('*, perfis(nome, codigo, permissoes)')
```

**DEPOIS:**
```javascript
.select('*, é_administrador, perfis(nome, codigo, permissoes)')
```

### Passo 2: Passar a Flag para a Sessão

**Função `montarSessaoFuncionarioPorLoja` (linha 32314):**

**ANTES:**
```javascript
function montarSessaoFuncionarioPorLoja(funcionario, perfilFuncionario, lojaEscolhida) {
  const loja = normalizarLojaLogin(lojaEscolhida) || null;
  return {
    tipo: 'funcionario',  // ← Sempre 'funcionario'
    id: funcionario.id,
    nome: funcionario.nome,
    // ... sem é_administrador
  };
}
```

**DEPOIS:**
```javascript
function montarSessaoFuncionarioPorLoja(funcionario, perfilFuncionario, lojaEscolhida) {
  const loja = normalizarLojaLogin(lojaEscolhida) || null;
  const ehAdminLoja = funcionario.é_administrador === true;
  
  return {
    tipo: ehAdminLoja ? 'admin_loja' : 'funcionario',  // ← Muda conforme flag
    id: funcionario.id,
    nome: funcionario.nome,
    é_administrador: ehAdminLoja,  // ← Passa a flag
    // ... resto iguql
  };
}
```

### Passo 3: Funções de Verificação de Admin

**CORRIGIDO (linha 12146):**
```javascript
// APENAS para painel administrativo global
function usuarioEhAdministrador() {
  if (!usuarioSistemaLogado) return false;
  return usuarioSistemaLogado?.tipo === 'admin';
}

// Para admin de LOJA (não admin global)
function usuarioEhAdminDeLoja() {
  if (!usuarioSistemaLogado) return false;
  if (usuarioSistemaLogado?.tipo === 'admin') return false;
  return usuarioSistemaLogado?.é_administrador === true || 
         usuarioSistemaLogado?.tipo === 'admin_loja';
}
```

---

## 📊 Comparação: Antes vs. Depois

### Cenário 1: Patrick (Funcionário Normal com Perfil ADM)

**ANTES (ERRADO):**
```
LOGIN → Patrick
┌──────────────────────────────┐
│ tipo: 'funcionario'          │
│ perfil.codigo: 'ADM'         │
│ usuarioEhAdministrador(): true ← BUG!
└──────────────────────────────┘
↓
✗ Acessa painel ADM
✗ Pode editar empresas/lojas
✗ Pode ver solicitações
✗ GRAVE: Acesso não autorizado
```

**DEPOIS (CORRETO):**
```
LOGIN → Patrick
┌──────────────────────────────┐
│ tipo: 'funcionario'          │
│ é_administrador: false       │
│ perfil.codigo: 'ADM'         │
│ usuarioEhAdministrador(): false ← Correto!
└──────────────────────────────┘
↓
✓ NÃO acessa painel ADM
✓ Pode usar funcionalidades da loja (por causa do perfil ADM)
✓ Não pode editar empresas/lojas
✓ Acesso correto
```

### Cenário 2: João (Admin de Loja com Flag Marcada)

**ANTES (NÃO TRATA DIFERENTE):**
```
LOGIN → João
┌──────────────────────────────┐
│ tipo: 'funcionario'          │
│ perfil.codigo: 'ADM'         │
│ usuarioEhAdministrador(): true
└──────────────────────────────┘
↓
Mesmo que Patrick - acesso igual
(Não diferencia admin de loja vs funcionário normal)
```

**DEPOIS (DIFERENCIA CORRETAMENTE):**
```
LOGIN → João (com é_administrador marcado)
┌──────────────────────────────┐
│ tipo: 'admin_loja'           │
│ é_administrador: true        │
│ perfil.codigo: 'ADM'         │
│ usuarioEhAdminDeLoja(): true
└──────────────────────────────┘
↓
✓ PODE acessar painel ADM da loja
✓ PODE editar funcionários da loja
✓ PODE vincular usuários a esta loja
✓ Acesso restrito a uma loja
```

---

## 🔄 Fluxo Correto de Cadastro

```
1. CADASTRO DE EMPRESA
   └─ Cria empresa (ex: Zuqui Cafe)

2. CADASTRO DE LOJA
   ├─ Vincula a empresa
   └─ Cria loja (ex: Premium - SP)

3. CADASTRO DE USUÁRIO/FUNCIONÁRIO
   ├─ Via painel ADM
   │  ├─ Nome: Patrick / João
   │  ├─ Email: patrick@zuqui.com
   │  ├─ Perfil: Administrador (ADM)
   │  ├─ Loja: Premium - SP ← IMPORTANTE
   │  └─ É Administrador?: 
   │     - Patrick: ☐ (não marcado)
   │     - João: ☑ (marcado)
   │
   └─ Via Solicitação SaaS (Tela de Login)
      ├─ Nome: Nome da Empresa
      ├─ CPF/CNPJ: (opcional)
      ├─ Telefone: (necessário)
      ├─ Email: (necessário)
      └─ Vai aguardar vinculação manual no painel ADM

4. VINCULAÇÃO DE USUÁRIO À LOJA
   ├─ Painel ADM → Gestão de Funcionários
   ├─ Editar Patrick/João
   ├─ Campo: "Loja"
   ├─ Selecionar: Premium - SP
   ├─ Campo: "É Administrador?"
   │  - Patrick: ☐ (sem acesso admin)
   │  - João: ☑ (com acesso admin)
   └─ Salvar

5. LOGIN DO FUNCIONÁRIO
   ├─ Patrick faz login
   │  └─ tipo: 'funcionario'
   │     é_administrador: false
   │     → Acessa apenas loja
   │
   └─ João faz login
      └─ tipo: 'admin_loja'
         é_administrador: true
         → Acessa painel ADM da loja
```

---

## 📝 Tabelas do Banco de Dados

### Estrutura ATUAL (Incompleta)

**Tabela: usuarios**
```
id | username | email | tipo | ...
1  | patrick  | ... | loja | ...
2  | joao     | ... | loja | ...
```

**Tabela: funcionarios**
```
id | nome | email | usuario_id | loja_id | empresa_id | perfil_id | é_administrador | ...
1  | Patrick | ... | 1 | 3 | 1 | 2 (ADM) | false | ...
2  | João | ... | 2 | 3 | 1 | 2 (ADM) | true | ...
```

### O Que Falta Melhorar

1. ✅ **Coluna `é_administrador`** já existe em `funcionarios`
2. ✅ **Coluna `loja_id`** já existe em `funcionarios`
3. ❌ **Não está sendo lida** na consulta de login
4. ❌ **Não está sendo usada** para definir tipo de sessão

---

## 🔧 Alterações Necessárias no Código

### 1. Linha 32552 (Consulta no Login)

```diff
  .select('*, perfis(nome, codigo, permissoes)')
+ .select('*, é_administrador, perfis(nome, codigo, permissoes)')
```

### 2. Linha 32314 (Montar Sessão)

```diff
  function montarSessaoFuncionarioPorLoja(funcionario, perfilFuncionario, lojaEscolhida) {
    const loja = normalizarLojaLogin(lojaEscolhida) || null;
+   const ehAdminLoja = funcionario.é_administrador === true;
    return {
-     tipo: 'funcionario',
+     tipo: ehAdminLoja ? 'admin_loja' : 'funcionario',
      id: funcionario.id,
      nome: funcionario.nome,
+     é_administrador: ehAdminLoja,
      // ... resto
```

### 3. Linha 12146-12150 (Função de Verificação)

```diff
  function usuarioEhAdministrador() {
    if (!usuarioSistemaLogado) return false;
-   const codigo = normalizarCodigoPerfil(...);
-   return usuarioSistemaLogado?.tipo === 'admin' || codigo === 'ADM' || codigo === 'MASTER';
+   return usuarioSistemaLogado?.tipo === 'admin';
  }
```

---

## ✅ Checklist de Teste

Após implementar as correções:

- [ ] Patrick faz login → NÃO tem acesso a "Configuração"
- [ ] Patrick faz login → NÃO tem acesso a "Admin SaaS"
- [ ] Patrick faz login → PODE usar funcionalidades da loja (por perfil ADM)
- [ ] João (com flag marcada) faz login → TEM acesso a funcionalidades admin da loja
- [ ] Admin global faz login → TEM acesso a "Configuração" e "Admin SaaS"
- [ ] No painel ADM, consegue editar `é_administrador` do funcionário
- [ ] Alteração de flag reflete no próximo login

---

## 🚨 Por Que Isso é Crítico?

1. **Segurança**: Usuários normais ganham acesso que não deveriam ter
2. **Dados**: Funcionários podem editar empresas/lojas que não pertencem
3. **Auditoria**: Não fica claro quem é admin e quem não é
4. **Confusão**: Patrick parece estar com "Administrador" marcado no topbar

**Necessita correção IMEDIATA** antes de usar em produção.
