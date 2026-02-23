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
    PROGRAM_HISTORY: 'ip_program_history',
    WORKOUT_START: 'ip_workout_start',
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

  // --- Program Versioning ---
  getProgramHistory() {
    const stored = localStorage.getItem(this.KEYS.PROGRAM_HISTORY);
    return stored ? JSON.parse(stored) : [];
  },

  saveProgramVersion(program) {
    const history = this.getProgramHistory();
    const version = history.length > 0 ? history[history.length - 1].version + 1 : 1;
    const entry = {
      version,
      savedAt: this.getTodayStr(),
      savedAtISO: new Date().toISOString(),
      exercises: JSON.parse(JSON.stringify(program)),
    };
    history.push(entry);
    localStorage.setItem(this.KEYS.PROGRAM_HISTORY, JSON.stringify(history));
    return version;
  },

  getCurrentProgramVersion() {
    const history = this.getProgramHistory();
    if (!history.length) return null;
    return history[history.length - 1].version;
  },

  // --- Workout Duration ---
  setWorkoutStart() {
    localStorage.setItem(this.KEYS.WORKOUT_START, new Date().toISOString());
  },

  getWorkoutStart() {
    return localStorage.getItem(this.KEYS.WORKOUT_START);
  },

  clearWorkoutStart() {
    localStorage.removeItem(this.KEYS.WORKOUT_START);
  },

  calculateDuration() {
    const start = this.getWorkoutStart();
    if (!start) return null;
    const startTime = new Date(start);
    const now = new Date();
    const diffMs = now - startTime;
    return Math.max(1, Math.round(diffMs / 60000)); // minutes, minimum 1
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

  // --- e1RM (Epley formula) ---
  calcE1RM(weight, reps) {
    const w = parseFloat(weight) || 0;
    const r = parseInt(reps) || 0;
    if (!w || !r) return 0;
    if (r === 1) return w;
    return Math.round(w * (1 + r / 30));
  },

  // --- PRs (best weight and best e1RM) ---
  getPRs(userId) {
    const sessions = this.getSessions(userId);
    const prs = {}; // { exerciseName: { weight, reps, date, sessionId, e1rm } }
    for (const session of sessions) {
      for (const exercise of (session.exercises || [])) {
        const name = exercise.name;
        for (const set of (exercise.sets || [])) {
          if (!set.weight || !set.reps) continue;
          const w = parseFloat(set.weight);
          const e1rm = this.calcE1RM(set.weight, set.reps);
          if (!prs[name] || e1rm > (prs[name].e1rm || 0)) {
            prs[name] = {
              weight: w,
              reps: set.reps,
              date: session.date,
              sessionId: session.id,
              isPR: true,
              e1rm,
            };
          }
        }
      }
    }
    return prs;
  },

  // Check if a set is a PR for a user/exercise (by e1RM)
  checkPR(userId, exerciseName, weight, reps) {
    const prs = this.getPRs(userId);
    const e1rm = this.calcE1RM(weight, reps);
    if (!prs[exerciseName]) return true; // first time = PR
    return e1rm > (prs[exerciseName].e1rm || 0);
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

    // Average duration
    const sessionsWithDuration = sessions.filter(s => s.durationMinutes);
    const avgDuration = sessionsWithDuration.length
      ? Math.round(sessionsWithDuration.reduce((s, sess) => s + sess.durationMinutes, 0) / sessionsWithDuration.length)
      : null;

    // Volume this week vs last week
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - now.getDay());
    weekStart.setHours(0, 0, 0, 0);
    const lastWeekStart = new Date(weekStart);
    lastWeekStart.setDate(lastWeekStart.getDate() - 7);
    const lastWeekEnd = new Date(weekStart);

    let volumeThisWeek = 0;
    let volumeLastWeek = 0;
    for (const s of sessions) {
      const d = new Date(s.date + 'T00:00:00');
      const vol = (s.exercises || []).reduce((total, ex) =>
        total + (ex.sets || []).reduce((sv, set) =>
          sv + (parseFloat(set.weight)||0) * (parseInt(set.reps)||0), 0), 0);
      if (d >= weekStart) volumeThisWeek += vol;
      else if (d >= lastWeekStart && d < lastWeekEnd) volumeLastWeek += vol;
    }

    // Best e1RM across all exercises
    let bestE1RM = null;
    let bestE1RMExercise = '';
    for (const [name, pr] of Object.entries(prs)) {
      if (!bestE1RM || pr.e1rm > bestE1RM) {
        bestE1RM = pr.e1rm;
        bestE1RMExercise = name;
      }
    }

    return {
      totalSessions: sessions.length,
      sessionsThisMonth: sessionsThisMonth.length,
      totalPRs: prCount,
      prsThisMonth,
      totalVolume: Math.round(totalVolume),
      streak,
      lastSession,
      avgDuration,
      volumeThisWeek: Math.round(volumeThisWeek),
      volumeLastWeek: Math.round(volumeLastWeek),
      bestE1RM,
      bestE1RMExercise,
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
          // Best e1RM for this exercise on this session
          const bestE1RM = Math.max(...(ex.sets || []).map(s => this.calcE1RM(s.weight, s.reps)));
          history.push({
            date: session.date,
            bestWeight,
            totalVolume: Math.round(totalVolume),
            bestE1RM,
            sets: ex.sets,
          });
        }
      }
    }
    return history;
  },

  // --- Volume per session (all exercises combined) ---
  getSessionVolumes(userId) {
    const sessions = this.getSessions(userId).sort((a, b) => new Date(a.date) - new Date(b.date));
    return sessions.map(s => {
      const vol = (s.exercises || []).reduce((total, ex) =>
        total + (ex.sets || []).reduce((sv, set) =>
          sv + (parseFloat(set.weight)||0) * (parseInt(set.reps)||0), 0), 0);
      return { date: s.date, volume: Math.round(vol), type: s.type };
    });
  },

  // --- Volume by day type (this month) ---
  getVolumeByType(userId) {
    const sessions = this.getSessions(userId);
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const result = { push: 0, pull: 0, legs: 0 };
    for (const s of sessions) {
      if (new Date(s.date) < monthStart) continue;
      const vol = (s.exercises || []).reduce((total, ex) =>
        total + (ex.sets || []).reduce((sv, set) =>
          sv + (parseFloat(set.weight)||0) * (parseInt(set.reps)||0), 0), 0);
      if (result[s.type] !== undefined) result[s.type] += vol;
    }
    return result;
  },

  // --- Bodyweight history ---
  getBodyweightHistory(userId) {
    const sessions = this.getSessions(userId)
      .filter(s => s.bodyweight)
      .sort((a, b) => new Date(a.date) - new Date(b.date));
    return sessions.map(s => ({ date: s.date, weight: parseFloat(s.bodyweight) }));
  },

  // --- Sessions per week (last N weeks) ---
  getSessionsPerWeek(userId, numWeeks = 4) {
    const sessions = this.getSessions(userId);
    const now = new Date();
    const result = [];
    for (let i = numWeeks - 1; i >= 0; i--) {
      const weekEnd = new Date(now);
      weekEnd.setDate(now.getDate() - i * 7);
      weekEnd.setHours(23, 59, 59, 999);
      const weekStart = new Date(weekEnd);
      weekStart.setDate(weekEnd.getDate() - 6);
      weekStart.setHours(0, 0, 0, 0);
      const count = sessions.filter(s => {
        const d = new Date(s.date + 'T00:00:00');
        return d >= weekStart && d <= weekEnd;
      }).length;
      result.push(count);
    }
    return result;
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

  // Parse and import a CSV string (DD/MM/YYYY format)
  // Expected columns: date, type, exercise, set, weight, reps, rir
  importCSV(userId, csvText) {
    const lines = csvText.trim().split('\n').map(l => l.trim()).filter(l => l);
    if (!lines.length) return 0;

    // Strip header row (detect by checking if first cell looks like a date)
    const isHeader = (line) => {
      const first = line.split(',')[0].trim().toLowerCase();
      return isNaN(first.charAt(0)) && !first.match(/^\d/);
    };
    const dataLines = isHeader(lines[0]) ? lines.slice(1) : lines;
    if (!dataLines.length) return 0;

    // Parse DD/MM/YYYY → YYYY-MM-DD
    const parseDate = (str) => {
      const s = str.trim();
      // Try DD/MM/YYYY
      const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
      if (m) return `${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`;
      // Try YYYY-MM-DD passthrough
      if (s.match(/^\d{4}-\d{2}-\d{2}$/)) return s;
      return null;
    };

    // Group rows into sessions keyed by date+type
    const sessionMap = new Map(); // key: "YYYY-MM-DD|type" → { date, type, exercises: Map<name, sets[]> }

    for (const line of dataLines) {
      // Support quoted fields (basic)
      const cols = line.split(',').map(c => c.trim().replace(/^"|"$/g, ''));
      if (cols.length < 6) continue;

      const [rawDate, type, exercise, , weight, reps, rir] = cols;
      const date = parseDate(rawDate);
      const normalType = (type || '').toLowerCase().trim();
      if (!date || !normalType || !exercise) continue;

      const key = `${date}|${normalType}`;
      if (!sessionMap.has(key)) {
        sessionMap.set(key, { date, type: normalType, exercises: new Map() });
      }
      const session = sessionMap.get(key);

      const exName = exercise.trim();
      if (!session.exercises.has(exName)) {
        session.exercises.set(exName, []);
      }

      const setObj = {
        weight: weight || '',
        reps: reps || '',
        isPR: false,
      };
      if (rir !== undefined && rir !== '') {
        setObj.rir = rir.trim();
      }
      session.exercises.get(exName).push(setObj);
    }

    if (!sessionMap.size) return 0;

    // Convert to session objects and import
    const sessionsArray = [...sessionMap.values()].map(s => ({
      date: s.date,
      type: s.type,
      exercises: [...s.exercises.entries()].map(([name, sets]) => ({ name, sets })),
    }));

    return this.importHistoricalSessions(userId, sessionsArray);
  },

  // Import historical sessions (array format)
  importHistoricalSessions(userId, sessionsArray) {
    const existing = this.getSessions(userId);
    const programVersion = this.getCurrentProgramVersion();
    let imported = 0;
    for (const raw of sessionsArray) {
      if (!raw.date || !raw.type || !raw.exercises) continue;
      const session = {
        id: `s_${Date.now()}_${Math.random().toString(36).substr(2, 9)}_imp`,
        date: raw.date,
        type: raw.type,
        exercises: (raw.exercises || []).map(ex => ({
          name: ex.name || '',
          sets: (ex.sets || []).map(set => ({
            weight: set.weight || '',
            reps: set.reps || '',
            ...(set.rir !== undefined && set.rir !== '' ? { rir: set.rir } : {}),
            isPR: false,
          })),
        })),
        notes: raw.notes || '',
        bodyweight: raw.bodyweight || null,
        durationMinutes: raw.durationMinutes || null,
        programVersion: raw.programVersion || programVersion,
        createdAt: raw.date + 'T00:00:00.000Z',
        imported: true,
      };
      existing.push(session);
      imported++;
    }
    this.saveSessions(userId, existing);
    return imported;
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
