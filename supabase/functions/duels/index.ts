import { corsHeaders } from '../_shared/cors.ts'
import { createDb } from '../_shared/db.ts'
import { validateSession } from '../_shared/session.ts'
import { broadcastToUser } from '../_shared/realtime.ts'

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

const QUESTIONS_PER_DUEL = 10
const COUNTDOWN_SECONDS = 6
const MAX_RANDOM_DUELS_PER_HOUR = 30

const asLang = (v: unknown): 'uz' | 'ru' => (v === 'ru' ? 'ru' : 'uz')

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const body = await req.json()
    const { action, session_token, device_id } = body

    const db = createDb()
    const session = await validateSession(db, session_token, device_id, req)
    if ('error' in session) return json({ error: session.error }, 401)
    const userId = session.user.id

    // Duels nobody plays any more are closed here as well as by the minute job,
    // so a player who asks never sees a room that is already dead.
    if (action !== 'leaderboard' && action !== 'queue-leave') {
      await db.rpc('resolve_stale_duels', { p_user: userId })
    }

    switch (action) {
      case 'challenge': {
        const { opponent_login } = body
        if (!opponent_login || typeof opponent_login !== 'string') return json({ error: 'invalid_input' }, 400)

        const { data: opponent } = await db
          .from('app_users')
          .select('id')
          .ilike('login', opponent_login.trim())
          .maybeSingle()
        if (!opponent) return json({ error: 'user_not_found' }, 404)
        if (opponent.id === userId) return json({ error: 'invalid_input' }, 400)

        const { data: friendship } = await db
          .from('friendships')
          .select('id, status')
          .or(
            `and(requester_id.eq.${userId},addressee_id.eq.${opponent.id}),and(requester_id.eq.${opponent.id},addressee_id.eq.${userId})`,
          )
          .maybeSingle()
        if (!friendship || friendship.status !== 'accepted') return json({ error: 'not_friends' }, 403)

        // If either side already has a live duel with the other, reuse that
        // room instead of creating a second one.
        const { data: existingDuel } = await db
          .from('duels')
          .select('id')
          .or(
            `and(challenger_id.eq.${userId},opponent_id.eq.${opponent.id}),and(challenger_id.eq.${opponent.id},opponent_id.eq.${userId})`,
          )
          .in('status', ['pending', 'active'])
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()
        if (existingDuel) return json({ data: { duel_id: existingDuel.id } })

        // topic_id stays filled for app builds that still play a whole topic.
        const { data: topics } = await db.from('topics').select('id')
        if (!topics || topics.length === 0) return json({ error: 'no_topics_available' }, 500)
        const topicId = topics[Math.floor(Math.random() * topics.length)].id

        const lang = asLang(body.lang)
        const { data: questionIds } = await db.rpc('duel_pick_questions', { p_lang: lang, p_count: QUESTIONS_PER_DUEL })

        const { data: duel, error: insertErr } = await db
          .from('duels')
          .insert({
            challenger_id: userId,
            opponent_id: opponent.id,
            topic_id: topicId,
            lang,
            question_ids: questionIds,
            total_questions: QUESTIONS_PER_DUEL,
          })
          .select('id')
          .single()
        if (insertErr) {
          // Two people pressed "challenge" on each other at the same moment.
          if (insertErr.code === '23505') {
            const { data: again } = await db
              .from('duels')
              .select('id')
              .in('status', ['pending', 'active'])
              .or(
                `and(challenger_id.eq.${userId},opponent_id.eq.${opponent.id}),and(challenger_id.eq.${opponent.id},opponent_id.eq.${userId})`,
              )
              .limit(1)
              .maybeSingle()
            if (again) return json({ data: { duel_id: again.id } })
          }
          throw insertErr
        }

        await broadcastToUser(opponent.id, 'duel_invite', { duel_id: duel.id })
        return json({ data: { duel_id: duel.id } })
      }

      case 'respond': {
        const { duel_id, accept } = body
        if (!duel_id || typeof accept !== 'boolean') return json({ error: 'invalid_input' }, 400)

        const { data: duel } = await db
          .from('duels')
          .select('id, challenger_id, opponent_id, status, question_ids')
          .eq('id', duel_id)
          .maybeSingle()
        if (!duel || duel.status !== 'pending') return json({ error: 'not_found' }, 404)

        const isOpponent = duel.opponent_id === userId
        const isChallenger = duel.challenger_id === userId
        if (!isOpponent && !isChallenger) return json({ error: 'not_found' }, 404)

        // The challenger can only take the challenge back; accepting is for the invited player.
        if (accept && !isOpponent) return json({ error: 'not_found' }, 404)

        const update: Record<string, unknown> = {
          responded_at: new Date().toISOString(),
          status: accept ? 'active' : isChallenger ? 'cancelled' : 'declined',
        }
        if (isChallenger && !accept) update.ended_reason = 'left'
        if (accept) update.start_at = new Date(Date.now() + COUNTDOWN_SECONDS * 1000).toISOString()

        // Guarded by status: cancelling and accepting at the same moment can't both win.
        const { data: changed, error: updateErr } = await db
          .from('duels')
          .update(update)
          .eq('id', duel_id)
          .eq('status', 'pending')
          .select('id')
        if (updateErr) throw updateErr
        if (!changed || changed.length === 0) return json({ error: 'not_found' }, 404)

        // Both sides hear about it at once, so both start from the same push.
        await Promise.all([
          broadcastToUser(duel.challenger_id, 'duel_updated', { duel_id }),
          broadcastToUser(duel.opponent_id, 'duel_updated', { duel_id }),
        ])
        return json({ data: { ok: true } })
      }

      case 'list': {
        const { data: rows, error } = await db
          .from('duels')
          .select(
            'id, challenger_id, opponent_id, topic_id, status, challenger_score, opponent_score, winner_id, created_at, source, start_at',
          )
          .or(`challenger_id.eq.${userId},opponent_id.eq.${userId}`)
          .in('status', ['pending', 'active'])
          .order('created_at', { ascending: false })
        if (error) throw error

        const otherIds = (rows || []).map((d: any) => (d.challenger_id === userId ? d.opponent_id : d.challenger_id))
        const { data: others } = otherIds.length
          ? await db.from('app_users').select('id, login, avatar_url').in('id', otherIds)
          : { data: [] }
        const usersById = new Map((others || []).map((u: any) => [u.id, u]))

        // Scores of a live duel stay hidden, so nobody can adapt to the other's result.
        const hide = (d: any) => ({ ...d, challenger_score: null, opponent_score: null })

        const incoming = (rows || [])
          .filter((d: any) => d.status === 'pending' && d.opponent_id === userId)
          .map((d: any) => ({ ...hide(d), opponent_user: usersById.get(d.challenger_id) }))
        const outgoing = (rows || [])
          .filter((d: any) => d.status === 'pending' && d.challenger_id === userId)
          .map((d: any) => ({ ...hide(d), opponent_user: usersById.get(d.opponent_id) }))
        const active = (rows || [])
          .filter((d: any) => d.status === 'active')
          .map((d: any) => ({
            ...hide(d),
            opponent_user: usersById.get(d.challenger_id === userId ? d.opponent_id : d.challenger_id),
          }))

        return json({ data: { incoming, outgoing, active } })
      }

      case 'get': {
        const { duel_id } = body
        if (!duel_id) return json({ error: 'invalid_input' }, 400)

        const { data: duel } = await db.from('duels').select('*').eq('id', duel_id).maybeSingle()
        if (!duel || (duel.challenger_id !== userId && duel.opponent_id !== userId)) {
          return json({ error: 'not_found' }, 404)
        }

        const otherId = duel.challenger_id === userId ? duel.opponent_id : duel.challenger_id
        const { data: other } = await db.from('app_users').select('id, login, avatar_url').eq('id', otherId).maybeSingle()

        const isChallenger = duel.challenger_id === userId
        const completed = duel.status === 'completed'
        const {
          challenger_answers: _ca,
          opponent_answers: _oa,
          challenger_seen: _cs,
          opponent_seen: _os,
          ...safe
        } = duel
        const myAnswers = isChallenger ? duel.challenger_answers : duel.opponent_answers
        return json({
          data: {
            ...safe,
            // The other player's score is shown only once the duel is over.
            challenger_score: completed ? duel.challenger_score : null,
            opponent_score: completed ? (isChallenger ? duel.opponent_score : duel.challenger_score) : null,
            opponent_user: other,
            my_score: isChallenger ? duel.challenger_score : duel.opponent_score,
            my_finished: isChallenger ? duel.challenger_finished : duel.opponent_finished,
            my_answers: myAnswers ?? {},
            opponent_finished: isChallenger ? duel.opponent_finished : duel.challenger_finished,
            server_now: new Date().toISOString(),
          },
        })
      }

      case 'heartbeat': {
        const { duel_id, answers } = body
        if (!duel_id) return json({ error: 'invalid_input' }, 400)

        const { data: duel } = await db
          .from('duels')
          .select('id, challenger_id, opponent_id, status, start_at, challenger_finished, opponent_finished')
          .eq('id', duel_id)
          .maybeSingle()
        if (!duel || (duel.challenger_id !== userId && duel.opponent_id !== userId)) {
          return json({ error: 'not_found' }, 404)
        }

        const isChallenger = duel.challenger_id === userId
        if (duel.status === 'active') {
          const patch: Record<string, unknown> = isChallenger
            ? { challenger_seen: new Date().toISOString() }
            : { opponent_seen: new Date().toISOString() }
          // Progress is saved on the server too, so a reload can pick up where the player was.
          const finished = isChallenger ? duel.challenger_finished : duel.opponent_finished
          if (!finished && answers && typeof answers === 'object' && !Array.isArray(answers)) {
            patch[isChallenger ? 'challenger_answers' : 'opponent_answers'] = answers
          }
          await db.from('duels').update(patch).eq('id', duel_id).eq('status', 'active')
        }
        return json({ data: { status: duel.status, server_now: new Date().toISOString() } })
      }

      case 'submit-result': {
        const { duel_id, answers, correct_count, total_questions } = body
        if (!duel_id) return json({ error: 'invalid_input' }, 400)

        const { data: duel } = await db.from('duels').select('*').eq('id', duel_id).maybeSingle()
        if (!duel || (duel.challenger_id !== userId && duel.opponent_id !== userId) || duel.status !== 'active') {
          return json({ error: 'not_found' }, 404)
        }
        const isChallenger = duel.challenger_id === userId
        const otherId = isChallenger ? duel.opponent_id : duel.challenger_id

        // New builds: the server scores the answers itself, atomically.
        if (duel.question_ids && answers && typeof answers === 'object') {
          const { data: result, error } = await db.rpc('duel_submit', {
            p_duel: duel_id,
            p_user: userId,
            p_answers: answers,
          })
          if (error) throw error
          if (result?.error) return json({ error: result.error }, 409)
          await broadcastToUser(otherId, 'duel_updated', { duel_id })
          return json({ data: { ok: true, completed: !!result.completed, my_score: result.my_score } })
        }

        // Old app builds still report their own score. Kept working, but guarded:
        // once per player, never more than the number of questions.
        if (typeof correct_count !== 'number' || typeof total_questions !== 'number') {
          return json({ error: 'invalid_input' }, 400)
        }
        if ((isChallenger && duel.challenger_finished) || (!isChallenger && duel.opponent_finished)) {
          return json({ error: 'already_submitted' }, 409)
        }
        const total = Math.max(0, Math.min(Math.floor(total_questions), 200))
        const score = Math.max(0, Math.min(Math.floor(correct_count), total))
        const update: Record<string, unknown> = isChallenger
          ? { challenger_score: score, challenger_finished: true }
          : { opponent_score: score, opponent_finished: true }
        update.total_questions = total

        const bothFinished = isChallenger ? duel.opponent_finished : duel.challenger_finished
        if (bothFinished) {
          const challengerScore = isChallenger ? score : duel.challenger_score
          const opponentScore = isChallenger ? duel.opponent_score : score
          update.status = 'completed'
          update.ended_reason = 'finished'
          update.completed_at = new Date().toISOString()
          update.winner_id =
            challengerScore === opponentScore
              ? null
              : challengerScore > opponentScore
                ? duel.challenger_id
                : duel.opponent_id
        }
        const { error: updateErr } = await db.from('duels').update(update).eq('id', duel_id).eq('status', 'active')
        if (updateErr) throw updateErr
        await broadcastToUser(otherId, 'duel_updated', { duel_id })
        return json({ data: { ok: true, completed: !!bothFinished } })
      }

      case 'leave': {
        const { duel_id } = body
        if (!duel_id) return json({ error: 'invalid_input' }, 400)
        const { data: result, error } = await db.rpc('duel_leave', { p_duel: duel_id, p_user: userId })
        if (error) throw error
        if (result?.error) return json({ error: 'not_found' }, 404)
        if (result.other) await broadcastToUser(result.other, 'duel_updated', { duel_id })
        return json({ data: { ok: true, result: result.result } })
      }

      case 'queue-join': {
        const lang = asLang(body.lang)
        // Strangers only play full-access students, so the trial lesson limit can't be bypassed.
        if (!session.user.fullAccess) return json({ error: 'trial_locked' }, 403)

        const { count } = await db
          .from('duels')
          .select('id', { count: 'exact', head: true })
          .eq('source', 'random')
          .or(`challenger_id.eq.${userId},opponent_id.eq.${userId}`)
          .gt('created_at', new Date(Date.now() - 3600 * 1000).toISOString())
        if ((count ?? 0) >= MAX_RANDOM_DUELS_PER_HOUR) return json({ error: 'rate_limited' }, 429)

        const { data: duelId, error } = await db.rpc('duel_match_or_enqueue', { p_user: userId, p_lang: lang })
        if (error) throw error
        if (duelId) {
          const { data: duel } = await db.from('duels').select('challenger_id, opponent_id').eq('id', duelId).single()
          await Promise.all([
            broadcastToUser(duel.challenger_id, 'duel_matched', { duel_id: duelId }),
            broadcastToUser(duel.opponent_id, 'duel_matched', { duel_id: duelId }),
          ])
          return json({ data: { matched: true, duel_id: duelId } })
        }
        return json({ data: { matched: false } })
      }

      case 'queue-poll': {
        // The heartbeat is what keeps a searching player "online" for matchmaking.
        await db.from('duel_queue').update({ heartbeat_at: new Date().toISOString() }).eq('user_id', userId)

        const { data: stillWaiting } = await db.from('duel_queue').select('user_id').eq('user_id', userId).maybeSingle()
        if (stillWaiting) return json({ data: { matched: false, searching: true } })

        // Not in the queue any more: either matched by someone else's search, or timed out.
        const { data: duel } = await db
          .from('duels')
          .select('id')
          .eq('source', 'random')
          .in('status', ['pending', 'active'])
          .or(`challenger_id.eq.${userId},opponent_id.eq.${userId}`)
          .gt('created_at', new Date(Date.now() - 60 * 1000).toISOString())
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()
        if (duel) return json({ data: { matched: true, duel_id: duel.id } })
        return json({ data: { matched: false, searching: false } })
      }

      case 'queue-leave': {
        await db.from('duel_queue').delete().eq('user_id', userId)
        return json({ data: { ok: true } })
      }

      case 'leaderboard': {
        const { data, error } = await db.rpc('get_duel_leaderboard')
        if (error) throw error
        return json({ data })
      }

      default:
        return json({ error: 'invalid_action' }, 400)
    }
  } catch (error) {
    console.error('duels error:', error)
    return json({ error: 'internal_error' }, 500)
  }
})
