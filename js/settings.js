/**
 * IronPact — Settings Page
 */

const Settings = {
  render() {
    const container = document.getElementById('page-settings');
    if (!container) return;

    const settings = DB.getSettings();
    const users = DB.getUsers();
    const currentUser = DB.getCurrentUser();

    container.innerHTML = `
      <div class="page-title">Settings</div>

      <!-- Users -->
      <div class="settings-section-title">Players</div>

      <div class="settings-row">
        <div class="settings-row-left">
          <div class="settings-row-label">🔥 Player 1 Name</div>
        </div>
        <input class="settings-input" type="text"
               value="${this.escHtml(settings.userName1)}"
               placeholder="Player 1"
               style="background: var(--bg-3); border: 1px solid var(--border); color: var(--text); border-radius: var(--radius-sm); padding: 8px 12px; font-size: 15px; font-family: inherit; text-align: right; max-width: 140px;"
               onchange="Settings.updateSetting('userName1', this.value)">
      </div>

      <div class="settings-row">
        <div class="settings-row-left">
          <div class="settings-row-label">⚡ Player 2 Name</div>
        </div>
        <input class="settings-input" type="text"
               value="${this.escHtml(settings.userName2)}"
               placeholder="Player 2"
               style="background: var(--bg-3); border: 1px solid var(--border); color: var(--text); border-radius: var(--radius-sm); padding: 8px 12px; font-size: 15px; font-family: inherit; text-align: right; max-width: 140px;"
               onchange="Settings.updateSetting('userName2', this.value)">
      </div>

      <!-- Units -->
      <div class="settings-section-title">Preferences</div>

      <div class="settings-row">
        <div class="settings-row-left">
          <div class="settings-row-label">Weight Unit</div>
          <div class="settings-row-sub">Used throughout the app</div>
        </div>
        <div class="unit-toggle">
          <button class="unit-btn ${settings.unit === 'kg' ? 'active' : ''}"
                  onclick="Settings.setUnit('kg')">kg</button>
          <button class="unit-btn ${settings.unit === 'lbs' ? 'active' : ''}"
                  onclick="Settings.setUnit('lbs')">lbs</button>
        </div>
      </div>

      <!-- Program Editor -->
      <div class="settings-section-title">Workout Program</div>
      <div class="card" style="padding: 16px; margin-bottom: 0;">
        <div id="program-container"></div>
      </div>

      <!-- Data Management -->
      <div class="settings-section-title">Data</div>

      <div class="settings-row" style="cursor: pointer;" onclick="Settings.exportData()">
        <div class="settings-row-left">
          <div class="settings-row-label">📤 Export My Data</div>
          <div class="settings-row-sub">Download JSON backup</div>
        </div>
        <div style="color: var(--accent);">→</div>
      </div>

      <div class="settings-row" style="cursor: pointer;" onclick="Settings.triggerImport()">
        <div class="settings-row-left">
          <div class="settings-row-label">📥 Import Data</div>
          <div class="settings-row-sub">Restore from JSON backup</div>
        </div>
        <div style="color: var(--accent-2);">→</div>
      </div>
      <input type="file" id="import-file-input" accept=".json" style="display:none;" onchange="Settings.importData(this)">

      <div class="settings-row" style="cursor: pointer;" onclick="Settings.exportAllData()">
        <div class="settings-row-left">
          <div class="settings-row-label">🔄 Export All (Both Users)</div>
          <div class="settings-row-sub">Full backup for migration</div>
        </div>
        <div style="color: var(--accent);">→</div>
      </div>

      <!-- About -->
      <div class="settings-section-title">About</div>
      <div class="card card-sm">
        <div style="font-size: 24px; font-weight: 900; background: linear-gradient(135deg, #ff6b2b, #ff9a5c); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; margin-bottom: 4px;">
          IronPact
        </div>
        <div style="font-size: 13px; color: var(--text-2);">v1.0.0 · Built for two</div>
        <div style="font-size: 12px; color: var(--text-3); margin-top: 8px; line-height: 1.5;">
          Track your workouts, crush your PRs, and stay ahead of your gym buddy. All data stored locally — no account needed.
        </div>
      </div>

      <div style="height: 16px;"></div>
    `;

    // Render program editor
    ProgramEditor.currentTab = ProgramEditor.currentTab || 'push';
    ProgramEditor.renderInto('program-container');
  },

  updateSetting(key, value) {
    const settings = DB.getSettings();
    settings[key] = value;
    DB.saveSettings(settings);
    App.updateHeaderUser();
    App.toast('Saved!', 'success');
  },

  setUnit(unit) {
    const settings = DB.getSettings();
    settings.unit = unit;
    DB.saveSettings(settings);
    this.render();
    App.toast(`Units set to ${unit}`, 'success');
  },

  exportData() {
    const user = DB.getCurrentUser();
    if (!user) { App.toast('Select a user first', 'error'); return; }

    const data = DB.exportData(user.id);
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ironpact-${user.id}-${DB.getTodayStr()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    App.toast('Data exported!', 'success');
  },

  exportAllData() {
    const users = DB.getUsers();
    const allData = {
      version: 1,
      exportDate: new Date().toISOString(),
      users: users.map(u => ({
        ...u,
        sessions: DB.getSessions(u.id),
      })),
      program: DB.getProgram(),
      settings: DB.getSettings(),
    };
    const json = JSON.stringify(allData, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ironpact-all-${DB.getTodayStr()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    App.toast('Full backup exported!', 'success');
  },

  triggerImport() {
    document.getElementById('import-file-input')?.click();
  },

  importData(input) {
    const file = input.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result);
        const user = DB.getCurrentUser();
        if (!user) { App.toast('Select a user first', 'error'); return; }

        // Handle single-user export
        if (data.sessions) {
          DB.importData(data, user.id);
          App.toast(`Imported ${data.sessions.length} sessions!`, 'success');
        }
        // Handle full export
        else if (data.users) {
          for (const u of data.users) {
            DB.saveSessions(u.id, u.sessions || []);
          }
          if (data.program) DB.saveProgram(data.program);
          if (data.settings) DB.saveSettings(data.settings);
          App.toast('Full backup imported!', 'success');
        } else {
          App.toast('Unrecognized format', 'error');
        }

        App.navigate('dashboard');
      } catch (err) {
        App.toast('Import failed: invalid JSON', 'error');
        console.error(err);
      }
    };
    reader.readAsText(file);
    // Reset input
    input.value = '';
  },

  escHtml(str) {
    return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  },
};

window.Settings = Settings;
