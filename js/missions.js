/**
 * IronPact — Missions System
 *
 * 15 missions across 3 types:
 *   daily    — reset every calendar day
 *   weekly   — reset every Mon-based week
 *   milestone — one-time, never reset
 *
 * State stored in localStorage under 'ironpact_missions'.
 * Token awards go via Cloud.awardTokens() + Tokens.refreshBalance().
 *
 * Public API:
 *   Missions.onSessionSaved()          — call after Log.save()
 *   Missions.renderDashboardSection()  — returns HTML string for dashboard
 *   Missions.claim(missionId)          — manually claim a completed mission
 *   Missions.checkAll()                — evaluate all missions, return completable ids
 *   Missions.MISSION_DEFS              — array of mission definition objects
 */

const Missions = (() => {
  const STORAGE_KEY = 'ironpact_missions';

  // ─── Mission Definitions ─────────────────────────────────────────────────

  const MISSION_DEFS = [
    // Daily (resets every calendar day)
    {
      id: 'daily_log',
      type: 'daily',
      title: 'Daily Grind',
      desc: 'Log a workout today',
      target: 1,
      reward: 1,
      icon: '💪',
      getValue: ctx => ctx.todaySessions,
    },

    // Weekly (resets every Mon-based week)
    {
      id: 'weekly_3',
      type: 'weekly',
      title: 'Three-Peat',
      desc: 'Log 3 workouts this week',
      target: 3,
      reward: 3,
      icon: '🔁',
      getValue: ctx => ctx.weekSessions,
    },
    {
      id: 'weekly_all_types',
      type: 'weekly',
      title: 'Full Rotation',
      desc: 'Log push, pull, legs & core this week',
      target: 4,
      reward: 5,
      icon: '🔄',
      getValue: ctx => ctx.weekTypeCount,
    },
    {
      id: 'weekly_pr',
      type: 'weekly',
      title: 'Record Breaker',
      desc: 'Hit a new PR this week',
      target: 1,
      reward: 2,
      icon: '🏆',
      getValue: ctx => ctx.weekPRs,
    },
    {
      id: 'weekly_volume',
      type: 'weekly',
      title: 'Volume King',
      desc: 'Log 10,000+ total volume this week',
      target: 10000,
      reward: 3,
      icon: '📦',
      getValue: ctx => ctx.weekVolume,
    },

    // Milestones (one-time, never reset)
    {
      id: 'm_10_sessions',
      type: 'milestone',
      title: 'Getting Started',
      desc: 'Log 10 total sessions',
      target: 10,
      reward: 5,
      icon: '🌱',
      getValue: ctx => ctx.totalSessions,
    },
    {
      id: 'm_50_sessions',
      type: 'milestone',
      title: 'Dedicated',
      desc: 'Log 50 total sessions',
      target: 50,
      reward: 10,
      icon: '⚡',
      getValue: ctx => ctx.totalSessions,
    },
    {
      id: 'm_100_sessions',
      type: 'milestone',
      title: 'The Grind',
      desc: 'Log 100 total sessions',
      target: 100,
      reward: 15,
      icon: '🔥',
      getValue: ctx => ctx.totalSessions,
    },
    {
      id: 'm_100_sets',
      type: 'milestone',
      title: 'Century Club',
      desc: 'Complete 100 total sets',
      target: 100,
      reward: 5,
      icon: '💯',
      getValue: ctx => ctx.totalSets,
    },
    {
      id: 'm_500_sets',
      type: 'milestone',
      title: 'Set Machine',
      desc: 'Complete 500 total sets',
      target: 500,
      reward: 10,
      icon: '🤖',
      getValue: ctx => ctx.totalSets,
    },
    {
      id: 'm_bw_5',
      type: 'milestone',
      title: 'Body Aware',
      desc: 'Log 5 workouts with bodyweight tracked',
      target: 5,
      reward: 3,
      icon: '⚖️',
      getValue: ctx => ctx.sessionsWithBW,
    },
    {
      id: 'm_streak_4',
      type: 'milestone',
      title: 'Iron Will',
      desc: 'Maintain a 4-week training streak',
      target: 4,
      reward: 10,
      icon: '🗓️',
      getValue: ctx => ctx.streak,
    },
    {
      id: 'm_10_prs',
      type: 'milestone',
      title: 'PR Collector',
      desc: 'Earn 10 personal records',
      target: 10,
      reward: 5,
      icon: '🏅',
      getValue: ctx => ctx.totalPRCount,
    },
    {
      id: 'm_friend',
      type: 'milestone',
      title: 'Social Butterfly',
      desc: 'Add a gym friend',
      target: 1,
      reward: 2,
      icon: '🤝',
      getValue: ctx => ctx.friendCount,
    },
    {
      id: 'm_vol_legend',
      type: 'milestone',
      title: 'Volume Legend',
      desc: 'Lift 1,000,000 total volume',
      target: 1000000,
      reward: 20,
      icon: '🦁',
      getValue: ctx => ctx.totalVolume,
    },
  ];

  // ─── State helpers ────────────────────────────────────────────────────────

  function _getState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : { progress: {}, claimed: {}, lastDaily: '', lastWeekly: '' };
    } catch (e) {
      return { progress: {}, claimed: {}, lastDaily: '', lastWeekly: '' };
    }
  }

  function _saveState(state) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function _getTodayStr() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  function _getWeekKey() {
    const d = new Date();
    const jan1 = new Date(d.getFullYear(), 0, 1);
    const week = Math.ceil(((d - jan1) / 86400000 + jan1.getDay() + 1) / 7);
    return `${d.getFullYear()}-W${week}`;
  }

  // ─── Context builder ──────────────────────────────────────────────────────

  function _buildContext() {
    const user = DB.getCurrentUser();
    if (!user) return null;
    const sessions = DB.getSessions(user.id);
    const todayStr = _getTodayStr();
    const now = new Date();

    // Week start = this Monday
    const dayOfWeek = now.getDay(); // 0=Sun
    const daysToMon = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - daysToMon);
    weekStart.setHours(0, 0, 0, 0);
    const weekStartStr = weekStart.toISOString().slice(0, 10);

    let todaySessions = 0;
    let weekSessions = 0;
    const weekTypes = new Set();
    let weekPRs = 0;
    let weekVolume = 0;
    let totalSessions = sessions.length;
    let totalSets = 0;
    let sessionsWithBW = 0;
    let totalVolume = 0;

    for (const s of sessions) {
      const vol = (s.exercises || []).reduce((t, ex) =>
        t + (ex.sets || []).reduce((sv, set) =>
          sv + (parseFloat(set.weight) || 0) * (parseInt(set.reps) || 0), 0), 0);
      totalVolume += vol;

      if (s.bodyweight) sessionsWithBW++;

      let sessionSets = 0;
      for (const ex of (s.exercises || [])) {
        sessionSets += (ex.sets || []).length;
      }
      totalSets += sessionSets;

      if (s.date === todayStr) todaySessions++;

      if (s.date >= weekStartStr) {
        weekSessions++;
        weekTypes.add(s.type);
        weekVolume += vol;
        // Count PRs in this session
        for (const ex of (s.exercises || [])) {
          for (const set of (ex.sets || [])) {
            if (set.isPR) weekPRs++;
          }
        }
      }
    }

    const prs = DB.getPRs(user.id);
    const totalPRCount = Object.keys(prs).length;
    const streak = DB.calculateStreak(sessions);

    // Friend count (cached from last friend fetch, or 0)
    const friendCount = _getCachedFriendCount();

    return {
      todaySessions,
      weekSessions,
      weekTypeCount: weekTypes.size,
      weekPRs,
      weekVolume: Math.round(weekVolume),
      totalSessions,
      totalSets,
      sessionsWithBW,
      streak,
      totalPRCount,
      totalVolume: Math.round(totalVolume),
      friendCount,
    };
  }

  // ─── Friend count cache ───────────────────────────────────────────────────

  const FC_KEY = 'ironpact_friend_count_cache';

  function _getCachedFriendCount() {
    return parseInt(localStorage.getItem(FC_KEY) || '0', 10);
  }

  async function _refreshFriendCount() {
    const userId = typeof App !== 'undefined' ? App.getCloudUserId() : null;
    if (!userId || typeof Cloud === 'undefined') return;
    try {
      const friends = await Cloud.getFriends(userId);
      localStorage.setItem(FC_KEY, String(friends.length));
    } catch (e) {
      // Silently fail — cached value stays
    }
  }

  // ─── Mission evaluation ───────────────────────────────────────────────────

  /**
   * Evaluates all missions against current context.
   * Handles daily/weekly resets.
   * Returns array of mission IDs that are newly completable (not yet claimed this period).
   */
  function checkAll() {
    const ctx = _buildContext();
    if (!ctx) return [];

    const state = _getState();
    const todayStr = _getTodayStr();
    const weekKey = _getWeekKey();

    // Reset daily progress if new day
    if (state.lastDaily !== todayStr) {
      for (const def of MISSION_DEFS.filter(d => d.type === 'daily')) {
        delete state.claimed[def.id + '_' + state.lastDaily];
      }
      state.lastDaily = todayStr;
    }

    // Reset weekly progress if new week
    if (state.lastWeekly !== weekKey) {
      for (const def of MISSION_DEFS.filter(d => d.type === 'weekly')) {
        delete state.claimed[def.id + '_' + state.lastWeekly];
      }
      state.lastWeekly = weekKey;
    }

    const completable = [];
    for (const def of MISSION_DEFS) {
      const claimKey = def.type === 'daily' ? def.id + '_' + todayStr
        : def.type === 'weekly' ? def.id + '_' + weekKey
        : def.id; // milestone: bare id

      if (state.claimed[claimKey]) continue; // already claimed

      const current = def.getValue(ctx);
      state.progress[def.id] = current;

      if (current >= def.target) {
        completable.push(def.id);
      }
    }

    _saveState(state);
    return completable;
  }

  // ─── Claiming ─────────────────────────────────────────────────────────────

  async function claim(missionId) {
    const def = MISSION_DEFS.find(d => d.id === missionId);
    if (!def) return;

    const state = _getState();
    const todayStr = _getTodayStr();
    const weekKey = _getWeekKey();
    const claimKey = def.type === 'daily' ? def.id + '_' + todayStr
      : def.type === 'weekly' ? def.id + '_' + weekKey
      : def.id;

    if (state.claimed[claimKey]) return; // already claimed

    // Verify it's actually complete
    const ctx = _buildContext();
    if (!ctx) return;
    const current = def.getValue(ctx);
    if (current < def.target) return;

    // Mark claimed
    state.claimed[claimKey] = Date.now();
    _saveState(state);

    // Award tokens
    const userId = typeof App !== 'undefined' ? App.getCloudUserId() : null;
    if (userId) {
      try {
        if (typeof Cloud !== 'undefined') {
          await Cloud.awardTokens(userId, def.reward, `Mission: ${def.title}`);
        }
        if (typeof Tokens !== 'undefined') {
          await Tokens.refreshBalance(userId);
        }
      } catch (e) {
        console.warn('[Missions] Token award failed:', e);
      }
    }

    // Refresh mission UI on dashboard
    const missionEl = document.getElementById('dashboard-missions');
    if (missionEl) missionEl.innerHTML = renderDashboardSection();

    if (typeof App !== 'undefined') {
      App.toast(`${def.icon} Mission: ${def.title} — +${def.reward} tokens!`, 'success');
    }
  }

  // ─── Called after session save ────────────────────────────────────────────

  async function onSessionSaved() {
    // Refresh friend count in background
    _refreshFriendCount();

    const completable = checkAll();
    if (!completable.length) return;

    for (const id of completable) {
      await claim(id);
    }
  }

  // ─── Dashboard renderer ───────────────────────────────────────────────────

  function renderDashboardSection() {
    const ctx = _buildContext();
    if (!ctx) return '';

    const state = _getState();
    const todayStr = _getTodayStr();
    const weekKey = _getWeekKey();

    // Gather missions with progress info
    const missionItems = MISSION_DEFS.map(def => {
      const claimKey = def.type === 'daily' ? def.id + '_' + todayStr
        : def.type === 'weekly' ? def.id + '_' + weekKey
        : def.id;
      const claimed = !!state.claimed[claimKey];
      const current = Math.min(def.getValue(ctx), def.target);
      const pct = Math.min(100, Math.round((current / def.target) * 100));
      const complete = current >= def.target;
      return { def, claimed, current, pct, complete };
    });

    // Show: unclaimed complete first, then in-progress, hide claimed milestones
    const visible = missionItems
      .filter(m => !m.claimed || m.def.type !== 'milestone') // always show daily/weekly even if claimed
      .filter(m => !m.claimed) // hide claimed items
      .sort((a, b) => {
        if (a.complete && !b.complete) return -1;
        if (!a.complete && b.complete) return 1;
        return b.pct - a.pct; // higher progress first
      })
      .slice(0, 4); // show top 4

    if (!visible.length) {
      // All missions claimed — show a "comeback later" card
      return `
        <div class="dash-section-label">Missions 🎯</div>
        <div class="card card-sm" style="color:var(--text-2); font-size:14px; text-align:center; padding:20px;">
          All missions complete! 🎉 New ones reset tomorrow.
        </div>`;
    }

    return `
      <div class="dash-section-label">Missions 🎯</div>
      ${visible.map(({ def, current, pct, complete }) => `
        <div class="mission-card">
          <div class="mission-card-header">
            <div class="mission-title">${def.icon} ${def.title}</div>
            <div class="mission-reward">+${def.reward} 🪙</div>
          </div>
          <div class="mission-desc">${def.desc}</div>
          <div class="mission-progress-bar-wrap">
            <div class="mission-progress-bar ${complete ? 'complete' : ''}" style="width:${pct}%"></div>
          </div>
          <div class="mission-footer">
            <div class="mission-progress-label">
              ${def.target >= 10000
                ? `${(current / 1000).toFixed(1)}k / ${(def.target / 1000).toFixed(0)}k`
                : `${current} / ${def.target}`}
              ${def.type === 'daily' ? ' · resets daily' : def.type === 'weekly' ? ' · resets weekly' : ''}
            </div>
            ${complete
              ? `<button class="mission-claim-btn" onclick="Missions.claim('${def.id}')">Claim!</button>`
              : `<div class="mission-complete-badge" style="color:var(--text-3);">${pct}%</div>`}
          </div>
        </div>
      `).join('')}
    `;
  }

  // ─── Public API ───────────────────────────────────────────────────────────
  return {
    onSessionSaved,
    renderDashboardSection,
    checkAll,
    claim,
    MISSION_DEFS,
  };
})();

window.Missions = Missions;
