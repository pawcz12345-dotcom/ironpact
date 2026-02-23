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

      <!-- Last session -->
      ${stats.lastSession ? `
        <div class="card card-sm mb-16" style="margin-bottom: 16px;">
          <div class="card-title">Last Session</div>
          <div style="display: flex; align-items: center; justify-content: space-between;">
            <div>
              <span class="badge badge-${stats.lastSession.type}">${stats.lastSession.type}</span>
              <div style="margin-top: 8px; font-size: 14px; color: var(--text-2);">
                ${App.formatDate(stats.lastSession.date)} · 
                ${(stats.lastSession.exercises || []).length} exercises
              </div>
            </div>
            <div style="text-align: right; font-size: 13px; color: var(--text-2);">
              ${(stats.lastSession.exercises || []).reduce((s, e) => s + (e.sets || []).length, 0)} sets
            </div>
          </div>
        </div>
      ` : ''}

      <!-- Recent Sessions -->
      <div class="section-header">
        <div class="section-title">Recent</div>
        <div class="section-action" onclick="App.navigate('progress')">View All</div>
      </div>

      ${recentSessions.length === 0 ? `
        <div class="empty-state" style="padding: 24px;">
          <div class="empty-icon">🏋️</div>
          <div class="empty-title">No sessions yet</div>
          <div class="empty-body">Tap the + button to log your first workout</div>
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

  renderSessionItem(session, readonly = false) {
    const exerciseCount = (session.exercises || []).length;
    const setCount = (session.exercises || []).reduce((s, e) => s + (e.sets || []).length, 0);
    const hasPR = (session.exercises || []).some(e => (e.sets || []).some(s => s.isPR));
    const unit = App.getUnit();

    return `
      <div class="session-item" onclick="${readonly ? '' : `Dashboard.openSession('${session.id}')`}" 
           style="${readonly ? 'cursor: default; opacity: 0.7;' : ''}">
        <div class="session-icon ${session.type}">${App.typeEmoji(session.type)}</div>
        <div class="session-info">
          <div class="session-name">${session.type} Day</div>
          <div class="session-meta">${App.formatDate(session.date)} · ${exerciseCount} exercises · ${setCount} sets</div>
        </div>
        <div class="session-right">
          <span class="badge badge-${session.type}">${session.type}</span>
          ${hasPR ? '<span class="badge badge-pr">🏆 PR</span>' : ''}
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
