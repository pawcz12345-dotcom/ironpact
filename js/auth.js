/**
 * IronPact — Auth Module
 *
 * Handles Google (and stub for Apple) OAuth via Supabase.
 * Shows a full-screen auth overlay when the user is not signed in.
 * After sign-in, checks if profile row exists; if not, triggers onboarding.
 *
 * Exposes:
 *   Auth.currentUser    — Supabase user object (or null)
 *   Auth.currentProfile — profiles row (or null)
 *   Auth.signInWithGoogle()
 *   Auth.signInWithApple()  — TODO: requires Apple Sign-In domain setup
 *   Auth.signOut()
 *   Auth.getSession()
 *   Auth.onAuthChange(callback)
 */

const Auth = (() => {
  // ─── State ─────────────────────────────────────────────────────────────────
  let currentUser = null;
  let currentProfile = null;
  let authChangeCallbacks = [];
  let authOverlay = null;

  // ─── Internal helpers ──────────────────────────────────────────────────────

  function _supabase() {
    if (!window.Supabase) {
      console.error('[Auth] Supabase client not initialised — check script order.');
      return null;
    }
    return window.Supabase;
  }

  async function _fetchProfile(userId) {
    const sb = _supabase();
    if (!sb) return null;
    try {
      const { data, error } = await sb
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();
      if (error) throw error;
      return data;
    } catch (err) {
      console.warn('[Auth] Could not fetch profile:', err.message);
      return null;
    }
  }

  async function _handleSession(session) {
    if (session?.user) {
      currentUser = session.user;
      currentProfile = await _fetchProfile(session.user.id);
      _hideAuthOverlay();

      // Trigger onboarding for brand-new users (profile has default name "Lifter")
      if (currentProfile && currentProfile.display_name === 'Lifter' && !currentProfile.username) {
        // Defer so App has time to initialise
        setTimeout(() => {
          if (typeof App !== 'undefined' && typeof App.showOnboarding === 'function') {
            App.showOnboarding();
          }
        }, 400);
      }
    } else {
      currentUser = null;
      currentProfile = null;
      _showAuthOverlay();
    }

    // Notify subscribers
    authChangeCallbacks.forEach(cb => {
      try { cb(currentUser, currentProfile); } catch (e) { /* ignore */ }
    });
  }

  // ─── Auth overlay UI ───────────────────────────────────────────────────────

  function _buildAuthOverlay() {
    const el = document.createElement('div');
    el.id = 'auth-overlay';
    el.innerHTML = `
      <div class="auth-sheet">
        <!-- Logo / branding -->
        <div class="auth-logo-wrap">
          <div class="auth-logo-icon">⚡</div>
          <div class="auth-logo-name">IronPact</div>
          <div class="auth-tagline">Track lifts. Crush PRs.<br>Compete with your gym buddy.</div>
        </div>

        <!-- Sign-in buttons -->
        <div class="auth-buttons">
          <button class="auth-btn auth-btn-google" onclick="Auth.signInWithGoogle()">
            <svg class="auth-btn-icon" viewBox="0 0 24 24" aria-hidden="true">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Sign in with Google
          </button>

          <button class="auth-btn auth-btn-apple" onclick="Auth.signInWithApple()">
            <svg class="auth-btn-icon" viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">
              <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
            </svg>
            Sign in with Apple
          </button>
        </div>

        <div class="auth-footer">
          By continuing you agree to the<br>IronPact Terms & Privacy Policy.
        </div>
      </div>
    `;

    // Inject styles
    if (!document.getElementById('auth-styles')) {
      const style = document.createElement('style');
      style.id = 'auth-styles';
      style.textContent = `
        #auth-overlay {
          position: fixed;
          inset: 0;
          z-index: 9999;
          background: #0a0a0f;
          display: flex;
          align-items: flex-end;
          justify-content: center;
          padding-bottom: env(safe-area-inset-bottom, 0px);
          animation: authFadeIn 0.3s ease;
        }
        @keyframes authFadeIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        .auth-sheet {
          width: 100%;
          max-width: 480px;
          background: #13131e;
          border-radius: 28px 28px 0 0;
          padding: 40px 28px calc(32px + env(safe-area-inset-bottom, 0px));
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0;
        }
        .auth-logo-wrap {
          text-align: center;
          margin-bottom: 40px;
        }
        .auth-logo-icon {
          font-size: 64px;
          line-height: 1;
          margin-bottom: 12px;
          filter: drop-shadow(0 0 24px rgba(255,107,43,0.6));
        }
        .auth-logo-name {
          font-size: 36px;
          font-weight: 900;
          letter-spacing: -1px;
          background: linear-gradient(135deg, #ff6b2b, #ff9a5c);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          margin-bottom: 10px;
        }
        .auth-tagline {
          font-size: 15px;
          color: #9090b0;
          line-height: 1.5;
        }
        .auth-buttons {
          width: 100%;
          display: flex;
          flex-direction: column;
          gap: 12px;
          margin-bottom: 24px;
        }
        .auth-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          width: 100%;
          padding: 15px 20px;
          border-radius: 14px;
          border: none;
          font-size: 16px;
          font-weight: 600;
          cursor: pointer;
          transition: opacity 0.15s, transform 0.1s;
          -webkit-tap-highlight-color: transparent;
          user-select: none;
        }
        .auth-btn:active {
          opacity: 0.85;
          transform: scale(0.98);
        }
        .auth-btn-icon {
          width: 20px;
          height: 20px;
          flex-shrink: 0;
        }
        .auth-btn-google {
          background: #ffffff;
          color: #1a1a1a;
        }
        .auth-btn-apple {
          background: #1c1c1e;
          color: #f0f0f8;
          border: 1px solid rgba(255,255,255,0.12);
        }
        .auth-footer {
          font-size: 12px;
          color: #606080;
          text-align: center;
          line-height: 1.6;
        }
        .auth-loading {
          position: fixed;
          inset: 0;
          z-index: 10000;
          background: rgba(10,10,15,0.85);
          display: flex;
          align-items: center;
          justify-content: center;
          flex-direction: column;
          gap: 16px;
          color: #9090b0;
          font-size: 15px;
        }
        .auth-spinner {
          width: 36px;
          height: 36px;
          border: 3px solid rgba(255,107,43,0.2);
          border-top-color: #ff6b2b;
          border-radius: 50%;
          animation: authSpin 0.8s linear infinite;
        }
        @keyframes authSpin {
          to { transform: rotate(360deg); }
        }
      `;
      document.head.appendChild(style);
    }

    return el;
  }

  function _showAuthOverlay() {
    if (authOverlay) return; // already shown
    authOverlay = _buildAuthOverlay();
    document.body.appendChild(authOverlay);
  }

  function _hideAuthOverlay() {
    if (!authOverlay) return;
    authOverlay.remove();
    authOverlay = null;
  }

  function _showLoading(msg = 'Signing in…') {
    let el = document.getElementById('auth-loading-overlay');
    if (!el) {
      el = document.createElement('div');
      el.id = 'auth-loading-overlay';
      el.className = 'auth-loading';
      el.innerHTML = `<div class="auth-spinner"></div><div>${msg}</div>`;
      document.body.appendChild(el);
    }
    return el;
  }

  function _hideLoading() {
    const el = document.getElementById('auth-loading-overlay');
    if (el) el.remove();
  }

  // ─── Public API ────────────────────────────────────────────────────────────

  async function signInWithGoogle() {
    const sb = _supabase();
    if (!sb) return;
    _showLoading('Signing in with Google…');
    try {
      const { error } = await sb.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: 'https://pawcz12345-dotcom.github.io/ironpact/',
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          },
        },
      });
      if (error) throw error;
      // Browser will redirect — nothing more to do here
    } catch (err) {
      _hideLoading();
      const msg = err.message || 'Sign-in failed';
      if (typeof App !== 'undefined') App.toast(msg, 'error');
      else alert(msg);
      console.error('[Auth] Google sign-in error:', err);
    }
  }

  async function signInWithApple() {
    // TODO: Apple Sign-In requires:
    //   1. An Apple Developer account with Sign in with Apple capability
    //   2. A registered Services ID and domain verification for:
    //      https://pawcz12345-dotcom.github.io/ironpact/
    //   3. Enable Apple provider in Supabase Dashboard → Auth → Providers
    // For now, show an informational message.
    if (typeof App !== 'undefined') {
      App.toast('Apple Sign-In coming soon! Use Google for now.', '');
    } else {
      alert('Apple Sign-In is not yet configured. Please use Google Sign-In.');
    }
  }

  async function signOut() {
    const sb = _supabase();
    if (!sb) return;
    try {
      const { error } = await sb.auth.signOut();
      if (error) throw error;
      currentUser = null;
      currentProfile = null;
      _showAuthOverlay();
    } catch (err) {
      console.error('[Auth] Sign-out error:', err);
      if (typeof App !== 'undefined') App.toast('Sign-out failed', 'error');
    }
  }

  async function getSession() {
    const sb = _supabase();
    if (!sb) return null;
    try {
      const { data: { session } } = await sb.auth.getSession();
      return session;
    } catch (err) {
      console.warn('[Auth] getSession error:', err);
      return null;
    }
  }

  function onAuthChange(callback) {
    authChangeCallbacks.push(callback);
  }

  // ─── Bootstrap ─────────────────────────────────────────────────────────────

  async function _init() {
    const sb = _supabase();
    if (!sb) return;

    // Listen for auth state changes (covers OAuth redirects, token refresh, etc.)
    sb.auth.onAuthStateChange(async (event, session) => {
      console.log('[Auth] Auth state change:', event);
      await _handleSession(session);
    });

    // Check for an existing session on page load
    const { data: { session } } = await sb.auth.getSession();
    await _handleSession(session);
  }

  // Run init as soon as the script loads (DOM may not be ready yet for overlay,
  // but we wait for DOMContentLoaded before showing the overlay).
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _init);
  } else {
    _init();
  }

  // ─── Public surface ────────────────────────────────────────────────────────
  return {
    get currentUser() { return currentUser; },
    get currentProfile() { return currentProfile; },
    signInWithGoogle,
    signInWithApple,
    signOut,
    getSession,
    onAuthChange,
  };
})();

window.Auth = Auth;
