/**
 * IronPact - Database Layer
 * Uses localStorage for all persistence
 */

const DB = {
  // Keys
  KEYS: {
    USERS: 'ip_users',
    CURRENT_USER: 'ip_current_user',
    SESSIONS: 'ip_sessions',
    PROGRAM: 'ip_program',
    SETTINGS: 'ip_settings',
    UNIT: 'ip_unit',
  },

  // Default program
  DEFAULT_PROGRAM: {
    push: [
      { name: 'Bench Press', order: 0 },
      { name: 'Overhead Press', order: 1 },
      { name: 'Incline Dumbbell Press', order: 2 },
      { name: 'Lateral Raises', order: 3 },
      { name: 'Tricep Pushdown', order: 4 },
      { name: 'Chest Flies', order: 5 },
    ],
    pull: [
      { name: 'Deadlift', order: 0 },
      { name: 'Pull-Ups', order: 1 },
      { name: 'Barbell Row', order: 2 },
      { name: 'Cable Row', order: 3 },
      { name: 'Face Pulls', order: 4 },
      { name: 'Bicep Curls', order: 5 },
    ],
    legs: [
      { name: 'Squat', order: 0 },
      { name: 'Romanian Deadlift', order: 1 },
      { name: 'Leg Press', order: 2 },
      { name: 'Leg Curl', order: 3 },
      { name: 'Calf Raises', order: 4 },
      { name: 'Hip Thrust', order: 5 },
    ],
  },

  DEFAULT_USERS: [
    { id: 'user1', name: 'Player 1', color: '#ff6b2b', emoji: '🔥' },
    { id: 'user2', name: 'Player 2', color: '#00d4ff', emoji: '⚡' },
  ],

  // --- Users ---
  getUsers() {
    const stored = localStorage.getItem(this.KEYS.USERS);
    return stored ? JSON.parse(stored) : this.DEFAULT_USERS;
  },

  saveUsers(users) {
    localStorage.setItem(this.KEYS.USERS, JSON.stringify(users));
  },

  getCurrentUser() {
    const id = localStorage.getItem(this.KEYS.CURRENT_USER);
    if (!id) return null;
    return this.getUsers().find(u => u.id === id) || null;
  },

  setCurrentUser(userId) {
    localStorage.setItem(this.KEYS.CURRENT_USER, userId);
  },

  // --- Program ---
  getProgram() {
    const stored = localStorage.getItem(this.KEYS.PROGRAM);
    return stored ? JSON.parse(stored) : JSON.parse(JSON.stringify(this.DEFAULT_PROGRAM));
  },

  saveProgram(program) {
    localStorage.setItem(this.KEYS.PROGRAM, JSON.stringify(program));
  },

  // --- Sessions ---
  getSessions(userId) {
    const key = `${this.KEYS.SESSIONS}_${userId}`;
    const stored = localStorage.getItem(key);
    return stored ? JSON.parse(stored) : [];
  },

  saveSessions(userId, sessions) {
    const key = `${this.KEYS.SESSIONS}_${userId}`;
    localStorage.setItem(key, JSON.stringify(sessions));
  },

  addSession(userId, session) {
    const sessions = this.getSessions(userId);
    // Assign ID if not set
    if (!session.id) {
      session.id = `s_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    sessions.push(session);
    this.saveSessions(userId, sessions);
    return session;
  },

  updateSession(userId, sessionId, updatedSession) {
    const sessions = this.getSessions(userId);
    const idx = sessions.findIndex(s => s.id === sessionId);
    if (idx !== -1) {
      sessions[idx] = { ...sessions[idx], ...updatedSession };
      this.saveSessions(userId, sessions);
      return sessions[idx];
    }
    return null;
  },

  deleteSession(userId, sessionId) {
    const sessions = this.getSessions(userId);
    const filtered = sessions.filter(s => s.id !== sessionId);
    this.saveSessions(userId, filtered);
  },

  getSessionsByDate(userId, dateStr) {
    // dateStr: 'YYYY-MM-DD'
    return this.getSessions(userId).filter(s => s.date === dateStr);
  },

  // --- Settings ---
  getSettings() {
    const stored = localStorage.getItem(this.KEYS.SETTINGS);
    const defaults = { unit: 'kg', userName1: 'Player 1', userName2: 'Player 2' };
    return stored ? { ...defaults, ...JSON.parse(stored) } : defaults;
  },

  saveSettings(settings) {
    localStorage.setItem(this.KEYS.SETTINGS, JSON.stringify(settings));
  },

  // --- PRs ---
  getPRs(userId) {
    // Calculate PRs from sessions — best weight per exercise
    const sessions = this.getSessions(userId);
    const prs = {}; // { exerciseName: { weight, reps, date, sessionId } }
    for (const session of sessions) {
      for (const exercise of (session.exercises || [])) {
        const name = exercise.name;
        for (const set of (exercise.sets || [])) {
          if (!set.weight || !set.reps) continue;
          const w = parseFloat(set.weight);
          if (!prs[name] || w > prs[name].weight) {
            prs[name] = {
              weight: w,
              reps: set.reps,
              date: session.date,
              sessionId: session.id,
              isPR: true,
            };
          }
        }
      }
    }
    return prs;
  },

  // Check if a set is a PR for a user/exercise (called when logging)
  checkPR(userId, exerciseName, weight, reps) {
    const prs = this.getPRs(userId);
    const w = parseFloat(weight);
    if (!prs[exerciseName]) return true; // first time = PR
    return w > prs[exerciseName].weight;
  },

  // --- Stats ---
  getStats(userId) {
    const sessions = this.getSessions(userId);
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const sessionsThisMonth = sessions.filter(s => new Date(s.date) >= monthStart);
    const prs = this.getPRs(userId);
    const prCount = Object.keys(prs).length;

    // PRs this month: sessions with at least one PR set
    let prsThisMonth = 0;
    for (const s of sessionsThisMonth) {
      let hasPR = false;
      for (const ex of (s.exercises || [])) {
        for (const set of (ex.sets || [])) {
          if (set.isPR) { hasPR = true; break; }
        }
        if (hasPR) break;
      }
      if (hasPR) prsThisMonth++;
    }

    // Total volume (weight * reps summed across all sets all sessions)
    let totalVolume = 0;
    for (const s of sessions) {
      for (const ex of (s.exercises || [])) {
        for (const set of (ex.sets || [])) {
          totalVolume += (parseFloat(set.weight) || 0) * (parseInt(set.reps) || 0);
        }
      }
    }

    // Streak: consecutive weeks with at least 1 session
    const streak = this.calculateStreak(sessions);

    const lastSession = sessions.length > 0
      ? sessions.sort((a, b) => new Date(b.date) - new Date(a.date))[0]
      : null;

    return {
      totalSessions: sessions.length,
      sessionsThisMonth: sessionsThisMonth.length,
      totalPRs: prCount,
      prsThisMonth,
      totalVolume: Math.round(totalVolume),
      streak,
      lastSession,
    };
  },

  calculateStreak(sessions) {
    if (!sessions.length) return 0;
    // Get unique weeks
    const weeks = new Set();
    for (const s of sessions) {
      const d = new Date(s.date);
      // ISO week number
      const jan1 = new Date(d.getFullYear(), 0, 1);
      const week = Math.ceil(((d - jan1) / 86400000 + jan1.getDay() + 1) / 7);
      weeks.add(`${d.getFullYear()}-W${week}`);
    }
    // Count consecutive weeks from current week backwards
    const now = new Date();
    let streak = 0;
    for (let i = 0; i < 52; i++) {
      const d = new Date(now);
      d.setDate(d.getDate() - i * 7);
      const jan1 = new Date(d.getFullYear(), 0, 1);
      const week = Math.ceil(((d - jan1) / 86400000 + jan1.getDay() + 1) / 7);
      const key = `${d.getFullYear()}-W${week}`;
      if (weeks.has(key)) {
        streak++;
      } else if (i > 0) { // Allow current week to be empty
        break;
      }
    }
    return streak;
  },

  // --- Exercise History ---
  getExerciseHistory(userId, exerciseName) {
    const sessions = this.getSessions(userId).sort((a, b) => new Date(a.date) - new Date(b.date));
    const history = [];
    for (const session of sessions) {
      for (const ex of (session.exercises || [])) {
        if (ex.name.toLowerCase() === exerciseName.toLowerCase()) {
          const bestWeight = Math.max(...(ex.sets || []).map(s => parseFloat(s.weight) || 0));
          const totalVolume = (ex.sets || []).reduce((sum, s) =>
            sum + (parseFloat(s.weight) || 0) * (parseInt(s.reps) || 0), 0);
          history.push({
            date: session.date,
            bestWeight,
            totalVolume: Math.round(totalVolume),
            sets: ex.sets,
          });
        }
      }
    }
    return history;
  },

  // --- Export/Import ---
  exportData(userId) {
    const users = this.getUsers();
    const user = users.find(u => u.id === userId);
    return {
      version: 1,
      exportDate: new Date().toISOString(),
      userId,
      user,
      sessions: this.getSessions(userId),
      program: this.getProgram(),
      settings: this.getSettings(),
    };
  },

  importData(data, targetUserId) {
    if (!data || !data.sessions) throw new Error('Invalid data format');
    this.saveSessions(targetUserId, data.sessions);
    if (data.program) this.saveProgram(data.program);
    if (data.settings) this.saveSettings(data.settings);
  },

  // --- Rotation ---
  getSuggestedWorkout() {
    // Find last session type and suggest next in PPL rotation
    const userId = this.getCurrentUser()?.id;
    if (!userId) return 'push';
    const sessions = this.getSessions(userId).sort((a, b) => new Date(b.date) - new Date(a.date));
    if (!sessions.length) return 'push';
    const last = sessions[0].type;
    const rotation = ['push', 'pull', 'legs'];
    const idx = rotation.indexOf(last);
    return rotation[(idx + 1) % 3];
  },

  getTodayStr() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  },
};

window.DB = DB;
