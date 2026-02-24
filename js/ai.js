/**
 * IronPact — AI Module
 *
 * Client-side wrapper for Supabase Edge Functions.
 * All AI features go through here.
 *
 * Public API:
 *   AI.getProgressiveOverload(exerciseName, history, unit)
 *   AI.renderOverloadCard(result, cached)  → HTML string
 */

const AI = (() => {
  const SUPABASE_URL = 'https://pwmqljgqifypjkhezaex.supabase.co';

  async function _callFunction(name, body) {
    const sb = window.Supabase;
    if (!sb) throw new Error('Supabase not initialised');

    const { data: { session } } = await sb.auth.getSession();
    if (!session) throw new Error('Not signed in');

    const res = await fetch(`${SUPABASE_URL}/functions/v1/${name}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    const data = await res.json();

    if (!res.ok) {
      if (res.status === 402) throw new Error('NOT_ENOUGH_TOKENS');
      throw new Error(data.error || `Function error ${res.status}`);
    }

    return data;
  }

  // ─── Progressive Overload ─────────────────────────────────────────────────

  async function getProgressiveOverload(exerciseName, history, unit) {
    return _callFunction('progressive-overload', {
      exercise_name: exerciseName,
      history,
      unit: unit || App.getUnit(),
    });
  }

  // ─── Render helpers ───────────────────────────────────────────────────────

  function renderOverloadCard(result, cached = false, tokensSpent = 0) {
    if (!result) return '';

    const confidenceColor = {
      high: 'var(--success)',
      medium: 'var(--warning)',
      low: 'var(--danger)',
    }[result.confidence] || 'var(--text-2)';

    const trendIcon = {
      progressing: '📈',
      stalling: '➡️',
      regressing: '📉',
      insufficient_data: '❓',
    }[result.trend] || '❓';

    const unit = App.getUnit();

    return `
      <div class="ai-overload-card">
        <div class="ai-overload-header">
          <div class="ai-overload-title">
            <span class="ai-overload-icon">🤖</span>
            Next Session Target
          </div>
          <div class="ai-overload-meta">
            ${cached ? '<span class="ai-cached-badge">cached</span>' : `<span class="ai-token-badge">−${tokensSpent} 🪙</span>`}
            <span style="color:${confidenceColor}; font-size:11px; font-weight:700; text-transform:uppercase;">
              ${result.confidence} confidence
            </span>
          </div>
        </div>

        <!-- Main recommendation -->
        <div class="ai-recommendation">
          ${result.recommendation}
        </div>

        <!-- Target numbers -->
        <div class="ai-targets">
          <div class="ai-target">
            <div class="ai-target-value">${result.target_sets}</div>
            <div class="ai-target-label">sets</div>
          </div>
          <div class="ai-target-divider">×</div>
          <div class="ai-target">
            <div class="ai-target-value">${result.target_reps}</div>
            <div class="ai-target-label">reps</div>
          </div>
          <div class="ai-target-divider">@</div>
          <div class="ai-target">
            <div class="ai-target-value">${result.target_weight}</div>
            <div class="ai-target-label">${unit}</div>
          </div>
          <div class="ai-target-trend">${trendIcon} ${result.trend?.replace('_', ' ')}</div>
        </div>

        <!-- Reasoning -->
        <div class="ai-reasoning">${result.reasoning}</div>

        <!-- Warning if any -->
        ${result.warning ? `
          <div class="ai-warning">
            ⚠️ ${result.warning}
          </div>
        ` : ''}
      </div>
    `;
  }

  function renderOverloadButton(exerciseName) {
    const balance = typeof Tokens !== 'undefined' ? Tokens.getBalance() : 0;
    const canAfford = balance >= 2;
    return `
      <button class="ai-overload-btn ${canAfford ? '' : 'ai-overload-btn-disabled'}"
              onclick="AI.requestOverload(${JSON.stringify(exerciseName)})"
              ${canAfford ? '' : 'disabled'}>
        <span>🤖 Get Overload Tip</span>
        <span class="ai-btn-cost">2 🪙</span>
      </button>
    `;
  }

  // ─── Request flow (called from progress page) ─────────────────────────────

  async function requestOverload(exerciseName) {
    const userId = App.getCloudUserId();
    if (!userId) { App.toast('Sign in to use AI features', 'error'); return; }

    const containerId = `ai-result-${exerciseName.replace(/\s+/g, '-').toLowerCase()}`;
    const container = document.getElementById(containerId);
    if (!container) return;

    // Show loading state
    container.innerHTML = `
      <div class="ai-loading">
        <div class="ai-spinner"></div>
        <span>Analysing your ${exerciseName} history…</span>
      </div>`;

    try {
      // Get exercise history from local DB
      const localUserId = DB.getCurrentUser()?.id || 'user1';
      const history = DB.getExerciseHistory(localUserId, exerciseName);

      if (history.length < 2) {
        container.innerHTML = `<div class="ai-error">Need at least 2 sessions of ${exerciseName} to generate a suggestion.</div>`;
        return;
      }

      const { result, cached, tokens_spent } = await getProgressiveOverload(
        exerciseName,
        history,
        App.getUnit()
      );

      container.innerHTML = renderOverloadCard(result, cached, tokens_spent);

      // Refresh token balance
      if (!cached && typeof Tokens !== 'undefined') {
        Tokens.refreshBalance(userId);
      }

    } catch (err) {
      if (err.message === 'NOT_ENOUGH_TOKENS') {
        container.innerHTML = `
          <div class="ai-error">
            Not enough tokens. You need 🪙 2 — earn more by logging sessions and hitting PRs.
          </div>`;
      } else {
        console.error('[AI] requestOverload error:', err);
        container.innerHTML = `<div class="ai-error">Something went wrong: ${err.message}</div>`;
      }
    }
  }

  return {
    getProgressiveOverload,
    renderOverloadCard,
    renderOverloadButton,
    requestOverload,
  };
})();

window.AI = AI;
