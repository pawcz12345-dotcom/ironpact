/**
 * IronPact — Compare Page
 *
 * Compares the signed-in user against a cloud friend.
 * Friends are fetched from Cloud.getFriends(). If no friends yet,
 * shows a prompt to add one by username.
 */

const Compare = {
  _friends: [],          // cached list of friend profiles
  _selectedFriendId: null,
  _mySessionId: null,
  _friendSessionId: null,

  async render() {
    const container = document.getElementById('page-compare');
    if (!container) return;

    const userId = App.getCloudUserId();

    if (!userId) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">🔒</div>
          <div class="empty-title">Sign in to compare</div>
          <div class="empty-body">Create an account to challenge your gym friends</div>
        </div>`;
      return;
    }

    container.innerHTML = `
      <div class="page-title">Head to Head</div>
      <div style="color: var(--text-3); font-size: 13px; padding: 40px 0; text-align: center;">Loading…</div>`;

    // Load friends
    this._friends = await Cloud.getFriends(userId);
    if (!this._selectedFriendId && this._friends.length) {
      this._selectedFriendId = this._friends[0].id;
    }

    const me = {
      id: userId,
      name: App.getMyName(),
      emoji: DB.getCurrentUser()?.emoji || '🔥',
      color: 'var(--push-color)',
    };

    // No friends yet
    if (!this._friends.length) {
      container.innerHTML = `
        <div class="page-title">Head to Head</div>
        <div class="empty-state">
          <div class="empty-icon">🤝</div>
          <div class="empty-title">No friends yet</div>
          <div class="empty-body">Add a friend by their username to start competing</div>
        </div>
        ${this._renderAddFriendCard()}`;
      this._bindAddFriend();
      return;
    }

    // Get selected friend
    const friend = this._friends.find(f => f.id === this._selectedFriendId) || this._friends[0];
    const friendUser = {
      id: friend.id,
      name: friend.display_name || friend.username || 'Friend',
      emoji: friend.emoji || '⚡',
      color: 'var(--pull-color)',
    };

    // Load sessions for both
    const [mySessions, friendSessions] = await Promise.all([
      Cloud.getSessions(userId),
      Cloud.getSessions(friend.id),
    ]);

    const mySorted = mySessions.sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 10);
    const friendSorted = friendSessions.sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 10);

    if (!this._mySessionId && mySorted.length) this._mySessionId = mySorted[0].id;
    if (!this._friendSessionId && friendSorted.length) this._friendSessionId = friendSorted[0].id;

    // Compute stats from full session lists
    const myStats = this._computeStats(mySessions);
    const friendStats = this._computeStats(friendSessions);

    container.innerHTML = `
      <div class="page-title">Head to Head</div>

      <!-- Friend selector (if multiple friends) -->
      ${this._friends.length > 1 ? `
        <div style="margin-bottom: 16px;">
          <div class="form-label">Competing against</div>
          <select class="compare-session-select" style="width:100%;" onchange="Compare.selectFriend(this.value)">
            ${this._friends.map(f => `
              <option value="${f.id}" ${f.id === this._selectedFriendId ? 'selected' : ''}>
                ${f.emoji || '⚡'} ${f.display_name || f.username || 'Friend'}
              </option>`).join('')}
          </select>
        </div>
      ` : ''}

      <!-- H2H Stats -->
      <div class="card" style="margin-bottom: 20px;">
        <div class="card-title">Season Stats</div>
        ${this._renderH2HRow('Sessions (Month)', myStats.sessionsThisMonth, friendStats.sessionsThisMonth, me, friendUser)}
        ${this._renderH2HRow('Total PRs', myStats.totalPRs, friendStats.totalPRs, me, friendUser)}
        ${this._renderH2HRow('PRs This Month', myStats.prsThisMonth, friendStats.prsThisMonth, me, friendUser)}
        ${this._renderH2HRow('Week Streak 🔥', myStats.streak, friendStats.streak, me, friendUser)}
        ${this._renderH2HRow('Total Volume', myStats.totalVolume, friendStats.totalVolume, me, friendUser, true)}
        ${(myStats.bestE1RM || friendStats.bestE1RM) ? this._renderH2HRow('Best e1RM', myStats.bestE1RM || 0, friendStats.bestE1RM || 0, me, friendUser) : ''}
        ${(myStats.avgDuration || friendStats.avgDuration) ? this._renderH2HRow('Avg Duration (min)', myStats.avgDuration || 0, friendStats.avgDuration || 0, me, friendUser) : ''}
      </div>

      <!-- Session Compare -->
      <div class="section-header">
        <div class="section-title">Session Compare</div>
      </div>

      ${mySorted.length === 0 && friendSorted.length === 0 ? `
        <div class="empty-state">
          <div class="empty-icon">📊</div>
          <div class="empty-title">No sessions yet</div>
          <div class="empty-body">Log workouts to compare side by side</div>
        </div>
      ` : `
        <div class="compare-pickers">
          <div class="compare-picker-col">
            <div class="compare-picker-label" style="color: ${me.color}">${me.emoji} ${me.name}</div>
            ${mySorted.length > 0 ? `
              <select class="compare-session-select" onchange="Compare.selectSession('my', this.value)">
                ${mySorted.map(s => `
                  <option value="${s.id}" ${s.id === this._mySessionId ? 'selected' : ''}>
                    ${App.formatDate(s.date)} · ${s.type}
                  </option>`).join('')}
              </select>` : `<div class="compare-no-session">No sessions</div>`}
          </div>
          <div class="compare-picker-col">
            <div class="compare-picker-label" style="color: ${friendUser.color}">${friendUser.emoji} ${friendUser.name}</div>
            ${friendSorted.length > 0 ? `
              <select class="compare-session-select" onchange="Compare.selectSession('friend', this.value)">
                ${friendSorted.map(s => `
                  <option value="${s.id}" ${s.id === this._friendSessionId ? 'selected' : ''}>
                    ${App.formatDate(s.date)} · ${s.type}
                  </option>`).join('')}
              </select>` : `<div class="compare-no-session">No sessions</div>`}
          </div>
        </div>
        ${this._renderSessionComparison(me, friendUser, mySorted, friendSorted)}
      `}

      <!-- Add another friend -->
      <div class="section-header" style="margin-top: 24px;">
        <div class="section-title">Friends</div>
      </div>
      ${this._renderFriendsList()}
      ${this._renderAddFriendCard()}
    `;

    this._bindAddFriend();
  },

  // ─── Friend management ────────────────────────────────────────────────────

  _renderFriendsList() {
    if (!this._friends.length) return '';
    return `
      <div class="card" style="margin-bottom: 16px; padding: 0;">
        ${this._friends.map(f => `
          <div style="display:flex; align-items:center; gap:12px; padding: 14px 16px; border-bottom: 1px solid var(--border);">
            <div style="font-size: 24px;">${f.emoji || '⚡'}</div>
            <div style="flex:1;">
              <div style="font-weight: 700; font-size: 15px;">${f.display_name || 'Friend'}</div>
              <div style="font-size: 12px; color: var(--text-3);">@${f.username || '—'}</div>
            </div>
          </div>`).join('')}
      </div>`;
  },

  _renderAddFriendCard() {
    return `
      <div class="card" style="padding: 16px; margin-bottom: 8px;">
        <div class="card-title">Add Friend</div>
        <div style="font-size: 13px; color: var(--text-2); margin-bottom: 12px;">
          Enter their IronPact username to send a request.
        </div>
        <div style="display: flex; gap: 8px;">
          <input id="friend-username-input" class="input" type="text"
                 placeholder="username" autocapitalize="none"
                 style="flex:1; font-size: 15px;">
          <button class="btn btn-primary" id="add-friend-btn" style="width: auto; padding: 0 20px;">
            Add
          </button>
        </div>
        <div id="friend-request-status" style="font-size: 13px; margin-top: 8px; color: var(--text-2);"></div>
      </div>`;
  },

  _bindAddFriend() {
    const btn = document.getElementById('add-friend-btn');
    if (!btn) return;
    btn.addEventListener('click', () => this._sendFriendRequest());
    document.getElementById('friend-username-input')?.addEventListener('keydown', e => {
      if (e.key === 'Enter') this._sendFriendRequest();
    });
  },

  async _sendFriendRequest() {
    const input = document.getElementById('friend-username-input');
    const status = document.getElementById('friend-request-status');
    const username = (input?.value || '').trim().toLowerCase();
    if (!username) return;

    const userId = App.getCloudUserId();
    if (!userId) { App.toast('Sign in first', 'error'); return; }

    if (status) status.textContent = 'Sending…';

    const result = await Cloud.sendFriendRequest(userId, username);
    if (result) {
      if (status) status.textContent = `✅ Request sent to @${username}!`;
      if (input) input.value = '';
    } else {
      if (status) status.textContent = `❌ Could not find @${username} or request already sent.`;
    }
  },

  // ─── Stats engine ─────────────────────────────────────────────────────────

  _computeStats(sessions) {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const sessionsThisMonth = sessions.filter(s => new Date(s.date) >= monthStart);

    let totalVolume = 0;
    let prsThisMonth = 0;
    let totalPRs = 0;
    const prMap = {};
    const durSessions = sessions.filter(s => s.durationMinutes);

    for (const s of sessions) {
      let sessionHasPR = false;
      for (const ex of (s.exercises || [])) {
        for (const set of (ex.sets || [])) {
          totalVolume += (parseFloat(set.weight) || 0) * (parseInt(set.reps) || 0);
          // Track PRs by e1rm
          if (set.weight && set.reps) {
            const e1rm = DB.calcE1RM(set.weight, set.reps);
            if (!prMap[ex.name] || e1rm > prMap[ex.name]) {
              prMap[ex.name] = e1rm;
            }
          }
          if (set.isPR) sessionHasPR = true;
        }
      }
      if (sessionHasPR && new Date(s.date) >= monthStart) prsThisMonth++;
    }
    totalPRs = Object.keys(prMap).length;

    const streak = DB.calculateStreak(sessions);

    let bestE1RM = null;
    let bestE1RMExercise = '';
    for (const [name, e1rm] of Object.entries(prMap)) {
      if (!bestE1RM || e1rm > bestE1RM) { bestE1RM = e1rm; bestE1RMExercise = name; }
    }

    const avgDuration = durSessions.length
      ? Math.round(durSessions.reduce((s, sess) => s + sess.durationMinutes, 0) / durSessions.length)
      : null;

    return {
      sessionsThisMonth: sessionsThisMonth.length,
      totalPRs,
      prsThisMonth,
      streak,
      totalVolume: Math.round(totalVolume),
      bestE1RM,
      bestE1RMExercise,
      avgDuration,
    };
  },

  // ─── Render helpers ───────────────────────────────────────────────────────

  _renderH2HRow(label, v1, v2, user1, user2, isVolume = false) {
    const fmt = v => isVolume ? App.formatVolume(v) : (v || 0);
    const u1Wins = v1 > v2;
    const u2Wins = v2 > v1;
    return `
      <div class="h2h-row">
        <div class="h2h-row-label">${label}</div>
        <div class="h2h-grid">
          <div class="h2h-user">
            <div class="h2h-user-name" style="color: ${user1.color}">${user1.name}</div>
            <div class="h2h-value ${u1Wins ? 'h2h-leader' : ''}">${fmt(v1)}</div>
          </div>
          <div class="h2h-divider">vs</div>
          <div class="h2h-user">
            <div class="h2h-user-name" style="color: ${user2.color}">${user2.name}</div>
            <div class="h2h-value ${u2Wins ? 'h2h-leader-2' : ''}">${fmt(v2)}</div>
          </div>
        </div>
        ${u1Wins || u2Wins ? `
          <div style="text-align:center; font-size:12px; margin-top:4px;">
            <span style="color:${u1Wins ? user1.color : user2.color}; font-weight:700;">
              ${u1Wins ? user1.name : user2.name} leads 🏆
            </span>
          </div>` : ''}
      </div>`;
  },

  _renderSessionComparison(me, friendUser, mySessions, friendSessions) {
    const mySession = mySessions.find(s => s.id === this._mySessionId) || null;
    const friendSession = friendSessions.find(s => s.id === this._friendSessionId) || null;
    if (!mySession && !friendSession) return '';

    const exerciseNames = new Set();
    if (mySession) (mySession.exercises || []).forEach(e => exerciseNames.add(e.name));
    if (friendSession) (friendSession.exercises || []).forEach(e => exerciseNames.add(e.name));

    const myExMap = {};
    if (mySession) (mySession.exercises || []).forEach(e => { myExMap[e.name] = e; });
    const friendExMap = {};
    if (friendSession) (friendSession.exercises || []).forEach(e => { friendExMap[e.name] = e; });

    const myVol = mySession ? (mySession.exercises || []).reduce((t, ex) =>
      t + (ex.sets || []).reduce((s, set) => s + (parseFloat(set.weight)||0)*(parseInt(set.reps)||0), 0), 0) : 0;
    const fVol = friendSession ? (friendSession.exercises || []).reduce((t, ex) =>
      t + (ex.sets || []).reduce((s, set) => s + (parseFloat(set.weight)||0)*(parseInt(set.reps)||0), 0), 0) : 0;

    const sessionType = (mySession || friendSession)?.type || 'push';

    return `
      <div class="compare-header" style="margin-top:16px;">
        <div class="compare-user" style="border-color:${me.color}30; color:${me.color}">
          ${me.emoji} ${me.name}
          ${mySession ? `<div style="font-size:10px; color:var(--text-3); margin-top:2px;">${App.formatDate(mySession.date)} · ${mySession.type}${mySession.durationMinutes ? ' · '+mySession.durationMinutes+'m' : ''}</div>` : ''}
        </div>
        <div class="compare-vs">vs</div>
        <div class="compare-user" style="border-color:${friendUser.color}30; color:${friendUser.color}">
          ${friendUser.emoji} ${friendUser.name}
          ${friendSession ? `<div style="font-size:10px; color:var(--text-3); margin-top:2px;">${App.formatDate(friendSession.date)} · ${friendSession.type}${friendSession.durationMinutes ? ' · '+friendSession.durationMinutes+'m' : ''}</div>` : ''}
        </div>
      </div>

      <div class="compare-exercise" style="margin-bottom:12px;">
        <div class="compare-exercise-name">Total Volume</div>
        <div class="compare-body">
          <div class="compare-user-col">
            <div class="compare-user-label" style="color:${me.color}">${me.name}</div>
            <div class="compare-set-line ${myVol > fVol ? 'winner' : ''}" style="font-size:16px; font-weight:700;">${App.formatVolume(Math.round(myVol))} ${App.getUnit()}</div>
          </div>
          <div class="compare-user-col">
            <div class="compare-user-label" style="color:${friendUser.color}">${friendUser.name}</div>
            <div class="compare-set-line ${fVol > myVol ? 'winner' : ''}" style="font-size:16px; font-weight:700;">${App.formatVolume(Math.round(fVol))} ${App.getUnit()}</div>
          </div>
        </div>
      </div>

      ${[...exerciseNames].map(exName => {
        const ex1 = myExMap[exName];
        const ex2 = friendExMap[exName];
        const u1Best = ex1 ? Math.max(...(ex1.sets||[]).map(s => parseFloat(s.weight)||0)) : 0;
        const u2Best = ex2 ? Math.max(...(ex2.sets||[]).map(s => parseFloat(s.weight)||0)) : 0;
        const u1E1RM = ex1 ? Math.max(...(ex1.sets||[]).map(s => DB.calcE1RM(s.weight, s.reps))) : 0;
        const u2E1RM = ex2 ? Math.max(...(ex2.sets||[]).map(s => DB.calcE1RM(s.weight, s.reps))) : 0;
        return `
          <div class="compare-exercise">
            <div class="compare-exercise-name">${exName}
              <span class="badge badge-${sessionType}" style="margin-left:8px; font-size:10px;">${sessionType}</span>
            </div>
            <div class="compare-body">
              <div class="compare-user-col">
                <div class="compare-user-label" style="color:${me.color}">${me.name}</div>
                ${ex1 ? (ex1.sets||[]).map((set,i) => `
                  <div class="compare-set-line ${u1Best > u2Best && parseFloat(set.weight)===u1Best ? 'winner' : ''}">
                    Set ${i+1}: ${set.weight||'—'}${App.getUnit()} × ${set.reps||'—'}${set.isPR?' 🏆':''}
                  </div>`).join('') : '<div class="compare-set-line" style="color:var(--text-3)">No data</div>'}
                ${u1E1RM > 0 ? `<div style="font-size:11px; color:var(--warning); margin-top:4px;">e1RM: ${u1E1RM}${App.getUnit()}</div>` : ''}
              </div>
              <div class="compare-user-col">
                <div class="compare-user-label" style="color:${friendUser.color}">${friendUser.name}</div>
                ${ex2 ? (ex2.sets||[]).map((set,i) => `
                  <div class="compare-set-line ${u2Best > u1Best && parseFloat(set.weight)===u2Best ? 'winner' : ''}">
                    Set ${i+1}: ${set.weight||'—'}${App.getUnit()} × ${set.reps||'—'}${set.isPR?' 🏆':''}
                  </div>`).join('') : '<div class="compare-set-line" style="color:var(--text-3)">No data</div>'}
                ${u2E1RM > 0 ? `<div style="font-size:11px; color:var(--warning); margin-top:4px;">e1RM: ${u2E1RM}${App.getUnit()}</div>` : ''}
              </div>
            </div>
            <div class="compare-footer">
              ${u1Best===u2Best && u1Best>0 ? '🤝 Tie!' :
                u1Best>u2Best ? `<span style="color:${me.color}">🏆 ${me.name} leads (${u1Best}${App.getUnit()})</span>` :
                u2Best>u1Best ? `<span style="color:${friendUser.color}">🏆 ${friendUser.name} leads (${u2Best}${App.getUnit()})</span>` : '—'}
            </div>
          </div>`;
      }).join('')}

      ${(mySession?.notes || friendSession?.notes) ? `
        <div class="compare-exercise" style="margin-top:4px;">
          <div class="compare-exercise-name">📝 Notes</div>
          <div class="compare-body">
            <div class="compare-user-col">
              <div class="compare-user-label" style="color:${me.color}">${me.name}</div>
              <div style="font-size:13px; color:var(--text-2); line-height:1.5;">${mySession?.notes||'—'}</div>
            </div>
            <div class="compare-user-col">
              <div class="compare-user-label" style="color:${friendUser.color}">${friendUser.name}</div>
              <div style="font-size:13px; color:var(--text-2); line-height:1.5;">${friendSession?.notes||'—'}</div>
            </div>
          </div>
        </div>` : ''}
    `;
  },

  selectFriend(friendId) {
    this._selectedFriendId = friendId;
    this._mySessionId = null;
    this._friendSessionId = null;
    this.render();
  },

  selectSession(who, sessionId) {
    if (who === 'my') this._mySessionId = sessionId;
    else this._friendSessionId = sessionId;
    this.render();
  },
};

window.Compare = Compare;
