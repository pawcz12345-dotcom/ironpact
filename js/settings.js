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
      <div class="card" style="padding: 16px; margin-bottom: 8px;">
        <div id="program-container"></div>
        <button class="btn btn-secondary" onclick="Settings.saveProgram()" style="margin-top: 12px;">
          💾 Save Program
        </button>
      </div>

      <!-- Program History -->
      <div id="program-history-section">
        ${this.renderProgramHistory()}
      </div>

      <!-- Historical Data Import -->
      <div class="settings-section-title">Import Historical Data</div>
      <div class="card" style="margin-bottom: 8px;">
        <div style="font-size: 13px; color: var(--text-2); margin-bottom: 14px; line-height: 1.5;">
          Bulk import past sessions from a CSV spreadsheet or JSON file.
        </div>

        <!-- CSV Section -->
        <div style="font-size: 12px; font-weight: 700; color: var(--text-3); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px;">CSV (from spreadsheet)</div>
        <button class="btn btn-secondary btn-sm" onclick="Settings.downloadCSVTemplate()" style="margin-bottom: 10px; width: 100%;">
          📊 Download CSV Template
        </button>
        <input type="file" id="csv-file-input" accept=".csv" style="display:none;" onchange="Settings.importCSVFile(this)">
        <button class="btn btn-primary" onclick="document.getElementById('csv-file-input').click()" style="margin-bottom: 16px; width: 100%;">
          📂 Upload CSV File
        </button>

        <!-- JSON Section -->
        <div style="font-size: 12px; font-weight: 700; color: var(--text-3); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px;">JSON (advanced)</div>
        <button class="btn btn-secondary btn-sm" onclick="Settings.downloadImportTemplate()" style="margin-bottom: 12px; width: 100%;">
          📄 Download JSON Template
        </button>
        <div style="font-size: 12px; color: var(--text-3); margin-bottom: 10px;">Or paste JSON directly:</div>
        <textarea id="historical-import-textarea"
                  style="min-height: 100px; font-size: 12px; font-family: monospace; resize: vertical;"
                  placeholder='[{"date":"2025-01-15","type":"push","exercises":[...]}]'></textarea>
        <button class="btn btn-secondary" onclick="Settings.importHistoricalData()" style="margin-top: 10px;">
          📥 Import JSON
        </button>
        <div style="margin-top: 10px;">
          <input type="file" id="historical-file-input" accept=".json" style="display:none;" onchange="Settings.importHistoricalFile(this)">
          <button class="btn btn-secondary btn-sm" onclick="document.getElementById('historical-file-input').click()" style="width: 100%;">
            📂 Upload JSON File
          </button>
        </div>
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
        <div style="font-size: 13px; color: var(--text-2);">v2.0.0 · Built for two</div>
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

  renderProgramHistory() {
    const history = DB.getProgramHistory();
    if (!history.length) return '';
    const recent = [...history].reverse().slice(0, 5);
    return `
      <div class="card card-sm" style="margin-bottom: 16px;">
        <div class="card-title">Program History</div>
        ${recent.map(h => `
          <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid var(--border); font-size: 13px;">
            <div>
              <span style="color: var(--accent); font-weight: 700;">v${h.version}</span>
              <span style="color: var(--text-2); margin-left: 8px;">${h.savedAt}</span>
            </div>
            <div style="color: var(--text-3); font-size: 11px;">
              ${Object.values(h.exercises || {}).reduce((t, arr) => t + arr.length, 0)} exercises
            </div>
          </div>
        `).join('')}
        ${history.length > 5 ? `<div style="font-size: 11px; color: var(--text-3); margin-top: 8px;">${history.length} versions total</div>` : ''}
      </div>
    `;
  },

  saveProgram() {
    const program = DB.getProgram();
    const version = DB.saveProgramVersion(program);
    App.toast(`Program saved as v${version}!`, 'success');
    // Re-render history section
    const historySection = document.getElementById('program-history-section');
    if (historySection) {
      historySection.innerHTML = this.renderProgramHistory();
    }
  },

  downloadCSVTemplate() {
    const rows = [
      ['date', 'type', 'exercise', 'set', 'weight', 'reps', 'rir'],
      ['15/01/2025', 'push', 'Bench Press', '1', '80', '8', '2'],
      ['15/01/2025', 'push', 'Bench Press', '2', '80', '7', '3'],
      ['15/01/2025', 'push', 'Bench Press', '3', '75', '8', '2'],
      ['15/01/2025', 'push', 'Overhead Press', '1', '50', '10', '1'],
      ['15/01/2025', 'push', 'Overhead Press', '2', '50', '9', '2'],
      ['17/01/2025', 'pull', 'Deadlift', '1', '120', '5', '2'],
      ['17/01/2025', 'pull', 'Deadlift', '2', '120', '5', '3'],
      ['17/01/2025', 'pull', 'Pull-Ups', '1', '0', '8', '1'],
      ['19/01/2025', 'legs', 'Squat', '1', '100', '5', '2'],
      ['19/01/2025', 'legs', 'Squat', '2', '100', '5', '3'],
    ];
    const csv = rows.map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'ironpact-import-template.csv';
    a.click();
    URL.revokeObjectURL(url);
    App.toast('CSV template downloaded!', 'success');
  },

  importCSVFile(input) {
    const file = input.files[0];
    if (!file) return;
    const user = DB.getCurrentUser();
    if (!user) { App.toast('Select a user first', 'error'); return; }
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const count = DB.importCSV(user.id, e.target.result);
        if (count === 0) {
          App.toast('No valid rows found — check the format', 'error');
        } else {
          App.toast(`Imported ${count} sessions from CSV! 💪`, 'success');
          App.navigate('dashboard');
        }
      } catch (err) {
        App.toast('CSV parse error — check your file', 'error');
        console.error(err);
      }
    };
    reader.readAsText(file);
    input.value = '';
  },

  downloadImportTemplate() {
    const template = [
      {
        date: '2025-01-15',
        type: 'push',
        notes: 'Optional session notes',
        bodyweight: 80,
        exercises: [
          {
            name: 'Bench Press',
            sets: [
              { weight: 80, reps: 8 },
              { weight: 80, reps: 7 },
              { weight: 75, reps: 8 },
            ],
          },
          {
            name: 'Overhead Press',
            sets: [
              { weight: 50, reps: 10 },
              { weight: 50, reps: 9 },
            ],
          },
        ],
      },
      {
        date: '2025-01-17',
        type: 'pull',
        exercises: [
          {
            name: 'Deadlift',
            sets: [
              { weight: 120, reps: 5 },
              { weight: 120, reps: 5 },
            ],
          },
        ],
      },
    ];
    const json = JSON.stringify(template, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'ironpact-import-template.json';
    a.click();
    URL.revokeObjectURL(url);
    App.toast('Template downloaded!', 'success');
  },

  importHistoricalData() {
    const textarea = document.getElementById('historical-import-textarea');
    if (!textarea || !textarea.value.trim()) {
      App.toast('Paste JSON data first', 'error');
      return;
    }
    this._processHistoricalImport(textarea.value.trim());
    textarea.value = '';
  },

  importHistoricalFile(input) {
    const file = input.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      this._processHistoricalImport(e.target.result);
    };
    reader.readAsText(file);
    input.value = '';
  },

  _processHistoricalImport(jsonStr) {
    const user = DB.getCurrentUser();
    if (!user) { App.toast('Select a user first', 'error'); return; }

    try {
      const data = JSON.parse(jsonStr);
      if (!Array.isArray(data)) {
        App.toast('Expected an array of sessions', 'error');
        return;
      }
      // Validate basic structure
      const valid = data.every(s => s.date && s.type && Array.isArray(s.exercises));
      if (!valid) {
        App.toast('Invalid format — check the template', 'error');
        return;
      }
      const count = DB.importHistoricalSessions(user.id, data);
      App.toast(`Imported ${count} sessions! 💪`, 'success');
      App.navigate('dashboard');
    } catch (err) {
      App.toast('Invalid JSON — check your data', 'error');
      console.error(err);
    }
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
