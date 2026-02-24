/**
 * IronPact — Log Workout Page
 */

const Log = {
  currentType: null,
  exercises: [],
  editingSessionId: null,
  restTimerInterval: null,
  restTimerSeconds: 0,
  restTimerActive: false,

  render(type = null, sessionId = null) {
    this.editingSessionId = sessionId;
    const user = DB.getCurrentUser();
    const container = document.getElementById('page-log');
    if (!container) return;

    if (!user) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">👤</div>
          <div class="empty-title">Select your profile first</div>
          <div class="empty-body">Tap the top right to choose who you are</div>
        </div>
      `;
      return;
    }

    // If editing existing session
    if (sessionId) {
      const sessions = DB.getSessions(user.id);
      const session = sessions.find(s => s.id === sessionId);
      if (session) {
        this.currentType = session.type;
        this.exercises = JSON.parse(JSON.stringify(session.exercises || []));
        this._editBodyweight = session.bodyweight || '';
        this._editNotes = session.notes || '';
      }
    } else {
      this.currentType = type || DB.getSuggestedWorkout();
      this._editBodyweight = '';
      this._editNotes = '';
      // Load from program
      this.loadFromProgram(this.currentType);
      // Record start time
      DB.setWorkoutStart();
    }

    container.innerHTML = this.buildHTML();
    this.bindEvents();
    this.stopRestTimer(); // Reset any existing timer
  },

  loadFromProgram(type) {
    const program = DB.getProgram();
    const exercises = program[type] || [];
    this.exercises = exercises.map(ex => ({
      name: ex.name,
      sets: [this.newSet()],
    }));
  },

  buildHTML() {
    const unit = App.getUnit();
    const bw = this._editBodyweight || '';
    const notes = this._editNotes || '';
    return `
      <div class="page-title">${this.editingSessionId ? 'Edit' : 'Log'} Workout</div>

      <!-- Type picker -->
      <div class="workout-type-picker">
        ${['push', 'pull', 'legs', 'core'].map(t => `
          <div class="workout-type-btn ${this.currentType === t ? `selected-${t}` : ''}"
               onclick="Log.selectType('${t}')">
            <div class="type-icon">${App.typeEmoji(t)}</div>
            <div class="type-label">${t}</div>
          </div>
        `).join('')}
      </div>

      <!-- Bodyweight (optional) -->
      <div class="bodyweight-field">
        <label class="bodyweight-label">Bodyweight (${unit}) — optional</label>
        <input class="bodyweight-input" type="number" inputmode="decimal"
               placeholder="e.g. 80"
               value="${this.escHtml(bw)}"
               id="bodyweight-input"
               onchange="Log.updateBodyweight(this.value)">
      </div>

      <!-- Exercises -->
      <div id="exercises-list">
        ${this.exercises.map((ex, i) => this.renderExerciseCard(ex, i)).join('')}
      </div>

      <!-- Add exercise -->
      <button class="btn btn-secondary" onclick="Log.addExercise()" style="margin-bottom: 16px;">
        + Add Exercise
      </button>

      <!-- Notes (optional) -->
      <div class="notes-field">
        <label class="notes-label">Notes (optional)</label>
        <textarea class="notes-textarea"
                  id="notes-textarea"
                  placeholder="How'd it feel? Anything to remember?"
                  oninput="Log.updateNotes(this.value)">${this.escHtml(notes)}</textarea>
      </div>

      <!-- Save button -->
      <button class="btn btn-primary" onclick="Log.save()">
        💾 Save Workout
      </button>

      ${this.editingSessionId ? `
        <button class="btn btn-danger" onclick="Log.deleteSession()" style="margin-top: 10px;">
          Delete Session
        </button>
      ` : ''}

      <div style="height: 80px;"></div>
    `;
  },

  renderExerciseCard(ex, idx) {
    const unit = App.getUnit();
    return `
      <div class="exercise-card" id="exercise-${idx}">
        <div class="exercise-header">
          <div class="exercise-relative" style="flex:1; position:relative;">
            <input class="exercise-name-input" 
                   type="text"
                   value="${this.escHtml(ex.name)}" 
                   placeholder="Exercise name..."
                   oninput="Log.updateExerciseName(${idx}, this.value)"
                   onfocus="Log.showSuggestions(${idx})"
                   onblur="Log.hideSuggestions(${idx})" 
                   autocomplete="off"
                   id="ex-name-${idx}">
            <div id="suggestions-${idx}" class="exercise-suggestions" style="display:none;"></div>
          </div>
          <button class="delete-btn" onclick="Log.removeExercise(${idx})" style="margin-left: 8px;">×</button>
        </div>
        <div class="exercise-body">
          <div class="sets-header">
            <span>Set</span>
            <span>${unit}</span>
            <span>Reps</span>
            <span>RIR</span>
            <span>PR</span>
            <span></span>
          </div>
          <div id="sets-${idx}">
            ${(ex.sets || []).map((set, si) => this.renderSetRow(idx, si, set)).join('')}
          </div>
          <button class="add-set-btn" onclick="Log.addSet(${idx})">
            + Add Set
          </button>
        </div>
      </div>
    `;
  },

  renderSetRow(exIdx, setIdx, set) {
    const unit = App.getUnit();
    const vol = set.weight && set.reps
      ? Math.round(parseFloat(set.weight) * parseInt(set.reps))
      : '-';
    const e1rm = (set.weight && set.reps)
      ? DB.calcE1RM(set.weight, set.reps)
      : 0;
    return `
      <div class="set-row" id="set-${exIdx}-${setIdx}">
        <div class="set-num ${set.isPR ? 'is-pr' : ''}" id="set-num-${exIdx}-${setIdx}">${setIdx + 1}</div>
        <input class="set-input" type="number" 
               inputmode="decimal" 
               placeholder="0"
               value="${set.weight || ''}"
               onchange="Log.updateSet(${exIdx}, ${setIdx}, 'weight', this.value)"
               id="set-w-${exIdx}-${setIdx}">
        <input class="set-input" type="number" 
               inputmode="numeric"
               placeholder="0"
               value="${set.reps || ''}"
               onchange="Log.updateSet(${exIdx}, ${setIdx}, 'reps', this.value)"
               id="set-r-${exIdx}-${setIdx}">
        <input class="set-input set-input-rir" type="number"
               inputmode="numeric"
               placeholder="—"
               value="${set.rir !== undefined && set.rir !== '' ? set.rir : ''}"
               onchange="Log.updateSet(${exIdx}, ${setIdx}, 'rir', this.value)"
               id="set-rir-${exIdx}-${setIdx}">
        <div class="pr-toggle ${set.isPR ? 'active' : ''}" 
             id="pr-toggle-${exIdx}-${setIdx}"
             onclick="Log.togglePR(${exIdx}, ${setIdx})">🏆</div>
        <div class="remove-set-btn" onclick="Log.removeSet(${exIdx}, ${setIdx})">×</div>
      </div>
    `;
  },

  newSet(prevSet = null) {
    return {
      weight: prevSet ? prevSet.weight : '',
      reps: prevSet ? prevSet.reps : '',
      rir: prevSet && prevSet.rir !== undefined ? prevSet.rir : '',
      isPR: false,
    };
  },

  selectType(type) {
    this.currentType = type;
    // Reload exercises from program if not editing
    if (!this.editingSessionId) {
      this.loadFromProgram(type);
    }
    const container = document.getElementById('page-log');
    container.innerHTML = this.buildHTML();
    this.bindEvents();
  },

  bindEvents() {
    // Nothing extra needed — all handlers are inline
  },

  updateBodyweight(value) {
    this._editBodyweight = value;
  },

  updateNotes(value) {
    this._editNotes = value;
  },

  updateExerciseName(idx, value) {
    this.exercises[idx].name = value;
    this.updateSuggestions(idx, value);
  },

  showSuggestions(idx) {
    const value = document.getElementById(`ex-name-${idx}`)?.value || '';
    this.updateSuggestions(idx, value);
  },

  hideSuggestions(idx) {
    setTimeout(() => {
      const el = document.getElementById(`suggestions-${idx}`);
      if (el) el.style.display = 'none';
    }, 200);
  },

  updateSuggestions(idx, value) {
    const el = document.getElementById(`suggestions-${idx}`);
    if (!el) return;

    if (!value || value.length < 1) {
      el.style.display = 'none';
      return;
    }

    // Get exercise names from all sessions
    const user = DB.getCurrentUser();
    const allNames = new Set();
    if (user) {
      const sessions = DB.getSessions(user.id);
      for (const s of sessions) {
        for (const ex of (s.exercises || [])) {
          if (ex.name) allNames.add(ex.name);
        }
      }
    }
    // Also from program
    const program = DB.getProgram();
    for (const type of Object.values(program)) {
      for (const ex of type) {
        if (ex.name) allNames.add(ex.name);
      }
    }

    const matches = [...allNames].filter(n =>
      n.toLowerCase().includes(value.toLowerCase()) &&
      n.toLowerCase() !== value.toLowerCase()
    ).slice(0, 6);

    if (!matches.length) {
      el.style.display = 'none';
      return;
    }

    el.style.display = 'block';
    el.innerHTML = matches.map(name => `
      <div class="exercise-suggestion" onmousedown="Log.selectSuggestion(${idx}, '${this.escHtml(name)}')">
        ${name}
      </div>
    `).join('');
  },

  selectSuggestion(idx, name) {
    this.exercises[idx].name = name;
    const input = document.getElementById(`ex-name-${idx}`);
    if (input) input.value = name;
    const el = document.getElementById(`suggestions-${idx}`);
    if (el) el.style.display = 'none';
  },

  addExercise() {
    this.exercises.push({ name: '', sets: [this.newSet()] });
    const container = document.getElementById('exercises-list');
    if (container) {
      const div = document.createElement('div');
      div.innerHTML = this.renderExerciseCard(this.exercises[this.exercises.length - 1], this.exercises.length - 1);
      container.appendChild(div.firstElementChild);
      // Focus the new exercise name input
      setTimeout(() => {
        const input = document.getElementById(`ex-name-${this.exercises.length - 1}`);
        if (input) input.focus();
      }, 100);
    }
  },

  removeExercise(idx) {
    this.exercises.splice(idx, 1);
    const container = document.getElementById('page-log');
    container.innerHTML = this.buildHTML();
  },

  removeSet(exIdx, setIdx) {
    const sets = this.exercises[exIdx].sets;
    if (sets.length <= 1) {
      App.toast("Can't remove the last set", 'error');
      return;
    }
    sets.splice(setIdx, 1);
    // Re-render just this exercise's sets
    const container = document.getElementById(`sets-${exIdx}`);
    if (container) {
      container.innerHTML = sets.map((s, si) => this.renderSetRow(exIdx, si, s)).join('');
    }
  },

  addSet(exIdx) {
    const sets = this.exercises[exIdx].sets;
    const prevSet = sets[sets.length - 1];
    const newSet = this.newSet(prevSet);
    sets.push(newSet);

    const container = document.getElementById(`sets-${exIdx}`);
    if (container) {
      const setIdx = sets.length - 1;
      const div = document.createElement('div');
      div.innerHTML = this.renderSetRow(exIdx, setIdx, newSet);
      container.appendChild(div.firstElementChild);
      // Focus weight input
      setTimeout(() => {
        const input = document.getElementById(`set-w-${exIdx}-${setIdx}`);
        if (input) input.focus();
      }, 50);
    }

    // Start rest timer
    this.startRestTimer();
  },

  updateSet(exIdx, setIdx, field, value) {
    const set = this.exercises[exIdx].sets[setIdx];
    set[field] = value;

    // Auto-detect PR (only on weight/reps change)
    if ((field === 'weight' || field === 'reps') && set.weight && set.reps) {
      const user = DB.getCurrentUser();
      const exName = this.exercises[exIdx].name;
      if (user && exName) {
        const isPR = DB.checkPR(user.id, exName, set.weight, set.reps);
        if (isPR && !set.isPR) {
          set.isPR = true;
          this.updatePRUI(exIdx, setIdx, true);
        }
      }
    }
  },

  togglePR(exIdx, setIdx) {
    const set = this.exercises[exIdx].sets[setIdx];
    set.isPR = !set.isPR;
    this.updatePRUI(exIdx, setIdx, set.isPR);
  },

  updatePRUI(exIdx, setIdx, isPR) {
    const toggle = document.getElementById(`pr-toggle-${exIdx}-${setIdx}`);
    const num = document.getElementById(`set-num-${exIdx}-${setIdx}`);
    if (toggle) toggle.className = `pr-toggle ${isPR ? 'active' : ''}`;
    if (num) num.className = `set-num ${isPR ? 'is-pr' : ''}`;
  },

  // --- Rest Timer ---
  startRestTimer() {
    this.stopRestTimer();
    this.restTimerSeconds = 0;
    this.restTimerActive = true;
    this.showRestTimerPill();
    this.restTimerInterval = setInterval(() => {
      this.restTimerSeconds++;
      this.updateRestTimerDisplay();
    }, 1000);
  },

  stopRestTimer() {
    if (this.restTimerInterval) {
      clearInterval(this.restTimerInterval);
      this.restTimerInterval = null;
    }
    this.restTimerActive = false;
    this.hideRestTimerPill();
  },

  resetRestTimer() {
    this.restTimerSeconds = 0;
    this.updateRestTimerDisplay();
  },

  showRestTimerPill() {
    let pill = document.getElementById('rest-timer-pill');
    if (!pill) {
      pill = document.createElement('div');
      pill.id = 'rest-timer-pill';
      pill.className = 'rest-timer-pill';
      pill.onclick = () => Log.resetRestTimer();
      document.body.appendChild(pill);
    }
    pill.style.display = 'flex';
    this.updateRestTimerDisplay();
  },

  hideRestTimerPill() {
    const pill = document.getElementById('rest-timer-pill');
    if (pill) pill.style.display = 'none';
  },

  updateRestTimerDisplay() {
    const pill = document.getElementById('rest-timer-pill');
    if (!pill) return;
    const m = Math.floor(this.restTimerSeconds / 60);
    const s = this.restTimerSeconds % 60;
    const timeStr = `${m}:${String(s).padStart(2, '0')}`;
    pill.innerHTML = `<span class="rest-timer-text">Rest: ${timeStr} ⏱️</span>`;
  },

  validate() {
    if (!this.currentType) {
      App.toast('Select a workout type', 'error');
      return false;
    }
    const validExercises = this.exercises.filter(ex =>
      ex.name && ex.sets.some(s => s.weight || s.reps)
    );
    if (!validExercises.length) {
      App.toast('Add at least one exercise with data', 'error');
      return false;
    }
    return true;
  },

  save() {
    if (!this.validate()) return;
    const user = DB.getCurrentUser();
    const cloudUserId = App.getCloudUserId();

    if (!user && !cloudUserId) {
      App.toast('Sign in to save workouts', 'error');
      return;
    }

    // Stop rest timer
    this.stopRestTimer();

    // Filter out empty exercises
    const exercises = this.exercises
      .filter(ex => ex.name && ex.sets.some(s => s.weight || s.reps))
      .map(ex => ({
        ...ex,
        sets: ex.sets.filter(s => s.weight || s.reps),
      }));

    const todayStr = DB.getTodayStr();
    const bodyweight = this._editBodyweight ? parseFloat(this._editBodyweight) : null;
    const notes = this._editNotes ? this._editNotes.trim() : '';
    const localUserId = user?.id || 'user1';

    if (this.editingSessionId) {
      const update = {
        type: this.currentType,
        exercises,
        bodyweight,
        notes,
        updatedAt: new Date().toISOString(),
      };
      DB.updateSession(localUserId, this.editingSessionId, update);
      // Also update in cloud
      if (cloudUserId && typeof Cloud !== 'undefined') {
        Cloud.updateSession(cloudUserId, this.editingSessionId, update);
      }
      App.toast('Session updated! 💪', 'success');
    } else {
      const durationMinutes = DB.calculateDuration();
      DB.clearWorkoutStart();
      const programVersion = DB.getCurrentProgramVersion();

      const savedSession = {
        type: this.currentType,
        date: todayStr,
        exercises,
        bodyweight,
        notes,
        durationMinutes,
        programVersion,
        createdAt: new Date().toISOString(),
      };

      // Save locally (for offline/cache use)
      DB.addSession(localUserId, savedSession);

      // Save to cloud
      if (cloudUserId && typeof Cloud !== 'undefined') {
        Cloud.addSession(cloudUserId, savedSession).then(cloudSession => {
          if (cloudSession) {
            // Update local record with cloud id for future edits
            DB.updateSession(localUserId, savedSession.id, { cloudId: cloudSession.id });
          }
        });
      }

      App.toast('Workout saved! 💪', 'success');

      // Award tokens
      if (typeof Tokens !== 'undefined' && cloudUserId) {
        Tokens.onSessionSaved(cloudUserId, savedSession);
      }
    }

    this.editingSessionId = null;
    App.navigate('dashboard');
  },

  deleteSession() {
    if (!this.editingSessionId) return;
    const user = DB.getCurrentUser();
    const cloudUserId = App.getCloudUserId();
    if (!user && !cloudUserId) return;
    if (confirm('Delete this session?')) {
      const localUserId = user?.id || 'user1';
      DB.deleteSession(localUserId, this.editingSessionId);
      if (cloudUserId && typeof Cloud !== 'undefined') {
        Cloud.deleteSession(cloudUserId, this.editingSessionId);
      }
      App.toast('Session deleted', '');
      this.editingSessionId = null;
      this.stopRestTimer();
      App.navigate('dashboard');
    }
  },

  editSession(sessionId) {
    this.stopRestTimer();
    this.render(null, sessionId);
    App.navigate('log');
  },

  escHtml(str) {
    return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  },
};

window.Log = Log;
