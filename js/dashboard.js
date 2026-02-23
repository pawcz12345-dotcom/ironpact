/**
 * IronPact — Dashboard Page
 */

const Dashboard = {
  render() {
    const user = DB.getCurrentUser();
    const container = document.getElementById('page-dashboard');
    if (!container) return;

    if (!user) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">👋</div>
          <div class="empty-title">Welcome to IronPact</div>
          <div class="empty-body">Tap your name in the top right to get started</div>
        </div>
      `;
      return;
    }

    const settings = DB.getSettings();
    const userName = App.getUserName(user.id);
    const stats = DB.getStats(user.id);
    const sessions = DB.getSessions(user.id)
      .sort((a, b) => new Date(b.date) - new Date(a.date));
    const recentSessions = sessions.slice(0, 5);
    const todayStr = DB.getTodayStr();
    const suggested = DB.getSuggestedWorkout();
    const program = DB.getProgram();
    const suggestedExercises = program[suggested] || [];

    // Friend data
    const allUsers = DB.getUsers();
    const friend = allUsers.find(u => u.id !== user.id);
    const friendName = friend ? App.getUserName(friend.id) : null;
    const friendSessions = friend ? DB.getSessions(friend.id)
      .sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 3) : [];

    // Today's session check
    const todaySessions = sessions.filter(s => s.date === todayStr);

    // Volume delta
    const volDelta = this.calcVolumeDelta(stats.volumeThisWeek, stats.volumeLastWeek);

    // Sessions per week (last 4 weeks) for momentum sparkline
    const sessionsPerWeek = DB.getSessionsPerWeek(user.id, 4);

    // Month heatmap
    const heatmapHtml = this.renderMonthHeatmap(sessions);

    container.innerHTML = `
      <div class="page-title">Hey, ${userName} 👋</div>

      <!-- Today's Planned Workout -->
      <div class="planned-banner">
        <div class="planned-banner-label">📅 Today's Workout</div>
        <div class="planned-banner-type" style="color: ${App.typeColor(suggested)}">${suggested}</div>
        <div class="planned-banner-exercises">${suggestedExercises.slice(0, 4).map(e => e.name).join(' · ')}${suggestedExercises.length > 4 ? ` +${suggestedExercises.length - 4}` : ''}</div>
        ${todaySessions.length === 0
          ? `<button class="btn btn-primary" onclick="App.navigate('log')" style="width: auto; padding: 12px 24px;">
              Start ${suggested.charAt(0).toUpperCase() + suggested.slice(1)} Day →
            </button>`
          : `<div class="badge badge-${suggested}" style="padding: 8px 14px; font-size: 13px;">✓ Logged Today</div>`
        }
      </div>

      <!-- Stats -->
      <div class="stat-grid">
        <div class="stat-card stat-accent">
          <div class="stat-value">${stats.streak}<span class="streak-icon" style="font-size: 16px;">🔥</span></div>
          <div class="stat-label">Week Streak</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${stats.sessionsThisMonth}</div>
          <div class="stat-label">Sessions This Month</div>
        </div>
        <div class="stat-card stat-accent-2">
          <div class="stat-value">${stats.prsThisMonth}</div>
          <div class="stat-label">PRs This Month</div>
        </div>
        <div class="stat-card stat-purple">
          <div class="stat-value">${App.formatVolume(stats.totalVolume)}</div>
          <div class="stat-label">Total Volume (${App.getUnit()})</div>
        </div>
      </div>

      <!-- Volume this week vs last + Best e1RM -->
      <div class="stat-grid" style="margin-top: -4px;">
        <div class="stat-card">
          <div class="stat-value" style="font-size: 20px;">
            ${volDelta !== null
              ? `<span style="color: ${volDelta >= 0 ? 'var(--success)' : 'var(--danger)'}">${volDelta >= 0 ? '▲' : '▼'} ${Math.abs(volDelta)}%</span>`
              : `<span style="color: var(--text-3)">—</span>`
            }
          </div>
          <div class="stat-label">Volume Week/Week</div>
        </div>
        <div class="stat-card">
          ${stats.bestE1RM ? `
            <div class="stat-value" style="font-size: 18px; color: var(--warning);">${stats.bestE1RM}<span style="font-size: 12px; color: var(--text-3);">${App.getUnit()}</span></div>
            <div class="stat-label">Best e1RM · ${stats.bestE1RMExercise.split(' ')[0]}</div>
          ` : `
            <div class="stat-value" style="color: var(--text-3); font-size: 18px;">—</div>
            <div class="stat-label">Best e1RM</div>
          `}
        </div>
      </div>

      <!-- Momentum (sessions per week sparkline) -->
      ${sessions.length > 0 ? `
        <div class="card card-sm" style="margin-bottom: 16px;">
          <div style="display: flex; align-items: center; justify-content: space-between;">
            <div>
              <div style="font-size: 11px; font-weight: 700; color: var(--text-3); text-transform: uppercase; letter-spacing: 0.5px;">Momentum</div>
              <div style="font-size: 14px; font-weight: 700; margin-top: 2px; color: var(--text-2);">Sessions / week (last 4 wks)</div>
            </div>
            <div class="dashboard-sparkline" id="momentum-sparkline">
              ${this.renderSparkline(sessionsPerWeek, '#ff6b2b')}
            </div>
          </div>
        </div>
      ` : ''}

      <!-- Month Heatmap -->
      ${heatmapHtml}

      <!-- Recent Sessions -->
      <div class="section-header">
        <div class="section-title">Recent</div>
        <div class="section-action" onclick="App.navigate('progress')">View All</div>
      </div>

      ${recentSessions.length === 0 ? `
        <div class="empty-state" style="padding: 24px;">
          <div class="empty-icon">🏋️</div>
          <div class="empty-title">No sessions yet</div>
        </div>
      ` : recentSessions.map(s => this.renderSessionItem(s)).join('')}

      <!-- Friend Activity -->
      ${friendName ? `
        <div class="section-header" style="margin-top: 8px;">
          <div class="section-title">${friendName}'s Activity</div>
          <div class="section-action" onclick="App.navigate('compare')">Compare</div>
        </div>
        ${friendSessions.length === 0
          ? `<div class="card card-sm" style="color: var(--text-2); font-size: 14px;">No sessions logged yet</div>`
          : friendSessions.map(s => this.renderSessionItem(s, true)).join('')
        }
      ` : ''}
    `;
  },

  calcVolumeDelta(thisWeek, lastWeek) {
    if (!lastWeek) return null;
    return Math.round(((thisWeek - lastWeek) / lastWeek) * 100);
  },

  renderMonthHeatmap(sessions) {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();

    // Build session map: date -> type
    const sessionMap = {};
    for (const s of sessions) {
      const d = new Date(s.date + 'T00:00:00');
      if (d.getFullYear() === year && d.getMonth() === month) {
        sessionMap[s.date] = s.type;
      }
    }

    // Build 5-week grid
    // Find start: first day of month, pad to Sunday
    const firstDay = new Date(year, month, 1);
    const startOffset = firstDay.getDay(); // 0=Sun
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const monthName = now.toLocaleDateString('en-US', { month: 'long' });

    let cells = '';
    // Day labels
    const dayLabels = ['S','M','T','W','T','F','S'];
    const labelRow = dayLabels.map(d => `<div class="heatmap-day-label">${d}</div>`).join('');

    // Build all cells: empty padding + days
    const totalCells = Math.ceil((startOffset + daysInMonth) / 7) * 7;
    for (let i = 0; i < totalCells; i++) {
      const dayNum = i - startOffset + 1;
      if (dayNum < 1 || dayNum > daysInMonth) {
        cells += `<div class="heatmap-cell heatmap-empty"></div>`;
      } else {
        const dStr = `${year}-${String(month+1).padStart(2,'0')}-${String(dayNum).padStart(2,'0')}`;
        const type = sessionMap[dStr];
        const isToday = dStr === DB.getTodayStr();
        const colorClass = type ? `heatmap-${type}` : 'heatmap-dim';
        cells += `<div class="heatmap-cell ${colorClass} ${isToday ? 'heatmap-today' : ''}" title="${dStr}${type ? ' · ' + type : ''}"></div>`;
      }
    }

    return `
      <div class="card card-sm" style="margin-bottom: 16px;">
        <div style="font-size: 11px; font-weight: 700; color: var(--text-3); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px;">${monthName}</div>
        <div class="heatmap-grid">
          ${labelRow}
          ${cells}
        </div>
        <div class="heatmap-legend">
          <span class="heatmap-legend-dot heatmap-push"></span><span>Push</span>
          <span class="heatmap-legend-dot heatmap-pull"></span><span>Pull</span>
          <span class="heatmap-legend-dot heatmap-legs"></span><span>Legs</span>
          <span class="heatmap-legend-dot heatmap-core"></span><span>Core</span>
        </div>
      </div>
    `;
  },

  renderSparkline(values, color) {
    if (!values || values.length === 0) return '';
    const max = Math.max(...values, 1);
    const w = 8;
    const gap = 3;
    const h = 32;
    const totalW = values.length * (w + gap) - gap;
    const bars = values.map((v, i) => {
      const barH = max > 0 ? Math.max(3, Math.round((v / max) * h)) : 3;
      const x = i * (w + gap);
      const y = h - barH;
      return `<rect x="${x}" y="${y}" width="${w}" height="${barH}" rx="2" fill="${color}" opacity="${v > 0 ? '0.85' : '0.18'}"/>`;
    }).join('');
    return `<svg width="${totalW}" height="${h}" viewBox="0 0 ${totalW} ${h}">${bars}</svg>`;
  },

  renderSessionSparkline(session) {
    // Per-exercise volume as small bars
    const volumes = (session.exercises || []).map(ex =>
      (ex.sets || []).reduce((s, set) =>
        s + (parseFloat(set.weight)||0) * (parseInt(set.reps)||0), 0)
    );
    if (!volumes.length) return '';
    const max = Math.max(...volumes, 1);
    const w = 5;
    const gap = 2;
    const h = 22;
    const totalW = volumes.length * (w + gap) - gap;
    const bars = volumes.map((v, i) => {
      const barH = max > 0 ? Math.max(2, Math.round((v / max) * h)) : 2;
      const x = i * (w + gap);
      const y = h - barH;
      const color = App.typeColor(session.type).replace('var(--push-color)', '#ff6b2b')
        .replace('var(--pull-color)', '#00d4ff')
        .replace('var(--legs-color)', '#a855f7')
        .replace('var(--core-color)', '#22c55e')
        .replace('var(--accent)', '#ff6b2b');
      return `<rect x="${x}" y="${y}" width="${w}" height="${barH}" rx="1" fill="${color}" opacity="0.8"/>`;
    }).join('');
    if (!totalW || !h) return '';
    return `<svg width="${totalW}" height="${h}" viewBox="0 0 ${totalW} ${h}" style="flex-shrink:0;">${bars}</svg>`;
  },

  renderSessionItem(session, readonly = false) {
    const exerciseCount = (session.exercises || []).length;
    const setCount = (session.exercises || []).reduce((s, e) => s + (e.sets || []).length, 0);
    const hasPR = (session.exercises || []).some(e => (e.sets || []).some(s => s.isPR));
    const hasNotes = session.notes && session.notes.trim().length > 0;
    const unit = App.getUnit();
    const sparkline = this.renderSessionSparkline(session);
    const duration = session.durationMinutes ? `${session.durationMinutes}m` : '';

    return `
      <div class="session-item" onclick="${readonly ? '' : `Dashboard.openSession('${session.id}')`}" 
           style="${readonly ? 'cursor: default; opacity: 0.7;' : ''}">
        <div class="session-icon ${session.type}">${App.typeEmoji(session.type)}</div>
        <div class="session-info">
          <div class="session-name">${session.type} Day${hasNotes ? ' <span style="font-size:12px;">📝</span>' : ''}</div>
          <div class="session-meta">${App.formatDate(session.date)} · ${exerciseCount} ex · ${setCount} sets${duration ? ' · ' + duration : ''}</div>
        </div>
        <div class="session-right">
          <span class="badge badge-${session.type}">${session.type}</span>
          ${hasPR ? '<span class="badge badge-pr">🏆 PR</span>' : ''}
          ${sparkline ? `<div style="margin-top: 4px;">${sparkline}</div>` : ''}
        </div>
      </div>
    `;
  },

  openSession(sessionId) {
    // Navigate to progress with session detail
    Progress.openSession(sessionId);
    App.navigate('progress');
  },
};

window.Dashboard = Dashboard;
