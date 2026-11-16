import { corsHeaders } from '../_shared/cors.ts'
import { createDb } from '../_shared/db.ts'
import { validateSession } from '../_shared/session.ts'
import { verifyPassword } from '../_shared/password.ts'
import { broadcastToUser } from '../_shared/realtime.ts'

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

// A student deletes his own account. Asks for the password again, so a phone left
// unlocked is not enough to wipe an account. See migration 20261117110000.
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { session_token, device_id, password } = await req.json()

    const db = createDb()
    const session = await validateSession(db, session_token, device_id, req)
    if ('error' in session) return json({ error: session.error }, 401)
    const user = session.user
    // The school's shared lab login belongs to the school, not to a student.
    if (user.isShared) return json({ error: 'not_allowed' }, 403)
    if (!password || typeof password !== 'string') return json({ error: 'invalid_input' }, 400)

    const { data: row } = await db
      .from('app_users')
      .select('id, phone, login, password_hash')
      .eq('id', user.id)
      .maybeSingle()
    if (!row || !(await verifyPassword(password, row.password_hash))) return json({ error: 'wrong_password' }, 403)

    // Live duels end now, so nobody is left waiting for a player who is gone.
    const { data: liveDuels } = await db
      .from('duels')
      .select('id, challenger_id, opponent_id')
      .in('status', ['pending', 'active'])
      .or(`challenger_id.eq.${user.id},opponent_id.eq.${user.id}`)
    await db
      .from('duels')
      .update({ status: 'cancelled', ended_reason: 'left' })
      .in('status', ['pending', 'active'])
      .or(`challenger_id.eq.${user.id},opponent_id.eq.${user.id}`)
    for (const d of liveDuels || []) {
      const other = d.challenger_id === user.id ? d.opponent_id : d.challenger_id
      if (other) await broadcastToUser(other, 'duel_updated', { duel_id: d.id })
    }

    await db.from('duel_queue').delete().eq('user_id', user.id)
    await db.from('phone_verifications').delete().eq('phone', row.phone)
    await db.from('client_errors').delete().eq('login', row.login)
    await db.storage.from('avatars').remove([`${user.id}.jpg`])

    // Payment records are kept for accounting, so a student who paid is anonymised instead of removed.
    const { count: paymentCount } = await db
      .from('payments')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)

    if ((paymentCount ?? 0) > 0) {
      const { error } = await db
        .from('app_users')
        .update({
          login: `deleted-${user.id.slice(0, 8)}`,
          phone: `deleted:${user.id}`,
          password_hash: '!',
          avatar_url: null,
          device_id: null,
          device_ids: [],
          session_token: null,
          session_created_at: null,
          trial_expires_at: null,
          deleted_at: new Date().toISOString(),
        })
        .eq('id', user.id)
      if (error) throw error
      // Progress, stats, mistakes, bookmarks and friendships go either way.
      await Promise.all([
        db.from('topic_progress').delete().eq('user_id', user.id),
        db.from('user_stats').delete().eq('user_id', user.id),
        db.from('test_sessions').delete().eq('user_id', user.id),
        db.from('user_mistakes').delete().eq('user_id', user.id),
        db.from('user_saved').delete().eq('user_id', user.id),
        db.from('friendships').delete().or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`),
      ])
    } else {
      const { error } = await db.from('app_users').delete().eq('id', user.id)
      if (error) throw error
    }

    return json({ data: { ok: true, anonymised: (paymentCount ?? 0) > 0 } })
  } catch (error) {
    console.error('delete-account error:', error)
    return json({ error: 'internal_error' }, 500)
  }
})
