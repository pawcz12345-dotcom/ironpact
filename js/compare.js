/**
 * IronPact — Side-by-Side Compare Page
 */

const Compare = {
  selectedSessionId1: null,
  selectedSessionId2: null,

  render() {
    const container = document.getElementById('page-compare');
    if (!container) return;

    const users = DB.getUsers();
    const settings = DB.getSettings();
    const user1 = { ...users[0], name: settings.userName1 };
    const user2 = { ...users[1], name: settings.userName2 };

    // Get last 10 sessions for each user
    const u1Sessions = DB.getSessions(user1.id)
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .slice(0, 10);
    const u2Sessions = DB.getSessions(user2.id)
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .slice(0, 10);

    // Default to most recent
    if (!this.selectedSessionId1 && u1Sessions.length) {
      this.selectedSessionId1 = u1Sessions[0].id;
    }
    if (!this.selectedSessionId2 && u2Sessions.length) {
      this.selectedSessionId2 = u2Sessions[0].id;
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
        ${u1Stats.bestE1RM || u2Stats.bestE1RM ? this.renderH2HRow('Best e1RM', u1Stats.bestE1RM || 0, u2Stats.bestE1RM || 0, user1, user2) : ''}
        ${(u1Stats.avgDuration || u2Stats.avgDuration) ? this.renderH2HRow('Avg Duration (min)', u1Stats.avgDuration || 0, u2Stats.avgDuration || 0, user1, user2) : ''}
      </div>

      <!-- Session Picker -->
      <div class="section-header">
        <div class="section-title">Session Compare</div>
      </div>

      ${u1Sessions.length === 0 && u2Sessions.length === 0 ? `
        <div class="empty-state">
          <div class="empty-icon">📊</div>
          <div class="empty-title">No sessions yet</div>
          <div class="empty-body">Log workouts to compare side by side</div>
        </div>
      ` : `
        <!-- Session pickers for each user -->
        <div class="compare-pickers">
          <div class="compare-picker-col">
            <div class="compare-picker-label" style="color: ${user1.color}">${user1.emoji} ${user1.name}</div>
            ${u1Sessions.length > 0 ? `
              <select class="compare-session-select" onchange="Compare.selectSession(1, this.value)">
                ${u1Sessions.map(s => `
                  <option value="${s.id}" ${s.id === this.selectedSessionId1 ? 'selected' : ''}>
                    ${App.formatDate(s.date)} · ${s.type}
                  </option>
                `).join('')}
              </select>
            ` : `<div class="compare-no-session">No sessions</div>`}
          </div>
          <div class="compare-picker-col">
            <div class="compare-picker-label" style="color: ${user2.color}">${user2.emoji} ${user2.name}</div>
            ${u2Sessions.length > 0 ? `
              <select class="compare-session-select" onchange="Compare.selectSession(2, this.value)">
                ${u2Sessions.map(s => `
                  <option value="${s.id}" ${s.id === this.selectedSessionId2 ? 'selected' : ''}>
                    ${App.formatDate(s.date)} · ${s.type}
                  </option>
                `).join('')}
              </select>
            ` : `<div class="compare-no-session">No sessions</div>`}
          </div>
        </div>

        ${this.renderComparison(user1, user2, u1Sessions, u2Sessions)}
      `}
    `;
  },

  renderH2HRow(label, v1, v2, user1, user2, isVolume = false) {
    const fmt = v => isVolume ? App.formatVolume(v) : (v || 0);
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

  selectSession(userNum, sessionId) {
    if (userNum === 1) this.selectedSessionId1 = sessionId;
    else this.selectedSessionId2 = sessionId;
    // Re-render just the comparison part without full page re-render
    this.render();
  },

  renderComparison(user1, user2, u1Sessions, u2Sessions) {
    const u1Session = u1Sessions.find(s => s.id === this.selectedSessionId1) || null;
    const u2Session = u2Sessions.find(s => s.id === this.selectedSessionId2) || null;

    if (!u1Session && !u2Session) {
      return `<div class="empty-state" style="padding: 24px;"><div class="empty-body">Select sessions to compare</div></div>`;
    }

    // Get all exercise names from both sessions
    const exerciseNames = new Set();
    if (u1Session) (u1Session.exercises || []).forEach(e => exerciseNames.add(e.name));
    if (u2Session) (u2Session.exercises || []).forEach(e => exerciseNames.add(e.name));

    const sessionType = (u1Session || u2Session)?.type || 'push';

    const u1ExMap = {};
    if (u1Session) (u1Session.exercises || []).forEach(e => { u1ExMap[e.name] = e; });
    const u2ExMap = {};
    if (u2Session) (u2Session.exercises || []).forEach(e => { u2ExMap[e.name] = e; });

    // Session meta info
    const u1Vol = u1Session ? (u1Session.exercises || []).reduce((t, ex) =>
      t + (ex.sets || []).reduce((s, set) => s + (parseFloat(set.weight)||0)*(parseInt(set.reps)||0), 0), 0) : 0;
    const u2Vol = u2Session ? (u2Session.exercises || []).reduce((t, ex) =>
      t + (ex.sets || []).reduce((s, set) => s + (parseFloat(set.weight)||0)*(parseInt(set.reps)||0), 0), 0) : 0;

    return `
      <!-- Compare header -->
      <div class="compare-header" style="margin-top: 16px;">
        <div class="compare-user" style="border-color: ${user1.color}30; color: ${user1.color}">
          ${user1.emoji} ${user1.name}
          ${u1Session ? `<div style="font-size: 10px; color: var(--text-3); margin-top: 2px;">${App.formatDate(u1Session.date)} · ${u1Session.type}${u1Session.durationMinutes ? ' · ' + u1Session.durationMinutes + 'm' : ''}</div>` : ''}
        </div>
        <div class="compare-vs">vs</div>
        <div class="compare-user" style="border-color: ${user2.color}30; color: ${user2.color}">
          ${user2.emoji} ${user2.name}
          ${u2Session ? `<div style="font-size: 10px; color: var(--text-3); margin-top: 2px;">${App.formatDate(u2Session.date)} · ${u2Session.type}${u2Session.durationMinutes ? ' · ' + u2Session.durationMinutes + 'm' : ''}</div>` : ''}
        </div>
      </div>

      <!-- Volume comparison -->
      <div class="compare-exercise" style="margin-bottom: 12px;">
        <div class="compare-exercise-name">Total Volume</div>
        <div class="compare-body">
          <div class="compare-user-col">
            <div class="compare-user-label" style="color: ${user1.color}">${user1.name}</div>
            <div class="compare-set-line ${u1Vol > u2Vol ? 'winner' : ''}" style="font-size: 16px; font-weight: 700;">${App.formatVolume(Math.round(u1Vol))} ${App.getUnit()}</div>
          </div>
          <div class="compare-user-col">
            <div class="compare-user-label" style="color: ${user2.color}">${user2.name}</div>
            <div class="compare-set-line ${u2Vol > u1Vol ? 'winner' : ''}" style="font-size: 16px; font-weight: 700;">${App.formatVolume(Math.round(u2Vol))} ${App.getUnit()}</div>
          </div>
        </div>
      </div>

      <!-- Exercises comparison -->
      ${[...exerciseNames].map(exName => {
        const ex1 = u1ExMap[exName];
        const ex2 = u2ExMap[exName];

        const u1Best = ex1 ? Math.max(...(ex1.sets || []).map(s => parseFloat(s.weight) || 0)) : 0;
        const u2Best = ex2 ? Math.max(...(ex2.sets || []).map(s => parseFloat(s.weight) || 0)) : 0;
        const u1E1RM = ex1 ? Math.max(...(ex1.sets || []).map(s => DB.calcE1RM(s.weight, s.reps))) : 0;
        const u2E1RM = ex2 ? Math.max(...(ex2.sets || []).map(s => DB.calcE1RM(s.weight, s.reps))) : 0;

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
                ${u1E1RM > 0 ? `<div style="font-size: 11px; color: var(--warning); margin-top: 4px;">e1RM: ${u1E1RM}${App.getUnit()}</div>` : ''}
              </div>
              <div class="compare-user-col">
                <div class="compare-user-label" style="color: ${user2.color}">${user2.name}</div>
                ${ex2 ? (ex2.sets || []).map((set, i) => `
                  <div class="compare-set-line ${u2Best > u1Best && parseFloat(set.weight) === u2Best ? 'winner' : ''}">
                    Set ${i+1}: ${set.weight || '—'}${App.getUnit()} × ${set.reps || '—'}
                    ${set.isPR ? ' 🏆' : ''}
                  </div>
                `).join('') : '<div class="compare-set-line" style="color: var(--text-3)">No data</div>'}
                ${u2E1RM > 0 ? `<div style="font-size: 11px; color: var(--warning); margin-top: 4px;">e1RM: ${u2E1RM}${App.getUnit()}</div>` : ''}
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

      <!-- Notes -->
      ${(u1Session?.notes || u2Session?.notes) ? `
        <div class="compare-exercise" style="margin-top: 4px;">
          <div class="compare-exercise-name">📝 Session Notes</div>
          <div class="compare-body">
            <div class="compare-user-col">
              <div class="compare-user-label" style="color: ${user1.color}">${user1.name}</div>
              <div style="font-size: 13px; color: var(--text-2); line-height: 1.5;">${u1Session?.notes || '—'}</div>
            </div>
            <div class="compare-user-col">
              <div class="compare-user-label" style="color: ${user2.color}">${user2.name}</div>
              <div style="font-size: 13px; color: var(--text-2); line-height: 1.5;">${u2Session?.notes || '—'}</div>
            </div>
          </div>
        </div>
      ` : ''}
    `;
  },
};

window.Compare = Compare;
