# TESTE PASSO A PASSO — v3.1.73

## 🧪 Validar Todas as Correções

### Teste 1: Verificar que Patrick NÃO é Admin

**Setup:**
- Funcionário Patrick cadastrado com:
  - Perfil: Administrador (ADM)
  - Loja: Premium - SP
  - É Administrador?: ☐ (NÃO marcado)

**Passos:**
1. Abrir index.html
2. Fazer login como Patrick
3. Selecionar loja "Premium - SP"
4. Após login, verificar:

**Resultado Esperado:**
```
✅ Topbar mostra: "LOJA LOGADA: Premium - SP"
✅ Sidebar NÃO tem "Configuração" (oculto)
✅ Sidebar NÃO tem "Admin SaaS" (oculto)
✅ Sidebar TEM "Checklist", "Escala", "Financeiro", etc.
✅ Console: usuarioEhAdministrador() = false
✅ Console: usuarioPodeAcessar('configuracoes') = false
```

**Teste Rápido no Console (F12):**
```javascript
// Verificar tipo
console.log(usuarioSistemaLogado.tipo);
// Esperado: "funcionario"

// Verificar flag
console.log(usuarioSistemaLogado.é_administrador);
// Esperado: false

// Verificar acesso
console.log(usuarioPodeAcessar('configuracoes'));
// Esperado: false
```

---

### Teste 2: Verificar que João É Admin com Flag Marcada

**Setup:**
- Funcionário João cadastrado com:
  - Perfil: Administrador (ADM)
  - Loja: Premium - SP
  - É Administrador?: ☑ (MARCADO)

**Passos:**
1. Abrir index.html
2. Fazer login como João
3. Selecionar loja "Premium - SP"
4. Após login, verificar:

**Resultado Esperado:**
```
✅ Topbar mostra: "PAINEL ADMINISTRATIVO" (em OURO)
✅ Sidebar TEM "Configuração" com submenu:
   ├─ Solicitações
   ├─ Envio de E-mail
   └─ Forçar Atualização
✅ Sidebar TEM "Admin SaaS" com submenu:
   ├─ Empresas/Clientes
   └─ Lojas/Filiais
✅ Console: usuarioSistemaLogado.tipo = "admin_loja"
✅ Console: usuarioPodeAcessar('configuracoes') = true
```

**Teste Rápido no Console (F12):**
```javascript
// Verificar tipo
console.log(usuarioSistemaLogado.tipo);
// Esperado: "admin_loja"

// Verificar flag
console.log(usuarioSistemaLogado.é_administrador);
// Esperado: true

// Verificar acesso
console.log(usuarioPodeAcessar('configuracoes'));
// Esperado: true

// Verificar que NÃO é admin GLOBAL
console.log(usuarioEhAdministrador());
// Esperado: false (porque não é tipo='admin')
```

---

### Teste 3: Cadastrar Novo Funcionário

**Passos:**
1. Login como Admin Global (tipo='admin')
2. Ir para painel ADM → Gestão de Funcionários
3. Clicar em "Novo Funcionário"
4. Preencher formulário:

```
Nome: Maria
Email: maria@zuqui.com
Perfil: Atendente
Loja: [SELECIONE] ← Campo NOVO
É Administrador?: ☐
[Cadastrar]
```

**Resultado Esperado:**
```
✅ Campo "Loja" aparece na forma
✅ Campo "Loja" é obrigatório
   (Se tentar salvar sem preencher: "Selecione uma loja/filial")
✅ Campo "É Administrador?" está vazio (não marcado)
✅ Ao salvar, Maria é criada com:
   - loja_id: (da loja selecionada)
   - é_administrador: false
```

**Validar no Banco:**
```sql
-- No Supabase SQL Editor
SELECT id, nome, email, loja_id, é_administrador FROM funcionarios 
WHERE email = 'maria@zuqui.com';

-- Esperado:
-- id | nome  | email              | loja_id      | é_administrador
-- XX | Maria | maria@zuqui.com    | premium-sp   | false
```

---

### Teste 4: Editar Funcionário e Marcar como Admin

**Passos:**
1. No painel ADM, clicar em "Editar" para Maria
2. Marcar "É Administrador?: ☑"
3. Mudar Loja para outra (ex: "Central - RJ")
4. Clicar "Salvar"

**Resultado Esperado:**
```
✅ Campo "Loja" mostra valor anterior (Central - RJ)
✅ Checkbox "É Administrador?" marcada ☑
✅ Ao salvar:
   - Maria.é_administrador = true
   - Maria.loja_id = "central-rj"
✅ Mensagem de sucesso
```

**Próximo Login de Maria:**
```
Maria faz login
├─ tipo: 'admin_loja' (porque é_administrador=true)
├─ loja_id: 'central-rj'
├─ Vê: "PAINEL ADMINISTRATIVO" no topbar
└─ Pode acessar funcionalidades admin da loja Central - RJ
```

---

### Teste 5: Admin Global Tem Acesso a Tudo

**Passos:**
1. Login como admin@empresa.com
2. Selecionar "Painel Administrativo"

**Resultado Esperado:**
```
✅ Topbar mostra: "PAINEL ADMINISTRATIVO" (em OURO)
✅ Sidebar HAS:
   ├─ CHECKLIST (grupo)
   ├─ ESCALA DE PLANTÕES
   ├─ FINANCEIRO
   ├─ FUNCIONÁRIOS
   ├─ ALERTAS
   ├─ RELATÓRIOS
   ├─ CONFIGURAÇÃO (em OURO)
   │  ├─ Solicitações
   │  ├─ Envio de E-mail
   │  └─ Forçar Atualização Geral
   └─ ADMIN SAAS (em OURO)
      ├─ Empresas/Clientes
      └─ Lojas/Filiais

✅ Console: usuarioSistemaLogado.tipo = "admin"
✅ Console: usuarioEhAdministrador() = true
✅ Console: usuarioPodeAcessar('empresas_saas') = true
```

---

### Teste 6: Fluxo Completo de Cadastro

**Cenário:**
Você está no painel ADM e precisa criar uma nova loja com um novo admin.

**Passos:**

1️⃣ **Cadastrar Empresa**
```
Painel ADM → Admin SaaS → Empresas/Clientes
[Criar Empresa] 
├─ Nome: ABC Tech
├─ CPF/CNPJ: 12.345.678/0001-00
└─ [Salvar]
```

2️⃣ **Cadastrar Loja**
```
Painel ADM → Admin SaaS → Lojas/Filiais
[Criar Loja]
├─ Empresa: ABC Tech
├─ Nome: Matriz - São Paulo
├─ Código: sp-01
└─ [Salvar]
```

3️⃣ **Cadastrar Funcionário/Admin**
```
Painel ADM → Funcionários → [Novo Funcionário]
├─ Nome: Carlos
├─ Email: carlos@abctech.com
├─ Perfil: Administrador (ADM)
├─ Loja: Matriz - São Paulo ← NOVO CAMPO
├─ É Administrador?: ☑ (MARCADO)
└─ [Cadastrar]
```

4️⃣ **Carlos faz login**
```
URL: index.html
Email: carlos@abctech.com
Senha: (aquela que foi definida)
[ENTRAR]

Resultado:
├─ tipo: 'admin_loja'
├─ loja_id: (Matriz - São Paulo)
├─ Vê: "PAINEL ADMINISTRATIVO" em OURO
└─ Pode acessar funcionalidades admin da loja
```

5️⃣ **Carlos dentro do painel ADM**
```
Pode:
✅ Editar funcionários da loja
✅ Definir é_administrador deles
✅ Vincular funcionários a lojas
✅ Ver relatórios da loja

Não pode:
❌ Ver/editar outras lojas
❌ Criar empresas
❌ Criar lojas
❌ Gerenciar solicitações sistema
```

**Resultado Esperado:** ✅ Tudo funciona harmoniosamente

---

## 🔍 Verificações Rápidas

### Query Rápida no Supabase

```sql
-- Verificar estrutura de um funcionário
SELECT id, nome, email, loja_id, é_administrador, perfil_id 
FROM funcionarios 
WHERE nome = 'Patrick';

-- Esperado para Patrick:
-- id | nome   | email        | loja_id   | é_administrador | perfil_id
-- 1  | Patrick| patrick@... | premium-sp| false           | adm-perfil-id
```

### Console Checks

```javascript
// Após login de cada tipo

// Patrick (funcionário normal)
usuarioSistemaLogado
// {
//   tipo: 'funcionario',
//   é_administrador: false,
//   loja_id: 'premium-sp',
//   perfil: { codigo: 'ADM', ... }
// }

// João (admin de loja)
usuarioSistemaLogado
// {
//   tipo: 'admin_loja',
//   é_administrador: true,
//   loja_id: 'premium-sp',
//   perfil: { codigo: 'ADM', ... }
// }

// Admin Global
usuarioSistemaLogado
// {
//   tipo: 'admin',
//   username: 'admin',
//   perfil: { codigo: 'ADM', ... }
// }
```

---

## ⚠️ Problemas Comuns

### Problema: Campo de loja não aparece
**Causa:** cache do navegador  
**Solução:** Ctrl+Shift+Delete → limpar cache → recarregar

### Problema: Checkbox está sempre marcado
**Causa:** Ainda usando lógica de perfil  
**Solução:** Verificar que a correção foi aplicada em `editarFuncionario()`

### Problema: Tipo muda para 'admin_loja' mas não vê menus
**Causa:** `usuarioPodeAcessar()` ainda usando lógica velha  
**Solução:** Limpar cache e recarregar

### Problema: Patrick vê menus de admin
**Causa:** Fix não foi aplicado corretamente  
**Solução:**
```javascript
// Verificar no console
usuarioEhAdministrador()
// Deve retornar: false

usuarioPodeAcessar('configuracoes')
// Deve retornar: false
```

---

## ✅ Checklist Final

- [ ] Patrick NÃO tem acesso a "Configuração"
- [ ] João (com flag) TEM acesso a "Configuração"
- [ ] Admin global TEM acesso a "Configuração"
- [ ] Campo "Loja" é obrigatório no cadastro
- [ ] Ao editar, loja pré-preenchida
- [ ] Checkbox reflete é_administrador (não perfil)
- [ ] Console mostra tipos corretos (funcionario / admin_loja / admin)
- [ ] Banco de dados tem é_administrador salvo corretamente
- [ ] Sem console errors relacionados a é_administrador
- [ ] Topbar mostra "PAINEL ADMINISTRATIVO" em OURO para admins de loja

---

**Testes COMPLETOS** = Sistema pronto para produção ✅
