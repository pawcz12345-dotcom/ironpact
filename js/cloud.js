/**
 * IronPact — Cloud DB Module
 *
 * Mirrors the DB.js API but persists data to Supabase instead of localStorage.
 * All methods are async. DB.js coexists unchanged — this module runs alongside it.
 *
 * Usage:
 *   const sessions = await Cloud.getSessions(userId);
 *
 * Errors are caught internally; App.toast() is called on failure and the
 * method returns null / [] / false as appropriate.
 */

const Cloud = (() => {
  // ─── Internal helpers ──────────────────────────────────────────────────────

  function _sb() {
    if (!window.Supabase) {
      console.error('[Cloud] Supabase client not initialised.');
      return null;
    }
    return window.Supabase;
  }

  function _toast(msg, type = 'error') {
    if (typeof App !== 'undefined' && typeof App.toast === 'function') {
      App.toast(msg, type);
    } else {
      console.warn('[Cloud]', msg);
    }
  }

  function _err(context, error) {
    const msg = error?.message || String(error) || 'Unknown error';
    console.error(`[Cloud] ${context}:`, error);
    _toast(`Cloud error: ${msg}`);
  }

  // ─── Sessions ──────────────────────────────────────────────────────────────

  /**
   * Fetch all sessions for a user, including nested exercises and sets.
   * Returns them in the same shape as DB.getSessions() — an array of session
   * objects where each session has an `exercises` array and each exercise has
   * a `sets` array.
   */
  async function getSessions(userId) {
    const sb = _sb();
    if (!sb || !userId) return [];
    try {
      // Fetch sessions
      const { data: sessions, error: sessErr } = await sb
        .from('sessions')
        .select('*')
        .eq('user_id', userId)
        .order('date', { ascending: false });
      if (sessErr) throw sessErr;
      if (!sessions?.length) return [];

      const sessionIds = sessions.map(s => s.id);

      // Fetch exercises for those sessions
      const { data: exercises, error: exErr } = await sb
        .from('exercises')
        .select('*')
        .in('session_id', sessionIds)
        .order('"order"', { ascending: true });
      if (exErr) throw exErr;

      const exerciseIds = (exercises || []).map(e => e.id);

      // Fetch sets for those exercises
      let sets = [];
      if (exerciseIds.length) {
        const { data: setsData, error: setsErr } = await sb
          .from('sets')
          .select('*')
          .in('exercise_id', exerciseIds)
          .order('set_number', { ascending: true });
        if (setsErr) throw setsErr;
        sets = setsData || [];
      }

      // Assemble the nested structure
      const setsByExercise = {};
      for (const s of sets) {
        if (!setsByExercise[s.exercise_id]) setsByExercise[s.exercise_id] = [];
        setsByExercise[s.exercise_id].push(_setToLocal(s));
      }

      const exercisesBySession = {};
      for (const ex of (exercises || [])) {
        if (!exercisesBySession[ex.session_id]) exercisesBySession[ex.session_id] = [];
        exercisesBySession[ex.session_id].push({
          id: ex.id,
          name: ex.name,
          order: ex.order,
          sets: setsByExercise[ex.id] || [],
        });
      }

      return sessions.map(s => _sessionToLocal(s, exercisesBySession[s.id] || []));
    } catch (err) {
      _err('getSessions', err);
      return [];
    }
  }

  /**
   * Insert a new session (with nested exercises + sets) into Supabase.
   * Accepts the same object shape that DB.addSession() produces.
   * Returns the created session (with cloud id) or null on failure.
   */
  async function addSession(userId, session) {
    const sb = _sb();
    if (!sb || !userId || !session) return null;
    try {
      // Insert session row
      const { data: sessionRow, error: sErr } = await sb
        .from('sessions')
        .insert(_sessionToCloud(userId, session))
        .select()
        .single();
      if (sErr) throw sErr;

      const sessionId = sessionRow.id;

      // Insert exercises
      const exercises = session.exercises || [];
      if (exercises.length) {
        const exRows = exercises.map((ex, idx) => ({
          session_id: sessionId,
          name: ex.name || '',
          order: ex.order ?? idx,
        }));

        const { data: exData, error: exErr } = await sb
          .from('exercises')
          .insert(exRows)
          .select();
        if (exErr) throw exErr;

        // Insert sets for each exercise
        const allSetRows = [];
        for (let i = 0; i < exercises.length; i++) {
          const ex = exercises[i];
          const exRow = exData[i];
          for (let j = 0; j < (ex.sets || []).length; j++) {
            const set = ex.sets[j];
            allSetRows.push(_setToCloud(exRow.id, set, j + 1));
          }
        }

        if (allSetRows.length) {
          const { error: setErr } = await sb.from('sets').insert(allSetRows);
          if (setErr) throw setErr;
        }
      }

      return { ...session, id: sessionId, cloudId: sessionId };
    } catch (err) {
      _err('addSession', err);
      return null;
    }
  }

  /**
   * Update a session's top-level fields. Does not handle exercises/sets —
   * for full updates, delete and re-insert.
   */
  async function updateSession(userId, sessionId, data) {
    const sb = _sb();
    if (!sb || !userId || !sessionId) return null;
    try {
      const updateData = {};
      if (data.date !== undefined) updateData.date = data.date;
      if (data.type !== undefined) updateData.type = data.type;
      if (data.duration_minutes !== undefined) updateData.duration_minutes = data.duration_minutes;
      if (data.durationMinutes !== undefined) updateData.duration_minutes = data.durationMinutes;
      if (data.bodyweight !== undefined) updateData.bodyweight = data.bodyweight || null;
      if (data.notes !== undefined) updateData.notes = data.notes || null;
      if (data.program_version !== undefined) updateData.program_version = data.program_version;
      if (data.programVersion !== undefined) updateData.program_version = data.programVersion;

      const { data: updated, error } = await sb
        .from('sessions')
        .update(updateData)
        .eq('id', sessionId)
        .eq('user_id', userId)
        .select()
        .single();
      if (error) throw error;
      return updated;
    } catch (err) {
      _err('updateSession', err);
      return null;
    }
  }

  /**
   * Delete a session (cascades to exercises and sets via FK constraints).
   */
  async function deleteSession(userId, sessionId) {
    const sb = _sb();
    if (!sb || !userId || !sessionId) return false;
    try {
      const { error } = await sb
        .from('sessions')
        .delete()
        .eq('id', sessionId)
        .eq('user_id', userId);
      if (error) throw error;
      return true;
    } catch (err) {
      _err('deleteSession', err);
      return false;
    }
  }

  // ─── Profile ───────────────────────────────────────────────────────────────

  async function getProfile(userId) {
    const sb = _sb();
    if (!sb || !userId) return null;
    try {
      const { data, error } = await sb
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();
      if (error) throw error;
      return data;
    } catch (err) {
      _err('getProfile', err);
      return null;
    }
  }

  async function updateProfile(userId, data) {
    const sb = _sb();
    if (!sb || !userId) return null;
    try {
      const { data: updated, error } = await sb
        .from('profiles')
        .update(data)
        .eq('id', userId)
        .select()
        .single();
      if (error) throw error;
      return updated;
    } catch (err) {
      _err('updateProfile', err);
      return null;
    }
  }

  // ─── Program ───────────────────────────────────────────────────────────────

  async function getProgram(userId) {
    const sb = _sb();
    if (!sb || !userId) return null;
    try {
      const { data, error } = await sb
        .from('programs')
        .select('*')
        .eq('user_id', userId)
        .order('version', { ascending: false })
        .limit(1)
        .single();
      if (error) {
        if (error.code === 'PGRST116') return null; // no rows
        throw error;
      }
      return data;
    } catch (err) {
      _err('getProgram', err);
      return null;
    }
  }

  async function saveProgram(userId, programData) {
    const sb = _sb();
    if (!sb || !userId) return null;
    try {
      // Get current max version
      const existing = await getProgram(userId);
      const version = existing ? existing.version + 1 : 1;

      const { data, error } = await sb
        .from('programs')
        .insert({ user_id: userId, version, data: programData })
        .select()
        .single();
      if (error) throw error;
      return data;
    } catch (err) {
      _err('saveProgram', err);
      return null;
    }
  }

  // ─── PRs ───────────────────────────────────────────────────────────────────

  async function getPRs(userId) {
    const sb = _sb();
    if (!sb || !userId) return [];
    try {
      const { data, error } = await sb
        .from('prs')
        .select('*')
        .eq('user_id', userId);
      if (error) throw error;
      // Convert to object keyed by exercise_name (matching DB.getPRs() shape)
      const map = {};
      for (const pr of (data || [])) {
        map[pr.exercise_name] = {
          weight: pr.weight,
          reps: pr.reps,
          e1rm: pr.e1rm,
          date: pr.achieved_at,
          sessionId: pr.session_id,
          isPR: true,
        };
      }
      return map;
    } catch (err) {
      _err('getPRs', err);
      return {};
    }
  }

  async function upsertPR(userId, exerciseName, prData) {
    const sb = _sb();
    if (!sb || !userId || !exerciseName) return null;
    try {
      const row = {
        user_id: userId,
        exercise_name: exerciseName,
        weight: prData.weight,
        reps: prData.reps,
        e1rm: prData.e1rm || null,
        session_id: prData.sessionId || null,
        achieved_at: prData.date || new Date().toISOString().slice(0, 10),
      };
      const { data, error } = await sb
        .from('prs')
        .upsert(row, { onConflict: 'user_id,exercise_name' })
        .select()
        .single();
      if (error) throw error;
      return data;
    } catch (err) {
      _err('upsertPR', err);
      return null;
    }
  }

  // ─── Friends ───────────────────────────────────────────────────────────────

  async function getFriends(userId) {
    const sb = _sb();
    if (!sb || !userId) return [];
    try {
      // Step 1: get accepted connections involving this user
      const { data: conns, error: connErr } = await sb
        .from('friend_connections')
        .select('id, requester_id, addressee_id')
        .eq('status', 'accepted')
        .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`);
      if (connErr) throw connErr;
      if (!conns || !conns.length) return [];

      // Step 2: collect friend ids
      const friendIds = conns.map(c =>
        c.requester_id === userId ? c.addressee_id : c.requester_id
      );

      // Step 3: fetch friend profiles
      const { data: profiles, error: profErr } = await sb
        .from('profiles')
        .select('id, display_name, username, emoji, unit')
        .in('id', friendIds);
      if (profErr) throw profErr;

      // Map connection id back onto each profile
      return (profiles || []).map(p => {
        const conn = conns.find(c => c.requester_id === p.id || c.addressee_id === p.id);
        return { connectionId: conn?.id, ...p };
      });
    } catch (err) {
      _err('getFriends', err);
      return [];
    }
  }

  async function sendFriendRequest(userId, targetUsername) {
    const sb = _sb();
    if (!sb || !userId || !targetUsername) return null;
    try {
      // Find target user by username
      const { data: target, error: findErr } = await sb
        .from('profiles')
        .select('id, display_name, username')
        .eq('username', targetUsername)
        .single();
      if (findErr || !target) throw findErr || new Error('User not found');
      if (target.id === userId) throw new Error('You cannot add yourself');

      const { data, error } = await sb
        .from('friend_connections')
        .insert({ requester_id: userId, addressee_id: target.id, status: 'pending' })
        .select()
        .single();
      if (error) throw error;
      return data;
    } catch (err) {
      _err('sendFriendRequest', err);
      return null;
    }
  }

  async function acceptFriendRequest(connectionId) {
    const sb = _sb();
    if (!sb || !connectionId) return null;
    try {
      const { data, error } = await sb
        .from('friend_connections')
        .update({ status: 'accepted' })
        .eq('id', connectionId)
        .select()
        .single();
      if (error) throw error;
      return data;
    } catch (err) {
      _err('acceptFriendRequest', err);
      return null;
    }
  }

  // ─── Tokens ────────────────────────────────────────────────────────────────

  async function getTokenBalance(userId) {
    const sb = _sb();
    if (!sb || !userId) return 0;
    try {
      const { data, error } = await sb
        .from('profiles')
        .select('token_balance')
        .eq('id', userId)
        .single();
      if (error) throw error;
      return data?.token_balance ?? 0;
    } catch (err) {
      _err('getTokenBalance', err);
      return 0;
    }
  }

  async function awardTokens(userId, amount, reason = '') {
    const sb = _sb();
    if (!sb || !userId || !amount) return false;
    try {
      // Insert transaction record
      const { error: txErr } = await sb
        .from('token_transactions')
        .insert({ user_id: userId, amount, type: 'earned', reason });
      if (txErr) throw txErr;

      // Increment balance on profile
      const { error: profileErr } = await sb.rpc('increment_tokens', {
        uid: userId,
        delta: amount,
      });
      // Fallback if RPC not available: manual read-modify-write
      if (profileErr) {
        const current = await getTokenBalance(userId);
        const { error: updateErr } = await sb
          .from('profiles')
          .update({ token_balance: current + amount })
          .eq('id', userId);
        if (updateErr) throw updateErr;
      }
      return true;
    } catch (err) {
      _err('awardTokens', err);
      return false;
    }
  }

  async function spendTokens(userId, amount, reason = '') {
    const sb = _sb();
    if (!sb || !userId || !amount) return false;
    try {
      const current = await getTokenBalance(userId);
      if (current < amount) {
        _toast('Not enough tokens', 'error');
        return false;
      }

      // Insert transaction record
      const { error: txErr } = await sb
        .from('token_transactions')
        .insert({ user_id: userId, amount, type: 'spent', reason });
      if (txErr) throw txErr;

      // Decrement balance
      const { error: updateErr } = await sb
        .from('profiles')
        .update({ token_balance: current - amount })
        .eq('id', userId);
      if (updateErr) throw updateErr;

      return true;
    } catch (err) {
      _err('spendTokens', err);
      return false;
    }
  }

  // ─── Shape converters ──────────────────────────────────────────────────────

  /** Convert a Supabase sessions row to the local app shape. */
  function _sessionToLocal(row, exercises = []) {
    return {
      id: row.id,
      cloudId: row.id,
      userId: row.user_id,
      date: row.date,
      type: row.type,
      durationMinutes: row.duration_minutes,
      bodyweight: row.bodyweight,
      notes: row.notes,
      programVersion: row.program_version,
      createdAt: row.created_at,
      exercises,
    };
  }

  /** Convert local session to Supabase insert shape. */
  function _sessionToCloud(userId, session) {
    return {
      user_id: userId,
      date: session.date,
      type: session.type,
      duration_minutes: session.durationMinutes ?? session.duration_minutes ?? null,
      bodyweight: session.bodyweight || null,
      notes: session.notes || null,
      program_version: session.programVersion ?? session.program_version ?? null,
    };
  }

  /** Convert a Supabase sets row to local app shape. */
  function _setToLocal(row) {
    return {
      id: row.id,
      setNumber: row.set_number,
      weight: row.weight !== null ? String(row.weight) : '',
      reps: row.reps !== null ? String(row.reps) : '',
      rir: row.rir !== null ? String(row.rir) : undefined,
      isPR: row.is_pr ?? false,
      e1rm: row.e1rm,
    };
  }

  /** Convert local set to Supabase insert shape. */
  function _setToCloud(exerciseId, set, setNumber) {
    return {
      exercise_id: exerciseId,
      set_number: setNumber,
      weight: parseFloat(set.weight) || null,
      reps: parseInt(set.reps) || null,
      rir: set.rir !== undefined && set.rir !== '' ? parseInt(set.rir) : null,
      is_pr: set.isPR ?? false,
      e1rm: set.e1rm ? parseFloat(set.e1rm) : null,
    };
  }

  // ─── Public API ────────────────────────────────────────────────────────────
  return {
    getSessions,
    addSession,
    updateSession,
    deleteSession,
    getProfile,
    updateProfile,
    getProgram,
    saveProgram,
    getPRs,
    upsertPR,
    getFriends,
    sendFriendRequest,
    acceptFriendRequest,
    getTokenBalance,
    awardTokens,
    spendTokens,
  };
})();

window.Cloud = Cloud;
