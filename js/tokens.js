/**
 * IronPact — Token System
 *
 * Earn rules:
 *   +1  Log any session
 *   +2  Each new PR hit in that session
 *   +5  Weekly streak milestone (every 4 sessions in the current 7-day window)
 *
 * All cloud writes delegate to Cloud.awardTokens() / Cloud.spendTokens().
 * A local shadow balance (localStorage) keeps the UI snappy and provides
 * offline resilience. Cloud is the source of truth.
 *
 * Public API:
 *   Tokens.onSessionSaved(userId, session)    — call after Log.save()
 *   Tokens.getBalance()                       — returns cached balance (number)
 *   Tokens.refreshBalance(userId)             — fetches latest from Supabase
 *   Tokens.spend(userId, amount, reason)      — deduct tokens (returns bool)
 *   Tokens.renderBalancePill()                — update header pill
 *   Tokens.renderHistory(containerId, userId) — render recent transactions
 */

const Tokens = (() => {
  // ─── Local cache ─────────────────────────────────────────────────────────

  const BALANCE_KEY = 'ironpact_token_balance';

  function _getCached() {
    return parseInt(localStorage.getItem(BALANCE_KEY) || '0', 10);
  }

  function _setCached(n) {
    localStorage.setItem(BALANCE_KEY, String(n));
  }

  // ─── Balance pill ─────────────────────────────────────────────────────────

  function renderBalancePill(balance) {
    const b = balance !== undefined ? balance : _getCached();
    let pill = document.getElementById('token-balance-pill');
    if (!pill) {
      pill = document.createElement('div');
      pill.id = 'token-balance-pill';
      pill.className = 'token-pill';
      pill.onclick = () => App.navigate('settings');
      pill.title = 'Your token balance';

      // Inject styles once
      if (!document.getElementById('token-pill-styles')) {
        const style = document.createElement('style');
        style.id = 'token-pill-styles';
        style.textContent = `
          .token-pill {
            display: flex;
            align-items: center;
            gap: 4px;
            background: rgba(255, 193, 7, 0.15);
            border: 1px solid rgba(255, 193, 7, 0.3);
            border-radius: 20px;
            padding: 4px 10px 4px 8px;
            font-size: 13px;
            font-weight: 700;
            color: #ffc107;
            cursor: pointer;
            transition: background 0.2s, transform 0.1s;
            user-select: none;
            -webkit-tap-highlight-color: transparent;
          }
          .token-pill:active { transform: scale(0.95); }
          .token-pill-icon { font-size: 14px; line-height: 1; }

          @keyframes tokenPop {
            0%   { transform: scale(1); }
            40%  { transform: scale(1.3); }
            70%  { transform: scale(0.9); }
            100% { transform: scale(1); }
          }
          .token-pill.pop { animation: tokenPop 0.4s ease; }

          .token-earn-badge {
            position: fixed;
            top: 64px;
            right: 16px;
            z-index: 5000;
            background: #1c1c1e;
            border: 1px solid rgba(255, 193, 7, 0.4);
            border-radius: 14px;
            padding: 10px 16px;
            font-size: 14px;
            font-weight: 700;
            color: #ffc107;
            display: flex;
            align-items: center;
            gap: 8px;
            box-shadow: 0 4px 20px rgba(0,0,0,0.4);
            animation: earnBadgeIn 0.3s ease, earnBadgeOut 0.3s ease 2.2s forwards;
            pointer-events: none;
          }
          @keyframes earnBadgeIn {
            from { opacity: 0; transform: translateY(-10px) scale(0.9); }
            to   { opacity: 1; transform: translateY(0) scale(1); }
          }
          @keyframes earnBadgeOut {
            from { opacity: 1; transform: translateY(0); }
            to   { opacity: 0; transform: translateY(-8px); }
          }

          .token-history-row {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 10px 0;
            border-bottom: 1px solid var(--border);
            font-size: 13px;
          }
          .token-history-row:last-child { border-bottom: none; }
          .token-history-reason { color: var(--text-2); flex: 1; }
          .token-history-amount { font-weight: 700; margin-left: 8px; }
          .token-history-amount.earned  { color: #ffc107; }
          .token-history-amount.spent   { color: var(--danger, #ef4444); }
          .token-history-amount.purchased { color: var(--success, #22c55e); }
          .token-history-date { font-size: 11px; color: var(--text-3); margin-left: 8px; }
        `;
        document.head.appendChild(style);
      }

      // Insert before the header-user div
      const headerUser = document.getElementById('header-user');
      if (headerUser) {
        headerUser.parentNode.insertBefore(pill, headerUser);
      } else {
        const header = document.getElementById('app-header');
        if (header) header.appendChild(pill);
      }
    }

    pill.innerHTML = `<span class="token-pill-icon">🪙</span><span id="token-pill-count">${b}</span>`;
  }

  function _animatePill() {
    const pill = document.getElementById('token-balance-pill');
    if (!pill) return;
    pill.classList.remove('pop');
    // Force reflow to restart animation
    void pill.offsetWidth;
    pill.classList.add('pop');
    setTimeout(() => pill.classList.remove('pop'), 500);
  }

  function _showEarnBadge(lines) {
    // Remove existing
    document.querySelectorAll('.token-earn-badge').forEach(el => el.remove());
    const el = document.createElement('div');
    el.className = 'token-earn-badge';
    el.innerHTML = `🪙 <span>${lines.join(' · ')}</span>`;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 2600);
  }

  // ─── Core earn logic ─────────────────────────────────────────────────────

  /**
   * Called immediately after a session is saved.
   * @param {string} userId — Supabase user id
   * @param {object} session — saved session (with exercises/sets)
   */
  async function onSessionSaved(userId, session) {
    if (!userId) return; // local-only mode, skip

    const earnLines = [];
    let totalEarned = 0;

    // +1 for logging
    const logOk = await _award(userId, 1, 'Logged a session');
    if (logOk) { totalEarned += 1; earnLines.push('+1 session'); }

    // +2 per new PR in this session
    const prCount = _countPRs(session);
    if (prCount > 0) {
      const prOk = await _award(userId, prCount * 2, `PR${prCount > 1 ? 's' : ''} (×${prCount})`);
      if (prOk) { totalEarned += prCount * 2; earnLines.push(`+${prCount * 2} PR${prCount > 1 ? 's' : ''} 🏆`); }
    }

    // +5 streak bonus: check if user just hit a 4-session-week
    const streakBonus = await _checkStreakBonus(userId, session);
    if (streakBonus > 0) {
      totalEarned += streakBonus;
      earnLines.push(`+${streakBonus} streak 🔥`);
    }

    if (totalEarned > 0) {
      // Refresh balance from cloud, update pill
      await refreshBalance(userId);
      _animatePill();
      _showEarnBadge(earnLines);
    }
  }

  function _countPRs(session) {
    let count = 0;
    for (const ex of (session.exercises || [])) {
      for (const set of (ex.sets || [])) {
        if (set.isPR) count++;
      }
    }
    return count;
  }

  /**
   * Award +5 if the user has logged exactly 4 sessions in the last 7 days
   * (i.e. they just completed their 4th — the streak milestone).
   * Uses localStorage sessions so it works offline-first.
   */
  async function _checkStreakBonus(userId, session) {
    try {
      // Get recent sessions from local store
      const sessions = DB.getSessions(DB.getCurrentUser()?.id || 'user1');
      const now = new Date();
      const weekAgo = new Date(now);
      weekAgo.setDate(weekAgo.getDate() - 7);
      const weekAgoStr = weekAgo.toISOString().slice(0, 10);

      const recentCount = sessions.filter(s => s.date >= weekAgoStr).length;

      // Only award on the 4th session exactly (not 5th, 6th…)
      if (recentCount === 4) {
        const awarded = await _award(userId, 5, '4-session streak bonus');
        if (awarded) return 5;
      }
    } catch (e) {
      console.warn('[Tokens] Streak check failed:', e);
    }
    return 0;
  }

  // ─── Cloud helpers ────────────────────────────────────────────────────────

  async function _award(userId, amount, reason) {
    if (typeof Cloud === 'undefined') {
      // Offline: just bump the local cache
      _setCached(_getCached() + amount);
      return true;
    }
    const ok = await Cloud.awardTokens(userId, amount, reason);
    if (ok) _setCached(_getCached() + amount);
    return ok;
  }

  async function spend(userId, amount, reason = '') {
    if (typeof Cloud === 'undefined') {
      const current = _getCached();
      if (current < amount) {
        App.toast('Not enough tokens', 'error');
        return false;
      }
      _setCached(current - amount);
      renderBalancePill();
      return true;
    }
    const ok = await Cloud.spendTokens(userId, amount, reason);
    if (ok) {
      await refreshBalance(userId);
      renderBalancePill();
    }
    return ok;
  }

  // ─── Balance fetch ────────────────────────────────────────────────────────

  async function refreshBalance(userId) {
    if (typeof Cloud === 'undefined') {
      renderBalancePill(_getCached());
      return _getCached();
    }
    try {
      const balance = await Cloud.getTokenBalance(userId);
      _setCached(balance);
      renderBalancePill(balance);
      return balance;
    } catch (e) {
      console.warn('[Tokens] refreshBalance failed:', e);
      renderBalancePill(_getCached());
      return _getCached();
    }
  }

  function getBalance() {
    return _getCached();
  }

  // ─── History renderer ─────────────────────────────────────────────────────

  async function renderHistory(containerId, userId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    container.innerHTML = `<div style="color: var(--text-3); font-size: 13px; padding: 12px 0;">Loading…</div>`;

    try {
      const sb = window.Supabase;
      if (!sb || !userId) throw new Error('no client');

      const { data, error } = await sb
        .from('token_transactions')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) throw error;

      if (!data || data.length === 0) {
        container.innerHTML = `<div style="color: var(--text-3); font-size: 13px; padding: 12px 0;">No transactions yet — start logging! 💪</div>`;
        return;
      }

      container.innerHTML = data.map(tx => {
        const sign = tx.type === 'spent' ? '−' : '+';
        const dateStr = new Date(tx.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
        return `
          <div class="token-history-row">
            <span class="token-history-reason">${tx.reason || tx.type}</span>
            <span class="token-history-amount ${tx.type}">${sign}${Math.abs(tx.amount)}</span>
            <span class="token-history-date">${dateStr}</span>
          </div>
        `;
      }).join('');
    } catch (e) {
      console.warn('[Tokens] renderHistory error:', e);
      container.innerHTML = `<div style="color: var(--text-3); font-size: 13px; padding: 12px 0;">Could not load history.</div>`;
    }
  }

  // ─── Public API ───────────────────────────────────────────────────────────
  return {
    onSessionSaved,
    getBalance,
    refreshBalance,
    spend,
    renderBalancePill,
    renderHistory,
  };
})();

window.Tokens = Tokens;
