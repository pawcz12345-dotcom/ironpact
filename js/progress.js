/**
 * IronPact — Progress & Stats Page
 */

const Progress = {
  selectedExercise: null,
  chartWeight: null,
  chartVolume: null,
  chartE1RM: null,
  chartSessionVolume: null,
  chartDonut: null,
  chartBodyweight: null,
  viewingSessionId: null,
  chartMode: 'weight', // 'weight' | 'volume' | 'e1rm'

  render() {
    const user = DB.getCurrentUser();
    const container = document.getElementById('page-progress');
    if (!container) return;

    if (!user) {
      container.innerHTML = `<div class="empty-state"><div class="empty-icon">📈</div><div class="empty-title">Select a user to see progress</div></div>`;
      return;
    }

    const sessions = DB.getSessions(user.id).sort((a, b) => new Date(b.date) - new Date(a.date));
    const prs = DB.getPRs(user.id);
    const stats = DB.getStats(user.id);

    // Get all unique exercise names
    const exerciseNames = new Set();
    for (const s of sessions) {
      for (const ex of (s.exercises || [])) {
        if (ex.name) exerciseNames.add(ex.name);
      }
    }

    if (!this.selectedExercise && exerciseNames.size > 0) {
      this.selectedExercise = [...exerciseNames][0];
    }

    const history = this.selectedExercise
      ? DB.getExerciseHistory(user.id, this.selectedExercise)
      : [];

    // Session volumes for the trend chart
    const sessionVolumes = DB.getSessionVolumes(user.id);

    // Volume by type (donut)
    const volByType = DB.getVolumeByType(user.id);
    const totalTypeVol = volByType.push + volByType.pull + volByType.legs;

    // Bodyweight history
    const bwHistory = DB.getBodyweightHistory(user.id);

    container.innerHTML = `
      <div class="page-title">Progress</div>

      <!-- Quick stats -->
      <div class="stat-grid">
        <div class="stat-card stat-accent">
          <div class="stat-value">${stats.totalSessions}</div>
          <div class="stat-label">Total Sessions</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${stats.streak} 🔥</div>
          <div class="stat-label">Week Streak</div>
        </div>
        <div class="stat-card stat-accent-2">
          <div class="stat-value">${App.formatVolume(stats.totalVolume)}</div>
          <div class="stat-label">Total Volume</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${stats.avgDuration !== null ? stats.avgDuration + 'm' : '—'}</div>
          <div class="stat-label">Avg Duration</div>
        </div>
      </div>

      <!-- Exercise Progress Chart -->
      <div class="card" style="margin-bottom: 16px;">
        <div class="card-title">Exercise Progress</div>
        <div class="exercise-select-wrap">
          <select onchange="Progress.selectExercise(this.value)">
            ${exerciseNames.size === 0
              ? '<option>No exercises yet</option>'
              : [...exerciseNames].map(name => `
                  <option value="${name}" ${name === this.selectedExercise ? 'selected' : ''}>${name}</option>
                `).join('')
            }
          </select>
        </div>

        <!-- Chart mode toggle -->
        ${exerciseNames.size > 0 ? `
          <div class="chart-mode-toggle">
            <button class="chart-mode-btn ${this.chartMode === 'weight' ? 'active' : ''}"
                    onclick="Progress.setChartMode('weight')">Weight</button>
            <button class="chart-mode-btn ${this.chartMode === 'volume' ? 'active' : ''}"
                    onclick="Progress.setChartMode('volume')">Volume</button>
            <button class="chart-mode-btn ${this.chartMode === 'e1rm' ? 'active' : ''}"
                    onclick="Progress.setChartMode('e1rm')">e1RM</button>
          </div>
        ` : ''}

        ${exerciseNames.size === 0 ? `
          <div class="empty-state" style="padding: 16px;">
            <div class="empty-body">Log workouts to see your progress charts</div>
          </div>
        ` : `
          <div>
            <div class="form-label" id="chart-main-label">${this.getChartModeLabel()}</div>
            <div class="chart-container">
              <canvas id="chart-main"></canvas>
            </div>
          </div>
        `}
      </div>

      <!-- Volume Trend Chart (all sessions) -->
      ${sessionVolumes.length > 0 ? `
        <div class="card" style="margin-bottom: 16px;">
          <div class="card-title">Total Volume Per Session</div>
          <div class="chart-container">
            <canvas id="chart-session-volume"></canvas>
          </div>
        </div>
      ` : ''}

      <!-- Volume by Day Type Donut -->
      ${totalTypeVol > 0 ? `
        <div class="card" style="margin-bottom: 16px;">
          <div class="card-title">Volume by Day Type — This Month</div>
          <div style="display: flex; align-items: center; gap: 20px;">
            <div class="chart-container" style="width: 160px; height: 160px; flex-shrink: 0;">
              <canvas id="chart-donut"></canvas>
            </div>
            <div class="donut-legend">
              ${['push', 'pull', 'legs'].map(t => {
                const pct = totalTypeVol > 0 ? Math.round((volByType[t] / totalTypeVol) * 100) : 0;
                const color = t === 'push' ? '#ff6b2b' : t === 'pull' ? '#00d4ff' : '#a855f7';
                return `
                  <div class="donut-legend-item">
                    <div class="donut-legend-dot" style="background: ${color};"></div>
                    <div>
                      <div style="font-size: 13px; font-weight: 700; text-transform: capitalize;">${t}</div>
                      <div style="font-size: 11px; color: var(--text-3);">${pct}% · ${App.formatVolume(Math.round(volByType[t]))}</div>
                    </div>
                  </div>
                `;
              }).join('')}
            </div>
          </div>
        </div>
      ` : ''}

      <!-- Bodyweight Chart (only if data exists) -->
      ${bwHistory.length > 0 ? `
        <div class="card" style="margin-bottom: 16px;">
          <div class="card-title">Bodyweight Over Time</div>
          <div class="chart-container">
            <canvas id="chart-bodyweight"></canvas>
          </div>
        </div>
      ` : ''}

      <!-- PRs Table -->
      <div class="card" style="margin-bottom: 16px;">
        <div class="card-title">Personal Records 🏆</div>
        ${Object.keys(prs).length === 0 ? `
          <div class="empty-state" style="padding: 16px;">
            <div class="empty-body">No PRs recorded yet. Log sets to track your bests!</div>
          </div>
        ` : `
          <div style="overflow-x: auto;">
            <table class="pr-table">
              <thead>
                <tr>
                  <th>Exercise</th>
                  <th>Date</th>
                  <th>${App.getUnit()}</th>
                  <th>e1RM</th>
                </tr>
              </thead>
              <tbody>
                ${Object.entries(prs)
                  .sort((a, b) => (b[1].e1rm || 0) - (a[1].e1rm || 0))
                  .map(([name, pr]) => `
                    <tr>
                      <td>
                        <div style="font-weight: 600">${name}</div>
                        <div style="font-size: 11px; color: var(--text-3); margin-top: 2px;">${pr.reps} reps</div>
                      </td>
                      <td style="color: var(--text-2)">${App.formatDate(pr.date)}</td>
                      <td>${pr.weight}</td>
                      <td style="color: var(--warning); font-weight: 700;">${pr.e1rm || '—'}</td>
                    </tr>
                  `).join('')}
              </tbody>
            </table>
          </div>
        `}
      </div>

      <!-- All Sessions -->
      <div class="section-header">
        <div class="section-title">All Sessions</div>
        <div class="text-muted text-sm">${sessions.length} total</div>
      </div>

      ${sessions.length === 0 ? `
        <div class="empty-state">
          <div class="empty-icon">🏋️</div>
          <div class="empty-title">No sessions yet</div>
        </div>
      ` : sessions.map(s => this.renderSessionItem(s)).join('')}
    `;

    // Render charts after DOM is ready
    setTimeout(() => {
      if (exerciseNames.size > 0 && history.length > 0) {
        this.renderMainChart(history);
      }
      if (sessionVolumes.length > 0) {
        this.renderSessionVolumeChart(sessionVolumes);
      }
      if (totalTypeVol > 0) {
        this.renderDonutChart(volByType);
      }
      if (bwHistory.length > 0) {
        this.renderBodyweightChart(bwHistory);
      }
    }, 50);
  },

  getChartModeLabel() {
    const unit = App.getUnit();
    const map = {
      weight: `Best Weight (${unit})`,
      volume: `Volume (${unit} × reps)`,
      e1rm: `Estimated 1RM (${unit})`,
    };
    return map[this.chartMode] || '';
  },

  setChartMode(mode) {
    this.chartMode = mode;
    const user = DB.getCurrentUser();
    if (!user || !this.selectedExercise) return;
    const history = DB.getExerciseHistory(user.id, this.selectedExercise);
    // Update label
    const label = document.getElementById('chart-main-label');
    if (label) label.textContent = this.getChartModeLabel();
    this.renderMainChart(history);
    // Update toggle buttons
    document.querySelectorAll('.chart-mode-btn').forEach(btn => {
      btn.classList.toggle('active', btn.textContent.toLowerCase().trim() === mode ||
        (mode === 'e1rm' && btn.textContent.trim() === 'e1RM'));
    });
  },

  renderSessionItem(session) {
    const exerciseCount = (session.exercises || []).length;
    const setCount = (session.exercises || []).reduce((s, e) => s + (e.sets || []).length, 0);
    const hasPR = (session.exercises || []).some(e => (e.sets || []).some(s => s.isPR));
    const hasNotes = session.notes && session.notes.trim().length > 0;
    const totalVol = (session.exercises || []).reduce((total, ex) =>
      total + (ex.sets || []).reduce((s, set) =>
        s + (parseFloat(set.weight)||0) * (parseInt(set.reps)||0), 0), 0);
    const duration = session.durationMinutes ? `· ${session.durationMinutes}m` : '';

    return `
      <div class="session-item" onclick="Progress.openSession('${session.id}')">
        <div class="session-icon ${session.type}">${App.typeEmoji(session.type)}</div>
        <div class="session-info">
          <div class="session-name">${session.type} Day${hasNotes ? ' <span style="font-size:12px;">📝</span>' : ''}</div>
          <div class="session-meta">${App.formatDate(session.date)} · ${exerciseCount} exercises · ${setCount} sets${duration}</div>
        </div>
        <div class="session-right">
          ${hasPR ? '<span class="badge badge-pr">🏆 PR</span>' : ''}
          <div style="font-size: 12px; color: var(--text-2); margin-top: 4px;">${App.formatVolume(Math.round(totalVol))} vol</div>
        </div>
      </div>
    `;
  },

  selectExercise(name) {
    this.selectedExercise = name;
    const user = DB.getCurrentUser();
    if (!user) return;
    const history = DB.getExerciseHistory(user.id, name);
    const label = document.getElementById('chart-main-label');
    if (label) label.textContent = this.getChartModeLabel();
    this.renderMainChart(history);
  },

  renderMainChart(history) {
    if (this.chartMode === 'weight') this.renderWeightChart(history);
    else if (this.chartMode === 'volume') this.renderVolumeChart(history);
    else if (this.chartMode === 'e1rm') this.renderE1RMChart(history);
  },

  destroyChart(chartRef) {
    if (this[chartRef]) {
      this[chartRef].destroy();
      this[chartRef] = null;
    }
  },

  renderWeightChart(history) {
    const canvas = document.getElementById('chart-main');
    if (!canvas) return;
    this.destroyChart('chartWeight');
    this.destroyChart('chartVolume');
    this.destroyChart('chartE1RM');
    if (!history.length) return;
    const labels = history.map(h => App.formatDate(h.date));
    const data = history.map(h => h.bestWeight);
    this.chartWeight = new Chart(canvas, {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label: `Best Weight (${App.getUnit()})`,
          data,
          borderColor: '#ff6b2b',
          backgroundColor: 'rgba(255, 107, 43, 0.1)',
          borderWidth: 2.5,
          pointBackgroundColor: '#ff6b2b',
          pointRadius: 4,
          pointHoverRadius: 6,
          fill: true,
          tension: 0.4,
        }],
      },
      options: this.chartOptions(`Weight (${App.getUnit()})`),
    });
  },

  renderVolumeChart(history) {
    const canvas = document.getElementById('chart-main');
    if (!canvas) return;
    this.destroyChart('chartWeight');
    this.destroyChart('chartVolume');
    this.destroyChart('chartE1RM');
    if (!history.length) return;
    const labels = history.map(h => App.formatDate(h.date));
    const data = history.map(h => h.totalVolume);
    this.chartVolume = new Chart(canvas, {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          label: 'Total Volume',
          data,
          backgroundColor: 'rgba(0, 212, 255, 0.3)',
          borderColor: '#00d4ff',
          borderWidth: 2,
          borderRadius: 6,
        }],
      },
      options: this.chartOptions('Volume'),
    });
  },

  renderE1RMChart(history) {
    const canvas = document.getElementById('chart-main');
    if (!canvas) return;
    this.destroyChart('chartWeight');
    this.destroyChart('chartVolume');
    this.destroyChart('chartE1RM');
    if (!history.length) return;
    const labels = history.map(h => App.formatDate(h.date));
    const data = history.map(h => h.bestE1RM);
    this.chartE1RM = new Chart(canvas, {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label: `Estimated 1RM (${App.getUnit()})`,
          data,
          borderColor: '#ffcc00',
          backgroundColor: 'rgba(255, 204, 0, 0.1)',
          borderWidth: 2.5,
          pointBackgroundColor: '#ffcc00',
          pointRadius: 4,
          pointHoverRadius: 6,
          fill: true,
          tension: 0.4,
        }],
      },
      options: this.chartOptions(`e1RM (${App.getUnit()})`),
    });
  },

  renderSessionVolumeChart(sessionVolumes) {
    const canvas = document.getElementById('chart-session-volume');
    if (!canvas) return;
    this.destroyChart('chartSessionVolume');
    if (!sessionVolumes.length) return;

    const last20 = sessionVolumes.slice(-20);
    const labels = last20.map(s => App.formatDate(s.date));
    const data = last20.map(s => s.volume);
    const colors = last20.map(s =>
      s.type === 'push' ? 'rgba(255,107,43,0.6)' :
      s.type === 'pull' ? 'rgba(0,212,255,0.6)' :
      'rgba(168,85,247,0.6)'
    );
    const borderColors = last20.map(s =>
      s.type === 'push' ? '#ff6b2b' :
      s.type === 'pull' ? '#00d4ff' :
      '#a855f7'
    );

    this.chartSessionVolume = new Chart(canvas, {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          label: 'Total Volume',
          data,
          backgroundColor: colors,
          borderColor: borderColors,
          borderWidth: 2,
          borderRadius: 5,
        }],
      },
      options: this.chartOptions('Volume'),
    });
  },

  renderDonutChart(volByType) {
    const canvas = document.getElementById('chart-donut');
    if (!canvas) return;
    this.destroyChart('chartDonut');

    this.chartDonut = new Chart(canvas, {
      type: 'doughnut',
      data: {
        labels: ['Push', 'Pull', 'Legs'],
        datasets: [{
          data: [volByType.push, volByType.pull, volByType.legs],
          backgroundColor: ['rgba(255,107,43,0.8)', 'rgba(0,212,255,0.8)', 'rgba(168,85,247,0.8)'],
          borderColor: ['#ff6b2b', '#00d4ff', '#a855f7'],
          borderWidth: 2,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 400 },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: 'rgba(19,19,30,0.95)',
            borderColor: 'rgba(255,255,255,0.1)',
            borderWidth: 1,
            titleColor: '#9090b0',
            bodyColor: '#f0f0f8',
            padding: 10,
            cornerRadius: 8,
          },
        },
        cutout: '65%',
      },
    });
  },

  renderBodyweightChart(bwHistory) {
    const canvas = document.getElementById('chart-bodyweight');
    if (!canvas) return;
    this.destroyChart('chartBodyweight');
    if (!bwHistory.length) return;
    const labels = bwHistory.map(h => App.formatDate(h.date));
    const data = bwHistory.map(h => h.weight);
    this.chartBodyweight = new Chart(canvas, {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label: `Bodyweight (${App.getUnit()})`,
          data,
          borderColor: '#a855f7',
          backgroundColor: 'rgba(168,85,247,0.1)',
          borderWidth: 2.5,
          pointBackgroundColor: '#a855f7',
          pointRadius: 4,
          pointHoverRadius: 6,
          fill: true,
          tension: 0.4,
        }],
      },
      options: this.chartOptions(`Bodyweight (${App.getUnit()})`),
    });
  },

  chartOptions(yLabel) {
    return {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 400 },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: 'rgba(19, 19, 30, 0.95)',
          borderColor: 'rgba(255,255,255,0.1)',
          borderWidth: 1,
          titleColor: '#9090b0',
          bodyColor: '#f0f0f8',
          padding: 10,
          cornerRadius: 8,
        },
      },
      scales: {
        x: {
          grid: { color: 'rgba(255,255,255,0.05)' },
          ticks: {
            color: '#606080',
            font: { size: 10 },
            maxRotation: 45,
          },
        },
        y: {
          grid: { color: 'rgba(255,255,255,0.05)' },
          ticks: {
            color: '#606080',
            font: { size: 10 },
          },
          beginAtZero: false,
        },
      },
    };
  },

  openSession(sessionId) {
    this.viewingSessionId = sessionId;
    const user = DB.getCurrentUser();
    if (!user) return;
    const sessions = DB.getSessions(user.id);
    const session = sessions.find(s => s.id === sessionId);
    if (!session) return;
    this.renderSessionDetail(session);
  },

  renderSessionDetail(session) {
    const container = document.getElementById('page-progress');
    if (!container) return;

    const totalVol = (session.exercises || []).reduce((total, ex) =>
      total + (ex.sets || []).reduce((s, set) =>
        s + (parseFloat(set.weight)||0) * (parseInt(set.reps)||0), 0), 0);

    const prs = DB.getPRs(DB.getCurrentUser().id);

    container.innerHTML = `
      <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 20px;">
        <div class="btn btn-icon" onclick="Progress.render()" style="flex-shrink: 0;">←</div>
        <div>
          <div class="section-title" style="text-transform: capitalize;">${session.type} Day</div>
          <div class="text-muted text-sm">${App.formatDate(session.date)}</div>
        </div>
        <div style="margin-left: auto;">
          <span class="badge badge-${session.type}">${session.type}</span>
        </div>
      </div>

      <!-- Session Stats -->
      <div class="stat-grid" style="margin-bottom: 16px;">
        <div class="stat-card">
          <div class="stat-value">${(session.exercises || []).length}</div>
          <div class="stat-label">Exercises</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${(session.exercises || []).reduce((s, e) => s + (e.sets || []).length, 0)}</div>
          <div class="stat-label">Sets</div>
        </div>
        <div class="stat-card stat-accent">
          <div class="stat-value">${App.formatVolume(Math.round(totalVol))}</div>
          <div class="stat-label">Total Volume</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${session.durationMinutes ? session.durationMinutes + 'm' : '—'}</div>
          <div class="stat-label">Duration</div>
        </div>
      </div>

      <!-- Bodyweight if present -->
      ${session.bodyweight ? `
        <div class="card card-sm" style="margin-bottom: 12px; display: flex; align-items: center; gap: 12px;">
          <span style="font-size: 20px;">⚖️</span>
          <div>
            <div style="font-size: 15px; font-weight: 700;">${session.bodyweight} ${App.getUnit()}</div>
            <div style="font-size: 11px; color: var(--text-3);">Bodyweight</div>
          </div>
        </div>
      ` : ''}

      <!-- Program version if present -->
      ${session.programVersion ? `
        <div style="font-size: 11px; color: var(--text-3); margin-bottom: 12px; padding: 0 4px;">
          Program version: v${session.programVersion}
        </div>
      ` : ''}

      <!-- Exercises -->
      ${(session.exercises || []).map(ex => {
        const bestSet = (ex.sets || []).reduce((best, s) =>
          (parseFloat(s.weight)||0) > (parseFloat(best?.weight)||0) ? s : best, null);
        const bestE1RM = bestSet
          ? DB.calcE1RM(bestSet.weight, bestSet.reps)
          : 0;

        return `
          <div class="card card-sm" style="margin-bottom: 12px;">
            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px;">
              <div style="font-size: 16px; font-weight: 700;">${ex.name}</div>
              <div style="text-align: right;">
                ${bestSet ? `<div style="font-size: 13px; color: var(--text-2)">Best: <span style="color: var(--accent); font-weight: 700">${bestSet.weight}${App.getUnit()}</span></div>` : ''}
                ${bestE1RM > 0 ? `<div style="font-size: 11px; color: var(--warning); margin-top: 2px;">e1RM: ${bestE1RM}${App.getUnit()}</div>` : ''}
              </div>
            </div>
            ${(ex.sets || []).map((set, i) => {
              const e1rm = DB.calcE1RM(set.weight, set.reps);
              return `
              <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid var(--border); font-size: 14px; gap: 8px;">
                <span style="color: var(--text-3); font-weight: 600; flex-shrink: 0;">Set ${i+1}</span>
                <span>${set.weight || '—'}${App.getUnit()} × ${set.reps || '—'} reps${set.rir !== undefined && set.rir !== '' ? ` · <span style="color: var(--text-3);">RIR ${set.rir}</span>` : ''}</span>
                <span style="color: var(--text-3);">${(parseFloat(set.weight)||0) * (parseInt(set.reps)||0)} vol</span>
                ${e1rm > 0 ? `<span style="color: var(--warning); font-size: 12px;">${e1rm}</span>` : '<span></span>'}
                ${set.isPR ? '<span class="badge badge-pr">🏆 PR</span>' : '<span></span>'}
              </div>
            `}).join('')}
          </div>
        `;
      }).join('')}

      <!-- Notes -->
      ${session.notes && session.notes.trim() ? `
        <div class="card card-sm" style="margin-bottom: 12px;">
          <div style="font-size: 11px; font-weight: 700; color: var(--text-3); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px;">📝 Notes</div>
          <div style="font-size: 14px; color: var(--text-2); line-height: 1.6;">${this.escHtml(session.notes)}</div>
        </div>
      ` : ''}

      <!-- Actions -->
      <div style="display: flex; gap: 10px; margin-top: 16px;">
        <button class="btn btn-secondary" onclick="Log.editSession('${session.id}')" style="flex: 1;">
          ✏️ Edit
        </button>
      </div>
    `;
  },

  escHtml(str) {
    return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  },
};

window.Progress = Progress;
