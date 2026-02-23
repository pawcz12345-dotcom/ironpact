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

    // ── Auth-aware startup ────────────────────────────────────────────────────
    // Auth.init() has already run (it fires on DOMContentLoaded via supabase.js
    // loading). Check if we already have a valid cloud session.

    let cloudSession = null;
    if (typeof Auth !== 'undefined') {
      cloudSession = await Auth.getSession();
    }

    if (cloudSession) {
      // Signed-in path — load cloud profile
      await this._initWithCloudUser(cloudSession);
    } else if (typeof Auth !== 'undefined') {
      // Not signed in — Auth module shows its overlay automatically.
      // Listen for when the user signs in so we can continue init.
      Auth.onAuthChange(async (user, profile) => {
        if (user && !this._cloudInitDone) {
          this._cloudInitDone = true;
          await this._initWithCloudUser({ user });
          // Offer migration of any local data
          if (typeof Migrate !== 'undefined') Migrate.run();
        }
      });
      // Still boot the shell so it's ready in the background
      this._initShell(true);
    } else {
      // No Auth module — fall back to pure local mode
      this._initLocal();
    }
  },

  /** Boot the app shell with a signed-in cloud user. */
  async _initWithCloudUser(session) {
    this._cloudInitDone = true;
    const userId = session?.user?.id || Auth?.currentUser?.id;

    // Attempt to sync profile from cloud to local-shaped object
    if (userId && typeof Cloud !== 'undefined') {
      try {
        const profile = await Cloud.getProfile(userId);
        if (profile) {
          // Map cloud profile fields into the local settings shape so existing
          // UI components (header, onboarding check) continue to work.
          const settings = DB.getSettings();
          settings.userName1 = profile.display_name || settings.userName1;
          settings.unit = profile.unit || settings.unit;
          DB.saveSettings(settings);

          // Store cloud user ID so DB helpers can find it
          if (!DB.getCurrentUser()) {
            DB.setCurrentUser('user1');
          }
        }
      } catch (e) {
        console.warn('[App] Could not sync cloud profile:', e);
      }
    }

    this._initShell(false);

    // After shell boots, offer migration
    if (typeof Migrate !== 'undefined') {
      setTimeout(() => Migrate.run(), 1000);
    }
  },

  /** Boot the app using purely local (localStorage) data. */
  _initLocal() {
    const settings = DB.getSettings();
    const isFirstLaunch =
      settings.userName1 === 'Player 1' &&
      settings.userName2 === 'Player 2' &&
      !DB.getCurrentUser();

    this._initShell(isFirstLaunch);
  },

  /**
   * Initialise nav, routing, header and user picker.
   * @param {boolean} isFirstLaunch — show onboarding if true
   */
  _initShell(isFirstLaunch) {
    // Init nav
    this.initNav();

    // Handle URL param
    const urlPage = new URLSearchParams(window.location.search).get('page');
    if (urlPage && this.pages.includes(urlPage)) {
      this.navigate(urlPage);
    } else {
      this.navigate('dashboard');
    }

    // Init header user display
    this.updateHeaderUser();

    // Init user picker
    this.initUserPicker();

    if (isFirstLaunch) {
      setTimeout(() => this.showOnboarding(), 300);
    } else if (!DB.getCurrentUser()) {
      // Local mode: prompt user selection
      if (typeof Auth === 'undefined' || !Auth.currentUser) {
        this.showUserPicker(true);
      }
    }
  },

  showOnboarding() {
    // Remove any existing onboarding
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
          Track your lifts, crush PRs, and compete with your gym buddy.
        </div>

        <div class="form-label">Your name</div>
        <input id="onboard-name1" class="input" type="text" placeholder="e.g. Alex"
               style="margin-bottom: 16px;"
               value="">

        <div class="form-label">Gym buddy's name <span style="color: var(--text-3); font-weight: 400;">(optional)</span></div>
        <input id="onboard-name2" class="input" type="text" placeholder="e.g. Jordan"
               style="margin-bottom: 20px;"
               value="">

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

  completeOnboarding() {
    const name1 = (document.getElementById('onboard-name1')?.value || '').trim() || 'Player 1';
    const name2 = (document.getElementById('onboard-name2')?.value || '').trim() || 'Player 2';
    const unit = this._onboardUnit || 'kg';

    const settings = DB.getSettings();
    settings.userName1 = name1;
    settings.userName2 = name2;
    settings.unit = unit;
    DB.saveSettings(settings);

    // Auto-select user 1
    DB.setCurrentUser('user1');

    // Remove overlay
    const overlay = document.getElementById('onboarding-overlay');
    if (overlay) overlay.remove();

    this.updateHeaderUser();
    this.navigate('dashboard');
    this.toast(`Welcome, ${name1}! 🎉`, 'success');
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

    // Hide all pages
    document.querySelectorAll('.page').forEach(p => {
      p.classList.remove('active');
    });

    // Deactivate all nav items
    document.querySelectorAll('.nav-item').forEach(n => {
      n.classList.remove('active');
    });

    // Show target page
    const pageEl = document.getElementById(`page-${page}`);
    if (pageEl) {
      pageEl.classList.add('active');
    }

    // Activate nav item
    const navEl = document.querySelector(`.nav-item[data-page="${page}"]`);
    if (navEl) navEl.classList.add('active');

    this.currentPage = page;

    // Stop rest timer if navigating away from log
    if (page !== 'log' && typeof Log !== 'undefined') {
      Log.stopRestTimer();
    }

    // Render page content
    switch (page) {
      case 'dashboard': Dashboard.render(); break;
      case 'log': Log.render(); break;
      case 'compare': Compare.render(); break;
      case 'progress': Progress.render(); break;
      case 'settings': Settings.render(); break;
    }
  },

  updateHeaderUser() {
    const user = DB.getCurrentUser();
    const el = document.getElementById('header-user');
    if (!el) return;
    if (user) {
      el.innerHTML = `
        <span class="user-emoji">${user.emoji}</span>
        <span>${user.name}</span>
      `;
    } else {
      el.innerHTML = `<span>Select User</span>`;
    }
  },

  initUserPicker() {
    const overlay = document.getElementById('user-picker-overlay');
    if (!overlay) return;

    // Close on backdrop click
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        const user = DB.getCurrentUser();
        if (user) this.hideUserPicker();
      }
    });

    // Populate users
    this.renderUserPicker();
  },

  renderUserPicker() {
    const container = document.getElementById('user-picker-list');
    if (!container) return;
    const users = DB.getUsers();
    const current = DB.getCurrentUser();
    const settings = DB.getSettings();

    container.innerHTML = users.map(user => {
      const stats = DB.getStats(user.id);
      const name = user.id === 'user1' ? settings.userName1 : settings.userName2;
      return `
        <div class="user-option ${current?.id === user.id ? 'selected' : ''}"
             onclick="App.selectUser('${user.id}')">
          <div class="user-option-emoji">${user.emoji}</div>
          <div class="user-option-info">
            <div class="user-option-name">${name}</div>
            <div class="user-option-stats">${stats.totalSessions} sessions · ${stats.streak} wk streak</div>
          </div>
          ${current?.id === user.id ? '<div class="text-accent">✓</div>' : ''}
        </div>
      `;
    }).join('');
  },

  selectUser(userId) {
    DB.setCurrentUser(userId);
    this.hideUserPicker();
    this.updateHeaderUser();
    // Re-render current page
    this.navigate(this.currentPage);
    App.toast(`Switched to ${App.getUserName(userId)}`, 'success');
  },

  showUserPicker(required = false) {
    const overlay = document.getElementById('user-picker-overlay');
    if (overlay) {
      overlay.classList.add('open');
      this.renderUserPicker();
    }
  },

  hideUserPicker() {
    const overlay = document.getElementById('user-picker-overlay');
    if (overlay) overlay.classList.remove('open');
  },

  getUserName(userId) {
    const settings = DB.getSettings();
    const users = DB.getUsers();
    const user = users.find(u => u.id === userId);
    if (!user) return 'Unknown';
    return userId === 'user1' ? settings.userName1 : settings.userName2;
  },

  getUserById(userId) {
    const users = DB.getUsers();
    const settings = DB.getSettings();
    const user = users.find(u => u.id === userId);
    if (!user) return null;
    return {
      ...user,
      name: userId === 'user1' ? settings.userName1 : settings.userName2,
    };
  },

  getUnit() {
    return DB.getSettings().unit || 'kg';
  },

  toast(message, type = '') {
    const el = document.getElementById('toast');
    if (!el) return;
    el.textContent = message;
    el.className = `show ${type}`;
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => {
      el.className = '';
    }, 2500);
  },

  formatDate(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr + 'T00:00:00');
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const todayStr = DB.getTodayStr();
    const yesterdayStr = `${yesterday.getFullYear()}-${String(yesterday.getMonth()+1).padStart(2,'0')}-${String(yesterday.getDate()).padStart(2,'0')}`;

    if (dateStr === todayStr) return 'Today';
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
    const map = { push: 'var(--push-color)', pull: 'var(--pull-color)', legs: 'var(--legs-color)', core: 'var(--core-color)' };
    return map[type] || 'var(--accent)';
  },
};

window.App = App;
