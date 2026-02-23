/**
 * IronPact — Side-by-Side Compare Page
 */

const Compare = {
  selectedDate: null,
  availableDates: [],

  render() {
    const container = document.getElementById('page-compare');
    if (!container) return;

    const users = DB.getUsers();
    const settings = DB.getSettings();
    const user1 = { ...users[0], name: settings.userName1 };
    const user2 = { ...users[1], name: settings.userName2 };

    // Get all dates with sessions from either user
    const u1Sessions = DB.getSessions(user1.id);
    const u2Sessions = DB.getSessions(user2.id);
    const allDates = new Set([
      ...u1Sessions.map(s => s.date),
      ...u2Sessions.map(s => s.date),
    ]);
    this.availableDates = [...allDates].sort((a, b) => b.localeCompare(a));

    if (!this.selectedDate && this.availableDates.length > 0) {
      this.selectedDate = this.availableDates[0];
    }

    // Head-to-head stats
    const u1Stats = DB.getStats(user1.id);
    const u2Stats = DB.getStats(user2.id);

    container.innerHTML = `
      <div class="page-title">Head to Head</div>

      <!-- H2H Stats -->
      <div class="card" style="margin-bottom: 20px;">
        <div class="card-title">Season Stats</div>
        ${this.renderH2HRow('Sessions (Month)', u1Stats.sessionsThisMonth, u2Stats.sessionsThisMonth, user1, user2)}
        ${this.renderH2HRow('Total PRs', u1Stats.totalPRs, u2Stats.totalPRs, user1, user2)}
        ${this.renderH2HRow('PRs This Month', u1Stats.prsThisMonth, u2Stats.prsThisMonth, user1, user2)}
        ${this.renderH2HRow('Week Streak 🔥', u1Stats.streak, u2Stats.streak, user1, user2)}
        ${this.renderH2HRow('Total Volume', u1Stats.totalVolume, u2Stats.totalVolume, user1, user2, true)}
      </div>

      <!-- Date Picker -->
      <div class="section-header">
        <div class="section-title">Session Compare</div>
      </div>

      ${this.availableDates.length === 0 ? `
        <div class="empty-state">
          <div class="empty-icon">📊</div>
          <div class="empty-title">No sessions yet</div>
          <div class="empty-body">Log workouts to compare side by side</div>
        </div>
      ` : `
        <!-- Date scroll -->
        <div class="date-scroll">
          ${this.availableDates.map(d => `
            <div class="date-chip ${d === this.selectedDate ? 'active' : ''}"
                 onclick="Compare.selectDate('${d}')">
              ${App.formatDate(d)}
            </div>
          `).join('')}
        </div>

        ${this.renderComparison(user1, user2)}
      `}
    `;
  },

  renderH2HRow(label, v1, v2, user1, user2, isVolume = false) {
    const fmt = v => isVolume ? App.formatVolume(v) : v;
    const u1Wins = v1 > v2;
    const u2Wins = v2 > v1;
    const tie = v1 === v2;

    return `
      <div class="h2h-row">
        <div class="h2h-row-label">${label}</div>
        <div class="h2h-grid">
          <div class="h2h-user">
            <div class="h2h-user-name" style="color: ${user1.color}">${user1.name}</div>
            <div class="h2h-value ${u1Wins ? 'h2h-leader' : ''}">${fmt(v1)}</div>
          </div>
          <div class="h2h-divider">vs</div>
          <div class="h2h-user">
            <div class="h2h-user-name" style="color: ${user2.color}">${user2.name}</div>
            <div class="h2h-value ${u2Wins ? 'h2h-leader-2' : ''}">${fmt(v2)}</div>
          </div>
        </div>
        ${tie ? '' : `
          <div style="text-align: center; font-size: 12px; margin-top: 4px;">
            <span style="color: ${u1Wins ? user1.color : user2.color}; font-weight: 700;">
              ${u1Wins ? user1.name : user2.name} leads 🏆
            </span>
          </div>
        `}
      </div>
    `;
  },

  selectDate(date) {
    this.selectedDate = date;
    this.render();
  },

  renderComparison(user1, user2) {
    if (!this.selectedDate) return '';

    const u1Sessions = DB.getSessionsByDate(user1.id, this.selectedDate);
    const u2Sessions = DB.getSessionsByDate(user2.id, this.selectedDate);

    const u1Session = u1Sessions[0];
    const u2Session = u2Sessions[0];

    // Get all exercise names from both sessions
    const exerciseNames = new Set();
    if (u1Session) (u1Session.exercises || []).forEach(e => exerciseNames.add(e.name));
    if (u2Session) (u2Session.exercises || []).forEach(e => exerciseNames.add(e.name));

    const sessionType = (u1Session || u2Session)?.type || 'push';

    const u1ExMap = {};
    if (u1Session) (u1Session.exercises || []).forEach(e => { u1ExMap[e.name] = e; });
    const u2ExMap = {};
    if (u2Session) (u2Session.exercises || []).forEach(e => { u2ExMap[e.name] = e; });

    return `
      <!-- Compare header -->
      <div class="compare-header">
        <div class="compare-user" style="border-color: ${user1.color}30; color: ${user1.color}">
          ${user1.emoji} ${user1.name}
        </div>
        <div class="compare-vs">vs</div>
        <div class="compare-user" style="border-color: ${user2.color}30; color: ${user2.color}">
          ${user2.emoji} ${user2.name}
        </div>
      </div>

      ${!u1Session && !u2Session ? `
        <div class="empty-state" style="padding: 24px;">
          <div class="empty-body">No sessions logged on this date</div>
        </div>
      ` : ''}

      <!-- Exercises comparison -->
      ${[...exerciseNames].map(exName => {
        const ex1 = u1ExMap[exName];
        const ex2 = u2ExMap[exName];

        // Find best weight per user
        const u1Best = ex1 ? Math.max(...(ex1.sets || []).map(s => parseFloat(s.weight) || 0)) : 0;
        const u2Best = ex2 ? Math.max(...(ex2.sets || []).map(s => parseFloat(s.weight) || 0)) : 0;
        const u1Volume = ex1 ? (ex1.sets || []).reduce((s, set) => s + (parseFloat(set.weight)||0) * (parseInt(set.reps)||0), 0) : 0;
        const u2Volume = ex2 ? (ex2.sets || []).reduce((s, set) => s + (parseFloat(set.weight)||0) * (parseInt(set.reps)||0), 0) : 0;

        return `
          <div class="compare-exercise">
            <div class="compare-exercise-name">
              ${exName}
              <span class="badge badge-${sessionType}" style="margin-left: 8px; font-size: 10px;">${sessionType}</span>
            </div>
            <div class="compare-body">
              <div class="compare-user-col">
                <div class="compare-user-label" style="color: ${user1.color}">${user1.name}</div>
                ${ex1 ? (ex1.sets || []).map((set, i) => `
                  <div class="compare-set-line ${u1Best > u2Best && parseFloat(set.weight) === u1Best ? 'winner' : ''}">
                    Set ${i+1}: ${set.weight || '—'}${App.getUnit()} × ${set.reps || '—'}
                    ${set.isPR ? ' 🏆' : ''}
                  </div>
                `).join('') : '<div class="compare-set-line" style="color: var(--text-3)">No data</div>'}
              </div>
              <div class="compare-user-col">
                <div class="compare-user-label" style="color: ${user2.color}">${user2.name}</div>
                ${ex2 ? (ex2.sets || []).map((set, i) => `
                  <div class="compare-set-line ${u2Best > u1Best && parseFloat(set.weight) === u2Best ? 'winner' : ''}">
                    Set ${i+1}: ${set.weight || '—'}${App.getUnit()} × ${set.reps || '—'}
                    ${set.isPR ? ' 🏆' : ''}
                  </div>
                `).join('') : '<div class="compare-set-line" style="color: var(--text-3)">No data</div>'}
              </div>
            </div>
            <div class="compare-footer">
              ${u1Best === u2Best && u1Best > 0 ? '🤝 Tie!' :
                u1Best > u2Best ? `<span style="color: ${user1.color}">🏆 ${user1.name} leads (${u1Best}${App.getUnit()})</span>` :
                u2Best > u1Best ? `<span style="color: ${user2.color}">🏆 ${user2.name} leads (${u2Best}${App.getUnit()})</span>` :
                '—'
              }
            </div>
          </div>
        `;
      }).join('')}
    `;
  },
};

window.Compare = Compare;
