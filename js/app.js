/**
 * IronPact — App Shell & Router
 */

const App = {
  currentPage: 'dashboard',
  pages: ['dashboard', 'log', 'compare', 'progress', 'settings'],

  init() {
    // Register service worker
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('/ironpact/sw.js').catch(err => {
          console.warn('SW registration failed:', err);
        });
      });
    }

    // Check if user is set
    const user = DB.getCurrentUser();
    if (!user) {
      this.showUserPicker(true);
    }

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
    const map = { push: '💪', pull: '🏋️', legs: '🦵' };
    return map[type] || '🏋️';
  },

  typeColor(type) {
    const map = { push: 'var(--push-color)', pull: 'var(--pull-color)', legs: 'var(--legs-color)' };
    return map[type] || 'var(--accent)';
  },
};

window.App = App;
