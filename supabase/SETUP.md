# Supabase Setup (ERP Obras)

## 1) Criar organizacao e projeto
1. Acesse `https://supabase.com/dashboard`.
2. Clique em `New organization` (se ainda nao tiver).
3. Clique em `New project`.
4. Defina:
   - `Project name`: ex. `erp-obras-cliente`
   - `Database password`: gere e guarde
   - `Region`: escolha a mais proxima dos usuarios
5. Aguarde o provisionamento terminar.

## 2) Rodar schema SQL (ordem obrigatoria)
No painel do projeto:
1. Va em `SQL Editor`.
2. Rode os arquivos na ordem:
   1. `supabase/01_core_auth_rbac.sql`
   2. `supabase/02_domain_tables.sql`
   3. `supabase/03_security_rls.sql`
   4. `supabase/04_update_user_limit_to_25.sql` (somente se seu projeto ja existia com limite 15)
   5. `supabase/05_pontes_tax_and_baixada.sql` (somente se seu projeto ja existia antes dos campos de impostos e "de baixada")
   6. `supabase/06_activity_logs.sql` (somente se seu projeto ja existia antes do feed global de notificacoes)

## 3) Criar o primeiro usuario administrador
1. Va em `Authentication` -> `Users` -> `Add user`.
2. Crie um usuario com `email` e `password`.
3. O trigger do schema promove automaticamente o **primeiro usuario** para admin.

## 4) Obter as chaves para o frontend
1. Va em `Project Settings` -> `API`.
2. Copie:
   - `Project URL`
   - `anon public key`
3. Preencha no arquivo `.env.local`:
   - `VITE_SUPABASE_URL=...`
   - `VITE_SUPABASE_ANON_KEY=...`

## 5) Limite de usuarios
- O banco bloqueia mais de **25 usuarios ativos** (regra do plano/negocio).
- Erro esperado ao exceder: `Limite de 25 usuarios ativos atingido.`

## 6) Modelo de sincronizacao offline (ja preparado no schema)
- Todas as tabelas tem:
  - `client_updated_at`
  - `updated_at`
  - `deleted_at` (soft delete)
- Regra recomendada no app:
  - `upsert` por `id`
  - enviar `client_updated_at` do dispositivo
  - em conflito, manter o registro com `client_updated_at` mais recente (last write wins).

## 7) CRUD de usuarios dentro do app (Edge Function)
Para criar/excluir usuarios direto na tela `Configuracoes`, publique a function:

1. Instale e faça login no Supabase CLI.
2. No diretório do projeto, rode:
   - `supabase link --project-ref SEU_PROJECT_REF`
   - `supabase secrets set SUPABASE_SERVICE_ROLE_KEY=SUA_SERVICE_ROLE_KEY`
   - `supabase functions deploy admin-users --no-verify-jwt=false`
3. Confirme no painel Supabase:
   - `Edge Functions` -> `admin-users` publicada.

Observacoes:
- Nao use `service_role` no frontend.
- A function valida se o solicitante e admin ativo antes de criar/excluir usuario.
- O limite de 25 usuarios ativos continua valendo.
- Campo `username` agora pode ser omitido na criacao via app; o sistema usa o email como base.
