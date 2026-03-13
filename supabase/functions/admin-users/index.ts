import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
}

const APP_PERMISSION_KEYS = [
  'editDashboard',
  'editOficina',
  'editCampo',
  'editAbastecimentos',
  'editBancoDados',
  'editConfiguracoes',
  'viewRelatorios',
  'viewPontes',
  'viewUsina'
]

const deriveUsernameFromEmail = (email: string) => {
  const normalizedEmail = String(email || '').trim().toLowerCase()
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
    return normalizedEmail
  }
  return `usuario_${Date.now()}`
}

const badRequest = (message: string) =>
  new Response(JSON.stringify({ ok: false, error: message }), {
    status: 400,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  })

const forbidden = (message: string) =>
  new Response(JSON.stringify({ ok: false, error: message }), {
    status: 403,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  })

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    const authHeader = req.headers.get('Authorization')

    if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
      return new Response(JSON.stringify({ ok: false, error: 'Secrets do Supabase nao configurados na function.' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    if (!authHeader) {
      return forbidden('Token de autenticacao ausente.')
    }

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false, autoRefreshToken: false }
    })

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false }
    })

    const { data: authData, error: authError } = await userClient.auth.getUser()
    if (authError || !authData?.user) {
      return forbidden('Sessao invalida.')
    }

    const requesterId = authData.user.id
    const { data: requesterProfile, error: requesterError } = await adminClient
      .from('profiles')
      .select('id, is_admin, is_active')
      .eq('id', requesterId)
      .single()

    if (requesterError || !requesterProfile) {
      return forbidden('Perfil do solicitante nao encontrado.')
    }
    if (!requesterProfile.is_admin || requesterProfile.is_active === false) {
      return forbidden('Somente admin ativo pode gerenciar usuarios.')
    }

    const body = await req.json()
    const action = body?.action

    if (action === 'create') {
      const email = String(body?.email || '').trim().toLowerCase()
      const password = String(body?.password || '')
      const name = String(body?.name || '').trim()
      const role = String(body?.role || 'Operador').trim() || 'Operador'
      const rawUsername = String(body?.username || '').trim()
      const username = rawUsername || deriveUsernameFromEmail(email)
      const allowedObraId = body?.allowedObraId === 'all' ? null : (body?.allowedObraId || null)
      const permissions = body?.permissions || {}
      const isAdmin = !!body?.isAdmin
      const isActive = body?.isActive !== false

      if (!email || !password || !name) {
        return badRequest('Email, senha e nome sao obrigatorios.')
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return badRequest('Informe um email valido para criar o usuario.')
      }

      if (password.length < 6) {
        return badRequest('A senha deve ter pelo menos 6 caracteres.')
      }

      if (isActive) {
        const { count, error: countError } = await adminClient
          .from('profiles')
          .select('id', { count: 'exact', head: true })
          .is('deleted_at', null)
          .eq('is_active', true)
        if (countError) {
          throw countError
        }
        if ((count || 0) >= 25) {
          return badRequest('Limite de 25 usuarios ativos atingido.')
        }
      }

      const { data: createdUserData, error: createUserError } = await adminClient.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          full_name: name,
          username
        }
      })

      if (createUserError || !createdUserData?.user?.id) {
        return badRequest(createUserError?.message || 'Falha ao criar usuario no auth.')
      }

      const newUserId = createdUserData.user.id
      const now = new Date().toISOString()

      const profilePayload = {
        id: newUserId,
        full_name: name,
        username,
        role,
        is_admin: isAdmin,
        is_active: isActive,
        allowed_obra_id: allowedObraId,
        client_updated_at: now
      }

      const permissionsPayload = APP_PERMISSION_KEYS.map((permissionKey) => ({
        profile_id: newUserId,
        permission_key: permissionKey,
        allowed: !!permissions[permissionKey],
        client_updated_at: now
      }))

      const [{ error: profileError }, { error: permissionsError }] = await Promise.all([
        adminClient.from('profiles').upsert(profilePayload, { onConflict: 'id' }),
        adminClient.from('profile_permissions').upsert(permissionsPayload, { onConflict: 'profile_id,permission_key' })
      ])

      if (profileError || permissionsError) {
        await adminClient.auth.admin.deleteUser(newUserId)
        return badRequest(profileError?.message || permissionsError?.message || 'Falha ao salvar perfil/permissoes.')
      }

      return new Response(JSON.stringify({
        ok: true,
        data: {
          id: newUserId,
          email
        }
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    if (action === 'delete') {
      const userId = String(body?.userId || '').trim()
      if (!userId) {
        return badRequest('userId obrigatorio.')
      }
      if (userId === requesterId) {
        return badRequest('Nao e permitido excluir o proprio usuario.')
      }

      const { data: targetProfile, error: targetError } = await adminClient
        .from('profiles')
        .select('id, is_admin, is_active')
        .eq('id', userId)
        .single()

      if (targetError || !targetProfile) {
        return badRequest('Usuario nao encontrado.')
      }

      if (targetProfile.is_admin && targetProfile.is_active !== false) {
        const { count: activeAdminsCount, error: adminsCountError } = await adminClient
          .from('profiles')
          .select('id', { count: 'exact', head: true })
          .is('deleted_at', null)
          .eq('is_admin', true)
          .eq('is_active', true)

        if (adminsCountError) {
          throw adminsCountError
        }

        if ((activeAdminsCount || 0) <= 1) {
          return badRequest('Nao e permitido excluir o ultimo admin ativo.')
        }
      }

      const { error: deleteError } = await adminClient.auth.admin.deleteUser(userId)
      if (deleteError) {
        return badRequest(deleteError.message || 'Falha ao excluir usuario.')
      }

      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    return badRequest('Acao invalida. Use action=create ou action=delete.')
  } catch (error) {
    return new Response(JSON.stringify({
      ok: false,
      error: error instanceof Error ? error.message : 'Erro inesperado na function.'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
