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
          <div class="empty-body">Sign in to get started</div>
        </div>`;
      return;
    }

    const userName = App.getMyName();
    const stats = DB.getStats(user.id);
    const sessions = DB.getSessions(user.id)
      .sort((a, b) => new Date(b.date) - new Date(a.date));
    const recentSessions = sessions.slice(0, 3);
    const todayStr = DB.getTodayStr();
    const suggested = DB.getSuggestedWorkout();
    const program = DB.getProgram();
    const suggestedExercises = program[suggested] || [];
    const todaySessions = sessions.filter(s => s.date === todayStr);
    const volDelta = this.calcVolumeDelta(stats.volumeThisWeek, stats.volumeLastWeek);
    const sessionsPerWeek = DB.getSessionsPerWeek(user.id, 8);

    // Greeting based on time of day
    const hour = new Date().getHours();
    const greeting = hour < 12 ? 'Morning' : hour < 17 ? 'Afternoon' : 'Evening';

    // Last session info
    const lastSession = sessions[0];
    const daysSinceLastSession = lastSession
      ? Math.floor((new Date() - new Date(lastSession.date + 'T00:00:00')) / 86400000)
      : null;

    container.innerHTML = `

      <!-- Hero greeting + CTA -->
      <div class="dash-hero">
        <div class="dash-hero-text">
          <div class="dash-greeting">Good ${greeting}</div>
          <div class="dash-name">${userName} 💪</div>
          ${daysSinceLastSession === 0
            ? `<div class="dash-sub" style="color:var(--success)">✓ Logged today</div>`
            : daysSinceLastSession === 1
            ? `<div class="dash-sub">Last session yesterday</div>`
            : daysSinceLastSession !== null
            ? `<div class="dash-sub" style="color:var(--warning)">${daysSinceLastSession}d since last session</div>`
            : `<div class="dash-sub">Ready to start your journey?</div>`
          }
        </div>
        ${todaySessions.length === 0
          ? `<button class="dash-start-btn" onclick="App.navigate('log')">
              <span style="font-size:20px;">${App.typeEmoji(suggested)}</span>
              <span>Start ${suggested.charAt(0).toUpperCase() + suggested.slice(1)}</span>
            </button>`
          : `<div class="dash-done-badge">✓ Done</div>`
        }
      </div>

      <!-- 3 key stats -->
      <div class="dash-stats-row">
        <div class="dash-stat">
          <div class="dash-stat-value">${stats.streak}<span style="font-size:14px;">🔥</span></div>
          <div class="dash-stat-label">Streak</div>
        </div>
        <div class="dash-stat-divider"></div>
        <div class="dash-stat">
          <div class="dash-stat-value">${stats.sessionsThisMonth}</div>
          <div class="dash-stat-label">This Month</div>
        </div>
        <div class="dash-stat-divider"></div>
        <div class="dash-stat">
          <div class="dash-stat-value">${stats.prsThisMonth}<span style="font-size:14px;">🏆</span></div>
          <div class="dash-stat-label">PRs</div>
        </div>
        <div class="dash-stat-divider"></div>
        <div class="dash-stat">
          <div class="dash-stat-value" style="${volDelta !== null ? `color:${volDelta >= 0 ? 'var(--success)' : 'var(--danger)'}` : ''}">
            ${volDelta !== null ? `${volDelta >= 0 ? '▲' : '▼'}${Math.abs(volDelta)}%` : '—'}
          </div>
          <div class="dash-stat-label">Volume</div>
        </div>
      </div>

      <!-- Missions -->
      <div id="dashboard-missions"></div>

      <!-- Activity graph (8-week sparkline) -->
      <div class="dash-section-label">Activity</div>
      <div class="dash-activity-card">
        ${this.renderActivityGraph(sessionsPerWeek)}
        <div class="dash-activity-footer">
          <span>8 weeks</span>
          <span>${sessions.length} total sessions</span>
        </div>
      </div>

      <!-- Next workout card -->
      <div class="dash-section-label">Up Next</div>
      <div class="dash-next-card" onclick="App.navigate('log')" style="border-left: 3px solid ${App.typeColor(suggested)};">
        <div class="dash-next-left">
          <div class="dash-next-type" style="color:${App.typeColor(suggested)}">${App.typeEmoji(suggested)} ${suggested.charAt(0).toUpperCase() + suggested.slice(1)} Day</div>
          <div class="dash-next-exercises">${suggestedExercises.slice(0, 4).map(e => e.name).join(' · ')}${suggestedExercises.length > 4 ? ` +${suggestedExercises.length - 4}` : ''}</div>
        </div>
        <div style="color:var(--text-3); font-size:20px;">→</div>
      </div>

      <!-- Best lift highlight -->
      ${stats.bestE1RM ? `
        <div class="dash-section-label">Personal Best</div>
        <div class="dash-pr-card">
          <div class="dash-pr-icon">🏆</div>
          <div class="dash-pr-info">
            <div class="dash-pr-lift">${stats.bestE1RMExercise}</div>
            <div class="dash-pr-value">${stats.bestE1RM}<span style="font-size:13px; color:var(--text-3);"> ${App.getUnit()} e1RM</span></div>
          </div>
          <div class="dash-pr-total">
            <div style="font-size:22px; font-weight:800;">${stats.totalPRs}</div>
            <div style="font-size:11px; color:var(--text-3);">total PRs</div>
          </div>
        </div>
      ` : ''}

      <!-- Recent sessions -->
      <div class="dash-section-header">
        <div class="dash-section-label" style="margin-bottom:0;">Recent</div>
        <div class="section-action" onclick="App.navigate('progress')">All →</div>
      </div>

      ${recentSessions.length === 0 ? `
        <div class="card card-sm" style="color:var(--text-2); font-size:14px; text-align:center; padding:24px;">
          No sessions yet — hit Log to start 💪
        </div>
      ` : recentSessions.map(s => this.renderSessionItem(s)).join('')}

      <!-- Friends section (async) -->
      <div id="dashboard-friend-activity"></div>

      <div style="height:8px;"></div>
    `;

    if (typeof Missions !== 'undefined') {
      const missionEl = document.getElementById('dashboard-missions');
      if (missionEl) missionEl.innerHTML = Missions.renderDashboardSection();
    }

    this._loadFriendActivity(user);
  },

  async _loadFriendActivity(user) {
    const container = document.getElementById('dashboard-friend-activity');
    if (!container) return;
    const userId = App.getCloudUserId();
    if (!userId || typeof Cloud === 'undefined') return;

    const friends = await Cloud.getFriends(userId);
    if (!friends.length) {
      container.innerHTML = `
        <div class="dash-section-header">
          <div class="dash-section-label" style="margin-bottom:0;">Friends</div>
          <div class="section-action" onclick="App.navigate('compare')">Add →</div>
        </div>
        <div class="dash-next-card" onclick="App.navigate('compare')" style="border-left:3px solid var(--accent-2);">
          <div class="dash-next-left">
            <div class="dash-next-type" style="color:var(--accent-2)">🤝 Add a friend</div>
            <div class="dash-next-exercises">Challenge someone to compete</div>
          </div>
          <div style="color:var(--text-3); font-size:20px;">→</div>
        </div>`;
      return;
    }

    // Fetch recent sessions from ALL friends
    const feedItems = [];
    await Promise.all(friends.map(async (friend) => {
      const friendName = friend.display_name || friend.username || 'Friend';
      const friendEmoji = friend.emoji || '⚡';
      try {
        const sessions = (await Cloud.getSessions(friend.id))
          .sort((a, b) => new Date(b.date) - new Date(a.date))
          .slice(0, 3);
        for (const s of sessions) {
          feedItems.push({ ...s, friendName, friendEmoji, friendId: friend.id });
        }
      } catch (e) {
        console.warn('[Dashboard] Could not load sessions for', friendName, e);
      }
    }));

    // Sort combined feed by date descending
    feedItems.sort((a, b) => new Date(b.date) - new Date(a.date));
    const recentFeed = feedItems.slice(0, 8);

    container.innerHTML = `
      <div class="dash-section-header">
        <div class="dash-section-label" style="margin-bottom:0;">Friend Activity</div>
        <div class="section-action" onclick="App.navigate('compare')">Compare →</div>
      </div>
      ${recentFeed.length === 0
        ? `<div class="card card-sm" style="color:var(--text-2); font-size:14px; text-align:center; padding:24px;">No sessions from friends yet</div>`
        : recentFeed.map(item => this._renderFeedItem(item)).join('')}
    `;
  },

  _renderFeedItem(item) {
    const exerciseCount = (item.exercises || []).length;
    const setCount = (item.exercises || []).reduce((s, e) => s + (e.sets || []).length, 0);
    const totalVol = (item.exercises || []).reduce((total, ex) =>
      total + (ex.sets || []).reduce((s, set) =>
        s + (parseFloat(set.weight)||0) * (parseInt(set.reps)||0), 0), 0);
    const hasPR = (item.exercises || []).some(e => (e.sets || []).some(s => s.isPR));
    const duration = item.durationMinutes ? `${item.durationMinutes}m` : '';

    return `
      <div class="session-item" style="cursor:default; opacity:0.85;">
        <div class="session-icon ${item.type}">${App.typeEmoji(item.type)}</div>
        <div class="session-info">
          <div class="session-name">
            <span style="color:var(--accent-2);">${item.friendEmoji} ${item.friendName}</span>
            · ${item.type.charAt(0).toUpperCase() + item.type.slice(1)}
          </div>
          <div class="session-meta">
            ${App.formatDate(item.date)} · ${exerciseCount} ex · ${setCount} sets${duration ? ' · ' + duration : ''}
            · ${App.formatVolume(Math.round(totalVol))} vol
          </div>
        </div>
        <div class="session-right">
          ${hasPR ? '<span class="badge badge-pr">🏆 PR</span>' : `<span class="badge badge-${item.type}">${item.type}</span>`}
        </div>
      </div>`;
  },

  calcVolumeDelta(thisWeek, lastWeek) {
    if (!lastWeek) return null;
    return Math.round(((thisWeek - lastWeek) / lastWeek) * 100);
  },

  renderActivityGraph(sessionsPerWeek) {
    if (!sessionsPerWeek || !sessionsPerWeek.length) return '<div style="height:48px; display:flex; align-items:center; justify-content:center; color:var(--text-3); font-size:13px;">No data yet</div>';
    const max = Math.max(...sessionsPerWeek, 1);
    const w = 20;
    const gap = 6;
    const h = 48;
    const totalW = sessionsPerWeek.length * (w + gap) - gap;
    const bars = sessionsPerWeek.map((v, i) => {
      const barH = max > 0 ? Math.max(4, Math.round((v / max) * h)) : 4;
      const x = i * (w + gap);
      const y = h - barH;
      const isLatest = i === sessionsPerWeek.length - 1;
      return `<rect x="${x}" y="${y}" width="${w}" height="${barH}" rx="4"
        fill="${isLatest ? '#ff6b2b' : 'rgba(255,107,43,0.3)'}" />`;
    }).join('');
    return `<svg width="100%" height="${h}" viewBox="0 0 ${totalW} ${h}" preserveAspectRatio="xMidYMid meet" style="display:block;">${bars}</svg>`;
  },

  renderSparkline(values, color) {
    if (!values || values.length === 0) return '';
    const max = Math.max(...values, 1);
    const w = 8; const gap = 3; const h = 32;
    const totalW = values.length * (w + gap) - gap;
    const bars = values.map((v, i) => {
      const barH = max > 0 ? Math.max(3, Math.round((v / max) * h)) : 3;
      const x = i * (w + gap); const y = h - barH;
      return `<rect x="${x}" y="${y}" width="${w}" height="${barH}" rx="2" fill="${color}" opacity="${v > 0 ? '0.85' : '0.18'}"/>`;
    }).join('');
    return `<svg width="${totalW}" height="${h}" viewBox="0 0 ${totalW} ${h}">${bars}</svg>`;
  },

  renderSessionSparkline(session) {
    const volumes = (session.exercises || []).map(ex =>
      (ex.sets || []).reduce((s, set) => s + (parseFloat(set.weight)||0) * (parseInt(set.reps)||0), 0)
    );
    if (!volumes.length) return '';
    const max = Math.max(...volumes, 1);
    const w = 5; const gap = 2; const h = 22;
    const totalW = volumes.length * (w + gap) - gap;
    const colorMap = { push: '#ff6b2b', pull: '#00d4ff', legs: '#a855f7', core: '#22c55e' };
    const color = colorMap[session.type] || '#ff6b2b';
    const bars = volumes.map((v, i) => {
      const barH = max > 0 ? Math.max(2, Math.round((v / max) * h)) : 2;
      const x = i * (w + gap); const y = h - barH;
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
    const sparkline = this.renderSessionSparkline(session);
    const duration = session.durationMinutes ? `${session.durationMinutes}m` : '';

    return `
      <div class="session-item" onclick="${readonly ? '' : `Dashboard.openSession('${session.id}')`}"
           style="${readonly ? 'cursor:default; opacity:0.7;' : ''}">
        <div class="session-icon ${session.type}">${App.typeEmoji(session.type)}</div>
        <div class="session-info">
          <div class="session-name">${session.type.charAt(0).toUpperCase() + session.type.slice(1)} Day${hasNotes ? ' <span style="font-size:11px;">📝</span>' : ''}</div>
          <div class="session-meta">${App.formatDate(session.date)} · ${exerciseCount} ex · ${setCount} sets${duration ? ' · ' + duration : ''}</div>
        </div>
        <div class="session-right">
          ${hasPR ? '<span class="badge badge-pr">🏆 PR</span>' : `<span class="badge badge-${session.type}">${session.type}</span>`}
          ${sparkline ? `<div style="margin-top:4px;">${sparkline}</div>` : ''}
        </div>
      </div>`;
  },

  openSession(sessionId) {
    Progress.openSession(sessionId);
    App.navigate('progress');
  },
};

window.Dashboard = Dashboard;
