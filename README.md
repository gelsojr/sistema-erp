# ERP Obras e Manutenção (Web + PWA)

Sistema interno para gestão de obras, equipamentos e manutenção, com operação online/offline e integração com Supabase.

## Visão Geral

Este projeto é o frontend em React (Vite) convertido de TypeScript para JavaScript, com foco em simplicidade e performance para uso por até 25 usuários.

### Módulos principais
- `Dashboard`: visão gerencial e indicadores.
- `Em Campo`: status das máquinas e acompanhamento operacional.
- `Oficina`: alertas, manutenção e histórico técnico.
- `Abastecimentos`: entradas/saídas de diesel e histórico.
- `Pontes`: custos, materiais, diário e equipe.
- `Usina`: controle de insumos e produção.
- `Banco de Dados`: cadastros base (obras, equipamentos, colaboradores).
- `Configurações`: gestão de usuários, permissões e preferências.

## Stack
- `React 19`
- `Vite 6`
- `Supabase (Auth + Postgres + RLS + Edge Functions)`
- `LocalStorage` para cache/offline queue
- `Service Worker` para comportamento PWA

## Requisitos
- `Node.js` 18+
- Conta Supabase ativa

## Instalação local

1. Instalar dependências:
```bash
npm install
```

2. Criar `.env.local` na raiz do projeto:
```env
VITE_SUPABASE_URL=https://SEU-PROJETO.supabase.co
VITE_SUPABASE_ANON_KEY=SEU_ANON_KEY
```

3. Rodar em desenvolvimento:
```bash
npm run dev
```

O servidor sobe em `http://localhost:3000`.

## Scripts
- `npm run dev`: ambiente de desenvolvimento.
- `npm run build`: build de produção.
- `npm run preview`: pré-visualização da build.

## Setup do Supabase

### 1) Estrutura do banco (ordem obrigatória)
No `SQL Editor`, execute:
1. `supabase/01_core_auth_rbac.sql`
2. `supabase/02_domain_tables.sql`
3. `supabase/03_security_rls.sql`
4. `supabase/04_update_user_limit_to_25.sql` (somente se o projeto ja existia com limite 15)
5. `supabase/05_pontes_tax_and_baixada.sql` (somente para bancos antigos, adiciona impostos em materiais e data efetiva de "de baixada")
6. `supabase/06_activity_logs.sql` (somente para bancos antigos, cria feed global de ações para admin)

### 2) Primeiro usuário (admin)
- Crie o primeiro usuário em `Authentication > Users`.
- O trigger promove automaticamente o primeiro usuário para admin.

### 3) Limite de usuários
- Regra de negócio ativa no banco: máximo de `25 usuários ativos`.

### 4) Edge Function `admin-users` (CRUD de usuários no app)
O frontend já chama `admin-users` para criação/exclusão de usuários na tela `Configurações`.
O `username` pode ser omitido na criação; quando vazio, a function deriva automaticamente a partir do email.

Configuração necessária na função:
- Segredos:
  - `SUPABASE_URL`
  - `SUPABASE_ANON_KEY`
  - `SUPABASE_SERVICE_ROLE_KEY`
- `Verify JWT` habilitado na função.

Arquivo da função no projeto:
- `supabase/functions/admin-users/index.ts`

## Segurança e permissões
- Autenticação por email/senha via Supabase Auth.
- Controle de acesso por RLS + RBAC (admin e permissões por módulo).
- Permissões por usuário salvas em `profile_permissions`.
- Escopo por obra via `allowed_obra_id`.

## Offline e sincronização

### Como funciona
- Ações de escrita offline entram em fila local (`erp_offline_queue_v1`).
- Cache por usuário em `erp_cache_v1_<userId>`.
- Ao reconectar, o app sincroniza via `upsert/update` no Supabase.
- Regra de conflito: `last write wins` usando `client_updated_at`.

### Observações
- Login e operações que dependem de Auth remoto exigem internet.
- Dados já carregados e operações com fila local funcionam offline.

## PWA
- `manifest.json` e `sw.js` já incluídos.
- O Service Worker registra apenas em `https` (não registra em `localhost`).
- Em produção, o navegador pode oferecer a instalação do app (atalho).

## Estrutura resumida
```text
aplicativo-mini-erp-js/
  App.jsx
  components/
  services/
    supabaseClient.js
  supabase/
    01_core_auth_rbac.sql
    02_domain_tables.sql
    03_security_rls.sql
    functions/admin-users/index.ts
  sw.js
  manifest.json
  vite.config.js
```

## Deploy (resumo)
1. Configurar variáveis `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` no ambiente.
2. Gerar build com `npm run build`.
3. Publicar pasta `dist/` em host com HTTPS.
4. Confirmar funcionamento da Edge Function `admin-users` no projeto Supabase.

## Troubleshooting rápido

### Erro `401` ao criar usuário
- Verifique se a função `admin-users` está no mesmo projeto Supabase.
- Confirme `Verify JWT` habilitado.
- Confirme o header `Authorization: Bearer <token>` (já implementado no frontend).
- Confirme que o usuário logado é admin ativo.

### Erro de configuração Supabase no frontend
Mensagem esperada:
`Supabase nao configurado. Defina VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY no .env.local.`

### Offline não sincroniza
- Verifique se voltou internet.
- Aguarde a rotina de flush da fila offline.
- Verifique políticas RLS e permissões do usuário.

## Status atual
- Frontend convertido para JavaScript.
- Fluxo principal com Supabase integrado.
- RBAC e limite de 25 usuários implementados.
- Offline queue + sincronização implementados.
- PWA base implementada.

---
Se necessário, consulte também `supabase/SETUP.md` para o passo a passo detalhado de configuração no painel Supabase.
