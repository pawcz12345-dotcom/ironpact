/**
 * IronPact — App Shell & Router
 */

const App = {
  currentPage: 'dashboard',
  pages: ['dashboard', 'log', 'compare', 'progress', 'settings'],

  async init() {
    // Register service worker
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('/ironpact/sw.js').catch(err => {
          console.warn('SW registration failed:', err);
        });
      });
    }

    // Auth.init() has already run via DOMContentLoaded. Check for existing session.
    let cloudSession = null;
    if (typeof Auth !== 'undefined') {
      cloudSession = await Auth.getSession();
    }

    if (cloudSession) {
      await this._initWithCloudUser(cloudSession);
    } else if (typeof Auth !== 'undefined') {
      // Not signed in — Auth module shows overlay automatically.
      Auth.onAuthChange(async (user, profile) => {
        if (user && !this._cloudInitDone) {
          this._cloudInitDone = true;
          await this._initWithCloudUser({ user });
          if (typeof Migrate !== 'undefined') Migrate.run();
        }
      });
      this._initShell();
    } else {
      this._initShell();
    }
  },

  /** Boot the app shell with a signed-in cloud user. */
  async _initWithCloudUser(session) {
    this._cloudInitDone = true;

    // Normalise: session may be a Supabase session or a bare { user } object
    const user = session?.user || Auth?.currentUser;
    const userId = user?.id;

    if (userId && typeof Cloud !== 'undefined') {
      try {
        const profile = await Cloud.getProfile(userId);
        if (profile) {
          const settings = DB.getSettings();
          settings.userName1 = profile.display_name || settings.userName1;
          settings.unit = profile.unit || settings.unit;
          // Stash cloud user id and profile for use anywhere in the app
          settings._cloudUserId = userId;
          settings._cloudUsername = profile.username || '';
          settings._cloudDisplayName = profile.display_name || '';
          DB.saveSettings(settings);
        }
      } catch (e) {
        console.warn('[App] Could not sync cloud profile:', e);
      }
    }

    // Always use user1 as the local DB slot for the signed-in user
    DB.setCurrentUser('user1');
    this._initShell();

    // Token pill
    if (userId && typeof Tokens !== 'undefined') {
      Tokens.renderBalancePill();
      Tokens.refreshBalance(userId);
    }

    // Offer migration of local data
    if (typeof Migrate !== 'undefined') {
      setTimeout(() => Migrate.run(), 1000);
    }
  },

  _initShell() {
    this.initNav();

    const urlPage = new URLSearchParams(window.location.search).get('page');
    if (urlPage && this.pages.includes(urlPage)) {
      this.navigate(urlPage);
    } else {
      this.navigate('dashboard');
    }

    this.updateHeaderUser();

    // Show onboarding for brand-new cloud users
    const profile = Auth?.currentProfile;
    const isNewUser = profile &&
      (profile.display_name === 'Lifter' || profile.display_name === 'Player 1') &&
      !profile.username;
    if (isNewUser) {
      setTimeout(() => this.showOnboarding(), 400);
    }
  },

  showOnboarding() {
    const existing = document.getElementById('onboarding-overlay');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.id = 'onboarding-overlay';
    overlay.className = 'overlay open';
    overlay.innerHTML = `
      <div class="overlay-sheet" style="max-height: 90vh; overflow-y: auto;">
        <div class="overlay-handle"></div>
        <div style="font-size: 32px; text-align: center; margin-bottom: 8px;">⚡</div>
        <div class="overlay-title" style="text-align: center; font-size: 22px;">Welcome to IronPact</div>
        <div style="font-size: 14px; color: var(--text-2); text-align: center; margin-bottom: 24px; line-height: 1.5;">
          Track your lifts, crush PRs, and compete with your friends.
        </div>

        <div class="form-label">Your display name</div>
        <input id="onboard-name1" class="input" type="text" placeholder="e.g. Alex"
               style="margin-bottom: 16px;" value="">

        <div class="form-label">Username <span style="color: var(--text-3); font-weight: 400;">(for friend requests)</span></div>
        <input id="onboard-username" class="input" type="text" placeholder="e.g. alex_lifts"
               style="margin-bottom: 20px;" value=""
               autocomplete="username" autocapitalize="none">

        <div class="form-label">Weight unit</div>
        <div class="unit-toggle" style="margin-bottom: 28px;">
          <button class="unit-btn active" id="onboard-kg" onclick="App.onboardSelectUnit('kg')">kg</button>
          <button class="unit-btn" id="onboard-lbs" onclick="App.onboardSelectUnit('lbs')">lbs</button>
        </div>

        <button class="btn btn-primary" onclick="App.completeOnboarding()" style="width: 100%;">
          Let's go 💪
        </button>
      </div>
    `;
    document.body.appendChild(overlay);
  },

  onboardSelectUnit(unit) {
    document.getElementById('onboard-kg').classList.toggle('active', unit === 'kg');
    document.getElementById('onboard-lbs').classList.toggle('active', unit === 'lbs');
    this._onboardUnit = unit;
  },

  async completeOnboarding() {
    const name = (document.getElementById('onboard-name1')?.value || '').trim() || 'Lifter';
    const username = (document.getElementById('onboard-username')?.value || '').trim().toLowerCase().replace(/[^a-z0-9_]/g, '') || null;
    const unit = this._onboardUnit || 'kg';

    // Save locally
    const settings = DB.getSettings();
    settings.userName1 = name;
    settings.unit = unit;
    DB.saveSettings(settings);
    DB.setCurrentUser('user1');

    // Sync to cloud profile
    const userId = Auth?.currentUser?.id;
    if (userId && typeof Cloud !== 'undefined') {
      await Cloud.updateProfile(userId, {
        display_name: name,
        unit,
        ...(username ? { username } : {}),
      });
    }

    const overlay = document.getElementById('onboarding-overlay');
    if (overlay) overlay.remove();

    this.updateHeaderUser();
    this.navigate('dashboard');
    this.toast(`Welcome, ${name}! 🎉`, 'success');
  },

  initNav() {
    document.querySelectorAll('.nav-item').forEach(item => {
      item.addEventListener('click', () => {
        const page = item.dataset.page;
        if (page) this.navigate(page);
      });
    });
  },

  navigate(page) {
    if (!this.pages.includes(page)) return;

    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

    const pageEl = document.getElementById(`page-${page}`);
    if (pageEl) pageEl.classList.add('active');

    const navEl = document.querySelector(`.nav-item[data-page="${page}"]`);
    if (navEl) navEl.classList.add('active');

    this.currentPage = page;

    if (page !== 'log' && typeof Log !== 'undefined') {
      Log.stopRestTimer();
    }

    switch (page) {
      case 'dashboard': Dashboard.render(); break;
      case 'log': Log.render(); break;
      case 'compare': Compare.render().catch(e => {
        console.error('[Compare] render error:', e);
        const c = document.getElementById('page-compare');
        if (c) c.innerHTML = `<div class="empty-state"><div class="empty-icon">⚠️</div><div class="empty-title">Something went wrong</div><div class="empty-body">${e.message}</div></div>`;
      }); break;
      case 'progress': Progress.render(); break;
      case 'settings': Settings.render(); break;
    }
  },

  updateHeaderUser() {
    const el = document.getElementById('header-user');
    if (!el) return;

    // Prefer cloud profile name
    const settings = DB.getSettings();
    const displayName = settings._cloudDisplayName || settings.userName1 || 'You';
    const user = DB.getCurrentUser();
    const emoji = user?.emoji || '🔥';

    el.innerHTML = `
      <span class="user-emoji">${emoji}</span>
      <span>${displayName}</span>
    `;
  },

  // ── Cloud user helpers ────────────────────────────────────────────────────

  /** Get the Supabase user id of the signed-in user (or null). */
  getCloudUserId() {
    return Auth?.currentUser?.id || null;
  },

  /** Get display name for the current user. */
  getMyName() {
    const settings = DB.getSettings();
    return settings._cloudDisplayName || settings.userName1 || 'You';
  },

  getUnit() {
    return DB.getSettings().unit || 'kg';
  },

  // ── Legacy stubs (kept for progress.js / other pages that still call these) ──

  getUserName(userId) {
    // In single-account mode, always return our own name
    return this.getMyName();
  },

  getUserById(userId) {
    const user = DB.getCurrentUser();
    return user ? { ...user, name: this.getMyName() } : null;
  },

  // ─── Toast ────────────────────────────────────────────────────────────────

  toast(message, type = '') {
    const el = document.getElementById('toast');
    if (!el) return;
    el.textContent = message;
    el.className = `show ${type}`;
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => { el.className = ''; }, 2500);
  },

  // ─── Formatting helpers ───────────────────────────────────────────────────

  formatDate(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr + 'T00:00:00');
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = `${yesterday.getFullYear()}-${String(yesterday.getMonth()+1).padStart(2,'0')}-${String(yesterday.getDate()).padStart(2,'0')}`;
    if (dateStr === DB.getTodayStr()) return 'Today';
    if (dateStr === yesterdayStr) return 'Yesterday';
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  },

  formatVolume(vol) {
    if (vol >= 1000) return `${(vol/1000).toFixed(1)}k`;
    return vol.toString();
  },

  typeEmoji(type) {
    const map = { push: '💪', pull: '🏋️', legs: '🦵', core: '🧱' };
    return map[type] || '🏋️';
  },

  typeColor(type) {
    const map = {
      push: 'var(--push-color)',
      pull: 'var(--pull-color)',
      legs: 'var(--legs-color)',
      core: 'var(--core-color)',
    };
    return map[type] || 'var(--accent)';
  },
};

window.App = App;
