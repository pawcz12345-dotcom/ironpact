/**
 * IronPact — Program Editor (embedded in Settings)
 */

const ProgramEditor = {
  currentTab: 'push',

  renderInto(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;
    const program = DB.getProgram();

    container.innerHTML = `
      <div class="program-tabs">
        ${['push', 'pull', 'legs'].map(t => `
          <div class="program-tab ${this.currentTab === t ? `active-${t}` : ''}"
               onclick="ProgramEditor.switchTab('${t}')">
            ${App.typeEmoji(t)} ${t.charAt(0).toUpperCase() + t.slice(1)}
          </div>
        `).join('')}
      </div>

      <div id="program-exercises">
        ${this.renderExerciseList(program[this.currentTab] || [])}
      </div>

      <button class="btn btn-secondary" onclick="ProgramEditor.addExercise()" style="margin-top: 8px;">
        + Add Exercise
      </button>
    `;
  },

  renderExerciseList(exercises) {
    if (!exercises.length) {
      return `<div class="empty-state" style="padding: 20px;"><div class="empty-body">No exercises. Add some below.</div></div>`;
    }
    return exercises.map((ex, i) => `
      <div class="program-exercise-item" id="prog-ex-${i}">
        <div class="drag-handle">
          <span></span><span></span><span></span>
        </div>
        <input class="program-exercise-name"
               value="${this.escHtml(ex.name)}"
               placeholder="Exercise name"
               onchange="ProgramEditor.updateName(${i}, this.value)">
        <div class="delete-btn" onclick="ProgramEditor.removeExercise(${i})">×</div>
      </div>
    `).join('');
  },

  switchTab(tab) {
    this.currentTab = tab;
    const container = document.getElementById('program-container');
    if (container) this.renderInto('program-container');
  },

  addExercise() {
    const program = DB.getProgram();
    const list = program[this.currentTab];
    list.push({ name: '', order: list.length });
    DB.saveProgram(program);
    const container = document.getElementById('program-exercises');
    if (container) {
      container.innerHTML = this.renderExerciseList(list);
    }
    // Focus new input
    setTimeout(() => {
      const inputs = document.querySelectorAll('.program-exercise-name');
      if (inputs.length) inputs[inputs.length - 1].focus();
    }, 100);
  },

  updateName(idx, value) {
    const program = DB.getProgram();
    if (program[this.currentTab][idx]) {
      program[this.currentTab][idx].name = value;
      DB.saveProgram(program);
    }
  },

  removeExercise(idx) {
    const program = DB.getProgram();
    program[this.currentTab].splice(idx, 1);
    // Reorder
    program[this.currentTab] = program[this.currentTab].map((ex, i) => ({ ...ex, order: i }));
    DB.saveProgram(program);
    const container = document.getElementById('program-exercises');
    if (container) container.innerHTML = this.renderExerciseList(program[this.currentTab]);
  },

  escHtml(str) {
    return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  },
};

window.ProgramEditor = ProgramEditor;
