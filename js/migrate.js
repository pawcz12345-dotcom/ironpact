/**
 * IronPact — localStorage → Supabase Migration Utility
 *
 * Call Migrate.run() after the user has signed in.
 * It checks localStorage for existing session data and offers to upload it
 * to the cloud. On confirmation, pushes all sessions via Cloud.addSession().
 *
 * Idempotent: skips migration if data has already been migrated
 * (tracked via localStorage flag 'ip_migrated').
 */

const Migrate = (() => {
  const MIGRATED_KEY = 'ip_migrated';
  const MIGRATION_OVERLAY_ID = 'migrate-overlay';

  // ─── Internal helpers ──────────────────────────────────────────────────────

  function _hasMigrated() {
    return localStorage.getItem(MIGRATED_KEY) === '1';
  }

  function _markMigrated() {
    localStorage.setItem(MIGRATED_KEY, '1');
  }

  /**
   * Collect all local session data for both users.
   * Returns an array of { userId, sessions[] } objects.
   */
  function _collectLocalData() {
    const userKeys = ['user1', 'user2'];
    const results = [];
    for (const uid of userKeys) {
      const key = `ip_sessions_${uid}`;
      const raw = localStorage.getItem(key);
      if (raw) {
        try {
          const sessions = JSON.parse(raw);
          if (Array.isArray(sessions) && sessions.length > 0) {
            results.push({ userId: uid, sessions });
          }
        } catch (e) { /* ignore parse errors */ }
      }
    }
    return results;
  }

  function _injectStyles() {
    if (document.getElementById('migrate-styles')) return;
    const style = document.createElement('style');
    style.id = 'migrate-styles';
    style.textContent = `
      #migrate-overlay {
        position: fixed;
        inset: 0;
        z-index: 9998;
        background: rgba(10,10,15,0.75);
        backdrop-filter: blur(8px);
        -webkit-backdrop-filter: blur(8px);
        display: flex;
        align-items: flex-end;
        justify-content: center;
        animation: migrateFadeIn 0.25s ease;
      }
      @keyframes migrateFadeIn {
        from { opacity: 0; }
        to   { opacity: 1; }
      }
      .migrate-sheet {
        width: 100%;
        max-width: 480px;
        background: #13131e;
        border-radius: 28px 28px 0 0;
        padding: 32px 24px calc(28px + env(safe-area-inset-bottom, 0px));
        border-top: 1px solid rgba(255,255,255,0.08);
      }
      .migrate-handle {
        width: 36px;
        height: 4px;
        background: rgba(255,255,255,0.15);
        border-radius: 2px;
        margin: 0 auto 24px;
      }
      .migrate-icon {
        font-size: 40px;
        text-align: center;
        margin-bottom: 12px;
      }
      .migrate-title {
        font-size: 20px;
        font-weight: 800;
        color: #f0f0f8;
        text-align: center;
        margin-bottom: 8px;
      }
      .migrate-body {
        font-size: 14px;
        color: #9090b0;
        text-align: center;
        line-height: 1.6;
        margin-bottom: 28px;
      }
      .migrate-body strong {
        color: #f0f0f8;
      }
      .migrate-actions {
        display: flex;
        flex-direction: column;
        gap: 10px;
      }
      .migrate-btn {
        display: block;
        width: 100%;
        padding: 15px;
        border-radius: 14px;
        border: none;
        font-size: 16px;
        font-weight: 600;
        cursor: pointer;
        transition: opacity 0.15s, transform 0.1s;
        -webkit-tap-highlight-color: transparent;
        user-select: none;
        text-align: center;
      }
      .migrate-btn:active {
        opacity: 0.85;
        transform: scale(0.98);
      }
      .migrate-btn-primary {
        background: linear-gradient(135deg, #ff6b2b, #ff9a5c);
        color: #fff;
      }
      .migrate-btn-secondary {
        background: #1c1c2e;
        color: #9090b0;
        border: 1px solid rgba(255,255,255,0.08);
        font-size: 14px;
      }
      .migrate-progress {
        text-align: center;
        padding: 20px;
        color: #9090b0;
        font-size: 14px;
      }
      .migrate-progress .migrate-spinner {
        width: 28px;
        height: 28px;
        border: 2px solid rgba(255,107,43,0.2);
        border-top-color: #ff6b2b;
        border-radius: 50%;
        animation: migrateSpin 0.8s linear infinite;
        margin: 0 auto 12px;
      }
      @keyframes migrateSpin {
        to { transform: rotate(360deg); }
      }
    `;
    document.head.appendChild(style);
  }

  function _showOverlay(sessionCount) {
    _injectStyles();

    const el = document.createElement('div');
    el.id = MIGRATION_OVERLAY_ID;
    el.innerHTML = `
      <div class="migrate-sheet">
        <div class="migrate-handle"></div>
        <div class="migrate-icon">☁️</div>
        <div class="migrate-title">Local data found</div>
        <div class="migrate-body">
          We found <strong>${sessionCount} workout session${sessionCount !== 1 ? 's' : ''}</strong>
          saved on this device.<br><br>
          Would you like to upload them to your cloud account so you never lose them?
        </div>
        <div class="migrate-actions">
          <button class="migrate-btn migrate-btn-primary" id="migrate-yes">
            ☁️ Upload to cloud
          </button>
          <button class="migrate-btn migrate-btn-secondary" id="migrate-skip">
            Skip for now
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(el);
    document.getElementById('migrate-yes').addEventListener('click', _doMigration);
    document.getElementById('migrate-skip').addEventListener('click', _dismissOverlay);
  }

  function _dismissOverlay() {
    const el = document.getElementById(MIGRATION_OVERLAY_ID);
    if (el) el.remove();
  }

  function _showProgress(text) {
    const sheet = document.querySelector(`#${MIGRATION_OVERLAY_ID} .migrate-sheet`);
    if (!sheet) return;
    sheet.innerHTML = `
      <div class="migrate-handle"></div>
      <div class="migrate-progress">
        <div class="migrate-spinner"></div>
        ${text}
      </div>
    `;
  }

  async function _doMigration() {
    const cloudUserId = Auth?.currentUser?.id;
    if (!cloudUserId) {
      if (typeof App !== 'undefined') App.toast('Please sign in first', 'error');
      _dismissOverlay();
      return;
    }

    _showProgress('Uploading your sessions…');

    const localData = _collectLocalData();
    let total = 0;
    let succeeded = 0;
    let failed = 0;

    for (const { sessions } of localData) {
      // All local sessions are migrated to the authenticated user's cloud account
      for (const session of sessions) {
        total++;
        try {
          const result = await Cloud.addSession(cloudUserId, session);
          if (result) succeeded++;
          else failed++;
        } catch (e) {
          failed++;
          console.warn('[Migrate] Failed to upload session:', session.id, e);
        }
      }
    }

    _markMigrated();
    _dismissOverlay();

    const msg = failed > 0
      ? `Migrated ${succeeded}/${total} sessions (${failed} failed)`
      : `✅ ${succeeded} session${succeeded !== 1 ? 's' : ''} uploaded to cloud!`;
    if (typeof App !== 'undefined') App.toast(msg, succeeded > 0 ? 'success' : 'error');
  }

  // ─── Public API ────────────────────────────────────────────────────────────

  /**
   * Run the migration check. Call this after the user has authenticated.
   * Shows a UI prompt if unmigratable local data exists.
   */
  async function run() {
    if (_hasMigrated()) return; // already done
    if (!Auth?.currentUser) return; // not signed in

    const localData = _collectLocalData();
    const totalSessions = localData.reduce((sum, d) => sum + d.sessions.length, 0);

    if (totalSessions === 0) {
      _markMigrated(); // nothing to migrate
      return;
    }

    // Wait a moment so the UI has settled after sign-in
    await new Promise(resolve => setTimeout(resolve, 800));
    _showOverlay(totalSessions);
  }

  return { run };
})();

window.Migrate = Migrate;
