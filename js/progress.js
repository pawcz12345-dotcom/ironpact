/**
 * IronPact — Progress & Stats Page
 */

const Progress = {
  selectedExercise: null,
  chartWeight: null,
  chartVolume: null,
  viewingSessionId: null,

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

        ${exerciseNames.size === 0 ? `
          <div class="empty-state" style="padding: 16px;">
            <div class="empty-body">Log workouts to see your progress charts</div>
          </div>
        ` : `
          <div style="margin-bottom: 12px;">
            <div class="form-label">Weight Progress (${App.getUnit()})</div>
            <div class="chart-container">
              <canvas id="chart-weight"></canvas>
            </div>
          </div>
          <div>
            <div class="form-label">Volume (${App.getUnit()} × reps)</div>
            <div class="chart-container">
              <canvas id="chart-volume"></canvas>
            </div>
          </div>
        `}
      </div>

      <!-- PRs Table -->
      <div class="card" style="margin-bottom: 16px;">
        <div class="card-title">Personal Records 🏆</div>
        ${Object.keys(prs).length === 0 ? `
          <div class="empty-state" style="padding: 16px;">
            <div class="empty-body">No PRs recorded yet. Log sets to track your bests!</div>
          </div>
        ` : `
          <table class="pr-table">
            <thead>
              <tr>
                <th>Exercise</th>
                <th>Date</th>
                <th>${App.getUnit()}</th>
              </tr>
            </thead>
            <tbody>
              ${Object.entries(prs)
                .sort((a, b) => new Date(b[1].date) - new Date(a[1].date))
                .map(([name, pr]) => `
                  <tr>
                    <td>
                      <div style="font-weight: 600">${name}</div>
                      <div style="font-size: 11px; color: var(--text-3); margin-top: 2px;">${pr.reps} reps</div>
                    </td>
                    <td style="color: var(--text-2)">${App.formatDate(pr.date)}</td>
                    <td>${pr.weight}</td>
                  </tr>
                `).join('')}
            </tbody>
          </table>
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
    if (exerciseNames.size > 0 && history.length > 0) {
      setTimeout(() => this.renderCharts(history), 50);
    }
  },

  renderSessionItem(session) {
    const exerciseCount = (session.exercises || []).length;
    const setCount = (session.exercises || []).reduce((s, e) => s + (e.sets || []).length, 0);
    const hasPR = (session.exercises || []).some(e => (e.sets || []).some(s => s.isPR));
    const totalVol = (session.exercises || []).reduce((total, ex) =>
      total + (ex.sets || []).reduce((s, set) =>
        s + (parseFloat(set.weight)||0) * (parseInt(set.reps)||0), 0), 0);

    return `
      <div class="session-item" onclick="Progress.openSession('${session.id}')">
        <div class="session-icon ${session.type}">${App.typeEmoji(session.type)}</div>
        <div class="session-info">
          <div class="session-name">${session.type} Day</div>
          <div class="session-meta">${App.formatDate(session.date)} · ${exerciseCount} exercises · ${setCount} sets</div>
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
    this.renderCharts(history);
  },

  renderCharts(history) {
    this.renderWeightChart(history);
    this.renderVolumeChart(history);
  },

  renderWeightChart(history) {
    const canvas = document.getElementById('chart-weight');
    if (!canvas) return;

    if (this.chartWeight) {
      this.chartWeight.destroy();
      this.chartWeight = null;
    }

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
    const canvas = document.getElementById('chart-volume');
    if (!canvas) return;

    if (this.chartVolume) {
      this.chartVolume.destroy();
      this.chartVolume = null;
    }

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
          <div class="stat-value">${(session.exercises || []).reduce((c, e) => c + (e.sets || []).filter(s => s.isPR).length, 0)}</div>
          <div class="stat-label">PRs</div>
        </div>
      </div>

      <!-- Exercises -->
      ${(session.exercises || []).map(ex => {
        const bestSet = (ex.sets || []).reduce((best, s) =>
          (parseFloat(s.weight)||0) > (parseFloat(best?.weight)||0) ? s : best, null);

        return `
          <div class="card card-sm" style="margin-bottom: 12px;">
            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px;">
              <div style="font-size: 16px; font-weight: 700;">${ex.name}</div>
              ${bestSet ? `<div style="font-size: 13px; color: var(--text-2)">Best: <span style="color: var(--accent); font-weight: 700">${bestSet.weight}${App.getUnit()}</span></div>` : ''}
            </div>
            ${(ex.sets || []).map((set, i) => `
              <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid var(--border); font-size: 14px;">
                <span style="color: var(--text-3); font-weight: 600;">Set ${i+1}</span>
                <span>${set.weight || '—'}${App.getUnit()} × ${set.reps || '—'} reps</span>
                <span style="color: var(--text-3);">${(parseFloat(set.weight)||0) * (parseInt(set.reps)||0)} vol</span>
                ${set.isPR ? '<span class="badge badge-pr">🏆 PR</span>' : '<span></span>'}
              </div>
            `).join('')}
          </div>
        `;
      }).join('')}

      <!-- Actions -->
      <div style="display: flex; gap: 10px; margin-top: 16px;">
        <button class="btn btn-secondary" onclick="Log.editSession('${session.id}')" style="flex: 1;">
          ✏️ Edit
        </button>
      </div>
    `;
  },
};

window.Progress = Progress;
