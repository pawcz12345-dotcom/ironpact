/**
 * IronPact — Exercise Catalog
 *
 * 174 exercises with metadata: category, equipment, isBodyweight flag.
 * Used for autocomplete suggestions, bodyweight detection, and program editor.
 */

const ExerciseCatalog = {
  exercises: [
    // ─── PUSH ──────────────────────────────────────────────────────────────────
    // Barbell
    { name: 'Bench Press', category: 'push', equipment: 'barbell', isBodyweight: false },
    { name: 'Incline Bench Press', category: 'push', equipment: 'barbell', isBodyweight: false },
    { name: 'Decline Bench Press', category: 'push', equipment: 'barbell', isBodyweight: false },
    { name: 'Close-Grip Bench Press', category: 'push', equipment: 'barbell', isBodyweight: false },
    { name: 'Floor Press', category: 'push', equipment: 'barbell', isBodyweight: false },
    { name: 'Overhead Press', category: 'push', equipment: 'barbell', isBodyweight: false },
    { name: 'Push Press', category: 'push', equipment: 'barbell', isBodyweight: false },
    // Dumbbell
    { name: 'Dumbbell Bench Press', category: 'push', equipment: 'dumbbell', isBodyweight: false },
    { name: 'Incline Dumbbell Press', category: 'push', equipment: 'dumbbell', isBodyweight: false },
    { name: 'Decline Dumbbell Press', category: 'push', equipment: 'dumbbell', isBodyweight: false },
    { name: 'Dumbbell Overhead Press', category: 'push', equipment: 'dumbbell', isBodyweight: false },
    { name: 'Arnold Press', category: 'push', equipment: 'dumbbell', isBodyweight: false },
    { name: 'Dumbbell Floor Press', category: 'push', equipment: 'dumbbell', isBodyweight: false },
    { name: 'Chest Flies', category: 'push', equipment: 'dumbbell', isBodyweight: false },
    { name: 'Incline Dumbbell Flies', category: 'push', equipment: 'dumbbell', isBodyweight: false },
    // Cable
    { name: 'Cable Crossover', category: 'push', equipment: 'cable', isBodyweight: false },
    { name: 'Low Cable Fly', category: 'push', equipment: 'cable', isBodyweight: false },
    { name: 'Cable Chest Press', category: 'push', equipment: 'cable', isBodyweight: false },
    // Machine
    { name: 'Machine Chest Press', category: 'push', equipment: 'machine', isBodyweight: false },
    { name: 'Pec Deck', category: 'push', equipment: 'machine', isBodyweight: false },
    { name: 'Smith Machine Bench Press', category: 'push', equipment: 'machine', isBodyweight: false },
    { name: 'Smith Machine Incline Press', category: 'push', equipment: 'machine', isBodyweight: false },
    // Bodyweight
    { name: 'Push-ups', category: 'push', equipment: 'bodyweight', isBodyweight: true },
    { name: 'Diamond Close-Grip Press', category: 'push', equipment: 'bodyweight', isBodyweight: true },
    { name: 'Dips', category: 'push', equipment: 'bodyweight', isBodyweight: true },
    { name: 'Pike Push-ups', category: 'push', equipment: 'bodyweight', isBodyweight: true },
    { name: 'Decline Push-ups', category: 'push', equipment: 'bodyweight', isBodyweight: true },
    { name: 'Archer Push-ups', category: 'push', equipment: 'bodyweight', isBodyweight: true },
    { name: 'Wide Push-ups', category: 'push', equipment: 'bodyweight', isBodyweight: true },
    { name: 'Deficit Push-ups', category: 'push', equipment: 'bodyweight', isBodyweight: true },
    { name: 'Handstand Push-ups', category: 'push', equipment: 'bodyweight', isBodyweight: true },

    // ─── PULL ──────────────────────────────────────────────────────────────────
    // Barbell
    { name: 'Deadlift', category: 'pull', equipment: 'barbell', isBodyweight: false },
    { name: 'Barbell Row', category: 'pull', equipment: 'barbell', isBodyweight: false },
    { name: 'Pendlay Row', category: 'pull', equipment: 'barbell', isBodyweight: false },
    { name: 'T-Bar Row', category: 'pull', equipment: 'barbell', isBodyweight: false },
    { name: 'Barbell Shrug', category: 'pull', equipment: 'barbell', isBodyweight: false },
    { name: 'Rack Pull', category: 'pull', equipment: 'barbell', isBodyweight: false },
    { name: 'Sumo Deadlift', category: 'pull', equipment: 'barbell', isBodyweight: false },
    { name: 'Snatch-Grip Deadlift', category: 'pull', equipment: 'barbell', isBodyweight: false },
    // Dumbbell
    { name: 'Dumbbell Row', category: 'pull', equipment: 'dumbbell', isBodyweight: false },
    { name: 'Dumbbell Shrug', category: 'pull', equipment: 'dumbbell', isBodyweight: false },
    { name: 'Dumbbell Pullover', category: 'pull', equipment: 'dumbbell', isBodyweight: false },
    { name: 'Incline Dumbbell Row', category: 'pull', equipment: 'dumbbell', isBodyweight: false },
    { name: 'Kroc Row', category: 'pull', equipment: 'dumbbell', isBodyweight: false },
    { name: 'Chest-Supported Row', category: 'pull', equipment: 'dumbbell', isBodyweight: false },
    // Cable
    { name: 'Cable Row', category: 'pull', equipment: 'cable', isBodyweight: false },
    { name: 'Face Pulls', category: 'pull', equipment: 'cable', isBodyweight: false },
    { name: 'Lat Pulldown', category: 'pull', equipment: 'cable', isBodyweight: false },
    { name: 'Close-Grip Pulldown', category: 'pull', equipment: 'cable', isBodyweight: false },
    { name: 'Straight-Arm Pulldown', category: 'pull', equipment: 'cable', isBodyweight: false },
    { name: 'Cable Shrug', category: 'pull', equipment: 'cable', isBodyweight: false },
    { name: 'Single-Arm Cable Row', category: 'pull', equipment: 'cable', isBodyweight: false },
    // Machine
    { name: 'Machine Row', category: 'pull', equipment: 'machine', isBodyweight: false },
    { name: 'Seated Row Machine', category: 'pull', equipment: 'machine', isBodyweight: false },
    { name: 'Assisted Pull-Up Machine', category: 'pull', equipment: 'machine', isBodyweight: false },
    // Bodyweight
    { name: 'Pull-Ups', category: 'pull', equipment: 'bodyweight', isBodyweight: true },
    { name: 'Chin-Ups', category: 'pull', equipment: 'bodyweight', isBodyweight: true },
    { name: 'Muscle-Ups', category: 'pull', equipment: 'bodyweight', isBodyweight: true },
    { name: 'Inverted Rows', category: 'pull', equipment: 'bodyweight', isBodyweight: true },
    { name: 'Wide-Grip Pull-Ups', category: 'pull', equipment: 'bodyweight', isBodyweight: true },
    { name: 'Neutral-Grip Pull-Ups', category: 'pull', equipment: 'bodyweight', isBodyweight: true },

    // ─── LEGS ──────────────────────────────────────────────────────────────────
    // Barbell
    { name: 'Squat', category: 'legs', equipment: 'barbell', isBodyweight: false },
    { name: 'Front Squat', category: 'legs', equipment: 'barbell', isBodyweight: false },
    { name: 'Romanian Deadlift', category: 'legs', equipment: 'barbell', isBodyweight: false },
    { name: 'Barbell Lunge', category: 'legs', equipment: 'barbell', isBodyweight: false },
    { name: 'Barbell Hip Thrust', category: 'legs', equipment: 'barbell', isBodyweight: false },
    { name: 'Good Morning', category: 'legs', equipment: 'barbell', isBodyweight: false },
    { name: 'Zercher Squat', category: 'legs', equipment: 'barbell', isBodyweight: false },
    { name: 'Pause Squat', category: 'legs', equipment: 'barbell', isBodyweight: false },
    { name: 'Box Squat', category: 'legs', equipment: 'barbell', isBodyweight: false },
    { name: 'Barbell Calf Raise', category: 'legs', equipment: 'barbell', isBodyweight: false },
    // Dumbbell
    { name: 'Dumbbell Lunge', category: 'legs', equipment: 'dumbbell', isBodyweight: false },
    { name: 'Dumbbell Romanian Deadlift', category: 'legs', equipment: 'dumbbell', isBodyweight: false },
    { name: 'Goblet Squat', category: 'legs', equipment: 'dumbbell', isBodyweight: false },
    { name: 'Dumbbell Step-Up', category: 'legs', equipment: 'dumbbell', isBodyweight: false },
    { name: 'Dumbbell Bulgarian Split Squat', category: 'legs', equipment: 'dumbbell', isBodyweight: false },
    { name: 'Dumbbell Calf Raise', category: 'legs', equipment: 'dumbbell', isBodyweight: false },
    { name: 'Dumbbell Hip Thrust', category: 'legs', equipment: 'dumbbell', isBodyweight: false },
    { name: 'Dumbbell Sumo Squat', category: 'legs', equipment: 'dumbbell', isBodyweight: false },
    // Cable
    { name: 'Cable Pull-Through', category: 'legs', equipment: 'cable', isBodyweight: false },
    { name: 'Cable Kickback', category: 'legs', equipment: 'cable', isBodyweight: false },
    // Machine
    { name: 'Leg Press', category: 'legs', equipment: 'machine', isBodyweight: false },
    { name: 'Leg Curl', category: 'legs', equipment: 'machine', isBodyweight: false },
    { name: 'Leg Extension', category: 'legs', equipment: 'machine', isBodyweight: false },
    { name: 'Hack Squat', category: 'legs', equipment: 'machine', isBodyweight: false },
    { name: 'Hip Thrust', category: 'legs', equipment: 'machine', isBodyweight: false },
    { name: 'Smith Machine Squat', category: 'legs', equipment: 'machine', isBodyweight: false },
    { name: 'Seated Calf Raise', category: 'legs', equipment: 'machine', isBodyweight: false },
    { name: 'Standing Calf Raise Machine', category: 'legs', equipment: 'machine', isBodyweight: false },
    { name: 'Hip Abductor Machine', category: 'legs', equipment: 'machine', isBodyweight: false },
    { name: 'Hip Adductor Machine', category: 'legs', equipment: 'machine', isBodyweight: false },
    { name: 'Pendulum Squat', category: 'legs', equipment: 'machine', isBodyweight: false },
    { name: 'Belt Squat', category: 'legs', equipment: 'machine', isBodyweight: false },
    // Bodyweight
    { name: 'Bodyweight Squat', category: 'legs', equipment: 'bodyweight', isBodyweight: true },
    { name: 'Pistol Squat', category: 'legs', equipment: 'bodyweight', isBodyweight: true },
    { name: 'Bulgarian Split Squat', category: 'legs', equipment: 'bodyweight', isBodyweight: true },
    { name: 'Walking Lunge', category: 'legs', equipment: 'bodyweight', isBodyweight: true },
    { name: 'Jump Squat', category: 'legs', equipment: 'bodyweight', isBodyweight: true },
    { name: 'Calf Raises', category: 'legs', equipment: 'bodyweight', isBodyweight: true },
    { name: 'Glute Bridge', category: 'legs', equipment: 'bodyweight', isBodyweight: true },
    { name: 'Nordic Curl', category: 'legs', equipment: 'bodyweight', isBodyweight: true },
    { name: 'Step-Up', category: 'legs', equipment: 'bodyweight', isBodyweight: true },
    { name: 'Wall Sit', category: 'legs', equipment: 'bodyweight', isBodyweight: true },
    { name: 'Box Jump', category: 'legs', equipment: 'bodyweight', isBodyweight: true },
    // Kettlebell
    { name: 'Kettlebell Swing', category: 'legs', equipment: 'kettlebell', isBodyweight: false },
    { name: 'Kettlebell Goblet Squat', category: 'legs', equipment: 'kettlebell', isBodyweight: false },

    // ─── CORE ──────────────────────────────────────────────────────────────────
    // Cable
    { name: 'Cable Crunch', category: 'core', equipment: 'cable', isBodyweight: false },
    { name: 'Cable Woodchop', category: 'core', equipment: 'cable', isBodyweight: false },
    { name: 'Pallof Press', category: 'core', equipment: 'cable', isBodyweight: false },
    // Machine / Weighted
    { name: 'Machine Crunch', category: 'core', equipment: 'machine', isBodyweight: false },
    { name: 'Weighted Decline Sit-Up', category: 'core', equipment: 'dumbbell', isBodyweight: false },
    // Bodyweight
    { name: 'Plank', category: 'core', equipment: 'bodyweight', isBodyweight: true },
    { name: 'Hanging Leg Raise', category: 'core', equipment: 'bodyweight', isBodyweight: true },
    { name: 'Ab Wheel Rollout', category: 'core', equipment: 'bodyweight', isBodyweight: true },
    { name: 'Russian Twist', category: 'core', equipment: 'bodyweight', isBodyweight: true },
    { name: 'Dead Bug', category: 'core', equipment: 'bodyweight', isBodyweight: true },
    { name: 'L-Sit', category: 'core', equipment: 'bodyweight', isBodyweight: true },
    { name: 'Dragon Flag', category: 'core', equipment: 'bodyweight', isBodyweight: true },
    { name: 'Bicycle Crunch', category: 'core', equipment: 'bodyweight', isBodyweight: true },
    { name: 'Sit-Up', category: 'core', equipment: 'bodyweight', isBodyweight: true },
    { name: 'Leg Raise', category: 'core', equipment: 'bodyweight', isBodyweight: true },
    { name: 'Flutter Kicks', category: 'core', equipment: 'bodyweight', isBodyweight: true },
    { name: 'Mountain Climbers', category: 'core', equipment: 'bodyweight', isBodyweight: true },
    { name: 'V-Up', category: 'core', equipment: 'bodyweight', isBodyweight: true },
    { name: 'Toe Touch', category: 'core', equipment: 'bodyweight', isBodyweight: true },
    { name: 'Side Plank', category: 'core', equipment: 'bodyweight', isBodyweight: true },
    { name: 'Hollow Body Hold', category: 'core', equipment: 'bodyweight', isBodyweight: true },
    { name: 'Bird Dog', category: 'core', equipment: 'bodyweight', isBodyweight: true },
    { name: 'Windshield Wipers', category: 'core', equipment: 'bodyweight', isBodyweight: true },
    { name: 'Toes to Bar', category: 'core', equipment: 'bodyweight', isBodyweight: true },

    // ─── SHOULDERS ─────────────────────────────────────────────────────────────
    // Barbell
    { name: 'Military Press', category: 'shoulders', equipment: 'barbell', isBodyweight: false },
    { name: 'Behind the Neck Press', category: 'shoulders', equipment: 'barbell', isBodyweight: false },
    { name: 'Barbell Upright Row', category: 'shoulders', equipment: 'barbell', isBodyweight: false },
    // Dumbbell
    { name: 'Lateral Raises', category: 'shoulders', equipment: 'dumbbell', isBodyweight: false },
    { name: 'Front Raise', category: 'shoulders', equipment: 'dumbbell', isBodyweight: false },
    { name: 'Reverse Fly', category: 'shoulders', equipment: 'dumbbell', isBodyweight: false },
    { name: 'Dumbbell Upright Row', category: 'shoulders', equipment: 'dumbbell', isBodyweight: false },
    { name: 'Lu Raise', category: 'shoulders', equipment: 'dumbbell', isBodyweight: false },
    { name: 'Dumbbell Y-Raise', category: 'shoulders', equipment: 'dumbbell', isBodyweight: false },
    // Cable
    { name: 'Cable Lateral Raise', category: 'shoulders', equipment: 'cable', isBodyweight: false },
    { name: 'Cable Front Raise', category: 'shoulders', equipment: 'cable', isBodyweight: false },
    { name: 'Cable Reverse Fly', category: 'shoulders', equipment: 'cable', isBodyweight: false },
    // Machine
    { name: 'Machine Shoulder Press', category: 'shoulders', equipment: 'machine', isBodyweight: false },
    { name: 'Reverse Pec Deck', category: 'shoulders', equipment: 'machine', isBodyweight: false },
    { name: 'Smith Machine Overhead Press', category: 'shoulders', equipment: 'machine', isBodyweight: false },

    // ─── ARMS ──────────────────────────────────────────────────────────────────
    // Barbell
    { name: 'Bicep Curls', category: 'arms', equipment: 'barbell', isBodyweight: false },
    { name: 'EZ-Bar Curl', category: 'arms', equipment: 'barbell', isBodyweight: false },
    { name: 'Preacher Curl', category: 'arms', equipment: 'barbell', isBodyweight: false },
    { name: 'Skull Crushers', category: 'arms', equipment: 'barbell', isBodyweight: false },
    { name: 'Barbell Wrist Curl', category: 'arms', equipment: 'barbell', isBodyweight: false },
    { name: 'Reverse Barbell Curl', category: 'arms', equipment: 'barbell', isBodyweight: false },
    // Dumbbell
    { name: 'Dumbbell Curl', category: 'arms', equipment: 'dumbbell', isBodyweight: false },
    { name: 'Hammer Curl', category: 'arms', equipment: 'dumbbell', isBodyweight: false },
    { name: 'Incline Dumbbell Curl', category: 'arms', equipment: 'dumbbell', isBodyweight: false },
    { name: 'Concentration Curl', category: 'arms', equipment: 'dumbbell', isBodyweight: false },
    { name: 'Dumbbell Tricep Extension', category: 'arms', equipment: 'dumbbell', isBodyweight: false },
    { name: 'Overhead Tricep Extension', category: 'arms', equipment: 'dumbbell', isBodyweight: false },
    { name: 'Tricep Kickback', category: 'arms', equipment: 'dumbbell', isBodyweight: false },
    { name: 'Zottman Curl', category: 'arms', equipment: 'dumbbell', isBodyweight: false },
    { name: 'Spider Curl', category: 'arms', equipment: 'dumbbell', isBodyweight: false },
    // Cable
    { name: 'Tricep Pushdown', category: 'arms', equipment: 'cable', isBodyweight: false },
    { name: 'Rope Tricep Pushdown', category: 'arms', equipment: 'cable', isBodyweight: false },
    { name: 'Overhead Cable Extension', category: 'arms', equipment: 'cable', isBodyweight: false },
    { name: 'Cable Curl', category: 'arms', equipment: 'cable', isBodyweight: false },
    { name: 'Rope Hammer Curl', category: 'arms', equipment: 'cable', isBodyweight: false },
    // Machine
    { name: 'Machine Preacher Curl', category: 'arms', equipment: 'machine', isBodyweight: false },
    { name: 'Tricep Dip Machine', category: 'arms', equipment: 'machine', isBodyweight: false },

    // ─── FULL BODY / COMPOUND ──────────────────────────────────────────────────
    { name: 'Clean and Press', category: 'push', equipment: 'barbell', isBodyweight: false },
    { name: 'Power Clean', category: 'pull', equipment: 'barbell', isBodyweight: false },
    { name: 'Hang Clean', category: 'pull', equipment: 'barbell', isBodyweight: false },
    { name: 'Snatch', category: 'pull', equipment: 'barbell', isBodyweight: false },
    { name: 'Thruster', category: 'push', equipment: 'barbell', isBodyweight: false },
    { name: 'Barbell Complex', category: 'push', equipment: 'barbell', isBodyweight: false },
    { name: 'Farmers Walk', category: 'pull', equipment: 'dumbbell', isBodyweight: false },
    { name: 'Turkish Get-Up', category: 'core', equipment: 'kettlebell', isBodyweight: false },
    { name: 'Kettlebell Clean and Press', category: 'push', equipment: 'kettlebell', isBodyweight: false },
    { name: 'Kettlebell Snatch', category: 'pull', equipment: 'kettlebell', isBodyweight: false },

    // ─── CARDIO / CONDITIONING ─────────────────────────────────────────────────
    { name: 'Burpees', category: 'cardio', equipment: 'bodyweight', isBodyweight: true },
    { name: 'Battle Ropes', category: 'cardio', equipment: 'cable', isBodyweight: false },
    { name: 'Rowing Machine', category: 'cardio', equipment: 'machine', isBodyweight: false },
    { name: 'Assault Bike', category: 'cardio', equipment: 'machine', isBodyweight: false },
    { name: 'Sled Push', category: 'cardio', equipment: 'machine', isBodyweight: false },
    { name: 'Sled Pull', category: 'cardio', equipment: 'machine', isBodyweight: false },
    { name: 'Jump Rope', category: 'cardio', equipment: 'bodyweight', isBodyweight: true },
    { name: 'Bear Crawl', category: 'cardio', equipment: 'bodyweight', isBodyweight: true },
  ],

  // ─── Lookup cache (built on first use) ──────────────────────────────────────
  _nameMap: null,

  _buildNameMap() {
    if (this._nameMap) return;
    this._nameMap = new Map();
    for (const ex of this.exercises) {
      this._nameMap.set(ex.name.toLowerCase(), ex);
    }
  },

  // ─── Public API ──────────────────────────────────────────────────────────────

  getAll() {
    return this.exercises;
  },

  getByCategory(category) {
    return this.exercises.filter(ex => ex.category === category);
  },

  getByEquipment(equipment) {
    return this.exercises.filter(ex => ex.equipment === equipment);
  },

  getBodyweightExercises() {
    return this.exercises.filter(ex => ex.isBodyweight);
  },

  /** Check if an exercise name is a bodyweight exercise (case-insensitive). */
  isBodyweight(name) {
    if (!name) return false;
    this._buildNameMap();
    const ex = this._nameMap.get(name.toLowerCase());
    return ex ? ex.isBodyweight : false;
  },

  /** Get exercise metadata by name (case-insensitive). */
  get(name) {
    if (!name) return null;
    this._buildNameMap();
    return this._nameMap.get(name.toLowerCase()) || null;
  },

  /** Search exercises by query string. Returns matching entries. */
  search(query, limit = 10) {
    if (!query) return [];
    const q = query.toLowerCase();
    return this.exercises
      .filter(ex => ex.name.toLowerCase().includes(q))
      .slice(0, limit);
  },

  /** Get all exercise names as a flat array. */
  getAllNames() {
    return this.exercises.map(ex => ex.name);
  },
};

window.ExerciseCatalog = ExerciseCatalog;
