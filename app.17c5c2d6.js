const SUPABASE_URL = "https://vgqyuvwpuicazztranch.supabase.co",
    SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZncXl1dndwdWljYXp6dHJhbmNoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIyMTMzMTUsImV4cCI6MjA4Nzc4OTMxNX0.7EU74dzKoefU1lZTR2wjTQVUgIZbAiGd2MqQ7YIZtPw";
var supabaseClient = null,
    isDemoMode = !0;
const memoryStorage = {
    _data: {},
    getItem(e) {
        return this._data[e] || null
    },
    setItem(e, t) {
        this._data[e] = t
    },
    removeItem(e) {
        delete this._data[e]
    }
};
function canUseLocalStorage() {
    try {
        const e = "__ironpact_test__";
        return localStorage.setItem(e, "1"), localStorage.removeItem(e), !0
    } catch (e) {
        return !1
    }
}
const hasLocalStorage = canUseLocalStorage();
try {
    if (void 0 !== window.supabase && window.supabase.createClient) {
        const e = hasLocalStorage ? {
            autoRefreshToken: !0,
            persistSession: !0
        } : {
            storage: memoryStorage,
            autoRefreshToken: !0,
            persistSession: !1
        };
        supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
            auth: e
        }), isDemoMode = !1
    }
} catch (e) {
    console.warn("Supabase init failed, running in demo mode:", e), isDemoMode = !0
}
const KG_TO_LBS = 2.20462;
async function ensureSession() {
    if (isDemoMode || !supabaseClient) return !0;
    try {
        let {
            data: {
                session: e
            }
        } = await supabaseClient.auth.getSession();
        if (e) return !0;
        const {
            data: t
        } = await supabaseClient.auth.refreshSession();
        return !!t?.session || (showToast("Session expired — please log in again", "error"), !1)
    } catch (e) {
        return !0
    }
}
const LBS_TO_KG = 1 / 2.20462,
    ALL_MUSCLE_GROUPS = ["chest", "back", "shoulders", "legs", "arms", "core", "cardio", "full_body"],
    AppState = {
        user: null,
        isAuthenticated: !1,
        onboardingComplete: !1,
        profile: {
            name: "Demo User",
            display_name: "Demo User",
            email: "demo@ironpact.app",
            username: "demo",
            goal: "strength",
            experience: "intermediate",
            equipment: ["barbell", "dumbbell", "cable", "machine", "bodyweight"],
            unit_pref: "imperial"
        },
        unitPref: "imperial",
        exercises: [],
        workouts: [],
        activeWorkout: null,
        activeWorkoutTimer: null,
        activeWorkoutStartTime: null,
        personalRecords: {},
        chartInstances: {},
        generatedPlan: null,
        savedPlans: [],
        sharedPlans: [],
        _loading: !1,
        friends: [],
        pacts: [],
        coachingLogs: [],
        bodyMeasurements: []
    };
function getUnitLabel() {
    return "imperial" === AppState.unitPref ? "lbs" : "kg"
}
function kgToDisplay(e) {
    return "imperial" === AppState.unitPref ? Math.round(2.20462 * e * 10) / 10 : Math.round(10 * e) / 10
}
function displayToKg(e) {
    return "imperial" === AppState.unitPref ? Math.round(e * LBS_TO_KG * 100) / 100 : e
}
function formatWeight(e) {
    return `${kgToDisplay(e)}${getUnitLabel()}`
}
function formatVolumeK(e) {
    return `${(("imperial"===AppState.unitPref?2.20462*e:e)/1e3).toFixed(1)}k`
}
function setUnitPref(e) {
    AppState.unitPref = e, handleRoute()
}
function getBodyweightKg() {
    const e = AppState.profile.body_weight || AppState.profile.weight_kg;
    if (e) return "imperial" === AppState.profile.unit_pref ? e * LBS_TO_KG : e;
    return 70
}
function getEffectiveWeight(e, t) {
    const a = AppState.exercises.find(t => t.id === e);
    if (a && a.equipment && a.equipment.toLowerCase() === "bodyweight") return getBodyweightKg() + (t || 0);
    return t || 0
}
function isTimedExercise(e) {
    const t = AppState.exercises.find(t => t.id === e);
    return t && t.exercise_modality && t.exercise_modality.toLowerCase() === "timed"
}
const ACTIVE_WORKOUT_STORAGE_KEY = "ironpact_active_workout";
function saveActiveWorkoutToStorage() {
    if (!canUseLocalStorage()) return;
    try {
        if (!AppState.activeWorkout) {
            localStorage.removeItem(ACTIVE_WORKOUT_STORAGE_KEY);
            return
        }
        const data = {
            activeWorkout: AppState.activeWorkout,
            startTime: AppState.activeWorkoutStartTime,
            paused: AppState.activeWorkoutPaused || !1,
            elapsedBeforePause: AppState.activeWorkoutElapsedBeforePause || 0,
            savedAt: Date.now()
        };
        localStorage.setItem(ACTIVE_WORKOUT_STORAGE_KEY, JSON.stringify(data))
    } catch (e) {
        console.warn("Failed to save active workout:", e)
    }
}
function loadActiveWorkoutFromStorage() {
    if (!canUseLocalStorage()) return null;
    try {
        const raw = localStorage.getItem(ACTIVE_WORKOUT_STORAGE_KEY);
        if (!raw) return null;
        const data = JSON.parse(raw);
        if (Date.now() - data.savedAt > 864e5) {
            localStorage.removeItem(ACTIVE_WORKOUT_STORAGE_KEY);
            return null
        }
        return data
    } catch (e) {
        console.warn("Failed to load active workout:", e);
        return null
    }
}
function clearActiveWorkoutStorage() {
    if (!canUseLocalStorage()) return;
    try { localStorage.removeItem(ACTIVE_WORKOUT_STORAGE_KEY) } catch (e) {}
}
function seedExercises() {
    return [{
        id: "ex-1",
        name: "Archer Push-ups",
        muscle_group: "chest",
        equipment: "bodyweight",
        exercise_type: "compound",
        description: "Wide push-up with one arm extended, shifting weight to working side."
    }, {
        id: "ex-2",
        name: "Bench Press",
        muscle_group: "chest",
        equipment: "barbell",
        exercise_type: "compound",
        description: "Lie flat on bench, grip barbell slightly wider than shoulders, lower to chest, press up."
    }, {
        id: "ex-3",
        name: "Cable Crossover",
        muscle_group: "chest",
        equipment: "cable",
        exercise_type: "isolation",
        description: "Stand between cable stations, bring handles together in front of chest."
    }, {
        id: "ex-4",
        name: "Chest Dips",
        muscle_group: "chest",
        equipment: "bodyweight",
        exercise_type: "compound",
        description: "Lean forward on parallel bars, lower body, press back up."
    }, {
        id: "ex-5",
        name: "Close-Grip Bench Press",
        muscle_group: "chest",
        equipment: "barbell",
        exercise_type: "compound",
        description: "Narrow grip bench press emphasizing triceps and inner chest."
    }, {
        id: "ex-6",
        name: "Decline Bench Press",
        muscle_group: "chest",
        equipment: "barbell",
        exercise_type: "compound",
        description: "Set bench to decline, press barbell from lower chest."
    }, {
        id: "ex-7",
        name: "Decline Dumbbell Press",
        muscle_group: "chest",
        equipment: "dumbbell",
        exercise_type: "compound",
        description: "Decline bench, press dumbbells from lower chest."
    }, {
        id: "ex-8",
        name: "Diamond Push-ups",
        muscle_group: "chest",
        equipment: "bodyweight",
        exercise_type: "compound",
        description: "Hands together in diamond shape, push up targeting inner chest and triceps."
    }, {
        id: "ex-9",
        name: "Dumbbell Bench Press",
        muscle_group: "chest",
        equipment: "dumbbell",
        exercise_type: "compound",
        description: "Lie flat on bench, press dumbbells from chest to lockout."
    }, {
        id: "ex-10",
        name: "Dumbbell Flyes",
        muscle_group: "chest",
        equipment: "dumbbell",
        exercise_type: "isolation",
        description: "Lie flat, arms extended, lower dumbbells in arc to sides, squeeze back up."
    }, {
        id: "ex-11",
        name: "Floor Press",
        muscle_group: "chest",
        equipment: "barbell",
        exercise_type: "compound",
        description: "Lie on floor, press barbell with limited ROM for lockout strength."
    }, {
        id: "ex-12",
        name: "Incline Bench Press",
        muscle_group: "chest",
        equipment: "barbell",
        exercise_type: "compound",
        description: "Set bench to 30-45 degrees, press barbell from upper chest."
    }, {
        id: "ex-13",
        name: "Incline Cable Fly",
        muscle_group: "chest",
        equipment: "cable",
        exercise_type: "isolation",
        description: "Incline bench between cables, fly motion targeting upper chest."
    }, {
        id: "ex-14",
        name: "Incline Dumbbell Press",
        muscle_group: "chest",
        equipment: "dumbbell",
        exercise_type: "compound",
        description: "Incline bench, press dumbbells from upper chest to lockout."
    }, {
        id: "ex-15",
        name: "Landmine Press",
        muscle_group: "chest",
        equipment: "barbell",
        exercise_type: "compound",
        description: "Press barbell anchored in landmine from chest height."
    }, {
        id: "ex-16",
        name: "Machine Chest Press",
        muscle_group: "chest",
        equipment: "machine",
        exercise_type: "compound",
        description: "Seated machine, press handles forward to full extension."
    }, {
        id: "ex-17",
        name: "Pec Deck Fly",
        muscle_group: "chest",
        equipment: "machine",
        exercise_type: "isolation",
        description: "Seated machine, bring pads together in front of chest."
    }, {
        id: "ex-18",
        name: "Push-ups",
        muscle_group: "chest",
        equipment: "bodyweight",
        exercise_type: "compound",
        description: "Hands shoulder-width apart, lower body to floor, push back up."
    }, {
        id: "ex-19",
        name: "Resistance Band Chest Fly",
        muscle_group: "chest",
        equipment: "band",
        exercise_type: "isolation",
        description: "Anchor band behind you, fly motion bringing hands together."
    }, {
        id: "ex-20",
        name: "Svend Press",
        muscle_group: "chest",
        equipment: "other",
        exercise_type: "isolation",
        description: "Squeeze plates together and press forward from chest."
    }, {
        id: "ex-21",
        name: "Band Pull-Apart",
        muscle_group: "back",
        equipment: "band",
        exercise_type: "isolation",
        description: "Hold band at arms length, pull apart squeezing rear delts and rhomboids."
    }, {
        id: "ex-22",
        name: "Barbell Row",
        muscle_group: "back",
        equipment: "barbell",
        exercise_type: "compound",
        description: "Bend at hips, row barbell to lower chest/upper abdomen."
    }, {
        id: "ex-23",
        name: "Chest-Supported Row",
        muscle_group: "back",
        equipment: "dumbbell",
        exercise_type: "compound",
        description: "Lie face down on incline bench, row dumbbells."
    }, {
        id: "ex-24",
        name: "Chin-ups",
        muscle_group: "back",
        equipment: "bodyweight",
        exercise_type: "compound",
        description: "Supinated grip pull-up emphasizing biceps and lower lats."
    }, {
        id: "ex-25",
        name: "Deadlift",
        muscle_group: "back",
        equipment: "barbell",
        exercise_type: "compound",
        description: "Hinge at hips, grip barbell, drive through floor to standing."
    }, {
        id: "ex-26",
        name: "Dumbbell Row",
        muscle_group: "back",
        equipment: "dumbbell",
        exercise_type: "compound",
        description: "One arm on bench, row dumbbell to hip."
    }, {
        id: "ex-27",
        name: "Inverted Row",
        muscle_group: "back",
        equipment: "bodyweight",
        exercise_type: "compound",
        description: "Hang under bar, pull chest to bar with feet on ground."
    }, {
        id: "ex-28",
        name: "Kroc Row",
        muscle_group: "back",
        equipment: "dumbbell",
        exercise_type: "compound",
        description: "Heavy single-arm dumbbell row with some body English."
    }, {
        id: "ex-29",
        name: "Lat Pulldown",
        muscle_group: "back",
        equipment: "cable",
        exercise_type: "compound",
        description: "Pull bar down to upper chest, squeeze shoulder blades."
    }, {
        id: "ex-30",
        name: "Meadows Row",
        muscle_group: "back",
        equipment: "barbell",
        exercise_type: "compound",
        description: "Landmine row from perpendicular stance, single arm."
    }, {
        id: "ex-31",
        name: "Neutral-Grip Pulldown",
        muscle_group: "back",
        equipment: "cable",
        exercise_type: "compound",
        description: "V-bar or neutral grip attachment for lat pulldown."
    }, {
        id: "ex-32",
        name: "Pendlay Row",
        muscle_group: "back",
        equipment: "barbell",
        exercise_type: "compound",
        description: "Strict barbell row from floor each rep, explosive pull."
    }, {
        id: "ex-33",
        name: "Pull-ups",
        muscle_group: "back",
        equipment: "bodyweight",
        exercise_type: "compound",
        description: "Hang from bar, pull body up until chin over bar."
    }, {
        id: "ex-34",
        name: "Rack Pull",
        muscle_group: "back",
        equipment: "barbell",
        exercise_type: "compound",
        description: "Deadlift from elevated pins targeting upper back."
    }, {
        id: "ex-35",
        name: "Seal Row",
        muscle_group: "back",
        equipment: "barbell",
        exercise_type: "compound",
        description: "Lie face down on elevated bench, row barbell with strict form."
    }, {
        id: "ex-36",
        name: "Seated Cable Row",
        muscle_group: "back",
        equipment: "cable",
        exercise_type: "compound",
        description: "Sit at cable station, pull handle to abdomen."
    }, {
        id: "ex-37",
        name: "Single-Arm Cable Row",
        muscle_group: "back",
        equipment: "cable",
        exercise_type: "compound",
        description: "Unilateral cable row, one arm at a time."
    }, {
        id: "ex-38",
        name: "Straight-Arm Pulldown",
        muscle_group: "back",
        equipment: "cable",
        exercise_type: "isolation",
        description: "Arms straight, pull bar down in arc to thighs."
    }, {
        id: "ex-39",
        name: "T-Bar Row",
        muscle_group: "back",
        equipment: "barbell",
        exercise_type: "compound",
        description: "Straddle bar, row landmine attachment to chest."
    }, {
        id: "ex-40",
        name: "Wide-Grip Pulldown",
        muscle_group: "back",
        equipment: "cable",
        exercise_type: "compound",
        description: "Extra wide grip lat pulldown for outer lat emphasis."
    }, {
        id: "ex-41",
        name: "Arnold Press",
        muscle_group: "shoulders",
        equipment: "dumbbell",
        exercise_type: "compound",
        description: "Start with palms facing you, rotate and press overhead."
    }, {
        id: "ex-42",
        name: "Barbell Shrug",
        muscle_group: "shoulders",
        equipment: "barbell",
        exercise_type: "isolation",
        description: "Hold barbell in front, shrug shoulders straight up."
    }, {
        id: "ex-43",
        name: "Behind-the-Neck Press",
        muscle_group: "shoulders",
        equipment: "barbell",
        exercise_type: "compound",
        description: "Press barbell from behind neck overhead. Requires good mobility."
    }, {
        id: "ex-44",
        name: "Cable Face Pull (Rope)",
        muscle_group: "shoulders",
        equipment: "cable",
        exercise_type: "isolation",
        description: "High cable pull to face with rope, external rotation at end."
    }, {
        id: "ex-45",
        name: "Cable Lateral Raise",
        muscle_group: "shoulders",
        equipment: "cable",
        exercise_type: "isolation",
        description: "Single-arm lateral raise using low cable pulley."
    }, {
        id: "ex-46",
        name: "Dumbbell Shrug",
        muscle_group: "shoulders",
        equipment: "dumbbell",
        exercise_type: "isolation",
        description: "Hold dumbbells at sides, shrug shoulders up to ears."
    }, {
        id: "ex-47",
        name: "Face Pull",
        muscle_group: "shoulders",
        equipment: "cable",
        exercise_type: "isolation",
        description: "Pull rope attachment to face, externally rotating shoulders."
    }, {
        id: "ex-48",
        name: "Front Raise",
        muscle_group: "shoulders",
        equipment: "dumbbell",
        exercise_type: "isolation",
        description: "Raise dumbbells in front to shoulder height."
    }, {
        id: "ex-49",
        name: "Handstand Push-ups",
        muscle_group: "shoulders",
        equipment: "bodyweight",
        exercise_type: "compound",
        description: "Inverted push-up against wall for max shoulder load."
    }, {
        id: "ex-50",
        name: "Kettlebell Press",
        muscle_group: "shoulders",
        equipment: "kettlebell",
        exercise_type: "compound",
        description: "Single-arm overhead press with kettlebell."
    }, {
        id: "ex-51",
        name: "Lateral Raise",
        muscle_group: "shoulders",
        equipment: "dumbbell",
        exercise_type: "isolation",
        description: "Raise dumbbells to sides until arms parallel to floor."
    }, {
        id: "ex-52",
        name: "Lu Raise",
        muscle_group: "shoulders",
        equipment: "dumbbell",
        exercise_type: "isolation",
        description: "Hybrid lateral/front raise at 45-degree angle."
    }, {
        id: "ex-53",
        name: "Machine Shoulder Press",
        muscle_group: "shoulders",
        equipment: "machine",
        exercise_type: "compound",
        description: "Seated machine, press handles overhead."
    }, {
        id: "ex-54",
        name: "Overhead Press",
        muscle_group: "shoulders",
        equipment: "barbell",
        exercise_type: "compound",
        description: "Press barbell from front of shoulders to overhead lockout."
    }, {
        id: "ex-55",
        name: "Pike Push-ups",
        muscle_group: "shoulders",
        equipment: "bodyweight",
        exercise_type: "compound",
        description: "Push-up with hips high in pike position, targeting shoulders."
    }, {
        id: "ex-56",
        name: "Plate Front Raise",
        muscle_group: "shoulders",
        equipment: "other",
        exercise_type: "isolation",
        description: "Hold plate with both hands, raise to shoulder height."
    }, {
        id: "ex-57",
        name: "Push Press",
        muscle_group: "shoulders",
        equipment: "barbell",
        exercise_type: "compound",
        description: "Use leg drive to press barbell overhead explosively."
    }, {
        id: "ex-58",
        name: "Rear Delt Fly",
        muscle_group: "shoulders",
        equipment: "dumbbell",
        exercise_type: "isolation",
        description: "Bend forward, raise dumbbells to sides targeting rear delts."
    }, {
        id: "ex-59",
        name: "Seated Dumbbell Press",
        muscle_group: "shoulders",
        equipment: "dumbbell",
        exercise_type: "compound",
        description: "Seated on bench, press dumbbells overhead."
    }, {
        id: "ex-60",
        name: "Upright Row",
        muscle_group: "shoulders",
        equipment: "barbell",
        exercise_type: "compound",
        description: "Pull barbell up along body to chin height, elbows high."
    }, {
        id: "ex-61",
        name: "Barbell Curl",
        muscle_group: "arms",
        equipment: "barbell",
        exercise_type: "isolation",
        description: "Curl barbell from thighs to shoulders, squeeze biceps."
    }, {
        id: "ex-62",
        name: "Bayesian Cable Curl",
        muscle_group: "arms",
        equipment: "cable",
        exercise_type: "isolation",
        description: "Face away from cable, curl from behind body for peak stretch."
    }, {
        id: "ex-63",
        name: "Cable Curl",
        muscle_group: "arms",
        equipment: "cable",
        exercise_type: "isolation",
        description: "Curl cable bar from low pulley, constant tension."
    }, {
        id: "ex-64",
        name: "Cable Overhead Extension",
        muscle_group: "arms",
        equipment: "cable",
        exercise_type: "isolation",
        description: "Face away from cable, extend rope overhead."
    }, {
        id: "ex-65",
        name: "Close-Grip Push-ups",
        muscle_group: "arms",
        equipment: "bodyweight",
        exercise_type: "compound",
        description: "Push-ups with hands close together targeting triceps."
    }, {
        id: "ex-66",
        name: "Concentration Curl",
        muscle_group: "arms",
        equipment: "dumbbell",
        exercise_type: "isolation",
        description: "Seated, elbow on inner thigh, curl dumbbell."
    }, {
        id: "ex-67",
        name: "Diamond Close-Grip Press",
        muscle_group: "arms",
        equipment: "dumbbell",
        exercise_type: "compound",
        description: "Press dumbbells together throughout movement for tricep focus."
    }, {
        id: "ex-68",
        name: "EZ-Bar Curl",
        muscle_group: "arms",
        equipment: "barbell",
        exercise_type: "isolation",
        description: "Curl EZ-bar with angled grip reducing wrist strain."
    }, {
        id: "ex-69",
        name: "Hammer Curl",
        muscle_group: "arms",
        equipment: "dumbbell",
        exercise_type: "isolation",
        description: "Curl dumbbells with neutral (hammer) grip."
    }, {
        id: "ex-70",
        name: "Incline Dumbbell Curl",
        muscle_group: "arms",
        equipment: "dumbbell",
        exercise_type: "isolation",
        description: "Seated on incline bench, curl dumbbells for stretched bicep."
    }, {
        id: "ex-71",
        name: "Kickbacks",
        muscle_group: "arms",
        equipment: "dumbbell",
        exercise_type: "isolation",
        description: "Bent over, extend dumbbell behind you squeezing tricep."
    }, {
        id: "ex-72",
        name: "Overhead Tricep Extension",
        muscle_group: "arms",
        equipment: "dumbbell",
        exercise_type: "isolation",
        description: "Hold dumbbell overhead, lower behind head, extend."
    }, {
        id: "ex-73",
        name: "Preacher Curl",
        muscle_group: "arms",
        equipment: "dumbbell",
        exercise_type: "isolation",
        description: "Arms on preacher bench, curl weight up."
    }, {
        id: "ex-74",
        name: "Reverse Curl",
        muscle_group: "arms",
        equipment: "barbell",
        exercise_type: "isolation",
        description: "Overhand grip barbell curl targeting brachioradialis."
    }, {
        id: "ex-75",
        name: "Reverse Wrist Curl",
        muscle_group: "arms",
        equipment: "dumbbell",
        exercise_type: "isolation",
        description: "Forearms on bench palms down, extend wrists up."
    }, {
        id: "ex-76",
        name: "Skull Crusher",
        muscle_group: "arms",
        equipment: "barbell",
        exercise_type: "isolation",
        description: "Lie flat, lower barbell to forehead, extend arms."
    }, {
        id: "ex-77",
        name: "Spider Curl",
        muscle_group: "arms",
        equipment: "dumbbell",
        exercise_type: "isolation",
        description: "Lie face down on incline bench, curl with arms hanging."
    }, {
        id: "ex-78",
        name: "Tricep Dips",
        muscle_group: "arms",
        equipment: "bodyweight",
        exercise_type: "compound",
        description: "Body upright on parallel bars, lower and press."
    }, {
        id: "ex-79",
        name: "Tricep Pushdown",
        muscle_group: "arms",
        equipment: "cable",
        exercise_type: "isolation",
        description: "Push cable bar/rope down, extending elbows fully."
    }, {
        id: "ex-80",
        name: "Wrist Curl",
        muscle_group: "arms",
        equipment: "dumbbell",
        exercise_type: "isolation",
        description: "Forearms on bench, curl wrists up holding dumbbells."
    }, {
        id: "ex-81",
        name: "Bulgarian Split Squat",
        muscle_group: "legs",
        equipment: "dumbbell",
        exercise_type: "compound",
        description: "Rear foot elevated on bench, squat on front leg."
    }, {
        id: "ex-82",
        name: "Calf Raise",
        muscle_group: "legs",
        equipment: "machine",
        exercise_type: "isolation",
        description: "Rise onto toes against resistance, squeeze calves at top."
    }, {
        id: "ex-83",
        name: "Front Squat",
        muscle_group: "legs",
        equipment: "barbell",
        exercise_type: "compound",
        description: "Bar on front delts, squat with upright torso."
    }, {
        id: "ex-84",
        name: "Goblet Squat",
        muscle_group: "legs",
        equipment: "dumbbell",
        exercise_type: "compound",
        description: "Hold dumbbell at chest, squat with upright posture."
    }, {
        id: "ex-85",
        name: "Good Mornings",
        muscle_group: "legs",
        equipment: "barbell",
        exercise_type: "compound",
        description: "Bar on back, hinge at hips bowing forward then stand."
    }, {
        id: "ex-86",
        name: "Hack Squat",
        muscle_group: "legs",
        equipment: "machine",
        exercise_type: "compound",
        description: "Machine squat with back supported, targets quads."
    }, {
        id: "ex-87",
        name: "Hip Thrust",
        muscle_group: "legs",
        equipment: "barbell",
        exercise_type: "compound",
        description: "Upper back on bench, drive hips up with barbell on lap."
    }, {
        id: "ex-88",
        name: "Kettlebell Swing",
        muscle_group: "legs",
        equipment: "kettlebell",
        exercise_type: "compound",
        description: "Explosive hip hinge swinging kettlebell to shoulder height."
    }, {
        id: "ex-89",
        name: "Leg Curl",
        muscle_group: "legs",
        equipment: "machine",
        exercise_type: "isolation",
        description: "Curl heels toward glutes against resistance."
    }, {
        id: "ex-90",
        name: "Leg Extension",
        muscle_group: "legs",
        equipment: "machine",
        exercise_type: "isolation",
        description: "Extend legs against pad to straighten knees."
    }, {
        id: "ex-91",
        name: "Leg Press",
        muscle_group: "legs",
        equipment: "machine",
        exercise_type: "compound",
        description: "Feet on platform, lower weight by bending knees, press back up."
    }, {
        id: "ex-92",
        name: "Leg Press (Narrow Stance)",
        muscle_group: "legs",
        equipment: "machine",
        exercise_type: "compound",
        description: "Narrow foot placement on leg press targeting outer quads."
    }, {
        id: "ex-93",
        name: "Nordic Hamstring Curl",
        muscle_group: "legs",
        equipment: "bodyweight",
        exercise_type: "isolation",
        description: "Kneel, slowly lower body forward controlling with hamstrings."
    }, {
        id: "ex-94",
        name: "Reverse Lunges",
        muscle_group: "legs",
        equipment: "dumbbell",
        exercise_type: "compound",
        description: "Step backward into lunge position, push back to standing."
    }, {
        id: "ex-95",
        name: "Romanian Deadlift",
        muscle_group: "legs",
        equipment: "barbell",
        exercise_type: "compound",
        description: "Hinge at hips with slight knee bend, lower barbell along legs."
    }, {
        id: "ex-96",
        name: "Sissy Squat",
        muscle_group: "legs",
        equipment: "bodyweight",
        exercise_type: "isolation",
        description: "Lean back with knees forward, deep quad stretch and contraction."
    }, {
        id: "ex-97",
        name: "Squat",
        muscle_group: "legs",
        equipment: "barbell",
        exercise_type: "compound",
        description: "Bar on upper back, squat down until thighs parallel, stand back up."
    }, {
        id: "ex-98",
        name: "Step-ups",
        muscle_group: "legs",
        equipment: "dumbbell",
        exercise_type: "compound",
        description: "Step onto elevated platform, drive through front foot."
    }, {
        id: "ex-99",
        name: "Sumo Deadlift",
        muscle_group: "legs",
        equipment: "barbell",
        exercise_type: "compound",
        description: "Wide stance deadlift with hands inside knees."
    }, {
        id: "ex-100",
        name: "Walking Lunges",
        muscle_group: "legs",
        equipment: "dumbbell",
        exercise_type: "compound",
        description: "Step forward into lunge, alternate legs walking."
    }, {
        id: "ex-100b",
        name: "Side Lunge",
        muscle_group: "legs",
        equipment: "bodyweight",
        exercise_type: "compound",
        description: "Step laterally into a wide squat on one leg, push back to start."
    }, {
        id: "ex-101",
        name: "Ab Wheel Rollout",
        muscle_group: "core",
        equipment: "other",
        exercise_type: "compound",
        description: "Kneel, roll wheel forward extending body, roll back."
    }, {
        id: "ex-102",
        name: "Bicycle Crunch",
        muscle_group: "core",
        equipment: "bodyweight",
        exercise_type: "isolation",
        description: "Lie on back, alternate elbow to opposite knee in cycling motion."
    }, {
        id: "ex-103",
        name: "Bird Dog",
        muscle_group: "core",
        equipment: "bodyweight",
        exercise_type: "isolation",
        description: "On all fours, extend opposite arm and leg, hold."
    }, {
        id: "ex-104",
        name: "Cable Crunch",
        muscle_group: "core",
        equipment: "cable",
        exercise_type: "isolation",
        description: "Kneel at cable station, crunch rope handle downward."
    }, {
        id: "ex-105",
        name: "Dead Bug",
        muscle_group: "core",
        equipment: "bodyweight",
        exercise_type: "isolation",
        description: "Lie on back, extend opposite arm and leg while bracing core."
    }, {
        id: "ex-106",
        name: "Decline Sit-ups",
        muscle_group: "core",
        equipment: "bodyweight",
        exercise_type: "isolation",
        description: "Sit-ups on decline bench for increased resistance."
    }, {
        id: "ex-107",
        name: "Dragon Flag",
        muscle_group: "core",
        equipment: "bodyweight",
        exercise_type: "isolation",
        description: "Lie on bench, raise body straight using only upper back as pivot."
    }, {
        id: "ex-108",
        name: "Farmer Carry",
        muscle_group: "core",
        equipment: "dumbbell",
        exercise_type: "compound",
        exercise_modality: "timed",
        description: "Walk holding heavy dumbbells in both hands, maintain posture."
    }, {
        id: "ex-109",
        name: "Flutter Kicks",
        muscle_group: "core",
        equipment: "bodyweight",
        exercise_type: "isolation",
        description: "Lie on back, alternate small leg kicks keeping core tight."
    }, {
        id: "ex-110",
        name: "Hanging Leg Raise",
        muscle_group: "core",
        equipment: "bodyweight",
        exercise_type: "isolation",
        description: "Hang from bar, raise legs to parallel or higher."
    }, {
        id: "ex-111",
        name: "L-Sit Hold",
        muscle_group: "core",
        equipment: "bodyweight",
        exercise_type: "isolation",
        exercise_modality: "timed",
        description: "Support body on parallel bars or floor with legs horizontal."
    }, {
        id: "ex-112",
        name: "Mountain Climbers",
        muscle_group: "core",
        equipment: "bodyweight",
        exercise_type: "compound",
        description: "Plank position, alternate driving knees to chest rapidly."
    }, {
        id: "ex-113",
        name: "Pallof Press",
        muscle_group: "core",
        equipment: "cable",
        exercise_type: "isolation",
        description: "Stand sideways to cable, press handle straight out resisting rotation."
    }, {
        id: "ex-114",
        name: "Plank",
        muscle_group: "core",
        equipment: "bodyweight",
        exercise_type: "isolation",
        exercise_modality: "timed",
        description: "Hold body straight in push-up position on forearms."
    }, {
        id: "ex-115",
        name: "Russian Twist",
        muscle_group: "core",
        equipment: "bodyweight",
        exercise_type: "isolation",
        description: "Seated, lean back, rotate torso side to side."
    }, {
        id: "ex-116",
        name: "Side Plank (Left)",
        muscle_group: "core",
        equipment: "bodyweight",
        exercise_type: "isolation",
        exercise_modality: "timed",
        is_unilateral: !0,
        description: "Support body on left forearm, left side facing down, hold."
    }, {
        id: "ex-116b",
        name: "Side Plank (Right)",
        muscle_group: "core",
        equipment: "bodyweight",
        exercise_type: "isolation",
        exercise_modality: "timed",
        is_unilateral: !0,
        description: "Support body on right forearm, right side facing down, hold."
    }, {
        id: "ex-117",
        name: "Suitcase Carry",
        muscle_group: "core",
        equipment: "dumbbell",
        exercise_type: "compound",
        exercise_modality: "timed",
        description: "Walk holding heavy dumbbell in one hand, resist lateral lean."
    }, {
        id: "ex-118",
        name: "Toe Touches",
        muscle_group: "core",
        equipment: "bodyweight",
        exercise_type: "isolation",
        description: "Lie on back with legs vertical, crunch up to touch toes."
    }, {
        id: "ex-119",
        name: "V-ups",
        muscle_group: "core",
        equipment: "bodyweight",
        exercise_type: "isolation",
        description: "Lie flat, simultaneously raise legs and torso to touch toes."
    }, {
        id: "ex-120",
        name: "Woodchop",
        muscle_group: "core",
        equipment: "cable",
        exercise_type: "compound",
        description: "Rotate torso pulling cable from high to low diagonally."
    }, {
        id: "ex-120b",
        name: "Wall Sit",
        muscle_group: "legs",
        equipment: "bodyweight",
        exercise_type: "isolation",
        exercise_modality: "timed",
        description: "Lean against wall with thighs parallel to floor, hold position."
    }, {
        id: "ex-120c",
        name: "Dead Hang",
        muscle_group: "back",
        equipment: "bodyweight",
        exercise_type: "isolation",
        exercise_modality: "timed",
        description: "Hang from pull-up bar with straight arms, decompress spine."
    }, {
        id: "ex-121",
        name: "Assault Bike",
        muscle_group: "cardio",
        equipment: "machine",
        exercise_type: "cardio",
        description: "Push and pull handles while pedaling for full-body cardio."
    }, {
        id: "ex-122",
        name: "Battle Ropes",
        muscle_group: "cardio",
        equipment: "other",
        exercise_type: "cardio",
        description: "Alternate slamming heavy ropes for upper body cardio."
    }, {
        id: "ex-123",
        name: "Box Jumps",
        muscle_group: "cardio",
        equipment: "other",
        exercise_type: "cardio",
        description: "Jump onto elevated box from standing, step down, repeat."
    }, {
        id: "ex-124",
        name: "Burpees",
        muscle_group: "cardio",
        equipment: "bodyweight",
        exercise_type: "cardio",
        description: "Full-body movement: squat, jump back, push-up, jump up."
    }, {
        id: "ex-125",
        name: "Jump Rope",
        muscle_group: "cardio",
        equipment: "other",
        exercise_type: "cardio",
        description: "Skip rope for cardio conditioning and coordination."
    }, {
        id: "ex-126",
        name: "Rowing Machine",
        muscle_group: "cardio",
        equipment: "machine",
        exercise_type: "cardio",
        description: "Full-body cardio pulling the rowing erg handle."
    }, {
        id: "ex-127",
        name: "Sled Push",
        muscle_group: "cardio",
        equipment: "other",
        exercise_type: "cardio",
        description: "Push weighted sled across floor for conditioning."
    }, {
        id: "ex-128",
        name: "Stairmaster",
        muscle_group: "cardio",
        equipment: "machine",
        exercise_type: "cardio",
        description: "Continuous stair climbing for lower body endurance."
    }, {
        id: "ex-129",
        name: "Stationary Bike",
        muscle_group: "cardio",
        equipment: "machine",
        exercise_type: "cardio",
        description: "Seated cycling on stationary bike at variable intensity."
    }, {
        id: "ex-130",
        name: "Treadmill Run",
        muscle_group: "cardio",
        equipment: "machine",
        exercise_type: "cardio",
        description: "Running on treadmill at steady or interval pace."
    }, {
        id: "ex-131",
        name: "Clean and Press",
        muscle_group: "full_body",
        equipment: "barbell",
        exercise_type: "compound",
        description: "Clean barbell from floor to shoulders, then press overhead."
    }, {
        id: "ex-132",
        name: "Devil Press",
        muscle_group: "full_body",
        equipment: "dumbbell",
        exercise_type: "compound",
        description: "Burpee with dumbbells into double snatch overhead."
    }, {
        id: "ex-133",
        name: "Man Maker",
        muscle_group: "full_body",
        equipment: "dumbbell",
        exercise_type: "compound",
        description: "Push-up, row each arm, clean to squat, press overhead."
    }, {
        id: "ex-134",
        name: "Thruster",
        muscle_group: "full_body",
        equipment: "barbell",
        exercise_type: "compound",
        description: "Front squat into overhead press in one fluid motion."
    }, {
        id: "ex-135",
        name: "Turkish Get-up",
        muscle_group: "full_body",
        equipment: "kettlebell",
        exercise_type: "compound",
        description: "From lying to standing while holding kettlebell overhead."
    }]
}
function seedWorkouts() {
    const e = Date.now(),
        t = 864e5;
    return [{
        id: "w-1",
        name: "Push Day",
        date: new Date(e - 1 * t).toISOString(),
        duration_minutes: 62,
        notes: "Felt strong today",
        exercises: [{
            exercise_id: "ex-2",
            exercise_name: "Bench Press",
            muscle_group: "chest",
            sets: [{
                set_number: 1,
                weight_kg: 80,
                reps: 8,
                rpe: 7,
                set_type: "working",
                completed: !0
            }, {
                set_number: 2,
                weight_kg: 85,
                reps: 6,
                rpe: 8,
                set_type: "working",
                completed: !0
            }, {
                set_number: 3,
                weight_kg: 90,
                reps: 5,
                rpe: 9,
                set_type: "working",
                completed: !0
            }, {
                set_number: 4,
                weight_kg: 90,
                reps: 4,
                rpe: 10,
                set_type: "working",
                completed: !0
            }]
        }, {
            exercise_id: "ex-12",
            exercise_name: "Incline Bench Press",
            muscle_group: "chest",
            sets: [{
                set_number: 1,
                weight_kg: 60,
                reps: 10,
                rpe: 7,
                set_type: "working",
                completed: !0
            }, {
                set_number: 2,
                weight_kg: 60,
                reps: 8,
                rpe: 8,
                set_type: "working",
                completed: !0
            }, {
                set_number: 3,
                weight_kg: 60,
                reps: 8,
                rpe: 9,
                set_type: "working",
                completed: !0
            }]
        }, {
            exercise_id: "ex-54",
            exercise_name: "Overhead Press",
            muscle_group: "shoulders",
            sets: [{
                set_number: 1,
                weight_kg: 50,
                reps: 8,
                rpe: 7,
                set_type: "working",
                completed: !0
            }, {
                set_number: 2,
                weight_kg: 50,
                reps: 7,
                rpe: 8,
                set_type: "working",
                completed: !0
            }, {
                set_number: 3,
                weight_kg: 50,
                reps: 6,
                rpe: 9,
                set_type: "working",
                completed: !0
            }]
        }, {
            exercise_id: "ex-79",
            exercise_name: "Tricep Pushdown",
            muscle_group: "arms",
            sets: [{
                set_number: 1,
                weight_kg: 30,
                reps: 12,
                rpe: 7,
                set_type: "working",
                completed: !0
            }, {
                set_number: 2,
                weight_kg: 30,
                reps: 12,
                rpe: 8,
                set_type: "working",
                completed: !0
            }, {
                set_number: 3,
                weight_kg: 30,
                reps: 10,
                rpe: 9,
                set_type: "working",
                completed: !0
            }]
        }]
    }, {
        id: "w-2",
        name: "Pull Day",
        date: new Date(e - 2 * t).toISOString(),
        duration_minutes: 58,
        notes: "Good back pump",
        exercises: [{
            exercise_id: "ex-25",
            exercise_name: "Deadlift",
            muscle_group: "back",
            sets: [{
                set_number: 1,
                weight_kg: 120,
                reps: 5,
                rpe: 7,
                set_type: "working",
                completed: !0
            }, {
                set_number: 2,
                weight_kg: 130,
                reps: 4,
                rpe: 8,
                set_type: "working",
                completed: !0
            }, {
                set_number: 3,
                weight_kg: 140,
                reps: 3,
                rpe: 9,
                set_type: "working",
                completed: !0
            }]
        }, {
            exercise_id: "ex-22",
            exercise_name: "Barbell Row",
            muscle_group: "back",
            sets: [{
                set_number: 1,
                weight_kg: 70,
                reps: 8,
                rpe: 7,
                set_type: "working",
                completed: !0
            }, {
                set_number: 2,
                weight_kg: 70,
                reps: 8,
                rpe: 8,
                set_type: "working",
                completed: !0
            }, {
                set_number: 3,
                weight_kg: 75,
                reps: 6,
                rpe: 9,
                set_type: "working",
                completed: !0
            }]
        }, {
            exercise_id: "ex-33",
            exercise_name: "Pull-ups",
            muscle_group: "back",
            sets: [{
                set_number: 1,
                weight_kg: 0,
                reps: 10,
                rpe: 7,
                set_type: "working",
                completed: !0
            }, {
                set_number: 2,
                weight_kg: 0,
                reps: 8,
                rpe: 8,
                set_type: "working",
                completed: !0
            }, {
                set_number: 3,
                weight_kg: 0,
                reps: 7,
                rpe: 9,
                set_type: "working",
                completed: !0
            }]
        }, {
            exercise_id: "ex-61",
            exercise_name: "Barbell Curl",
            muscle_group: "arms",
            sets: [{
                set_number: 1,
                weight_kg: 30,
                reps: 10,
                rpe: 7,
                set_type: "working",
                completed: !0
            }, {
                set_number: 2,
                weight_kg: 30,
                reps: 10,
                rpe: 8,
                set_type: "working",
                completed: !0
            }, {
                set_number: 3,
                weight_kg: 35,
                reps: 8,
                rpe: 9,
                set_type: "working",
                completed: !0
            }]
        }]
    }, {
        id: "w-3",
        name: "Leg Day",
        date: new Date(e - 3 * t).toISOString(),
        duration_minutes: 55,
        notes: "Squats felt heavy but manageable",
        exercises: [{
            exercise_id: "ex-97",
            exercise_name: "Squat",
            muscle_group: "legs",
            sets: [{
                set_number: 1,
                weight_kg: 100,
                reps: 6,
                rpe: 7,
                set_type: "working",
                completed: !0
            }, {
                set_number: 2,
                weight_kg: 110,
                reps: 5,
                rpe: 8,
                set_type: "working",
                completed: !0
            }, {
                set_number: 3,
                weight_kg: 115,
                reps: 4,
                rpe: 9,
                set_type: "working",
                completed: !0
            }]
        }, {
            exercise_id: "ex-95",
            exercise_name: "Romanian Deadlift",
            muscle_group: "legs",
            sets: [{
                set_number: 1,
                weight_kg: 80,
                reps: 10,
                rpe: 7,
                set_type: "working",
                completed: !0
            }, {
                set_number: 2,
                weight_kg: 80,
                reps: 8,
                rpe: 8,
                set_type: "working",
                completed: !0
            }, {
                set_number: 3,
                weight_kg: 85,
                reps: 8,
                rpe: 8,
                set_type: "working",
                completed: !0
            }]
        }, {
            exercise_id: "ex-90",
            exercise_name: "Leg Extension",
            muscle_group: "legs",
            sets: [{
                set_number: 1,
                weight_kg: 50,
                reps: 12,
                rpe: 7,
                set_type: "working",
                completed: !0
            }, {
                set_number: 2,
                weight_kg: 50,
                reps: 12,
                rpe: 8,
                set_type: "working",
                completed: !0
            }, {
                set_number: 3,
                weight_kg: 55,
                reps: 10,
                rpe: 9,
                set_type: "working",
                completed: !0
            }]
        }, {
            exercise_id: "ex-82",
            exercise_name: "Calf Raise",
            muscle_group: "legs",
            sets: [{
                set_number: 1,
                weight_kg: 60,
                reps: 15,
                rpe: 7,
                set_type: "working",
                completed: !0
            }, {
                set_number: 2,
                weight_kg: 60,
                reps: 15,
                rpe: 8,
                set_type: "working",
                completed: !0
            }, {
                set_number: 3,
                weight_kg: 60,
                reps: 12,
                rpe: 9,
                set_type: "working",
                completed: !0
            }]
        }]
    }, {
        id: "w-4",
        name: "Upper Body",
        date: new Date(e - 5 * t).toISOString(),
        duration_minutes: 65,
        notes: "Great session",
        exercises: [{
            exercise_id: "ex-2",
            exercise_name: "Bench Press",
            muscle_group: "chest",
            sets: [{
                set_number: 1,
                weight_kg: 75,
                reps: 10,
                rpe: 7,
                set_type: "working",
                completed: !0
            }, {
                set_number: 2,
                weight_kg: 80,
                reps: 8,
                rpe: 8,
                set_type: "working",
                completed: !0
            }, {
                set_number: 3,
                weight_kg: 85,
                reps: 5,
                rpe: 9,
                set_type: "working",
                completed: !0
            }]
        }, {
            exercise_id: "ex-22",
            exercise_name: "Barbell Row",
            muscle_group: "back",
            sets: [{
                set_number: 1,
                weight_kg: 65,
                reps: 10,
                rpe: 7,
                set_type: "working",
                completed: !0
            }, {
                set_number: 2,
                weight_kg: 70,
                reps: 8,
                rpe: 8,
                set_type: "working",
                completed: !0
            }, {
                set_number: 3,
                weight_kg: 70,
                reps: 7,
                rpe: 9,
                set_type: "working",
                completed: !0
            }]
        }, {
            exercise_id: "ex-54",
            exercise_name: "Overhead Press",
            muscle_group: "shoulders",
            sets: [{
                set_number: 1,
                weight_kg: 45,
                reps: 8,
                rpe: 7,
                set_type: "working",
                completed: !0
            }, {
                set_number: 2,
                weight_kg: 45,
                reps: 8,
                rpe: 8,
                set_type: "working",
                completed: !0
            }, {
                set_number: 3,
                weight_kg: 50,
                reps: 6,
                rpe: 9,
                set_type: "working",
                completed: !0
            }]
        }]
    }, {
        id: "w-5",
        name: "Full Body",
        date: new Date(e - 7 * t).toISOString(),
        duration_minutes: 72,
        notes: "",
        exercises: [{
            exercise_id: "ex-97",
            exercise_name: "Squat",
            muscle_group: "legs",
            sets: [{
                set_number: 1,
                weight_kg: 95,
                reps: 8,
                rpe: 7,
                set_type: "working",
                completed: !0
            }, {
                set_number: 2,
                weight_kg: 100,
                reps: 6,
                rpe: 8,
                set_type: "working",
                completed: !0
            }, {
                set_number: 3,
                weight_kg: 105,
                reps: 5,
                rpe: 9,
                set_type: "working",
                completed: !0
            }]
        }, {
            exercise_id: "ex-2",
            exercise_name: "Bench Press",
            muscle_group: "chest",
            sets: [{
                set_number: 1,
                weight_kg: 75,
                reps: 8,
                rpe: 7,
                set_type: "working",
                completed: !0
            }, {
                set_number: 2,
                weight_kg: 80,
                reps: 6,
                rpe: 8,
                set_type: "working",
                completed: !0
            }]
        }, {
            exercise_id: "ex-25",
            exercise_name: "Deadlift",
            muscle_group: "back",
            sets: [{
                set_number: 1,
                weight_kg: 110,
                reps: 5,
                rpe: 8,
                set_type: "working",
                completed: !0
            }, {
                set_number: 2,
                weight_kg: 120,
                reps: 3,
                rpe: 9,
                set_type: "working",
                completed: !0
            }]
        }]
    }, {
        id: "w-6",
        name: "Push Day",
        date: new Date(e - 8 * t).toISOString(),
        duration_minutes: 48,
        notes: "Quick session",
        exercises: [{
            exercise_id: "ex-2",
            exercise_name: "Bench Press",
            muscle_group: "chest",
            sets: [{
                set_number: 1,
                weight_kg: 70,
                reps: 12,
                rpe: 6,
                set_type: "working",
                completed: !0
            }, {
                set_number: 2,
                weight_kg: 75,
                reps: 10,
                rpe: 7,
                set_type: "working",
                completed: !0
            }, {
                set_number: 3,
                weight_kg: 80,
                reps: 8,
                rpe: 8,
                set_type: "working",
                completed: !0
            }]
        }, {
            exercise_id: "ex-51",
            exercise_name: "Lateral Raise",
            muscle_group: "shoulders",
            sets: [{
                set_number: 1,
                weight_kg: 10,
                reps: 15,
                rpe: 7,
                set_type: "working",
                completed: !0
            }, {
                set_number: 2,
                weight_kg: 10,
                reps: 15,
                rpe: 8,
                set_type: "working",
                completed: !0
            }, {
                set_number: 3,
                weight_kg: 12,
                reps: 12,
                rpe: 9,
                set_type: "working",
                completed: !0
            }]
        }]
    }, {
        id: "w-7",
        name: "Pull Day",
        date: new Date(e - 10 * t).toISOString(),
        duration_minutes: 60,
        notes: "",
        exercises: [{
            exercise_id: "ex-25",
            exercise_name: "Deadlift",
            muscle_group: "back",
            sets: [{
                set_number: 1,
                weight_kg: 115,
                reps: 5,
                rpe: 7,
                set_type: "working",
                completed: !0
            }, {
                set_number: 2,
                weight_kg: 125,
                reps: 4,
                rpe: 8,
                set_type: "working",
                completed: !0
            }, {
                set_number: 3,
                weight_kg: 135,
                reps: 3,
                rpe: 9,
                set_type: "working",
                completed: !0
            }]
        }, {
            exercise_id: "ex-29",
            exercise_name: "Lat Pulldown",
            muscle_group: "back",
            sets: [{
                set_number: 1,
                weight_kg: 70,
                reps: 10,
                rpe: 7,
                set_type: "working",
                completed: !0
            }, {
                set_number: 2,
                weight_kg: 75,
                reps: 8,
                rpe: 8,
                set_type: "working",
                completed: !0
            }, {
                set_number: 3,
                weight_kg: 75,
                reps: 7,
                rpe: 9,
                set_type: "working",
                completed: !0
            }]
        }]
    }, {
        id: "w-8",
        name: "Leg Day",
        date: new Date(e - 12 * t).toISOString(),
        duration_minutes: 50,
        notes: "",
        exercises: [{
            exercise_id: "ex-97",
            exercise_name: "Squat",
            muscle_group: "legs",
            sets: [{
                set_number: 1,
                weight_kg: 90,
                reps: 8,
                rpe: 7,
                set_type: "working",
                completed: !0
            }, {
                set_number: 2,
                weight_kg: 100,
                reps: 6,
                rpe: 8,
                set_type: "working",
                completed: !0
            }]
        }, {
            exercise_id: "ex-89",
            exercise_name: "Leg Curl",
            muscle_group: "legs",
            sets: [{
                set_number: 1,
                weight_kg: 45,
                reps: 12,
                rpe: 7,
                set_type: "working",
                completed: !0
            }, {
                set_number: 2,
                weight_kg: 45,
                reps: 12,
                rpe: 8,
                set_type: "working",
                completed: !0
            }, {
                set_number: 3,
                weight_kg: 50,
                reps: 10,
                rpe: 9,
                set_type: "working",
                completed: !0
            }]
        }]
    }, {
        id: "w-9",
        name: "Push Day",
        date: new Date(e - 15 * t).toISOString(),
        duration_minutes: 55,
        notes: "",
        exercises: [{
            exercise_id: "ex-2",
            exercise_name: "Bench Press",
            muscle_group: "chest",
            sets: [{
                set_number: 1,
                weight_kg: 75,
                reps: 8,
                rpe: 7,
                set_type: "working",
                completed: !0
            }, {
                set_number: 2,
                weight_kg: 80,
                reps: 6,
                rpe: 8,
                set_type: "working",
                completed: !0
            }, {
                set_number: 3,
                weight_kg: 82.5,
                reps: 5,
                rpe: 9,
                set_type: "working",
                completed: !0
            }]
        }, {
            exercise_id: "ex-10",
            exercise_name: "Dumbbell Flyes",
            muscle_group: "chest",
            sets: [{
                set_number: 1,
                weight_kg: 20,
                reps: 12,
                rpe: 7,
                set_type: "working",
                completed: !0
            }, {
                set_number: 2,
                weight_kg: 20,
                reps: 12,
                rpe: 8,
                set_type: "working",
                completed: !0
            }, {
                set_number: 3,
                weight_kg: 22.5,
                reps: 10,
                rpe: 9,
                set_type: "working",
                completed: !0
            }]
        }]
    }, {
        id: "w-10",
        name: "Full Body",
        date: new Date(e - 18 * t).toISOString(),
        duration_minutes: 70,
        notes: "",
        exercises: [{
            exercise_id: "ex-97",
            exercise_name: "Squat",
            muscle_group: "legs",
            sets: [{
                set_number: 1,
                weight_kg: 85,
                reps: 8,
                rpe: 7,
                set_type: "working",
                completed: !0
            }, {
                set_number: 2,
                weight_kg: 90,
                reps: 6,
                rpe: 8,
                set_type: "working",
                completed: !0
            }]
        }, {
            exercise_id: "ex-22",
            exercise_name: "Barbell Row",
            muscle_group: "back",
            sets: [{
                set_number: 1,
                weight_kg: 60,
                reps: 10,
                rpe: 7,
                set_type: "working",
                completed: !0
            }, {
                set_number: 2,
                weight_kg: 65,
                reps: 8,
                rpe: 8,
                set_type: "working",
                completed: !0
            }]
        }, {
            exercise_id: "ex-54",
            exercise_name: "Overhead Press",
            muscle_group: "shoulders",
            sets: [{
                set_number: 1,
                weight_kg: 42.5,
                reps: 8,
                rpe: 7,
                set_type: "working",
                completed: !0
            }, {
                set_number: 2,
                weight_kg: 45,
                reps: 7,
                rpe: 8,
                set_type: "working",
                completed: !0
            }]
        }]
    }]
}
function buildPRs() {
    const e = {};
    AppState.workouts.forEach(t => {
        (t.exercises || []).forEach(t => {
            const a = t.exercise_id;
            e[a] || (e[a] = {
                max_weight: 0,
                max_weight_reps: 0,
                max_reps: 0,
                max_volume_set: 0
            }), (t.sets || []).forEach(t => {
                if (!1 === t.completed) return;
                const s = getEffectiveWeight(a, t.weight_kg || 0),
                    n = t.reps || 0,
                    i = s * n;
                s > e[a].max_weight && (e[a].max_weight = s, e[a].max_weight_reps = n),
                s === e[a].max_weight && n > e[a].max_weight_reps && (e[a].max_weight_reps = n),
                n > e[a].max_reps && (e[a].max_reps = n),
                i > e[a].max_volume_set && (e[a].max_volume_set = i)
            })
        })
    }), AppState.personalRecords = e
}
function countWorkoutPRs(workout) {
    let count = 0;
    const prs = AppState.personalRecords;
    (workout.exercises || []).forEach(ex => {
        const pr = prs[ex.exercise_id];
        if (!pr) return;
        (ex.sets || []).forEach(s => {
            if (!1 === s.completed) return;
            const w = getEffectiveWeight(ex.exercise_id, s.weight_kg || 0);
            if ((w === pr.max_weight && w > 0) || s.is_pr) count++
        })
    });
    return count
}
function seedFriends() {
    return [{
        id: "f-1",
        user_id: "friend-1",
        username: "iron_mike",
        display_name: "Iron Mike",
        status: "accepted",
        workouts_count: 87,
        streak: 14,
        weekly_volume: 48e3,
        total_volume: 1240000,
        favorite_muscle: "chest",
        recent_workouts: [{name:"Push Day",date:new Date(Date.now()-864e5).toISOString()},{name:"Legs",date:new Date(Date.now()-2*864e5).toISOString()},{name:"Pull Day",date:new Date(Date.now()-4*864e5).toISOString()}]
    }, {
        id: "f-2",
        user_id: "friend-2",
        username: "sara_lifts",
        display_name: "Sara Lifts",
        status: "accepted",
        workouts_count: 124,
        streak: 22,
        weekly_volume: 35e3,
        total_volume: 2180000,
        favorite_muscle: "legs",
        recent_workouts: [{name:"Lower Body",date:new Date(Date.now()-864e5).toISOString()},{name:"Upper Body",date:new Date(Date.now()-3*864e5).toISOString()},{name:"Full Body",date:new Date(Date.now()-5*864e5).toISOString()}]
    }, {
        id: "f-3",
        user_id: "friend-3",
        username: "coach_ryan",
        display_name: "Coach Ryan",
        status: "accepted",
        workouts_count: 210,
        streak: 5,
        weekly_volume: 62e3,
        total_volume: 3750000,
        favorite_muscle: "back",
        recent_workouts: [{name:"Back & Biceps",date:new Date(Date.now()-864e5).toISOString()},{name:"Chest & Tris",date:new Date(Date.now()-2*864e5).toISOString()},{name:"Legs",date:new Date(Date.now()-3*864e5).toISOString()}]
    }, {
        id: "f-4",
        user_id: "friend-4",
        username: "fitjess",
        display_name: "Fit Jess",
        status: "pending_received",
        workouts_count: 45,
        streak: 3,
        weekly_volume: 28e3,
        total_volume: 580000,
        favorite_muscle: "core",
        recent_workouts: [{name:"Core Blast",date:new Date(Date.now()-2*864e5).toISOString()}]
    }]
}
function seedPacts() {
    return [{
        id: "pact-1",
        name: "Iron Crew January",
        description: "Hit 4 workouts every week, no excuses.",
        goal_type: "workouts_per_week",
        goal_target: 4,
        start_date: new Date(Date.now() - 12096e5).toISOString(),
        end_date: new Date(Date.now() + 14688e5).toISOString(),
        is_active: !0,
        member_count: 4,
        members: [{
            user_id: "demo-user",
            display_name: "Demo User",
            role: "admin",
            progress: 3,
            rank: 2
        }, {
            user_id: "friend-1",
            display_name: "Iron Mike",
            role: "member",
            progress: 4,
            rank: 1
        }, {
            user_id: "friend-2",
            display_name: "Sara Lifts",
            role: "member",
            progress: 2,
            rank: 3
        }, {
            user_id: "friend-3",
            display_name: "Coach Ryan",
            role: "member",
            progress: 1,
            rank: 4
        }]
    }, {
        id: "pact-2",
        name: "Volume Kings",
        description: "Who can move the most weight this month?",
        goal_type: "total_volume",
        goal_target: 5e5,
        start_date: new Date(Date.now() - 432e6).toISOString(),
        end_date: new Date(Date.now() + 216e7).toISOString(),
        is_active: !0,
        member_count: 3,
        members: [{
            user_id: "demo-user",
            display_name: "Demo User",
            role: "member",
            progress: 142e3,
            rank: 1
        }, {
            user_id: "friend-1",
            display_name: "Iron Mike",
            role: "admin",
            progress: 138500,
            rank: 2
        }, {
            user_id: "friend-3",
            display_name: "Coach Ryan",
            role: "member",
            progress: 119e3,
            rank: 3
        }]
    }]
}
function seedBodyMeasurements() {
    const e = Date.now(),
        t = 864e5;
    return [{
        id: "bm-1",
        date: new Date(e - 30 * t).toISOString(),
        weight_kg: 82.5,
        body_fat_pct: 18.2
    }, {
        id: "bm-2",
        date: new Date(e - 25 * t).toISOString(),
        weight_kg: 82,
        body_fat_pct: 17.9
    }, {
        id: "bm-3",
        date: new Date(e - 20 * t).toISOString(),
        weight_kg: 81.8,
        body_fat_pct: 17.6
    }, {
        id: "bm-4",
        date: new Date(e - 15 * t).toISOString(),
        weight_kg: 81.5,
        body_fat_pct: 17.4
    }, {
        id: "bm-5",
        date: new Date(e - 10 * t).toISOString(),
        weight_kg: 81.2,
        body_fat_pct: 17.1
    }, {
        id: "bm-6",
        date: new Date(e - 5 * t).toISOString(),
        weight_kg: 80.9,
        body_fat_pct: 16.8
    }, {
        id: "bm-7",
        date: new Date(e - 1 * t).toISOString(),
        weight_kg: 80.5,
        body_fat_pct: 16.5
    }]
}
const COACHING_TIPS = [{
    id: "tip-bench-setup",
    exercise_types: ["chest"],
    coaching_type: "form_tip",
    message: "Bench Press: Retract your shoulder blades and maintain a slight arch. This protects your rotator cuff and maximises chest recruitment."
}, {
    id: "tip-deadlift-brace",
    exercise_types: ["back", "full_body"],
    coaching_type: "form_tip",
    message: "Deadlift: Take a big breath and brace your core like you're about to take a punch before you pull. This protects your spine."
}, {
    id: "tip-squat-depth",
    exercise_types: ["legs"],
    coaching_type: "form_tip",
    message: "Squat: Aim for hip crease below parallel. Consistent depth is more important than loading when building strength."
}, {
    id: "tip-ohp-lockout",
    exercise_types: ["shoulders"],
    coaching_type: "form_tip",
    message: "Overhead Press: Lock out fully at the top and shrug your traps to press your head through. This activates the entire deltoid."
}, {
    id: "tip-row-elbow",
    exercise_types: ["back"],
    coaching_type: "form_tip",
    message: "Barbell Row: Drive with your elbow, not your hands. Think about pulling your elbow into your hip for maximum lat engagement."
}, {
    id: "tip-curl-supinate",
    exercise_types: ["arms"],
    coaching_type: "form_tip",
    message: "Barbell Curl: Supinate (twist) your wrist at the top of each rep to fully contract the bicep. Squeeze hard for 1 second."
}, {
    id: "tip-tricep-full",
    exercise_types: ["arms"],
    coaching_type: "form_tip",
    message: "Tricep Pushdown: Use full range of motion. Stretch at the top and lock out completely at the bottom for maximum muscle activation."
}, {
    id: "tip-plank-tension",
    exercise_types: ["core"],
    coaching_type: "form_tip",
    message: 'Plank: Squeeze your glutes and abs simultaneously. Think "shorten the distance between your ribcage and hip bones" for maximal tension.'
}, {
    id: "tip-leg-press-feet",
    exercise_types: ["legs"],
    coaching_type: "form_tip",
    message: "Leg Press: Higher foot placement targets glutes and hamstrings; lower placement emphasizes quads. Experiment with both."
}, {
    id: "tip-rdl-hinge",
    exercise_types: ["legs", "back"],
    coaching_type: "form_tip",
    message: "Romanian Deadlift: Push your hips back as far as possible — the movement is a hinge, not a squat. Feel the stretch in your hamstrings."
}, {
    id: "tip-lateral-raise-angle",
    exercise_types: ["shoulders"],
    coaching_type: "form_tip",
    message: "Lateral Raise: Lead with your elbow, not your hand. Tilt the front of the dumbbell slightly down for better medial delt isolation."
}, {
    id: "tip-face-pull-rope",
    exercise_types: ["shoulders"],
    coaching_type: "form_tip",
    message: "Face Pull: Pull to ear height and externally rotate your shoulders at the end of each rep for full rear delt and rotator cuff work."
}, {
    id: "tip-pullup-scapula",
    exercise_types: ["back"],
    coaching_type: "form_tip",
    message: "Pull-ups: Start every rep by depressing your shoulder blades (pulling them down). This pre-activates your lats before you pull."
}, {
    id: "tip-calf-pause",
    exercise_types: ["legs"],
    coaching_type: "form_tip",
    message: "Calf Raise: Pause 1-2 seconds at the top and stretch fully at the bottom. The calf muscle responds best to full range and time under tension."
}, {
    id: "tip-prog-overload",
    exercise_types: [],
    coaching_type: "progressive_overload",
    message: "Progressive Overload: If you hit the top of your rep range for all sets, add 2.5kg (5lbs) next session. Consistent small increases compound dramatically."
}, {
    id: "tip-deload-sign",
    exercise_types: [],
    coaching_type: "deload_warning",
    message: "Deload Signal: You've been pushing hard for several weeks. Consider a deload — reduce volume by 40-50% for one week to allow full systemic recovery."
}, {
    id: "tip-muscle-balance",
    exercise_types: [],
    coaching_type: "muscle_balance",
    message: "Muscle Balance: Your training is heavily push-dominant. Add an extra pulling session to balance your chest-to-back volume ratio and protect your shoulder health."
}, {
    id: "tip-rest-time",
    exercise_types: [],
    coaching_type: "rest_suggestion",
    message: "Rest Periods: For strength lifts (1-5 reps), rest 3-5 minutes between sets. For hypertrophy (6-12 reps), 60-120 seconds. Cutting rest short limits adaptation."
}, {
    id: "tip-warm-up",
    exercise_types: [],
    coaching_type: "general",
    message: "Warm-up Sets: Before your heaviest sets, do 2-3 ramp-up sets at 50%, 70%, and 85% of your working weight. This primes your nervous system and reduces injury risk."
}, {
    id: "tip-mind-muscle",
    exercise_types: [],
    coaching_type: "general",
    message: "Mind-Muscle Connection: Slow down your sets and consciously focus on the target muscle contracting. This improves muscle recruitment, especially for isolation movements."
}, {
    id: "tip-sleep",
    exercise_types: [],
    coaching_type: "general",
    message: "Recovery: Sleep is your most anabolic tool. Aim for 7-9 hours per night. Growth hormone peaks during deep sleep — skimping on sleep undermines your training."
}, {
    id: "tip-protein",
    exercise_types: [],
    coaching_type: "general",
    message: "Nutrition: Aim for 1.6-2.2g of protein per kg of bodyweight daily. Spread intake across 4-5 meals for optimal muscle protein synthesis."
}, {
    id: "tip-incline-bench",
    exercise_types: ["chest"],
    coaching_type: "form_tip",
    message: "Incline Bench: A 30-degree incline is optimal for upper chest activation. Higher angles shift emphasis toward the anterior deltoid."
}, {
    id: "tip-cable-crossover",
    exercise_types: ["chest"],
    coaching_type: "form_tip",
    message: "Cable Crossover: Cross your hands at the end of the rep for a full peak contraction of the sternal (inner) head of the pectoralis major."
}, {
    id: "tip-arnold-press",
    exercise_types: ["shoulders"],
    coaching_type: "form_tip",
    message: "Arnold Press: The rotating motion recruits all three heads of the deltoid. Keep the rotation smooth — don't rush the supination."
}, {
    id: "tip-seated-row",
    exercise_types: ["back"],
    coaching_type: "form_tip",
    message: "Seated Cable Row: Maintain a neutral spine. Avoid rounding forward to load more weight — it shifts stress from your lats to your lower back."
}, {
    id: "tip-hammer-curl",
    exercise_types: ["arms"],
    coaching_type: "form_tip",
    message: 'Hammer Curl: The neutral grip recruits the brachialis, a muscle that sits under your bicep and "pushes" it up, adding size to your arm peak.'
}, {
    id: "tip-leg-curl-flex",
    exercise_types: ["legs"],
    coaching_type: "form_tip",
    message: "Leg Curl: Tilt your pelvis slightly posterior (tuck your tailbone) to lengthen the hamstring starting position and increase the range of motion."
}, {
    id: "tip-hanging-raise",
    exercise_types: ["core"],
    coaching_type: "form_tip",
    message: "Hanging Leg Raise: Initiate by tilting your pelvis posteriorly before raising your legs. This ensures your abs — not your hip flexors — do the work."
}, {
    id: "tip-skull-crusher",
    exercise_types: ["arms"],
    coaching_type: "form_tip",
    message: "Skull Crusher: Lower the bar to your forehead OR slightly behind your head. The behind-head version increases the long head stretch for more growth."
}, {
    id: "tip-burpee-form",
    exercise_types: ["full_body", "cardio"],
    coaching_type: "form_tip",
    message: "Burpees: Land with soft knees after the jump to absorb impact. Prioritize quality of movement over speed to protect your joints at fatigue."
}, {
    id: "tip-kb-swing",
    exercise_types: ["full_body"],
    coaching_type: "form_tip",
    message: 'Kettlebell Swing: Power comes from your hips, not your arms. Think "hike the bell back like a hiking football" and then thrust your hips forward explosively.'
}];
async function sbLoadExercises() {
    if (!isDemoMode && supabaseClient) try {
        const e = AppState.user?.id,
            {
                data: t,
                error: a
            } = await supabaseClient.from("exercises").select("*").or("is_custom.eq.false" + (e ? ",created_by.eq." + e : ""));
        if (a) throw a;
        AppState.exercises = (t || []).map(e => ({
            id: e.id,
            name: e.name,
            muscle_group: e.muscle_group,
            equipment: e.equipment,
            exercise_type: e.exercise_type,
            description: e.description,
            is_custom: e.is_custom,
            created_by: e.created_by
        }))
    } catch (e) {
        console.error("Failed to load exercises:", e)
    }
}
async function sbSaveCustomExercise(e) {
    if (isDemoMode || !supabaseClient || !AppState.user) {
        const t = { ...e, id: generateId(), is_custom: !0, created_by: AppState.user?.id || "demo-user" };
        return AppState.exercises.push(t), t
    }
    try {
        const { data: t, error: a } = await supabaseClient.from("exercises").insert({
            name: e.name, muscle_group: e.muscle_group, equipment: e.equipment,
            exercise_type: e.exercise_type || "compound", description: e.description || "",
            is_custom: !0, created_by: AppState.user.id, exercise_modality: e.exercise_modality || "reps"
        }).select().single();
        if (a) throw a;
        const s = { id: t.id, name: t.name, muscle_group: t.muscle_group, equipment: t.equipment,
            exercise_type: t.exercise_type, description: t.description, is_custom: !0,
            created_by: t.created_by, exercise_modality: t.exercise_modality };
        return AppState.exercises.push(s), s
    } catch (t) {
        console.error("Failed to save custom exercise:", t);
        const s = { ...e, id: generateId(), is_custom: !0, created_by: AppState.user.id };
        return AppState.exercises.push(s), s
    }
}
async function sbLoadProfile() {
    if (isDemoMode || !supabaseClient || !AppState.user) return null;
    try {
        const {
            data: e,
            error: t
        } = await supabaseClient.from("profiles").select("*").eq("id", AppState.user.id).single();
        if (t) throw t;
        return e && (AppState.profile = {
            name: e.display_name || e.username || "User",
            display_name: e.display_name || e.username || "User",
            username: e.username || "",
            email: AppState.user.email || "",
            goal: e.goal || "strength",
            experience: e.experience || "intermediate",
            equipment: e.available_equipment || ["barbell", "dumbbell", "cable", "machine", "bodyweight"],
            unit_pref: e.unit_pref || "imperial",
            avatar_url: e.avatar_url || "",
            height_cm: e.height_cm,
            weight_kg: e.weight_kg,
            current_streak: e.current_streak || 0,
            longest_streak: e.longest_streak || 0,
            total_workouts: e.total_workouts || 0,
            // Login streak DB fields — required by updateLoginStreak()
            last_login_date: e.last_login_date || null,
            login_streak: e.login_streak || 0,
            longest_login_streak: e.longest_login_streak || 0
        }, AppState.unitPref = "metric" === e.unit_pref ? "metric" : "imperial", AppState.onboardingComplete = !!e.onboarding_complete), e
    } catch (e) {
        return console.error("Failed to load profile:", e), null
    }
}
async function sbUpdateProfile(e) {
    if (!isDemoMode && supabaseClient && AppState.user) try {
        const {
            error: t
        } = await supabaseClient.from("profiles").update(e).eq("id", AppState.user.id);
        if (t) throw t
    } catch (e) {
        console.error("Failed to update profile:", e), showToast("Failed to save profile", "error")
    }
}
function normalizeWorkout(e) {
    const t = (e.workout_exercises || []).sort((e, t) => (e.order_index || 0) - (t.order_index || 0)).map(e => {
            const t = e.exercise || {};
            return {
                exercise_id: e.exercise_id,
                exercise_name: t.name || "Unknown Exercise",
                muscle_group: t.muscle_group || "chest",
                workout_exercise_id: e.id,
                sets: (e.sets || []).sort((e, t) => (e.set_number || 0) - (t.set_number || 0)).map(e => ({
                    id: e.id,
                    set_number: e.set_number,
                    weight_kg: e.weight_kg || 0,
                    reps: e.reps || 0,
                    rpe: e.rpe,
                    set_type: e.set_type || "working",
                    completed: !!e.completed_at,
                    is_pr: e.is_pr || !1,
                    duration_seconds: e.duration_seconds,
                    distance_meters: e.distance_meters
                }))
            }
        }),
        a = e.started_at ? new Date(e.started_at) : new Date(e.created_at),
        s = e.duration_seconds ? Math.round(e.duration_seconds / 60) : e.completed_at ? Math.round((new Date(e.completed_at) - a) / 6e4) : 0;
    return {
        id: e.id,
        name: e.name || "Workout",
        date: e.started_at || e.created_at,
        duration_minutes: s || 0,
        notes: e.notes || "",
        is_ai_generated: e.is_ai_generated,
        exercises: t
    }
}
async function sbLoadWorkouts() {
    if (!isDemoMode && supabaseClient && AppState.user) try {
        const {
            data: e,
            error: t
        } = await supabaseClient.from("workouts").select("*, workout_exercises(*, exercise:exercises(*), sets(*))").eq("user_id", AppState.user.id).order("started_at", {
            ascending: !1
        });
        if (t) throw t;
        AppState.workouts = (e || []).map(normalizeWorkout)
    } catch (e) {
        console.error("Failed to load workouts:", e)
    }
}
async function sbLoadPersonalRecords() {
    if (!isDemoMode && supabaseClient && AppState.user) try {
        const {
            data: e,
            error: t
        } = await supabaseClient.from("personal_records").select("*, exercise:exercises(name, muscle_group)").eq("user_id", AppState.user.id);
        if (t) throw t;
        const a = {};
        (e || []).forEach(e => {
            const t = e.exercise_id;
            a[t] || (a[t] = {
                max_weight: 0,
                max_weight_reps: 0,
                max_reps: 0,
                max_volume_set: 0,
                exercise_name: e.exercise?.name
            }), "max_weight" === e.record_type || "one_rep_max" === e.record_type ? a[t].max_weight = Math.max(a[t].max_weight, e.value || 0) : "max_reps" === e.record_type ? a[t].max_reps = Math.max(a[t].max_reps, e.value || 0) : "max_volume" === e.record_type && (a[t].max_volume_set = Math.max(a[t].max_volume_set, e.value || 0))
        }), AppState.personalRecords = a, function() {
        AppState.workouts.forEach(function(w) {
            (w.exercises || []).forEach(function(ex) {
                var pr = AppState.personalRecords[ex.exercise_id];
                if (!pr || !pr.max_weight) return;
                (ex.sets || []).forEach(function(s) {
                    if (!1 === s.completed) return;
                    var ew = getEffectiveWeight(ex.exercise_id, s.weight_kg || 0);
                    if (ew === pr.max_weight) {
                        var r = s.reps || 0;
                        if (r > (pr.max_weight_reps || 0)) pr.max_weight_reps = r
                    }
                })
            })
        })
    }()
    } catch (e) {
        console.error("Failed to load PRs:", e), buildPRs()
    }
}
async function sbSaveWorkout(e) {
    if (isDemoMode || !supabaseClient || !AppState.user) return null;
    try {
        const t = (new Date).toISOString(),
            a = e.duration_seconds || Math.round(60 * (e.duration_minutes || 0)),
            {
                data: s,
                error: n
            } = await supabaseClient.from("workouts").insert({
                user_id: AppState.user.id,
                name: e.name,
                started_at: e.started_at || new Date(Date.now() - 1e3 * a).toISOString(),
                completed_at: t,
                duration_seconds: a,
                notes: e.notes || "",
                is_ai_generated: e.is_ai_generated || !1
            }).select().single();
        if (n) throw n;
        for (let a = 0; a < e.exercises.length; a++) {
            const n = e.exercises[a],
                {
                    data: i,
                    error: o
                } = await supabaseClient.from("workout_exercises").insert({
                    workout_id: s.id,
                    exercise_id: n.exercise_id,
                    order_index: a,
                    notes: n.notes || ""
                }).select().single();
            if (o) throw o;
            const r = (n.sets || []).filter(e => e.completed).map(e => ({
                workout_exercise_id: i.id,
                set_number: e.set_number,
                set_type: e.set_type || "working",
                weight_kg: e.weight_kg || 0,
                reps: e.reps || 0,
                rpe: e.rpe || null,
                is_pr: !1,
                completed_at: t
            }));
            if (r.length > 0) {
                const {
                    data: e,
                    error: t
                } = await supabaseClient.from("sets").insert(r).select();
                if (t) throw t;
                for (const t of e || []) await sbCheckAndUpsertPR(n.exercise_id, t)
            }
        }
        return await sbGenerateCoachingTips(e), s
    } catch (e) {
        return console.error("Failed to save workout:", e), showToast("Failed to save workout to cloud", "error"), null
    }
}
async function sbUpdateWorkoutName(id, newName) {
    const w = AppState.workouts.find(e => e.id === id);
    if (w) w.name = newName;
    if (isDemoMode || !supabaseClient || !AppState.user) return;
    try {
        await supabaseClient.from("workouts").update({ name: newName }).eq("id", id).eq("user_id", AppState.user.id)
    } catch (e) { console.warn("Failed to update workout name:", e) }
}
async function sbUpdateWorkout(workoutId, updatedExercises) {
    const w = AppState.workouts.find(e => e.id === workoutId);
    if (!w) return !1;
    w.exercises = updatedExercises;
    if (isDemoMode || !supabaseClient || !AppState.user) { buildPRs(); return !0 }
    try {
        if (!await ensureSession()) return !1;
        const { data: existingWE } = await supabaseClient.from("workout_exercises").select("id").eq("workout_id", workoutId);
        if (existingWE && existingWE.length > 0) {
            const weIds = existingWE.map(e => e.id);
            await supabaseClient.from("sets").delete().in("workout_exercise_id", weIds)
        }
        await supabaseClient.from("workout_exercises").delete().eq("workout_id", workoutId);
        const now = new Date().toISOString();
        for (let i = 0; i < updatedExercises.length; i++) {
            const ex = updatedExercises[i];
            const { data: we, error: weErr } = await supabaseClient.from("workout_exercises").insert({
                workout_id: workoutId, exercise_id: ex.exercise_id, order_index: i, notes: ex.notes || ""
            }).select().single();
            if (weErr) throw weErr;
            const sets = (ex.sets || []).filter(s => s.completed !== !1).map(s => ({
                workout_exercise_id: we.id, set_number: s.set_number, set_type: s.set_type || "working",
                weight_kg: s.weight_kg || 0, reps: s.reps || 0, is_pr: !1, completed_at: now
            }));
            if (sets.length > 0) {
                const { error: sErr } = await supabaseClient.from("sets").insert(sets);
                if (sErr) throw sErr
            }
        }
        const affectedExIds = [...new Set(updatedExercises.map(e => e.exercise_id))];
        await supabaseClient.from("personal_records").delete().eq("user_id", AppState.user.id).in("exercise_id", affectedExIds);
        buildPRs();
        await sbRecalculatePRsForExercises(affectedExIds);
        return !0
    } catch (e) {
        return console.error("Failed to update workout:", e), showToast("Failed to update workout", "error"), !1
    }
}
async function sbDeleteWorkout(e) {
    if (isDemoMode || !supabaseClient || !AppState.user) {
        const t = AppState.workouts.find(t => t.id === e),
            a = t ? (t.exercises || []).map(e => e.exercise_id) : [];
        return AppState.workouts = AppState.workouts.filter(t => t.id !== e), buildPRs(), showToast("Workout deleted"), !0
    }
    try {
        if (!await ensureSession()) return !1;
        const t = AppState.workouts.find(t => t.id === e),
            a = t ? [...new Set((t.exercises || []).map(e => e.exercise_id))] : [];
        const {
            data: s
        } = await supabaseClient.from("workout_exercises").select("id").eq("workout_id", e);
        if (s && s.length > 0) {
            const e = s.map(e => e.id);
            await supabaseClient.from("sets").delete().in("workout_exercise_id", e)
        }
        if (a.length > 0) await supabaseClient.from("personal_records").delete().eq("user_id", AppState.user.id).in("exercise_id", a);
        const {
            error: n
        } = await supabaseClient.from("workouts").delete().eq("id", e).eq("user_id", AppState.user.id);
        if (n) throw n;
        AppState.workouts = AppState.workouts.filter(t => t.id !== e), buildPRs();
        if (a.length > 0) await sbRecalculatePRsForExercises(a);
        return showToast("Workout deleted"), !0
    } catch (e) {
        return console.error("Failed to delete workout:", e), showToast("Failed to delete workout", "error"), !1
    }
}
async function sbRecalculatePRsForExercises(e) {
    if (isDemoMode || !supabaseClient || !AppState.user) return;
    try {
        for (const t of e) {
            let a = 0, s = 0, n = 0, i = null, mwr = 0;
            AppState.workouts.forEach(e => {
                (e.exercises || []).forEach(e => {
                    if (e.exercise_id === t) (e.sets || []).forEach(e => {
                        if (!1 === e.completed) return;
                        const o = getEffectiveWeight(t, e.weight_kg || 0),
                            r = o * (e.reps || 0);
                        if (o > a) { a = o; mwr = e.reps || 0 } else if (o === a && (e.reps || 0) > mwr) { mwr = e.reps || 0 }
                        (e.reps || 0) > s && (s = e.reps || 0), r > n && (n = r)
                    })
                })
            });
            if (a > 0 || s > 0 || n > 0) {
                AppState.personalRecords[t] = { max_weight: a, max_weight_reps: mwr, max_reps: s, max_volume_set: n };
                await supabaseClient.from("personal_records").upsert({
                    user_id: AppState.user.id, exercise_id: t, record_type: "max_weight",
                    value: a, achieved_at: new Date().toISOString()
                }, { onConflict: "user_id,exercise_id,record_type" });
                await supabaseClient.from("personal_records").upsert({
                    user_id: AppState.user.id, exercise_id: t, record_type: "max_volume",
                    value: n, achieved_at: new Date().toISOString()
                }, { onConflict: "user_id,exercise_id,record_type" });
            }
        }
    } catch (e) {
        console.error("Failed to recalculate PRs:", e)
    }
}
async function sbDeletePR(exerciseId) {
    delete AppState.personalRecords[exerciseId];
    if (isDemoMode || !supabaseClient || !AppState.user) return true;
    try {
        await supabaseClient.from("personal_records")
            .delete()
            .eq("user_id", AppState.user.id)
            .eq("exercise_id", exerciseId);
        return true;
    } catch (e) {
        console.error("Failed to delete PR:", e);
        return false;
    }
}
async function sbSavePlan(e) {
    if (isDemoMode || !supabaseClient || !AppState.user) {
        const t = JSON.parse(JSON.stringify(e));
        t.id = t.id || generateId(), t.generated_at = t.generated_at || (new Date).toISOString();
        return AppState.savedPlans.some(e => e.id === t.id) || AppState.savedPlans.push(t), t
    }
    try {
        if (!await ensureSession()) return null;
        const t = {
                fat_loss: "weight_loss"
            } [e.goal] || e.goal || "general",
            a = ["strength", "hypertrophy", "endurance", "weight_loss", "general"].includes(t) ? t : "general",
            s = {
                beginner: "beginner",
                intermediate: "intermediate",
                advanced: "advanced"
            } [e.experience] || "intermediate",
            n = {
                user_id: AppState.user.id,
                plan_name: e.name,
                goal: a,
                days_per_week: e.days ? e.days.length : 4,
                difficulty: s,
                equipment_available: JSON.stringify(e.equipment || []),
                plan_data: JSON.stringify(e),
                is_active: !0
            },
            {
                data: i,
                error: o
            } = await supabaseClient.from("ai_plans").insert(n).select().single();
        if (o) throw o;
        const r = {
            ...e,
            id: i.id,
            db_id: i.id,
            generated_at: i.generated_at
        };
        return AppState.savedPlans.some(e => e.id === i.id || e.db_id === i.id) || AppState.savedPlans.push(r), r
    } catch (e) {
        return console.error("Failed to save plan:", e), showToast("Failed to save plan to cloud", "error"), null
    }
}
async function sbLoadPlans() {
    if (!isDemoMode && supabaseClient && AppState.user) try {
        const {
            data: e,
            error: t
        } = await supabaseClient.from("ai_plans").select("*").eq("user_id", AppState.user.id).eq("is_active", !0).order("generated_at", {
            ascending: !1
        });
        if (t) throw t;
        AppState.savedPlans = (e || []).map(e => {
            const t = "string" == typeof e.plan_data ? JSON.parse(e.plan_data) : e.plan_data || {};
            return {
                ...t,
                id: e.id,
                db_id: e.id,
                name: e.plan_name || t.name,
                goal: t.goal || e.goal,
                generated_at: e.generated_at
            }
        })
    } catch (e) {
        console.error("Failed to load plans:", e)
    }
}
async function sbDeletePlan(e) {
    if (isDemoMode || !supabaseClient || !AppState.user) return AppState.savedPlans = AppState.savedPlans.filter(t => t.id !== e && t.db_id !== e), !0;
    try {
        if (!await ensureSession()) return !1;
        const t = e,
            {
                error: a
            } = await supabaseClient.from("ai_plans").delete().eq("id", t).eq("user_id", AppState.user.id);
        if (a) throw a;
        return AppState.savedPlans = AppState.savedPlans.filter(t => t.id !== e && t.db_id !== e), !0
    } catch (e) {
        return console.error("Failed to delete plan:", e), showToast("Failed to delete plan", "error"), !1
    }
}
async function sbSharePlan(e, t, a) {
    if (isDemoMode || !supabaseClient || !AppState.user) return showToast("Plan shared!"), !0;
    try {
        if (!await ensureSession()) return !1;
        const s = {
                sender_id: AppState.user.id,
                recipient_id: t,
                plan_id: e.db_id || null,
                plan_data: JSON.stringify(e),
                plan_name: e.name,
                message: a || null,
                status: "pending"
            },
            {
                error: n
            } = await supabaseClient.from("shared_plans").insert(s);
        if (n) throw n;
        return showToast("Plan sent to friend!"), !0
    } catch (e) {
        return console.error("Failed to share plan:", e), showToast("Failed to share plan", "error"), !1
    }
}
async function sbLoadSharedPlans() {
    if (!isDemoMode && supabaseClient && AppState.user) try {
        const {
            data: e,
            error: t
        } = await supabaseClient.from("shared_plans").select("*, sender:profiles!shared_plans_sender_id_fkey(id, username, display_name)").eq("recipient_id", AppState.user.id).order("created_at", {
            ascending: !1
        });
        if (t) throw t;
        AppState.sharedPlans = (e || []).map(e => {
            const t = "string" == typeof e.plan_data ? JSON.parse(e.plan_data) : e.plan_data || {};
            return {
                id: e.id,
                sender_username: e.sender?.username || "Unknown",
                sender_display_name: e.sender?.display_name || e.sender?.username || "Unknown",
                plan_name: e.plan_name,
                plan_data: t,
                message: e.message,
                status: e.status,
                created_at: e.created_at
            }
        })
    } catch (e) {
        console.error("Failed to load shared plans:", e)
    }
}
async function sbDismissSharedPlan(e) {
    if (!isDemoMode && supabaseClient && AppState.user) try {
        if (!await ensureSession()) return;
        await supabaseClient.from("shared_plans").update({
            status: "dismissed",
            read_at: (new Date).toISOString()
        }).eq("id", e), AppState.sharedPlans = AppState.sharedPlans.filter(t => t.id !== e)
    } catch (e) {
        console.error("Failed to dismiss shared plan:", e)
    } else AppState.sharedPlans = AppState.sharedPlans.filter(t => t.id !== e)
}
async function sbAcceptSharedPlan(e) {
    if (!isDemoMode && supabaseClient && AppState.user) try {
        if (!await ensureSession()) return;
        const t = AppState.sharedPlans.find(t => t.id === e);
        if (!t) return;
        const a = {
            ...t.plan_data,
            name: t.plan_name
        };
        await sbSavePlan(a), await supabaseClient.from("shared_plans").update({
            status: "accepted",
            read_at: (new Date).toISOString()
        }).eq("id", e), AppState.sharedPlans = AppState.sharedPlans.filter(t => t.id !== e), showToast(`Plan "${t.plan_name}" saved to your plans!`)
    } catch (e) {
        console.error("Failed to accept shared plan:", e)
    }
}
async function sbCheckAndUpsertPR(e, t) {
    if (isDemoMode || !supabaseClient || !AppState.user) return !1;
    try {
        const a = AppState.user.id,
            s = getEffectiveWeight(e, t.weight_kg || 0),
            n = s * (t.reps || 0);
        let i = !1;
        if (s > 0) {
            const {
                data: n
            } = await supabaseClient.from("personal_records").select("id, value").eq("user_id", a).eq("exercise_id", e).eq("record_type", "max_weight").maybeSingle();
            (!n || s > (n.value || 0)) && (await supabaseClient.from("personal_records").upsert({
                user_id: a,
                exercise_id: e,
                record_type: "max_weight",
                value: s,
                set_id: t.id,
                achieved_at: t.completed_at || (new Date).toISOString()
            }, {
                onConflict: "user_id,exercise_id,record_type"
            }), i = !0)
        }
        if (n > 0) {
            const {
                data: s
            } = await supabaseClient.from("personal_records").select("id, value").eq("user_id", a).eq("exercise_id", e).eq("record_type", "max_volume").maybeSingle();
            (!s || n > (s.value || 0)) && (await supabaseClient.from("personal_records").upsert({
                user_id: a,
                exercise_id: e,
                record_type: "max_volume",
                value: n,
                set_id: t.id,
                achieved_at: t.completed_at || (new Date).toISOString()
            }, {
                onConflict: "user_id,exercise_id,record_type"
            }), i = !0)
        }
        return i && await supabaseClient.from("sets").update({
            is_pr: !0
        }).eq("id", t.id), i
    } catch (e) {
        return console.error("PR check failed:", e), !1
    }
}
async function sbSaveCoachingLog(e) {
    if (isDemoMode || !supabaseClient || !AppState.user) {
        const t = {
            id: "cl-" + Date.now(),
            user_id: "demo-user",
            dismissed: !1,
            created_at: (new Date).toISOString(),
            ...e
        };
        return AppState.coachingLogs.unshift(t), t
    }
    try {
        const {
            data: t,
            error: a
        } = await supabaseClient.from("coaching_logs").insert({
            user_id: AppState.user.id,
            ...e
        }).select().single();
        if (a) throw a;
        return AppState.coachingLogs.unshift(t), t
    } catch (e) {
        return console.error("Failed to save coaching log:", e), null
    }
}
async function sbLoadCoachingLogs() {
    if (!isDemoMode && supabaseClient && AppState.user) try {
        const {
            data: e,
            error: t
        } = await supabaseClient.from("coaching_logs").select("*").eq("user_id", AppState.user.id).eq("dismissed", !1).order("created_at", {
            ascending: !1
        }).limit(10);
        if (t) throw t;
        AppState.coachingLogs = e || []
    } catch (e) {
        console.error("Failed to load coaching logs:", e)
    }
}
async function sbDismissCoachingTip(e) {
    if (AppState.coachingLogs = AppState.coachingLogs.filter(t => t.id !== e), !isDemoMode && supabaseClient && AppState.user) try {
        await supabaseClient.from("coaching_logs").update({
            dismissed: !0
        }).eq("id", e)
    } catch (e) {
        console.error("Failed to dismiss tip:", e)
    }
}
async function sbGenerateCoachingTips(e) {
    const t = generateCoachingAnalysis(e);
    for (const e of t) await sbSaveCoachingLog(e)
}
function generateCoachingAnalysis(e) {
    const t = [],
        a = e.exercises || [];
    a.forEach(a => {
        const s = (a.sets || []).filter(e => e.completed);
        if (s.length >= 3) {
            const n = s.reduce((e, t) => e + (t.rpe || 7), 0) / s.length;
            if (n < 7 && s[0].weight_kg > 0) {
                const i = kgToDisplay(1.025 * s[0].weight_kg);
                t.push({
                    workout_id: e.id,
                    exercise_id: a.exercise_id,
                    coaching_type: "weight_rec",
                    message: `${a.exercise_name}: Your RPE averaged ${n.toFixed(1)} — you have room to grow. Try ${Math.round(2*i)/2}${getUnitLabel()} next session.`,
                    data: {
                        exercise_name: a.exercise_name,
                        suggested_weight: i
                    },
                    dismissed: !1
                })
            }
        }
    });
    const s = [...AppState.workouts].sort((e, t) => new Date(t.date) - new Date(e.date)).slice(0, 5);
    if (a.forEach(a => {
            for (const n of s) {
                const s = (n.exercises || []).find(e => e.exercise_id === a.exercise_id);
                if (s) {
                    const n = Math.max(...(a.sets || []).filter(e => e.completed).map(e => e.weight_kg || 0), 0),
                        i = Math.max(...(s.sets || []).map(e => e.weight_kg || 0), 0);
                    n > i && i > 0 && t.push({
                        workout_id: e.id,
                        exercise_id: a.exercise_id,
                        coaching_type: "progressive_overload",
                        message: `Progressive Overload achieved on ${a.exercise_name}! You lifted ${formatWeight(n)} vs ${formatWeight(i)} last time. Keep this momentum.`,
                        data: {
                            exercise_name: a.exercise_name,
                            current_max: n,
                            prev_max: i
                        },
                        dismissed: !1
                    });
                    break
                }
            }
        }), a.length > 0) {
        const s = a[Math.floor(Math.random() * a.length)],
            n = COACHING_TIPS.filter(e => "form_tip" === e.coaching_type && (0 === e.exercise_types.length || e.exercise_types.includes(s.muscle_group)));
        if (n.length > 0) {
            const a = n[Math.floor(Math.random() * n.length)];
            t.push({
                workout_id: e.id,
                exercise_id: s.exercise_id,
                coaching_type: "form_tip",
                message: a.message,
                data: {
                    tip_id: a.id
                },
                dismissed: !1
            })
        }
    }
    const n = a.map(e => e.muscle_group),
        i = n.filter(e => ["chest", "shoulders"].includes(e)).length,
        o = n.filter(e => ["back"].includes(e)).length;
    i > 0 && 0 === o && t.push({
        workout_id: e.id,
        exercise_id: null,
        coaching_type: "muscle_balance",
        message: "Muscle Balance Alert: This session was heavily push-focused. Make sure your weekly programming includes adequate pulling work to balance your shoulder joint.",
        data: {
            push_count: i,
            pull_count: o
        },
        dismissed: !1
    });
    const r = [];
    for (let e = 0; e < 4; e++) {
        const t = new Date(Date.now() - 7 * (e + 1) * 864e5),
            a = new Date(Date.now() - 7 * e * 864e5);
        let s = 0;
        AppState.workouts.forEach(e => {
            const n = new Date(e.date);
            n >= t && n < a && (s += getTotalVolume(e))
        }), r.unshift(s)
    }
    return r.length >= 3 && r[0] > 0 && r[1] > r[0] && r[2] > r[1] && r[3] > r[2] && t.push({
        workout_id: e.id,
        exercise_id: null,
        coaching_type: "deload_warning",
        message: "Deload Warning: Your training volume has increased for 3+ consecutive weeks. Consider scheduling a deload week — reduce volume by 40-50% to allow full recovery and come back stronger.",
        data: {
            weekly_volumes: r
        },
        dismissed: !1
    }), t.slice(0, 4)
}
function seedCoachingLogs() {
    return [{
        id: "cl-1",
        coaching_type: "weight_rec",
        dismissed: !1,
        created_at: new Date(Date.now() - 864e5).toISOString(),
        message: "Bench Press: Your RPE averaged 6.5 — you have room to grow. Try 92.5kg next session.",
        data: {
            exercise_name: "Bench Press"
        }
    }, {
        id: "cl-2",
        coaching_type: "progressive_overload",
        dismissed: !1,
        created_at: new Date(Date.now() - 1728e5).toISOString(),
        message: "Progressive Overload achieved on Deadlift! You lifted 140kg vs 135kg last time. Keep this momentum.",
        data: {
            exercise_name: "Deadlift"
        }
    }, {
        id: "cl-3",
        coaching_type: "form_tip",
        dismissed: !1,
        created_at: new Date(Date.now() - 2592e5).toISOString(),
        message: "Squat: Aim for hip crease below parallel. Consistent depth is more important than loading when building strength.",
        data: {}
    }]
}
async function sbLoadFriends() {
    if (!isDemoMode && supabaseClient && AppState.user) try {
        const e = AppState.user.id,
            {
                data: t,
                error: a
            } = await supabaseClient.from("friendships").select("*, requester:profiles!friendships_requester_profile_fkey(id, username, display_name), addressee:profiles!friendships_addressee_profile_fkey(id, username, display_name)").or(`requester_id.eq.${e},addressee_id.eq.${e}`).neq("status", "blocked");
        if (a) throw a;
        AppState.friends = (t || []).map(t => {
            const a = t.requester_id === e,
                s = a ? t.addressee : t.requester;
            return {
                id: t.id,
                user_id: s?.id,
                username: s?.username,
                display_name: s?.display_name,
                status: "accepted" === t.status ? "accepted" : a ? "pending_sent" : "pending_received",
                // Stats shown in friend list rows and profile modal
                streak: s?.login_streak || 0,
                workouts_count: s?.total_workouts || 0
            }
        })
    } catch (e) {
        console.error("Failed to load friends:", e)
    }
}
async function sbSendFriendRequest(e) {
    if (!isDemoMode && supabaseClient && AppState.user) try {
        if (!await ensureSession()) return;
        let t = null;
        const {
            data: a
        } = await supabaseClient.from("profiles").select("id, username, display_name").eq("username", e).maybeSingle();
        if (a) t = a;
        else {
            const {
                data: a
            } = await supabaseClient.from("profiles").select("id, username, display_name").ilike("display_name", e).maybeSingle();
            if (a) t = a;
            else if (e.includes("@")) {
                const a = e.split("@")[0].toLowerCase().replace(/[^a-z0-9]/g, "_"),
                    {
                        data: s
                    } = await supabaseClient.from("profiles").select("id, username, display_name").ilike("username", a + "%").maybeSingle();
                s && (t = s)
            }
        }
        if (!t) return void(e.includes("@") ? showToast("User not found. They may need to sign up at ironpact-xi.vercel.app first.", "error") : showToast("User not found. Try their exact username or display name.", "error"));
        if (t.id === AppState.user.id) return void showToast("You can't add yourself!", "error");
        const {
            data: s
        } = await supabaseClient.from("friendships").select("id, status").or(`and(requester_id.eq.${AppState.user.id},addressee_id.eq.${t.id}),and(requester_id.eq.${t.id},addressee_id.eq.${AppState.user.id})`).maybeSingle();
        if (s) return void showToast("accepted" === s.status ? "Already friends!" : "Request already pending", "error");
        const {
            error: n
        } = await supabaseClient.from("friendships").insert({
            requester_id: AppState.user.id,
            addressee_id: t.id,
            status: "pending"
        });
        if (n) throw n;
        showToast(`Friend request sent to ${t.display_name||e}!`), await sbLoadFriends()
    } catch (e) {
        console.error("Failed to send request:", e), showToast("Failed to send friend request", "error")
    } else showToast(`Friend request sent to ${e}!`)
}
async function sbAcceptFriend(e) {
    if (isDemoMode || !supabaseClient || !AppState.user) return AppState.friends = AppState.friends.map(t => t.id === e ? {
        ...t,
        status: "accepted"
    } : t), void showToast("Friend request accepted!");
    try {
        const {
            error: t
        } = await supabaseClient.from("friendships").update({
            status: "accepted",
            updated_at: (new Date).toISOString()
        }).eq("id", e);
        if (t) throw t;
        showToast("Friend request accepted!"), await sbLoadFriends()
    } catch (e) {
        console.error("Failed to accept:", e), showToast("Failed to accept request", "error")
    }
}
async function sbRemoveFriend(e) {
    if (isDemoMode || !supabaseClient || !AppState.user) return AppState.friends = AppState.friends.filter(t => t.id !== e), void showToast("Friend removed");
    try {
        const {
            error: t
        } = await supabaseClient.from("friendships").delete().eq("id", e);
        if (t) throw t;
        showToast("Friend removed"), await sbLoadFriends()
    } catch (e) {
        console.error("Failed to remove:", e), showToast("Failed to remove friend", "error")
    }
}
async function sbLoadPacts() {
    if (!isDemoMode && supabaseClient && AppState.user) try {
        const e = AppState.user.id,
            {
                data: t,
                error: a
            } = await supabaseClient.from("pacts").select("*, pact_members!inner(user_id, role)").eq("pact_members.user_id", e).eq("is_active", !0);
        if (a) throw a;
        AppState.pacts = t || []
    } catch (e) {
        console.error("Failed to load pacts:", e)
    }
}
async function sbCreatePact(e) {
    if (isDemoMode || !supabaseClient || !AppState.user) {
        const t = {
            id: "pact-" + Date.now(),
            ...e,
            is_active: !0,
            created_at: (new Date).toISOString(),
            member_count: 1,
            members: [{
                user_id: "demo-user",
                display_name: AppState.profile.display_name,
                role: "admin",
                progress: 0,
                rank: 1
            }]
        };
        return AppState.pacts.unshift(t), showToast("Pact created!"), t
    }
    try {
        const {
            data: t,
            error: a
        } = await supabaseClient.from("pacts").insert({
            ...e,
            created_by: AppState.user.id,
            is_active: !0
        }).select().single();
        if (a) throw a;
        return await supabaseClient.from("pact_members").insert({
            pact_id: t.id,
            user_id: AppState.user.id,
            role: "admin"
        }), showToast("Pact created!"), await sbLoadPacts(), t
    } catch (e) {
        return console.error("Failed to create pact:", e), showToast("Failed to create pact", "error"), null
    }
}
async function sbJoinPact(e) {
    if (!isDemoMode && supabaseClient && AppState.user) try {
        const {
            error: t
        } = await supabaseClient.from("pact_members").insert({
            pact_id: e,
            user_id: AppState.user.id,
            role: "member"
        });
        if (t) throw t;
        showToast("Joined pact!"), await sbLoadPacts()
    } catch (e) {
        console.error("Failed to join pact:", e), showToast("Failed to join pact", "error")
    } else showToast("Joined pact!")
}
async function sbLoadPactLeaderboard(e) {
    if (isDemoMode || !supabaseClient || !AppState.user) return [];
    try {
        const {
            data: t,
            error: a
        } = await supabaseClient.from("leaderboard_entries").select("*, profile:profiles(display_name, username)").eq("pact_id", e).eq("period", "weekly").order("rank", {
            ascending: !0
        });
        if (a) throw a;
        return t || []
    } catch (e) {
        return console.error("Failed to load leaderboard:", e), []
    }
}
async function sbSaveBodyMeasurement(e) {
    if (isDemoMode || !supabaseClient || !AppState.user) {
        const t = {
            id: "bm-" + Date.now(),
            user_id: "demo-user",
            created_at: (new Date).toISOString(),
            ...e
        };
        return AppState.bodyMeasurements.unshift(t), showToast("Measurement logged!"), t
    }
    try {
        const {
            data: t,
            error: a
        } = await supabaseClient.from("body_measurements").insert({
            user_id: AppState.user.id,
            ...e
        }).select().single();
        if (a) throw a;
        return AppState.bodyMeasurements.unshift(t), showToast("Measurement logged!"), t
    } catch (e) {
        return console.error("Failed to save measurement:", e), showToast("Failed to save measurement", "error"), null
    }
}
async function sbLoadBodyMeasurements() {
    if (!isDemoMode && supabaseClient && AppState.user) try {
        const {
            data: e,
            error: t
        } = await supabaseClient.from("body_measurements").select("*").eq("user_id", AppState.user.id).order("date", {
            ascending: !1
        }).limit(50);
        if (t) throw t;
        AppState.bodyMeasurements = e || []
    } catch (e) {
        console.error("Failed to load measurements:", e)
    }
}
async function loadUserData() {
    if (!isDemoMode) {
        AppState._loading = !0;
        try {
            await Promise.all([sbLoadExercises(), sbLoadProfile(), sbLoadWorkouts()]), await sbLoadPersonalRecords(), 0 === Object.keys(AppState.personalRecords).length && AppState.workouts.length > 0 && buildPRs(), await Promise.all([sbLoadCoachingLogs(), sbLoadBodyMeasurements(), sbLoadFriends(), sbLoadPacts()]);
            updateLoginStreak()
        } catch (e) {
            console.error("Error loading user data:", e)
        }
        AppState._loading = !1
    }
}
async function handleAuthSignUp(e, t, a, s) {
    if (isDemoMode || !supabaseClient) return {
        error: {
            message: "Running in demo mode"
        }
    };
    try {
        const n = s || a.toLowerCase().replace(/[^a-z0-9]/g, "_").replace(/_+/g, "_").replace(/^_|_$/g, "").slice(0, 20),
            {
                data: i,
                error: o
            } = await supabaseClient.auth.signUp({
                email: e,
                password: t,
                options: {
                    data: {
                        username: n,
                        display_name: a
                    }
                }
            });
        return o ? {
            error: o
        } : (i.user && (AppState.user = i.user, AppState.isAuthenticated = !0, AppState.onboardingComplete = !1, AppState.profile.name = a, AppState.profile.display_name = a, AppState.profile.email = e), {
            data: i
        })
    } catch (e) {
        return {
            error: {
                message: e.message || "Signup failed"
            }
        }
    }
}
async function handleAuthSignIn(e, t) {
    if (isDemoMode || !supabaseClient) return {
        error: {
            message: "Running in demo mode"
        }
    };
    try {
        const {
            data: a,
            error: s
        } = await supabaseClient.auth.signInWithPassword({
            email: e,
            password: t
        });
        return s ? {
            error: s
        } : (AppState.user = a.user, AppState.isAuthenticated = !0, await loadUserData(), {
            data: a
        })
    } catch (e) {
        return {
            error: {
                message: e.message || "Login failed"
            }
        }
    }
}
async function handleAuthSignOut() {
    if (!isDemoMode && supabaseClient) try {
        await supabaseClient.auth.signOut()
    } catch (e) {
        console.warn("Signout error:", e)
    }
    AppState.isAuthenticated = !1, AppState.user = null, AppState.onboardingComplete = !1, AppState.profile = {
        name: "Demo User",
        display_name: "Demo User",
        email: "demo@ironpact.app",
        username: "demo",
        goal: "strength",
        experience: "intermediate",
        equipment: ["barbell", "dumbbell", "cable", "machine", "bodyweight"],
        unit_pref: "imperial"
    }, AppState.unitPref = "imperial", AppState.workouts = [], AppState.personalRecords = {}, AppState.generatedPlan = null, AppState.friends = [], AppState.pacts = [], AppState.coachingLogs = [], AppState.bodyMeasurements = [], clearInterval(AppState.activeWorkoutTimer), AppState.activeWorkout = null
}
async function initApp() {
    if (AppState.exercises = seedExercises(), !isDemoMode && supabaseClient) {
        try {
            const {
                data: {
                    session: e
                }
            } = await supabaseClient.auth.getSession();
            e && e.user && (AppState.user = e.user, AppState.isAuthenticated = !0, await loadUserData())
        } catch (e) {
            console.warn("Session check failed:", e)
        }
        supabaseClient.auth.onAuthStateChange(async (e, t) => {
            "SIGNED_IN" === e && t?.user ? (AppState.user = t.user, AppState.isAuthenticated = !0) : "SIGNED_OUT" === e && (AppState.isAuthenticated = !1, AppState.user = null)
        })
    }
    isDemoMode && (AppState.workouts = seedWorkouts(), buildPRs(), AppState.friends = seedFriends(), AppState.pacts = seedPacts(), AppState.coachingLogs = seedCoachingLogs(), AppState.bodyMeasurements = seedBodyMeasurements(), updateLoginStreak());
    const savedWorkoutData = loadActiveWorkoutFromStorage();
    if (savedWorkoutData && savedWorkoutData.activeWorkout && !AppState.activeWorkout) {
        AppState.activeWorkout = savedWorkoutData.activeWorkout;
        AppState.activeWorkoutStartTime = savedWorkoutData.startTime;
        AppState.activeWorkoutPaused = savedWorkoutData.paused;
        AppState.activeWorkoutElapsedBeforePause = savedWorkoutData.elapsedBeforePause;
        showToast("Resumed your in-progress workout", "info", 3e3);
        setTimeout(() => { window.location.hash = "#/workout/new" }, 300)
    }
    document.addEventListener("visibilitychange", () => {
        if ("hidden" === document.visibilityState && AppState.activeWorkout) saveActiveWorkoutToStorage()
    });
    window.addEventListener("beforeunload", e => {
        if (AppState.activeWorkout) {
            saveActiveWorkoutToStorage();
            e.preventDefault();
            e.returnValue = "You have an active workout in progress. Are you sure you want to leave?"
        }
    });
    setupRouter(), handleRoute(), window.addEventListener("hashchange", handleRoute)
}
function setupRouter() {}
function handleRoute() {
    const e = (window.location.hash || "#/").slice(1) || "/";
    let t = e,
        a = {};
    const s = e.match(/^\/workout\/([^/]+)$/);
    s && "new" !== s[1] && (t = "/workout/:id", a.id = s[1]);
    const n = e.match(/^\/social\/pact\/([^/]+)$/);
    n && (t = "/social/pact/:id", a.id = n[1]);
    const i = ["/", "/login", "/signup", "/onboarding"].includes(t),
        o = document.getElementById("sidebar"),
        r = document.getElementById("bottom-nav"),
        l = document.getElementById("demo-badge"),
        d = document.getElementById("mobile-header");
    !i && AppState.isAuthenticated ? (o.classList.remove("hidden"), o.style.display = "", r.classList.remove("hidden"), r.style.display = "", d && (d.style.display = ""), isDemoMode ? l.classList.remove("hidden") : l.classList.add("hidden")) : (o.classList.add("hidden"), r.classList.add("hidden"), d && (d.style.display = "none")), updateActiveNav(t);
    const c = document.getElementById("view-container");
    switch (c.innerHTML = "", c.className = "view-enter", Object.keys(AppState.chartInstances).forEach(e => {
            AppState.chartInstances[e] && (AppState.chartInstances[e].destroy(), delete AppState.chartInstances[e])
        }), t) {
        case "/":
            if (AppState.isAuthenticated) return void(AppState.onboardingComplete || isDemoMode ? window.location.hash = "#/dashboard" : window.location.hash = "#/onboarding");
            renderLanding(c);
            break;
        case "/login":
            renderLogin(c);
            break;
        case "/signup":
            renderSignup(c);
            break;
        case "/onboarding":
            renderOnboarding(c);
            break;
        case "/dashboard":
            if (!AppState.isAuthenticated) return void(window.location.hash = "#/");
            renderDashboard(c);
            break;
        case "/workout/new":
            if (!AppState.isAuthenticated) return void(window.location.hash = "#/");
            renderNewWorkout(c);
            break;
        case "/workouts":
            if (!AppState.isAuthenticated) return void(window.location.hash = "#/");
            renderWorkoutHistory(c);
            break;
        case "/workout/:id":
            if (!AppState.isAuthenticated) return void(window.location.hash = "#/");
            renderWorkoutDetail(c, a.id);
            break;
        case "/exercises":
            if (!AppState.isAuthenticated) return void(window.location.hash = "#/");
            renderExerciseLibrary(c);
            break;
        case "/plans/generate":
            if (!AppState.isAuthenticated) return void(window.location.hash = "#/");
            renderAIPlanGenerator(c);
            break;
        case "/social":
            if (!AppState.isAuthenticated) return void(window.location.hash = "#/");
            renderSocial(c);
            break;
        case "/social/pact/:id":
            if (!AppState.isAuthenticated) return void(window.location.hash = "#/");
            renderPactDetail(c, a.id);
            break;
        case "/stats":
            if (!AppState.isAuthenticated) return void(window.location.hash = "#/");
            renderStats(c);
            break;
        case "/profile":
            if (!AppState.isAuthenticated) return void(window.location.hash = "#/");
            renderProfile(c);
            break;
        default:
            c.innerHTML = '<div class="empty-state"><div class="empty-state-icon">404</div><div class="empty-state-title">Page Not Found</div><div class="empty-state-text">The page you\'re looking for doesn\'t exist.</div><a href="#/dashboard" class="btn btn-primary">Go to Dashboard</a></div>'
    }
}
function updateActiveNav(e) {
    document.querySelectorAll(".nav-item, .bottom-nav-item").forEach(e => e.classList.remove("active"));
    let t = "";
    e.startsWith("/dashboard") ? t = "dashboard" : e.startsWith("/workout") || "/workouts" === e ? t = "workouts" : "/exercises" === e ? t = "exercises" : e.startsWith("/plans") ? t = "plans" : e.startsWith("/social") ? t = "social" : "/stats" === e ? t = "stats" : "/profile" === e && (t = "profile"), t && document.querySelectorAll(`[data-nav="${t}"]`).forEach(e => e.classList.add("active"))
}
function injectSocialNav() {
    const e = document.querySelector(".sidebar-nav-items");
    if (e && !document.querySelector('[data-nav="social"]')) {
        const t = e.querySelector('[data-nav="stats"]'),
            a = document.createElement("a");
        a.href = "#/social", a.className = "nav-item", a.setAttribute("data-nav", "social"), a.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg><span>Social</span>', t ? e.insertBefore(a, t) : e.appendChild(a)
    }
    const t = document.getElementById("bottom-nav");
    if (t && !t.querySelector('[data-nav="social"]')) {
        const e = t.querySelector('[data-nav="stats"]'),
            a = document.createElement("a");
        a.href = "#/social", a.className = "bottom-nav-item", a.setAttribute("data-nav", "social"), a.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg><span>Social</span>', e ? t.insertBefore(a, e) : t.appendChild(a)
    }
}
function showToast(e, t = "success", a = 3e3) {
    const s = document.getElementById("toast-container"),
        n = document.createElement("div");
    n.className = `toast ${t}`;
    let i = "&#10003;";
    "error" === t && (i = "&#10007;"), "pr" === t && (i = "&#9733;"), n.innerHTML = `<span class="toast-icon">${i}</span><span>${e}</span>`, s.appendChild(n), setTimeout(() => {
        n.classList.add("removing"), setTimeout(() => n.remove(), 250)
    }, a)
}
function showConfirmModal(e, t, a, s = "Delete", n = !0) {
    const i = document.createElement("div");
    i.className = "modal-overlay", i.innerHTML = `\n    <div class="modal-content" style="max-width:400px;text-align:center;padding:32px;">\n      <div style="font-size:24px;margin-bottom:12px;">&#9888;</div>\n      <div style="font-weight:700;font-size:18px;margin-bottom:8px;">${e}</div>\n      <div style="color:var(--text-secondary);font-size:14px;margin-bottom:24px;">${t}</div>\n      <div style="display:flex;gap:12px;justify-content:center;">\n        <button class="btn btn-secondary" id="confirm-cancel">Cancel</button>\n        <button class="btn ${n?"btn-danger":"btn-primary"}" id="confirm-ok">${s}</button>\n      </div>\n    </div>\n  `, document.body.appendChild(i), i.querySelector("#confirm-cancel").addEventListener("click", () => i.remove()), i.querySelector("#confirm-ok").addEventListener("click", async () => {
        i.remove(), a && await a()
    }), i.addEventListener("click", e => {
        e.target === i && i.remove()
    })
}
function showFriendPickerModal(e, t) {
    const a = AppState.friends.filter(e => "accepted" === e.status),
        s = document.createElement("div");
    s.className = "modal-overlay", s.innerHTML = `\n    <div class="modal-content" style="max-width:440px;">\n      <div class="modal-header">\n        <h3>${e}</h3>\n        <button class="modal-close" id="picker-close">&times;</button>\n      </div>\n      <div style="padding:16px;">\n        ${0===a.length?'\n          <div class="empty-state" style="padding:24px;">\n            <div class="empty-state-title">No friends yet</div>\n            <div class="empty-state-text">Add friends on the Social page first.</div>\n          </div>\n        ':`\n          <div id="picker-message-wrap" style="margin-bottom:16px;">\n            <label class="form-label">Message (optional)</label>\n            <input type="text" class="form-input" id="picker-message" placeholder="Check out this plan!" maxlength="200">\n          </div>\n          <div style="display:flex;flex-direction:column;gap:8px;">\n            ${a.map(e=>`\n              <button class="btn btn-secondary friend-pick-btn" data-uid="${e.user_id}" style="display:flex;align-items:center;gap:12px;justify-content:flex-start;padding:12px;">\n                <div class="friend-avatar" style="width:36px;height:36px;font-size:14px;">${(e.display_name||e.username||"?")[0].toUpperCase()}</div>\n                <div style="text-align:left;">\n                  <div style="font-weight:700;font-size:14px;">${e.display_name||e.username}</div>\n                  <div style="font-size:12px;color:var(--text-tertiary);">@${e.username||"user"}</div>\n                </div>\n              </button>\n            `).join("")}\n          </div>\n        `}\n      </div>\n    </div>\n  `, document.body.appendChild(s), s.querySelector("#picker-close").addEventListener("click", () => s.remove()), s.addEventListener("click", e => {
        e.target === s && s.remove()
    }), s.querySelectorAll(".friend-pick-btn").forEach(e => {
        e.addEventListener("click", () => {
            const a = e.dataset.uid,
                n = s.querySelector("#picker-message")?.value || "";
            s.remove(), t && t(a, n)
        })
    })
}
function showPlanPreviewModal(e) {
    const t = e.plan_data,
        a = document.createElement("div");
    a.className = "modal-overlay", a.innerHTML = `\n    <div class="modal-content" style="max-width:560px;max-height:80vh;overflow-y:auto;">\n      <div class="modal-header">\n        <h3>${e.plan_name}</h3>\n        <button class="modal-close" id="preview-close">&times;</button>\n      </div>\n      <div style="padding:16px;">\n        <div style="font-size:13px;color:var(--text-secondary);margin-bottom:16px;">From @${e.sender_username} &middot; ${t.days?.length||"?"}-day &middot; ${t.goal||"General"}</div>\n        ${e.message?`<div style="background:var(--bg-elevated);padding:12px;border-radius:var(--radius-md);margin-bottom:16px;font-style:italic;font-size:13px;">&quot;${e.message}&quot;</div>`:""}\n        ${(t.days||[]).map(e=>`\n          <div style="margin-bottom:16px;">\n            <div style="font-weight:700;font-size:14px;margin-bottom:8px;color:var(--accent);">${e.name}</div>\n            ${(e.exercises||[]).map(e=>`\n              <div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--border-subtle);font-size:13px;">\n                <span>${e.name}</span>\n                <span style="color:var(--text-secondary);">${e.sets} x ${e.reps} | ${e.rest}</span>\n              </div>\n            `).join("")}\n          </div>\n        `).join("")}\n      </div>\n    </div>\n  `, document.body.appendChild(a), a.querySelector("#preview-close").addEventListener("click", () => a.remove()), a.addEventListener("click", e => {
        e.target === a && a.remove()
    })
}
function formatDate(e) {
    const t = new Date(e),
        a = new Date,
        s = Math.floor((a - t) / 864e5);
    return 0 === s ? "Today" : 1 === s ? "Yesterday" : s < 7 ? `${s} days ago` : t.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: t.getFullYear() !== a.getFullYear() ? "numeric" : void 0
    })
}
function formatTime(e) {
    const t = Math.floor(e / 3600),
        a = Math.floor(e % 3600 / 60),
        s = e % 60;
    return t > 0 ? `${t}:${String(a).padStart(2,"0")}:${String(s).padStart(2,"0")}` : `${String(a).padStart(2,"0")}:${String(s).padStart(2,"0")}`
}
function getTotalVolume(e) {
    let t = 0;
    return (e.exercises || []).forEach(ex => {
        const eid = ex.exercise_id;
        (ex.sets || []).forEach(s => {
            !1 !== s.completed && (t += getEffectiveWeight(eid, s.weight_kg || 0) * (s.reps || 0))
        })
    }), t
}
function getTotalSets(e) {
    let t = 0;
    return (e.exercises || []).forEach(e => {
        t += (e.sets || []).filter(e => !1 !== e.completed).length
    }), t
}
function getStreak() {
    if (0 === AppState.workouts.length) return 0;
    const e = [...AppState.workouts].sort((e, t) => new Date(t.date) - new Date(e.date));
    let t = 0;
    const a = new Date;
    a.setHours(0, 0, 0, 0);
    const s = new Date(e[0].date);
    s.setHours(0, 0, 0, 0);
    if (Math.floor((a - s) / 864e5) > 1) return 0;
    let n = new Date(s);
    for (let a = 0; a < 365; a++) {
        const a = n.toISOString().slice(0, 10);
        if (!e.some(e => new Date(e.date).toISOString().slice(0, 10) === a)) break;
        t++, n.setDate(n.getDate() - 1)
    }
    return t
}
function getLongestStreak() {
    if (0 === AppState.workouts.length) return 0;
    const e = [...new Set(AppState.workouts.map(e => new Date(e.date).toISOString().slice(0, 10)))].sort();
    let t = 1,
        a = 1;
    for (let s = 1; s < e.length; s++) {
        const n = new Date(e[s - 1]);
        1 === (new Date(e[s]) - n) / 864e5 ? (a++, t = Math.max(t, a)) : a = 1
    }
    return t
}
function updateLoginStreak() {
    const today = (new Date).toISOString().slice(0, 10),
        lastLogin = AppState.profile.last_login_date;
    if (lastLogin === today) return;  // idempotent — already updated today
    if (lastLogin) {
        const lastDate = new Date(lastLogin),
            todayDate = new Date(today),
            diff = Math.floor((todayDate - lastDate) / 864e5);
        1 === diff ? AppState.profile.login_streak = (AppState.profile.login_streak || 0) + 1 : diff > 1 && (AppState.profile.login_streak = 1)
    } else AppState.profile.login_streak = 1;
    AppState.profile.last_login_date = today;
    if ((AppState.profile.login_streak || 0) > (AppState.profile.longest_login_streak || 0)) AppState.profile.longest_login_streak = AppState.profile.login_streak;
    if (!isDemoMode && supabaseClient && AppState.user) {
        supabaseClient.from("profiles").update({
            last_login_date: today,
            login_streak: AppState.profile.login_streak,
            longest_login_streak: AppState.profile.longest_login_streak
        }).eq("id", AppState.user.id)
          .then(() => {})
          .catch(e => {
              // Columns may not exist yet — pending DB migration. Fail silently.
              console.warn("Login streak DB update failed (columns may be missing — run migration):", e);
          })
    }
}
function getLoginStreak() {
    return AppState.profile.login_streak || 0
}
function getLongestLoginStreak() {
    return AppState.profile.longest_login_streak || 0
}
function getWeeklyVolume() {
    const e = new Date(Date.now() - 6048e5);
    let t = 0;
    return AppState.workouts.forEach(a => {
        new Date(a.date) >= e && (t += getTotalVolume(a))
    }), t
}
function getWeeklyWorkoutCount() {
    const e = new Date(Date.now() - 6048e5);
    return AppState.workouts.filter(t => new Date(t.date) >= e).length
}
function generateId() {
    return "id-" + Date.now() + "-" + Math.random().toString(36).slice(2, 8)
}
function shareWorkout(e) {
    getUnitLabel();
    let t = `💪 ${e.name}\n`;
    return t += `📅 ${formatDate(e.date)} | ⏱ ${e.duration_minutes}m\n\n`, (e.exercises || []).forEach(e => {
        t += `\n${e.exercise_name} (${formatMuscleGroupLabel(e.muscle_group)})\n`, (e.sets || []).forEach(e => {
            t += `  Set ${e.set_number}: ${formatWeight(e.weight_kg)} × ${e.reps}${e.rpe?` @RPE${e.rpe}`:""}\n`
        })
    }), t += "\nGenerated by IronPact — sigro.ai", t
}
function shareAIPlan(e) {
    let t = `🤖 ${e.name}\n`;
    return t += `Goal: ${e.goal} | ${e.days.length}-day program\n\n`, (e.days || []).forEach(e => {
        t += `\n${e.name}\n`, (e.exercises || []).forEach(e => {
            t += `  • ${e.name} — ${e.sets} sets × ${e.reps} reps | Rest: ${e.rest}\n`
        })
    }), t += "\nGenerated by IronPact AI — sigro.ai", t
}
function getMuscleGroupIcon(e) {
    return {
        chest: "🏋️",
        back: "💪",
        shoulders: "🦾",
        legs: "🦵",
        arms: "💪",
        core: "🎯",
        cardio: "🏃",
        full_body: "⚡"
    } [e] || "🏋️"
}
function getEquipmentIcon(e) {
    return {
        barbell: "🔩",
        dumbbell: "🏋️",
        cable: "⚙️",
        machine: "🔧",
        bodyweight: "🤸",
        kettlebell: "🏋️",
        band: "🎗️",
        other: "🔧"
    } [e] || "🏋️"
}
function formatMuscleGroupLabel(e) {
    return "full_body" === e ? "Full Body" : e.charAt(0).toUpperCase() + e.slice(1)
}
function getCoachingTypeIcon(e) {
    return {
        weight_rec: "⬆️",
        progressive_overload: "📈",
        form_tip: "🎯",
        muscle_balance: "⚖️",
        deload_warning: "🔄",
        rest_suggestion: "⏱️",
        general: "💡"
    } [e] || "💡"
}
function getCoachingTypeLabel(e) {
    return {
        weight_rec: "Weight Recommendation",
        progressive_overload: "Progressive Overload",
        form_tip: "Form Tip",
        muscle_balance: "Muscle Balance",
        deload_warning: "Deload Warning",
        rest_suggestion: "Rest Suggestion",
        general: "General Tip"
    } [e] || "Tip"
}
function renderUnitToggle() {
    return `<div class="unit-toggle" title="Switch between lbs and kg">\n    <button class="unit-btn ${"imperial"===AppState.unitPref?"active":""}" onclick="setUnitPref('imperial')">lbs</button>\n    <button class="unit-btn ${"metric"===AppState.unitPref?"active":""}" onclick="setUnitPref('metric')">kg</button>\n  </div>`
}
function renderLanding(e) {
    e.innerHTML = '\n    <div class="landing">\n      <header class="landing-header">\n        <div class="landing-logo">\n          <span class="logo-icon">⬡</span>\n          <span class="logo-text font-display" style="font-weight:800;font-size:26px;">Iron<span class="accent">Pact</span></span>\n        </div>\n        <div class="landing-nav">\n          <a href="#/login" class="btn btn-ghost">Log In</a>\n          <a href="#/signup" class="btn btn-primary">Get Started</a>\n        </div>\n      </header>\n      <section class="landing-hero">\n        <div class="hero-badge"><span class="accent">&#9733;</span> Powered by Sigro.ai</div>\n        <h1 class="hero-title">Forge Your<br><span class="accent">Strength</span></h1>\n        <p class="hero-subtitle">AI-powered workout tracking built for lifters who mean business. Log every rep, crush PRs, and let intelligence guide your training.</p>\n        <div class="hero-actions">\n          <a href="#/signup" class="btn btn-primary btn-lg">Start Training Free</a>\n          <a href="#/login" class="btn btn-secondary btn-lg">Log In</a>\n        </div>\n      </section>\n      <section class="landing-features">\n        <h2 class="features-title">Everything You Need to <span class="text-accent">Dominate</span></h2>\n        <div class="features-grid">\n          <div class="feature-card">\n            <div class="feature-icon">📊</div>\n            <h3>Smart Workout Logging</h3>\n            <p>Track exercises, sets, reps, weight, and RPE with a buttery smooth interface. Real-time timer keeps you on pace.</p>\n          </div>\n          <div class="feature-card">\n            <div class="feature-icon">🏆</div>\n            <h3>PR Detection</h3>\n            <p>Automatic personal record tracking. Hit a new max? We\'ll celebrate it with you. Every PR is logged and highlighted.</p>\n          </div>\n          <div class="feature-card">\n            <div class="feature-icon">🤖</div>\n            <h3>AI Coaching</h3>\n            <p>Get personalized coaching tips after every workout — weight recommendations, form cues, and progressive overload guidance.</p>\n          </div>\n          <div class="feature-card">\n            <div class="feature-icon">👥</div>\n            <h3>Social Pacts</h3>\n            <p>Create accountability pacts with friends. Set group goals, track leaderboards, and push each other to new heights.</p>\n          </div>\n          <div class="feature-card">\n            <div class="feature-icon">📈</div>\n            <h3>Deep Analytics</h3>\n            <p>Volume charts, muscle distribution radar, heatmap calendar, body composition trends. Visualize your progress.</p>\n          </div>\n          <div class="feature-card">\n            <div class="feature-icon">⚡</div>\n            <h3>Built for Speed</h3>\n            <p>No bloat. No lag. IronPact loads instantly and stays out of your way so you can focus on what matters: lifting.</p>\n          </div>\n        </div>\n      </section>\n      <footer class="landing-footer">\n        <p>IronPact by <a href="https://sigro.ai" target="_blank" rel="noopener noreferrer">Sigro.ai</a> — An AI-agent-run company</p>\n      </footer>\n    </div>\n  '
}
function renderLogin(e) {
    e.innerHTML = '\n    <div class="auth-container">\n      <div class="auth-card">\n        <div class="auth-logo">\n          <span class="logo-icon">⬡</span>\n          <span class="logo-text font-display" style="font-weight:800;font-size:30px;">Iron<span class="accent">Pact</span></span>\n        </div>\n        <div class="card" style="padding:28px;">\n          <h2 class="auth-title">Welcome back</h2>\n          <p class="auth-subtitle">Log in to continue your training</p>\n          <form class="auth-form" id="login-form">\n            <div class="form-group">\n              <label class="form-label">Email</label>\n              <input type="email" class="form-input" placeholder="you@example.com" id="login-email" required>\n            </div>\n            <div class="form-group">\n              <label class="form-label">Password</label>\n              <input type="password" class="form-input" placeholder="Enter your password" id="login-password" required>\n            </div>\n            <div id="login-error" style="color:var(--danger);font-size:13px;margin-bottom:12px;display:none;"></div>\n            <button type="submit" class="btn btn-primary w-full btn-lg" id="login-submit-btn">Log In</button>\n          </form>\n          <div class="auth-divider">or</div>\n          <button class="btn btn-secondary w-full" id="demo-login-btn">Continue in Demo Mode</button>\n          <div class="auth-footer">\n            Don\'t have an account? <a href="#/signup">Sign up</a>\n          </div>\n        </div>\n      </div>\n    </div>\n  ', document.getElementById("login-form").addEventListener("submit", async e => {
        e.preventDefault();
        const t = document.getElementById("login-email").value.trim(),
            a = document.getElementById("login-password").value,
            s = document.getElementById("login-error"),
            n = document.getElementById("login-submit-btn");
        if (s.style.display = "none", n.disabled = !0, n.textContent = "Logging in...", isDemoMode) AppState.isAuthenticated = !0, AppState.onboardingComplete = !0, AppState.user = {
            id: "demo-user",
            email: t || "demo@ironpact.app"
        }, AppState.workouts = seedWorkouts(), AppState.friends = seedFriends(), AppState.pacts = seedPacts(), AppState.coachingLogs = seedCoachingLogs(), AppState.bodyMeasurements = seedBodyMeasurements(), buildPRs(), showToast("Logged in (Demo Mode)"), window.location.hash = "#/dashboard";
        else {
            const {
                data: e,
                error: i
            } = await handleAuthSignIn(t, a);
            if (i) return s.textContent = i.message || "Login failed", s.style.display = "block", n.disabled = !1, void(n.textContent = "Log In");
            showToast("Logged in successfully"), AppState.onboardingComplete ? window.location.hash = "#/dashboard" : window.location.hash = "#/onboarding"
        }
    }), document.getElementById("demo-login-btn").addEventListener("click", () => {
        isDemoMode = !0, AppState.isAuthenticated = !0, AppState.onboardingComplete = !0, AppState.user = {
            id: "demo-user",
            email: "demo@ironpact.app"
        }, AppState.exercises = seedExercises(), AppState.workouts = seedWorkouts(), AppState.friends = seedFriends(), AppState.pacts = seedPacts(), AppState.coachingLogs = seedCoachingLogs(), AppState.bodyMeasurements = seedBodyMeasurements(), buildPRs(), showToast("Welcome to IronPact Demo!"), window.location.hash = "#/dashboard"
    })
}
function renderSignup(e) {
    e.innerHTML = '\n    <div class="auth-container">\n      <div class="auth-card">\n        <div class="auth-logo">\n          <span class="logo-icon">⬡</span>\n          <span class="logo-text font-display" style="font-weight:800;font-size:30px;">Iron<span class="accent">Pact</span></span>\n        </div>\n        <div class="card" style="padding:28px;">\n          <h2 class="auth-title">Create your account</h2>\n          <p class="auth-subtitle">Start tracking your gains today</p>\n          <form class="auth-form" id="signup-form">\n            <div class="form-group">\n              <label class="form-label">Display Name</label>\n              <input type="text" class="form-input" placeholder="Your name" id="signup-name" required>\n            </div>\n            <div class="form-group">\n              <label class="form-label">Username</label>\n              <input type="text" class="form-input" placeholder="Choose a unique username" id="signup-username" required pattern="[a-z0-9_]{3,20}" title="3-20 characters, lowercase letters, numbers, and underscores only">\n              <div style="font-size:11px;color:var(--text-tertiary);margin-top:4px;">Friends will find you by this name</div>\n            </div>\n            <div class="form-group">\n              <label class="form-label">Email</label>\n              <input type="email" class="form-input" placeholder="you@example.com" id="signup-email" required>\n            </div>\n            <div class="form-group">\n              <label class="form-label">Password</label>\n              <input type="password" class="form-input" placeholder="At least 6 characters" id="signup-password" minlength="6" required>\n            </div>\n            <div id="signup-error" style="color:var(--danger);font-size:13px;margin-bottom:12px;display:none;"></div>\n            <button type="submit" class="btn btn-primary w-full btn-lg" id="signup-submit-btn">Create Account</button>\n          </form>\n          <div class="auth-divider">or</div>\n          <button class="btn btn-secondary w-full" id="demo-signup-btn">Try Demo Mode</button>\n          <div class="auth-footer">\n            Already have an account? <a href="#/login">Log in</a>\n          </div>\n        </div>\n      </div>\n    </div>\n  ';
    const t = document.getElementById("signup-name"),
        a = document.getElementById("signup-username");
    let s = !1;
    a.addEventListener("input", () => {
        s = !0
    }), t.addEventListener("input", () => {
        s || (a.value = t.value.trim().toLowerCase().replace(/[^a-z0-9]/g, "_").replace(/_+/g, "_").replace(/^_|_$/g, "").slice(0, 20))
    }), document.getElementById("signup-form").addEventListener("submit", async e => {
        e.preventDefault();
        const t = document.getElementById("signup-name").value.trim(),
            a = document.getElementById("signup-username").value.trim().toLowerCase(),
            s = document.getElementById("signup-email").value.trim(),
            n = document.getElementById("signup-password").value,
            i = document.getElementById("signup-error"),
            o = document.getElementById("signup-submit-btn");
        if (i.style.display = "none", o.disabled = !0, o.textContent = "Creating account...", !/^[a-z0-9_]{3,20}$/.test(a)) return i.textContent = "Username must be 3-20 characters: lowercase letters, numbers, underscores only", i.style.display = "block", o.disabled = !1, void(o.textContent = "Create Account");
        if (isDemoMode) AppState.isAuthenticated = !0, AppState.onboardingComplete = !1, AppState.user = {
            id: "demo-user",
            email: s
        }, AppState.profile.name = t, AppState.profile.display_name = t, AppState.profile.username = a, AppState.profile.email = s, showToast("Account created!"), window.location.hash = "#/onboarding";
        else {
            const {
                data: e
            } = await supabaseClient.from("profiles").select("id").eq("username", a).maybeSingle();
            if (e) return i.textContent = "That username is already taken. Try another.", i.style.display = "block", o.disabled = !1, void(o.textContent = "Create Account");
            const {
                data: r,
                error: l
            } = await handleAuthSignUp(s, n, t, a);
            if (l) return i.textContent = l.message || "Signup failed", i.style.display = "block", o.disabled = !1, void(o.textContent = "Create Account");
            await sbLoadExercises(), showToast("Account created!"), window.location.hash = "#/onboarding"
        }
    }), document.getElementById("demo-signup-btn").addEventListener("click", () => {
        isDemoMode = !0, AppState.isAuthenticated = !0, AppState.onboardingComplete = !0, AppState.user = {
            id: "demo-user",
            email: "demo@ironpact.app"
        }, AppState.exercises = seedExercises(), AppState.workouts = seedWorkouts(), AppState.friends = seedFriends(), AppState.pacts = seedPacts(), AppState.coachingLogs = seedCoachingLogs(), AppState.bodyMeasurements = seedBodyMeasurements(), buildPRs(), showToast("Welcome to IronPact Demo!"), window.location.hash = "#/dashboard"
    })
}
function renderOnboarding(e) {
    let t = 1;
    const a = {
        goal: AppState.profile.goal || "",
        experience: AppState.profile.experience || "",
        equipment: [...AppState.profile.equipment || []]
    };
    function render() {
        e.innerHTML = `\n      <div class="onboarding-container">\n        <div class="onboarding-card">\n          <div class="card" style="padding:32px;">\n            <div class="onboarding-step-indicator">\n              <div class="step-dot ${t>=1?t>1?"completed":"active":""}"></div>\n              <div class="step-dot ${t>=2?t>2?"completed":"active":""}"></div>\n              <div class="step-dot ${t>=3?"active":""}"></div>\n            </div>\n            ${1===t?function renderStep1(){return`\n      <h2 class="auth-title">What's your primary goal?</h2>\n      <p class="auth-subtitle">This helps us tailor your experience</p>\n      <div class="option-grid" id="goal-options">\n        <div class="option-card ${"strength"===a.goal?"selected":""}" data-value="strength"><div class="option-icon">🏋️</div><div>Strength</div></div>\n        <div class="option-card ${"hypertrophy"===a.goal?"selected":""}" data-value="hypertrophy"><div class="option-icon">💪</div><div>Muscle Growth</div></div>\n        <div class="option-card ${"endurance"===a.goal?"selected":""}" data-value="endurance"><div class="option-icon">🏃</div><div>Endurance</div></div>\n        <div class="option-card ${"fat_loss"===a.goal?"selected":""}" data-value="fat_loss"><div class="option-icon">🔥</div><div>Fat Loss</div></div>\n        <div class="option-card ${"general"===a.goal?"selected":""}" data-value="general"><div class="option-icon">⚡</div><div>General Fitness</div></div>\n      </div>\n      <div style="margin-top:24px;display:flex;justify-content:flex-end;">\n        <button class="btn btn-primary" id="next-step" ${a.goal?"":"disabled"}>Next</button>\n      </div>\n    `}():2===t?function renderStep2(){return`\n      <h2 class="auth-title">Experience level?</h2>\n      <p class="auth-subtitle">No judgment — we'll match your programming</p>\n      <div class="option-grid" id="exp-options">\n        <div class="option-card ${"beginner"===a.experience?"selected":""}" data-value="beginner"><div class="option-icon">🌱</div><div>Beginner</div><div style="font-size:11px;color:var(--text-tertiary);margin-top:2px;">&lt;1 year</div></div>\n        <div class="option-card ${"intermediate"===a.experience?"selected":""}" data-value="intermediate"><div class="option-icon">⚡</div><div>Intermediate</div><div style="font-size:11px;color:var(--text-tertiary);margin-top:2px;">1-3 years</div></div>\n        <div class="option-card ${"advanced"===a.experience?"selected":""}" data-value="advanced"><div class="option-icon">🔥</div><div>Advanced</div><div style="font-size:11px;color:var(--text-tertiary);margin-top:2px;">3+ years</div></div>\n      </div>\n      <div style="margin-top:24px;display:flex;justify-content:space-between;">\n        <button class="btn btn-ghost" id="prev-step">Back</button>\n        <button class="btn btn-primary" id="next-step" ${a.experience?"":"disabled"}>Next</button>\n      </div>\n    `}():function renderStep3(){return`\n      <h2 class="auth-title">Available equipment?</h2>\n      <p class="auth-subtitle">Select all that apply</p>\n      <div class="option-grid" id="eq-options">\n        ${["barbell","dumbbell","cable","machine","bodyweight"].map(e=>`\n          <div class="option-card ${a.equipment.includes(e)?"selected":""}" data-value="${e}">\n            <div class="option-icon">${getEquipmentIcon(e)}</div>\n            <div style="text-transform:capitalize;">${e}</div>\n          </div>\n        `).join("")}\n      </div>\n      <div style="margin-top:24px;display:flex;justify-content:space-between;">\n        <button class="btn btn-ghost" id="prev-step">Back</button>\n        <button class="btn btn-primary" id="finish-onboarding" ${0===a.equipment.length?"disabled":""}>Start Training</button>\n      </div>\n    `}()}\n          </div>\n        </div>\n      </div>\n    `,
            function attachStepListeners() {
                1 === t && document.querySelectorAll("#goal-options .option-card").forEach(e => {
                    e.addEventListener("click", () => {
                        a.goal = e.dataset.value, render()
                    })
                });
                2 === t && document.querySelectorAll("#exp-options .option-card").forEach(e => {
                    e.addEventListener("click", () => {
                        a.experience = e.dataset.value, render()
                    })
                });
                3 === t && document.querySelectorAll("#eq-options .option-card").forEach(e => {
                    e.addEventListener("click", () => {
                        const t = e.dataset.value,
                            s = a.equipment.indexOf(t);
                        s >= 0 ? a.equipment.splice(s, 1) : a.equipment.push(t), render()
                    })
                });
                const e = document.getElementById("next-step");
                e && e.addEventListener("click", () => {
                    t++, render()
                });
                const s = document.getElementById("prev-step");
                s && s.addEventListener("click", () => {
                    t--, render()
                });
                const n = document.getElementById("finish-onboarding");
                n && n.addEventListener("click", async () => {
                    n.disabled = !0, n.textContent = "Setting up...", AppState.profile.goal = a.goal, AppState.profile.experience = a.experience, AppState.profile.equipment = a.equipment, AppState.onboardingComplete = !0, !isDemoMode && supabaseClient && AppState.user && (await sbUpdateProfile({
                        goal: a.goal,
                        experience: a.experience,
                        available_equipment: a.equipment,
                        onboarding_complete: !0,
                        unit_pref: "imperial",
                        updated_at: (new Date).toISOString()
                    }), await sbLoadExercises()), isDemoMode && (AppState.workouts = seedWorkouts(), AppState.friends = seedFriends(), AppState.pacts = seedPacts(), AppState.coachingLogs = seedCoachingLogs(), AppState.bodyMeasurements = seedBodyMeasurements(), buildPRs()), showToast("Profile set up! Let's get to work."), window.location.hash = "#/dashboard"
                })
            }()
    }
    render()
}
function renderDashboard(e) {
    const t = getLoginStreak(),
        a = getWeeklyVolume(),
        s = getWeeklyWorkoutCount(),
        n = AppState.workouts.length,
        wStreak = getStreak(),
        i = [...AppState.workouts].sort((e, t) => new Date(t.date) - new Date(e.date)).slice(0, 5),
        o = (AppState.profile.display_name || AppState.profile.name || "User").split(" ")[0],
        r = getUnitLabel(),
        l = isDemoMode ? '<div style="background:var(--accent-glow);border:1px solid var(--accent);border-radius:var(--radius-md);padding:10px 16px;margin-bottom:16px;font-size:13px;color:var(--accent);font-weight:600;">Running in demo mode — <a href="#/signup" style="color:var(--accent);text-decoration:underline;">Sign up</a> for the full experience</div>' : "",
        d = AppState.coachingLogs.filter(e => !e.dismissed).slice(0, 3),
        c = d.length > 0 ? `\n    <div class="card" style="margin-bottom:24px;">\n      <div class="card-header">\n        <h3 class="card-title">🤖 Coach's Corner</h3>\n        <a href="#/stats" class="btn btn-ghost btn-sm">Analytics</a>\n      </div>\n      <div class="coaching-tips-list">\n        ${d.map(e=>`\n          <div class="coaching-tip-card" id="tip-${e.id}">\n            <div class="coaching-tip-icon">${getCoachingTypeIcon(e.coaching_type)}</div>\n            <div class="coaching-tip-body">\n              <div class="coaching-tip-label">${getCoachingTypeLabel(e.coaching_type)}</div>\n              <div class="coaching-tip-message">${e.message}</div>\n            </div>\n            <button class="coaching-tip-dismiss" onclick="dismissTip('${e.id}')" title="Dismiss">✕</button>\n          </div>\n        `).join("")}\n      </div>\n    </div>\n  ` : "";
    e.innerHTML = `\n    ${l}\n    <div class="dashboard-header">\n      <div>\n        <div class="greeting">Welcome back, <span class="accent">${o}</span></div>\n        <div class="page-subtitle" style="margin-bottom:0;">Let's make today count.</div>\n      </div>\n      <div style="display:flex;align-items:center;gap:12px;">\n        ${renderUnitToggle()}\n        <a href="#/workout/new" class="btn btn-primary btn-lg">\n          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="18" height="18"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>\n          New Workout\n        </a>\n      </div>\n    </div>\n\n    <div class="stats-grid">\n      <div class="stat-card">\n        <div class="stat-label">Login Streak</div>\n        <div class="stat-value"><span class="streak-fire">🔥</span> ${t} day${1!==t?"s":""}</div>\n        <div class="stat-change" style="color:var(--text-secondary);font-size:11px;">Workout streak: ${wStreak}d</div>\n      </div>\n      <div class="stat-card">\n        <div class="stat-label">This Week</div>\n        <div class="stat-value">${s}</div>\n        <div class="stat-change positive">workouts</div>\n      </div>\n      <div class="stat-card">\n        <div class="stat-label">Weekly Volume</div>\n        <div class="stat-value">${formatVolumeK(a)}</div>\n        <div class="stat-change" style="color:var(--text-secondary)">${r} total</div>\n      </div>\n      <div class="stat-card">\n        <div class="stat-label">Total Workouts</div>\n        <div class="stat-value">${n}</div>\n      </div>\n    </div>\n\n    <div class="quick-actions">\n      <a href="#/workout/new" class="btn btn-secondary">\n        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><path d="M6.5 6.5h11M6.5 17.5h11M4 10h1.5M18.5 10H20M4 14h1.5M18.5 14H20M7.5 10v4M16.5 10v4M9.5 8v8M14.5 8v8M11.5 6v12"/></svg>\n        Quick Start\n      </a>\n      <a href="#/plans/generate" class="btn btn-secondary">\n        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>\n        AI Plan\n      </a>\n      <a href="#/social" class="btn btn-secondary">\n        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>\n        Social\n      </a>\n    </div>\n\n    ${c}\n\n    <div class="card">\n      <div class="card-header">\n        <h3 class="card-title">Recent Workouts</h3>\n        <a href="#/workouts" class="btn btn-ghost btn-sm">View All</a>\n      </div>\n      <div class="recent-workouts-list" id="recent-list">\n        ${0===i.length?'\n          <div class="empty-state" style="padding:32px;">\n            <div class="empty-state-icon">🏋️</div>\n            <div class="empty-state-title">No workouts yet</div>\n            <div class="empty-state-text">Start your first workout to see it here.</div>\n            <a href="#/workout/new" class="btn btn-primary" style="margin-top:16px;">Start a Workout</a>\n          </div>\n        ':i.map(e=>`\n          <div class="workout-row" onclick="window.location.hash='#/workout/${e.id}'">\n            <div class="workout-row-icon">🏋️</div>\n            <div class="workout-row-info">\n              <div class="workout-row-name">${e.name}</div>\n              <div class="workout-row-meta">\n                <span>${formatDate(e.date)}</span>\n                <span>${(e.exercises||[]).length} exercise${1!==(e.exercises||[]).length?"s":""}</span>\n              </div>\n            </div>\n            <div class="workout-row-stats">\n              <div class="workout-row-stat">\n                <div class="workout-row-stat-value">${e.duration_minutes}m</div>\n                <div class="workout-row-stat-label">Duration</div>\n              </div>\n              <div class="workout-row-stat">\n                <div class="workout-row-stat-value">${getTotalSets(e)}</div>\n                <div class="workout-row-stat-label">Sets</div>\n              </div>\n              <div class="workout-row-stat">\n                <div class="workout-row-stat-value">${formatVolumeK(getTotalVolume(e))}</div>\n                <div class="workout-row-stat-label">Volume</div>\n              </div>\n            </div>\n          </div>\n        `).join("")}\n      </div>\n    </div>\n  `, window.dismissTip = async e => {
        await sbDismissCoachingTip(e);
        const t = document.getElementById(`tip-${e}`);
        t && (t.style.opacity = "0", t.style.transform = "translateX(100%)", t.style.transition = "all 0.3s ease", setTimeout(() => {
            t.remove()
        }, 300))
    }
}
function renderNewWorkout(e) {
    // If memory was cleared (e.g. double-listener race), restore from storage
    if (!AppState.activeWorkout) {
        const _stored = loadActiveWorkoutFromStorage();
        if (_stored && _stored.activeWorkout) {
            AppState.activeWorkout = _stored.activeWorkout;
            AppState.activeWorkoutStartTime = _stored.startTime || null;
            AppState.activeWorkoutPaused = _stored.paused || false;
            AppState.activeWorkoutElapsedBeforePause = _stored.elapsedBeforePause || 0;
        }
    }
    AppState.activeWorkout || (AppState.activeWorkout = {
        id: generateId(),
        name: "",
        exercises: [],
        startTime: null
    }, AppState.activeWorkoutStartTime = null, AppState.activeWorkoutPaused = !1, AppState.activeWorkoutPausedAt = null, AppState.activeWorkoutElapsedBeforePause = 0);
    getUnitLabel();
    function getElapsed() {
        return AppState.activeWorkoutStartTime ? AppState.activeWorkoutPaused ? AppState.activeWorkoutElapsedBeforePause : Math.floor(AppState.activeWorkoutElapsedBeforePause + (Date.now() - AppState.activeWorkoutStartTime) / 1e3) : 0
    }
    function render() {
        const t = getElapsed(),
            a = !!AppState.activeWorkoutStartTime,
            s = AppState.activeWorkoutPaused;
        e.innerHTML = `\n      <div class="page-header-back">\n        <button class="back-btn" onclick="cancelWorkout()">\n          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>\n        </button>\n        <div>\n          <div class="page-title" style="margin-bottom:0;">Active Workout</div>\n        </div>\n        <div style="margin-left:auto;">${renderUnitToggle()}</div>\n      </div>\n\n      <div class="workout-timer-bar">\n        <div>\n          <div class="timer-label">Duration</div>\n          <div class="timer-display" id="workout-timer">${formatTime(t)}</div>\n        </div>\n        <div style="display:flex;gap:8px;align-items:center;">\n          ${a?`\n            <button class="btn btn-secondary btn-sm" id="pause-workout-btn">\n              ${s?'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><polygon points="5 3 19 12 5 21 5 3" fill="currentColor"/></svg> Resume':'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg> Pause'}\n            </button>\n          `:'\n            <button class="btn btn-primary btn-sm" id="start-workout-btn" style="background:var(--success);border-color:var(--success);">\n              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><polygon points="5 3 19 12 5 21 5 3" fill="currentColor"/></svg>\n              Start\n            </button>\n          '}\n          <button class="btn btn-secondary btn-sm" onclick="showExercisePicker()">\n            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="14" height="14"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>\n            Add Exercise\n          </button>\n          <button class="btn btn-primary btn-sm" onclick="finishWorkout()" ${0===AppState.activeWorkout.exercises.length?"disabled":""}>Finish</button>\n        </div>\n      </div>\n\n      <div style="margin-bottom:16px;">\n        <label style="display:block;font-size:11px;font-weight:700;color:var(--text-secondary);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px;">Workout Name</label>\n        <input type="text" class="form-input w-full" placeholder="e.g., Push Day" value="${AppState.activeWorkout.name}" id="workout-name-input" style="font-family:var(--font-display);font-weight:700;font-size:18px;background:var(--bg-elevated);border:1.5px solid var(--border-medium);padding:10px 14px;" onblur="AppState.activeWorkout.name=this.value;">\n      </div>\n\n      <div id="exercise-blocks">\n        ${0===AppState.activeWorkout.exercises.length?'\n          <div class="empty-state" style="padding:48px 24px;">\n            <div class="empty-state-icon">🏋️</div>\n            <div class="empty-state-title">Add your first exercise</div>\n            <div class="empty-state-text">Tap "Add Exercise" to start building your workout.</div>\n          </div>\n        ':AppState.activeWorkout.exercises.map((e,t)=>function renderExerciseBlock(e,t){const a=getUnitLabel(),s=e._aiTarget?`<div style="font-size:11px;color:var(--accent);margin-top:2px;">Target: ${e._aiTarget}</div>`:"",_exObj=AppState.exercises.find(x=>x.id===e.exercise_id),_isBW=_exObj&&_exObj.equipment&&_exObj.equipment.toLowerCase()==="bodyweight",_isTimed=_exObj&&_exObj.exercise_modality&&_exObj.exercise_modality.toLowerCase()==="timed";return`\n      <div class="exercise-block">\n        <div class="exercise-block-header">\n          <div>\n            <div class="exercise-block-name">${e.exercise_name}</div>\n            <span class="muscle-tag ${e.muscle_group}" style="margin-top:4px;">${formatMuscleGroupLabel(e.muscle_group)}</span>\n            ${s}\n            ${_isBW?`<div style="font-size:11px;color:var(--text-tertiary);margin-top:2px;">BW: ${formatWeight(getBodyweightKg())} + added weight</div>`:""}\n          </div>\n          <button class="btn btn-ghost btn-sm" onclick="removeExerciseFromWorkout(${t})" style="color:var(--danger);">\n            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>\n          </button>\n        </div>\n        <table class="set-table">\n          <thead>\n            <tr>\n              <th style="width:50px;">Set</th>\n              <th>${_isBW?"Added Wt ("+a+")":"Weight ("+a+")"}</th>\n              <th>${_isTimed?"Time (sec)":"Reps"}</th>\n              <th style="width:50px;"></th>\n            </tr>\n          </thead>\n          <tbody>\n            ${e.sets.map((e,a)=>{const s=null!=e._displayWeight?e._displayWeight:kgToDisplay(e.weight_kg);return`\n              <tr class="${e.completed?"pr-row":""}" style="${e.completed?"opacity:0.7;":""}">\n                <td><div class="set-number">${e.set_number}</div></td>\n                <td><input type="number" value="${s||""}" placeholder="0" min="0" step="0.5" onchange="updateSetWeight(${t},${a},parseFloat(this.value)||0)" ${e.completed?'readonly style="opacity:0.6"':""}></td>\n                <td><input type="number" value="${e.reps||""}" placeholder="0" min="0" onchange="updateSet(${t},${a},'reps',parseInt(this.value)||0)" ${e.completed?'readonly style="opacity:0.6"':""}></td>\n                              <td>\n                  <button class="set-complete-btn ${e.completed?"completed":""}" onclick="toggleSetComplete(${t},${a})" title="${e.completed?"Mark incomplete":"Mark complete"}" style="width:42px;height:42px;font-size:20px;font-weight:800;${e.completed?"background:var(--success);border-color:var(--success);color:#fff;":"border:2px dashed var(--border-medium);color:var(--text-tertiary);"}">\n                    ${e.completed?"✓":""}\n                  </button>\n                </td>\n              </tr>\n            `}).join("")}\n          </tbody>\n        </table>\n        <button class="add-set-btn" onclick="addSetToExercise(${t})">+ Add Set</button>\n      </div>\n    `}(e,t)).join("")}\n      </div>\n\n      ${AppState.activeWorkout.exercises.length>0?'\n        <div style="display:flex;gap:10px;margin-top:16px;">\n          <button class="btn btn-secondary w-full" onclick="showExercisePicker()">\n            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="16" height="16"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>\n            Add Exercise\n          </button>\n          <button class="btn btn-primary w-full" onclick="finishWorkout()">\n            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><path d="M20 6L9 17l-5-5"/></svg>\n            Finish Workout\n          </button>\n        </div>\n      ':""}\n\n      <div style="text-align:center;margin-top:16px;">\n        <button class="btn btn-ghost text-danger" onclick="cancelWorkout()" style="color:var(--danger);">Discard Workout</button>\n      </div>\n    `;
        const n = document.getElementById("start-workout-btn");
        n && n.addEventListener("click", () => {
            AppState.activeWorkoutStartTime = Date.now(), AppState.activeWorkoutPaused = !1, AppState.activeWorkoutElapsedBeforePause = 0, render(), startTimer()
        });
        const i = document.getElementById("pause-workout-btn");
        i && i.addEventListener("click", () => {
            if (AppState.activeWorkoutPaused) AppState.activeWorkoutStartTime = Date.now(), AppState.activeWorkoutPaused = !1, i.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg> Pause', startTimer();
            else {
                AppState.activeWorkoutElapsedBeforePause = getElapsed(), AppState.activeWorkoutPaused = !0, AppState.activeWorkoutStartTime = null, clearInterval(AppState.activeWorkoutTimer), i.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><polygon points="5 3 19 12 5 21 5 3" fill="currentColor"/></svg> Resume';
                const e = document.getElementById("workout-timer");
                e && (e.textContent = formatTime(AppState.activeWorkoutElapsedBeforePause))
            }
        }), a && !s && startTimer()
    }
    function startTimer() {
        clearInterval(AppState.activeWorkoutTimer), AppState.activeWorkoutTimer = setInterval(() => {
            if (AppState.activeWorkoutPaused) return;
            const e = document.getElementById("workout-timer");
            e && (e.textContent = formatTime(getElapsed()))
        }, 1e3)
    }
    render(), window.removeExerciseFromWorkout = e => {
        AppState.activeWorkout.exercises.splice(e, 1), saveActiveWorkoutToStorage(), render()
    }, window.addSetToExercise = e => {
        const t = AppState.activeWorkout.exercises[e],
            a = t.sets[t.sets.length - 1];
        t.sets.push({
            set_number: t.sets.length + 1,
            weight_kg: a ? a.weight_kg : 0,
            _displayWeight: a ? null != a._displayWeight ? a._displayWeight : kgToDisplay(a.weight_kg) : 0,
            reps: a ? a.reps : 0,
            rpe: null,
            set_type: "working",
            completed: !1
        }), saveActiveWorkoutToStorage(), render()
    }, window.updateSetWeight = (e, t, a) => {
        const s = AppState.activeWorkout.exercises[e].sets[t];
        s._displayWeight = a, s.weight_kg = displayToKg(a), saveActiveWorkoutToStorage()
    }, window.updateSet = (e, t, a, s) => {
        AppState.activeWorkout.exercises[e].sets[t][a] = s, saveActiveWorkoutToStorage()
    }, window.toggleSetComplete = (e, t) => {
        const a = AppState.activeWorkout.exercises[e].sets[t];
        if (a.completed = !a.completed, a.completed) {
            const t = AppState.activeWorkout.exercises[e],
                s = t.exercise_id,
                o = getEffectiveWeight(s, a.weight_kg || 0),
                n = AppState.personalRecords[s];
            let i = !1;
            if (o > 0) {
                if (n) {
                    o > n.max_weight && (n.max_weight = o, n.max_weight_reps = a.reps || 0, i = !0), o === n.max_weight && (a.reps || 0) > (n.max_weight_reps || 0) && (n.max_weight_reps = a.reps || 0), a.reps > n.max_reps && o >= .8 * n.max_weight && (i = !0);
                    const e = o * (a.reps || 0);
                    e > n.max_volume_set && (n.max_volume_set = e, i = !0)
                } else i = !0, AppState.personalRecords[s] = {
                    max_weight: o,
                    max_weight_reps: a.reps || 0,
                    max_reps: a.reps || 0,
                    max_volume_set: o * (a.reps || 0)
                };
                i ? showToast(`NEW PR! ${t.exercise_name} — ${formatWeight(o)} × ${a.reps}`, "pr", 4e3) : showToast(`Set logged: ${formatWeight(o)} × ${a.reps}`)
            }
        }
        saveActiveWorkoutToStorage(), render()
    }, window.showExercisePicker = () => {
        const e = document.createElement("div");
        e.className = "modal-overlay", e.id = "exercise-picker-modal";
        let t = "",
            a = "";
        ! function renderModal() {
            let s = AppState.exercises;
            if (t) {
                const e = t.toLowerCase();
                s = s.filter(t => t.name.toLowerCase().includes(e) || (t.muscle_group || "").includes(e) || (t.equipment || "").includes(e))
            }
            a && (s = s.filter(e => e.muscle_group === a)), e.innerHTML = `\n        <div class="modal">\n          <div class="modal-header">\n            <span class="modal-title">Add Exercise</span>\n            <button class="modal-close" id="close-picker">✕</button>\n          </div>\n          <div class="modal-body">\n            <div class="search-bar">\n              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>\n              <input type="text" placeholder="Search exercises..." value="${t}" id="picker-search">\n            </div>\n            <div class="filter-row">\n              <button class="filter-chip ${""===a?"active":""}" data-group="">All</button>\n              ${ALL_MUSCLE_GROUPS.map(e=>`<button class="filter-chip ${a===e?"active":""}" data-group="${e}">${formatMuscleGroupLabel(e)}</button>`).join("")}\n            </div>\n            <div style="margin-bottom:12px;">\n              <button class="btn btn-secondary btn-sm" id="picker-create-custom" style="width:100%;">+ Create Custom Exercise</button>\n            </div>\n            <div class="modal-exercise-list">\n              ${s.map(e=>`\n                <div class="modal-exercise-item" data-eid="${e.id}">\n                  <div class="exercise-card-icon" style="background:${e.is_custom?"var(--success-glow)":"var(--accent-glow)"};border-radius:var(--radius-md);">${getMuscleGroupIcon(e.muscle_group)}</div>\n                  <div class="exercise-card-info">\n                    <div class="exercise-card-name">${e.name}${e.is_custom?' <span style="font-size:10px;background:var(--accent-glow);color:var(--accent);padding:1px 6px;border-radius:8px;font-weight:600;">Custom</span>':""}</div>\n                    <div class="exercise-card-detail"><span class="muscle-tag ${e.muscle_group}" style="font-size:10px;padding:2px 6px;">${formatMuscleGroupLabel(e.muscle_group)}</span> <span style="color:var(--text-tertiary);font-size:11px;margin-left:4px;">${e.equipment||""}</span></div>\n                  </div>\n                </div>\n              `).join("")}\n              ${0===s.length?'<div style="padding:20px;text-align:center;color:var(--text-tertiary);font-size:13px;">No exercises found</div>':""}\n            </div>\n          </div>\n        </div>\n      `, e.querySelector("#close-picker").addEventListener("click", () => e.remove()), e.addEventListener("click", t => {
                t.target === e && e.remove()
            }), e.querySelector("#picker-search").addEventListener("input", a => {
                t = a.target.value, renderModal(), setTimeout(() => {
                    const t = e.querySelector("#picker-search");
                    t && (t.focus(), t.setSelectionRange(t.value.length, t.value.length))
                }, 0)
            }), e.querySelectorAll(".filter-chip").forEach(e => {
                e.addEventListener("click", () => {
                    a = e.dataset.group, renderModal()
                })
            });
            const ccBtn = e.querySelector("#picker-create-custom");
            ccBtn && ccBtn.addEventListener("click", () => {
                showCreateExerciseModal(() => renderModal())
            });
            e.querySelectorAll(".modal-exercise-item").forEach(t => {
                t.addEventListener("click", () => {
                    const a = AppState.exercises.find(e => e.id === t.dataset.eid);
                    if (a) {
                        let t = 0,
                            s = 0;
                        const n = [...AppState.workouts].sort((e, t) => new Date(t.date) - new Date(e.date));
                        for (const e of n) {
                            const n = (e.exercises || []).find(e => e.exercise_id === a.id);
                            if (n && n.sets && n.sets.length > 0) {
                                const e = n.sets.filter(e => !1 !== e.completed);
                                t = (e.length > 0 ? e[e.length - 1] : n.sets[n.sets.length - 1]).weight_kg || 0, s = Math.round(10 * kgToDisplay(t)) / 10;
                                break
                            }
                        }
                        AppState.activeWorkout.exercises.push({
                            exercise_id: a.id,
                            exercise_name: a.name,
                            muscle_group: a.muscle_group,
                            sets: [{
                                set_number: 1,
                                weight_kg: t,
                                _displayWeight: s,
                                reps: 0,
                                rpe: null,
                                set_type: "working",
                                completed: !1
                            }, {
                                set_number: 2,
                                weight_kg: t,
                                _displayWeight: s,
                                reps: 0,
                                rpe: null,
                                set_type: "working",
                                completed: !1
                            }, {
                                set_number: 3,
                                weight_kg: t,
                                _displayWeight: s,
                                reps: 0,
                                rpe: null,
                                set_type: "working",
                                completed: !1
                            }]
                        }), e.remove(), render(), showToast(`Added ${a.name}`)
                    }
                })
            })
        }(), document.body.appendChild(e), setTimeout(() => {
            const t = e.querySelector("#picker-search");
            t && t.focus()
        }, 100)
    }, window.finishWorkout = async () => {
        if (AppState._saving) return;
        AppState._saving = !0;
        try {
        clearInterval(AppState.activeWorkoutTimer);
        const t = AppState.activeWorkoutPaused ? AppState.activeWorkoutElapsedBeforePause : AppState.activeWorkoutStartTime ? Math.floor(AppState.activeWorkoutElapsedBeforePause + (Date.now() - AppState.activeWorkoutStartTime) / 1e3) : 0,
            a = AppState.activeWorkout.name || "Workout " + (AppState.workouts.length + 1),
            s = AppState.activeWorkout.exercises.map(e => ({
                ...e,
                sets: e.sets.filter(e => e.completed)
            })).filter(e => e.sets.length > 0);
        if (0 === s.length) return AppState._saving = !1, void showToast("Complete at least one set before finishing", "error");
        const n = {
            name: a,
            started_at: new Date(AppState.activeWorkoutStartTime || Date.now()).toISOString(),
            duration_seconds: t,
            duration_minutes: Math.max(1, Math.round(t / 60)),
            notes: "",
            is_ai_generated: AppState.activeWorkout.is_ai_generated || !1,
            exercises: s
        };
        if (!isDemoMode && supabaseClient && AppState.user) {
            const i = e.querySelector(".btn-primary");
            i && (i.disabled = !0, i.textContent = "Saving...");
            const o = await sbSaveWorkout(n);
            if (o) await sbLoadWorkouts(), await sbLoadPersonalRecords(), AppState.activeWorkout = null, AppState.activeWorkoutStartTime = null, clearActiveWorkoutStorage(), showToast("Workout completed! Great work. 💪"), showWorkoutCompletionModal(n), setTimeout(() => {
                window.location.hash = "#/workout/" + o.id
            }, 3e3);
            else {
                const e = {
                    id: AppState.activeWorkout.id,
                    name: a,
                    date: (new Date).toISOString(),
                    duration_minutes: Math.max(1, Math.round(t / 60)),
                    notes: "",
                    exercises: s
                };
                AppState.workouts.unshift(e), buildPRs(), AppState.activeWorkout = null, AppState.activeWorkoutStartTime = null, clearActiveWorkoutStorage(), showToast("Workout saved locally (sync failed)", "error"), window.location.hash = "#/workout/" + e.id
            }
        } else {
            const e = {
                id: AppState.activeWorkout.id,
                name: a,
                date: (new Date).toISOString(),
                duration_minutes: Math.max(1, Math.round(t / 60)),
                notes: "",
                exercises: s
            };
            AppState.workouts.unshift(e), buildPRs();
            const i = generateCoachingAnalysis({
                ...n,
                id: e.id
            });
            for (const e of i) await sbSaveCoachingLog(e);
            AppState.activeWorkout = null, AppState.activeWorkoutStartTime = null, clearActiveWorkoutStorage(), showToast("Workout completed! Great work. 💪"), showWorkoutCompletionModal(n), setTimeout(() => {
                window.location.hash = "#/workout/" + e.id
            }, 3500)
        }
        } finally { AppState._saving = !1 }
    }, window.cancelWorkout = () => {
        if (AppState.activeWorkout && AppState.activeWorkout.exercises.length > 0) try {
            if (!confirm("Discard this workout? All data will be lost.")) return
        } catch (e) {}
        clearInterval(AppState.activeWorkoutTimer), AppState.activeWorkout = null, AppState.activeWorkoutStartTime = null, AppState.activeWorkoutPaused = !1, AppState.activeWorkoutElapsedBeforePause = 0, clearActiveWorkoutStorage(), window.location.hash = "#/dashboard"
    }
}
function showWorkoutCompletionModal(e) {
    const t = AppState.coachingLogs.filter(e => !e.dismissed).slice(0, 3);
    if (0 === t.length) return;
    const a = document.createElement("div");
    a.className = "modal-overlay", a.innerHTML = `\n    <div class="modal" style="max-width:480px;">\n      <div class="modal-header">\n        <span class="modal-title">🏆 Workout Complete!</span>\n        <button class="modal-close" id="close-completion">✕</button>\n      </div>\n      <div class="modal-body">\n        <div style="text-align:center;margin-bottom:20px;">\n          <div style="font-size:48px;margin-bottom:8px;">💪</div>\n          <div style="font-family:var(--font-display);font-weight:700;font-size:18px;">${e.name}</div>\n          <div style="color:var(--text-secondary);font-size:13px;">${Math.max(1,Math.round((e.duration_seconds||0)/60))} min · ${(e.exercises||[]).length} exercises</div>\n        </div>\n        <div style="margin-bottom:12px;font-size:13px;font-weight:600;color:var(--text-secondary);text-transform:uppercase;letter-spacing:0.5px;">Coach's Tips for This Session</div>\n        <div class="coaching-tips-list">\n          ${t.map(e=>`\n            <div class="coaching-tip-card">\n              <div class="coaching-tip-icon">${getCoachingTypeIcon(e.coaching_type)}</div>\n              <div class="coaching-tip-body">\n                <div class="coaching-tip-label">${getCoachingTypeLabel(e.coaching_type)}</div>\n                <div class="coaching-tip-message">${e.message}</div>\n              </div>\n            </div>\n          `).join("")}\n        </div>\n        <button class="btn btn-primary w-full" id="close-completion-btn" style="margin-top:16px;">Got It!</button>\n      </div>\n    </div>\n  `, document.body.appendChild(a), a.querySelector("#close-completion").addEventListener("click", () => a.remove()), a.querySelector("#close-completion-btn").addEventListener("click", () => a.remove()), a.addEventListener("click", e => {
        e.target === a && a.remove()
    })
}
function renderWorkoutHistory(e) {
    let t = "all",
        a = "",
        _searchTimer = null;
    function getFilteredWorkouts() {
        let s = [...AppState.workouts].sort((e, t) => new Date(t.date) - new Date(e.date));
        if ("week" === t) {
            const e = new Date(Date.now() - 6048e5);
            s = s.filter(t => new Date(t.date) >= e)
        } else if ("month" === t) {
            const e = new Date(Date.now() - 2592e6);
            s = s.filter(t => new Date(t.date) >= e)
        }
        if (a) {
            const e = a.toLowerCase();
            s = s.filter(t => t.name.toLowerCase().includes(e))
        }
        return s
    }
    function buildWorkoutListHTML(s) {
        if (0 === s.length && 0 === AppState.workouts.length) return '\n        <div class="empty-state" style="padding:48px;">\n          <div class="empty-state-icon">📋</div>\n          <div class="empty-state-title">No workouts yet</div>\n          <div class="empty-state-text">Complete your first workout to see your history here.</div>\n          <a href="#/workout/new" class="btn btn-primary" style="margin-top:16px;">Start a Workout</a>\n        </div>\n      ';
        if (0 === s.length) return '\n        <div class="empty-state" style="padding:48px;">\n          <div class="empty-state-icon">🔍</div>\n          <div class="empty-state-title">No workouts match your filters</div>\n          <div class="empty-state-text">Try a different search term or time period.</div>\n        </div>\n      ';
        return `\n        <div class="recent-workouts-list">\n          ${s.map(e=>{const _prCount=countWorkoutPRs(e);return`\n            <div class="workout-row card-hover">\n              <div class="workout-row-icon" onclick="window.location.hash='#/workout/${e.id}'">🏋️</div>\n              <div class="workout-row-info" onclick="window.location.hash='#/workout/${e.id}'" style="cursor:pointer;">\n                <div class="workout-row-name">${e.name}${_prCount>0?` <span class="pr-count-badge">🏆 ${_prCount}</span>`:""}</div>\n                <div class="workout-row-meta">\n                  <span>${formatDate(e.date)}</span>\n                  <span>${(e.exercises||[]).length} exercise${1!==(e.exercises||[]).length?"s":""}</span>\n                  <span>${getTotalSets(e)} sets</span>\n                </div>\n              </div>\n              <div class="workout-row-stats">\n                <div class="workout-row-stat">\n                  <div class="workout-row-stat-value">${e.duration_minutes}m</div>\n                  <div class="workout-row-stat-label">Duration</div>\n                </div>\n                <div class="workout-row-stat">\n                  <div class="workout-row-stat-value">${formatVolumeK(getTotalVolume(e))}</div>\n                  <div class="workout-row-stat-label">Volume</div>\n                </div>\n                <button class="btn btn-secondary btn-sm copy-workout-btn" data-wid="${e.id}" style="margin-left:8px;white-space:nowrap;" title="Copy workout">\n                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>\n                  Copy\n                </button>\n                <button class="btn btn-secondary btn-sm repeat-workout-btn" data-wid="${e.id}" style="white-space:nowrap;">\n                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13"><path d="M17 1l4 4-4 4"/><path d="M3 11V9a4 4 0 014-4h14M7 23l-4-4 4-4"/><path d="M21 13v2a4 4 0 01-4 4H3"/></svg>\n                  Repeat\n                </button>\n                <button class="btn btn-ghost btn-sm delete-workout-btn" data-wid="${e.id}" style="color:var(--danger);padding:6px;" title="Delete workout">\n                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>\n                </button>\n              </div>\n            </div>\n          `}).join("")}\n        </div>\n      `
    }
    function bindListEvents() {
        e.querySelectorAll(".repeat-workout-btn").forEach(e => {
            e.addEventListener("click", t => {
                t.stopPropagation();
                const a = e.dataset.wid,
                    s = AppState.workouts.find(e => e.id === a);
                s && (clearInterval(AppState.activeWorkoutTimer), AppState.activeWorkout = {
                    id: generateId(),
                    name: s.name + " (Repeat)",
                    exercises: (s.exercises || []).map(e => ({
                        exercise_id: e.exercise_id,
                        exercise_name: e.exercise_name,
                        muscle_group: e.muscle_group,
                        sets: (e.sets || []).map((e, t) => ({
                            set_number: t + 1,
                            weight_kg: e.weight_kg || 0,
                            _displayWeight: Math.round(10 * kgToDisplay(e.weight_kg || 0)) / 10,
                            reps: e.reps || 0,
                            rpe: null,
                            set_type: "working",
                            completed: !1
                        }))
                    })),
                    startTime: null
                }, AppState.activeWorkoutStartTime = null, AppState.activeWorkoutPaused = !1, AppState.activeWorkoutElapsedBeforePause = 0, showToast("Workout pre-filled from history — tap Start when ready!"), window.location.hash = "#/workout/new")
            })
        }), e.querySelectorAll(".copy-workout-btn").forEach(e => {
            e.addEventListener("click", t => {
                t.stopPropagation();
                const a = e.dataset.wid,
                    s = AppState.workouts.find(e => e.id === a);
                s && (clearInterval(AppState.activeWorkoutTimer), AppState.activeWorkout = {
                    id: generateId(),
                    name: s.name + " (Copy)",
                    exercises: (s.exercises || []).map(e => ({
                        exercise_id: e.exercise_id,
                        exercise_name: e.exercise_name,
                        muscle_group: e.muscle_group,
                        sets: (e.sets || []).map((e, t) => ({
                            set_number: t + 1,
                            weight_kg: e.weight_kg || 0,
                            _displayWeight: Math.round(10 * kgToDisplay(e.weight_kg || 0)) / 10,
                            reps: e.reps || 0,
                            rpe: null,
                            set_type: "working",
                            completed: !1
                        }))
                    })),
                    startTime: null
                }, AppState.activeWorkoutStartTime = null, AppState.activeWorkoutPaused = !1, AppState.activeWorkoutElapsedBeforePause = 0, showToast("Workout copied — tap Start when ready!"), window.location.hash = "#/workout/new")
            })
        }), e.querySelectorAll(".delete-workout-btn").forEach(e => {
            e.addEventListener("click", t => {
                t.stopPropagation();
                const a = e.dataset.wid,
                    s = AppState.workouts.find(e => e.id === a);
                s && showConfirmModal("Delete Workout", `Are you sure you want to delete "${s.name}"? This cannot be undone.`, async () => {
                    e.disabled = !0, e.innerHTML = '<div class="spinner-sm"></div>', await sbDeleteWorkout(a), render()
                })
            })
        })
    }
    function updateWorkoutList() {
        const s = getFilteredWorkouts(),
            listContainer = document.getElementById("history-list-container");
        if (listContainer) {
            listContainer.innerHTML = buildWorkoutListHTML(s);
            bindListEvents()
        }
    }
    ! function render() {
        const s = getFilteredWorkouts();
        getUnitLabel(), e.innerHTML = `\n      <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;margin-bottom:16px;">\n        <div>\n          <div class="page-title">Workout History</div>\n          <div class="page-subtitle">${AppState.workouts.length} workout${1!==AppState.workouts.length?"s":""} logged</div>\n        </div>\n        <div style="display:flex;align-items:center;gap:12px;">\n          ${renderUnitToggle()}\n          <a href="#/workout/new" class="btn btn-primary" style="white-space:nowrap;">\n            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="14" height="14" style="margin-right:6px;"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>\n            New Workout\n          </a>\n        </div>\n      </div>\n\n      <div class="history-filters">\n        <div class="search-bar" style="flex:1;min-width:200px;">\n          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>\n          <input type="text" placeholder="Search workouts..." value="${a}" id="history-search">\n        </div>\n        <div class="filter-row" style="flex-shrink:0;">\n          <button class="filter-chip ${"week"===t?"active":""}" data-period="week">This Week</button>\n          <button class="filter-chip ${"month"===t?"active":""}" data-period="month">This Month</button>\n          <button class="filter-chip ${"all"===t?"active":""}" data-period="all">All Time</button>\n        </div>\n      </div>\n\n      <div id="history-list-container">${buildWorkoutListHTML(s)}</div>\n    `, document.getElementById("history-search").addEventListener("input", e => {
            a = e.target.value;
            clearTimeout(_searchTimer);
            _searchTimer = setTimeout(() => updateWorkoutList(), 200)
        }), e.querySelectorAll(".filter-chip[data-period]").forEach(e => {
            e.addEventListener("click", () => {
                t = e.dataset.period, updateWorkoutList();
                e.closest(".filter-row").querySelectorAll(".filter-chip").forEach(e => e.classList.remove("active"));
                e.classList.add("active")
            })
        }), bindListEvents()
    }()
}
function renderWorkoutDetail(e, t) {
    const a = AppState.workouts.find(e => e.id === t);
    if (!a) return void(e.innerHTML = '<div class="empty-state"><div class="empty-state-icon">🤷</div><div class="empty-state-title">Workout not found</div><a href="#/workouts" class="btn btn-primary mt-4">Back to History</a></div>');
    const s = getTotalVolume(a),
        n = getTotalSets(a),
        i = new Date(a.date),
        o = getUnitLabel();
    e.innerHTML = `\n    <div class="page-header-back">\n      <button class="back-btn" onclick="window.location.hash='#/workouts'">\n        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>\n      </button>\n      <div>\n        <div class="page-title editable-name" id="workout-detail-name" style="margin-bottom:0;cursor:pointer;" title="Click to edit name">${a.name} <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14" style="opacity:0.4;vertical-align:middle;"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></div>\n        <div style="font-size:13px;color:var(--text-secondary);">${i.toLocaleDateString("en-US",{weekday:"long",month:"long",day:"numeric",year:"numeric"})}</div>\n      </div>\n      <div style="margin-left:auto;display:flex;gap:8px;align-items:center;">\n        <button class="btn btn-ghost btn-sm" id="edit-workout-btn" style="color:var(--accent);">\n          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>\n          Edit\n        </button>\n        <button class="btn btn-ghost btn-sm" id="copy-workout-btn" style="color:var(--success);">\n          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>\n          Copy\n        </button>\n        <button class="btn btn-ghost btn-sm" id="share-workout-btn" style="color:var(--accent);">\n          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>\n          Share\n        </button>\n        <button class="btn btn-ghost btn-sm" id="delete-workout-detail-btn" style="color:var(--danger);">\n          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>\n          Delete\n        </button>\n        ${renderUnitToggle()}\n      </div>\n    </div>\n\n    <div class="stats-grid" style="margin-bottom:24px;">\n      <div class="stat-card">\n        <div class="stat-label">Duration</div>\n        <div class="stat-value">${a.duration_minutes}<span style="font-size:14px;color:var(--text-secondary);font-weight:400;"> min</span></div>\n      </div>\n      <div class="stat-card">\n        <div class="stat-label">Exercises</div>\n        <div class="stat-value">${(a.exercises||[]).length}</div>\n      </div>\n      <div class="stat-card">\n        <div class="stat-label">Total Sets</div>\n        <div class="stat-value">${n}</div>\n      </div>\n      <div class="stat-card">\n        <div class="stat-label">Volume</div>\n        <div class="stat-value">${formatVolumeK(s)}<span style="font-size:14px;color:var(--text-secondary);font-weight:400;"> ${o}</span></div>\n      </div>\n      ${countWorkoutPRs(a)>0?`<div class="stat-card pr-stat-card">\n        <div class="stat-label">PRs Hit</div>\n        <div class="stat-value">🏆 ${countWorkoutPRs(a)}</div>\n      </div>`:""}\n    </div>\n\n    ${(a.exercises||[]).map(e=>{const t=AppState.personalRecords[e.exercise_id],_eid=e.exercise_id;return`\n        <div class="detail-exercise">\n          <div class="detail-exercise-header">\n            <div style="display:flex;align-items:center;gap:10px;">\n              <span class="detail-exercise-name">${e.exercise_name}</span>\n              <span class="muscle-tag ${e.muscle_group}">${formatMuscleGroupLabel(e.muscle_group)}</span>\n            </div>\n            ${t?`<span style="font-size:11px;color:var(--text-tertiary);">PR: ${formatWeight(t.max_weight)}</span>`:""}\n          </div>\n          <div class="detail-set-list">\n            ${(e.sets||[]).map(e=>{const w=getEffectiveWeight(_eid,e.weight_kg||0),a=t&&w===t.max_weight&&w>0||e.is_pr;return`<div class="detail-set-chip ${a?"is-pr":""}">\n                <div style="font-size:10px;color:var(--text-tertiary);margin-bottom:2px;">Set ${e.set_number}</div>\n                <div>${formatWeight(e.weight_kg)} × ${e.reps}</div>\n                ${a?'<div class="pr-badge-gold">🏆 PR</div>':""}\n              </div>`}).join("")}\n          </div>\n        </div>\n      `}).join("")}\n\n    ${a.notes?`<div class="card mt-4"><div class="card-title" style="margin-bottom:8px;">Notes</div><p style="font-size:14px;color:var(--text-secondary);">${a.notes}</p></div>`:""}\n  `;
    const r = document.getElementById("share-workout-btn");
    r && r.addEventListener("click", () => {
        const e = shareWorkout(a);
        navigator.clipboard ? navigator.clipboard.writeText(e).then(() => showToast("Copied to clipboard! 📋")).catch(() => showToast("Copy failed", "error")) : showToast("Clipboard not available", "error")
    });
    const cp = document.getElementById("copy-workout-btn");
    cp && cp.addEventListener("click", () => {
        clearInterval(AppState.activeWorkoutTimer);
        AppState.activeWorkout = {
            id: generateId(),
            name: a.name + " (Copy)",
            exercises: (a.exercises || []).map(ex => ({
                exercise_id: ex.exercise_id,
                exercise_name: ex.exercise_name,
                muscle_group: ex.muscle_group,
                sets: (ex.sets || []).map((s, idx) => ({
                    set_number: idx + 1,
                    weight_kg: s.weight_kg || 0,
                    _displayWeight: kgToDisplay(s.weight_kg || 0),
                    reps: s.reps || 0,
                    rpe: null,
                    set_type: s.set_type || "working",
                    completed: !1
                }))
            }))
        };
        AppState.activeWorkoutStartTime = null;
        AppState.activeWorkoutPaused = !1;
        AppState.activeWorkoutElapsedBeforePause = 0;
        saveActiveWorkoutToStorage();
        showToast("Workout copied — ready to start!");
        window.location.hash = "#/workout/new";
    });
    const editBtn = document.getElementById("edit-workout-btn");
    editBtn && editBtn.addEventListener("click", () => showEditWorkoutModal(a, t, e));
    const l = document.getElementById("delete-workout-detail-btn");
    l && l.addEventListener("click", () => {
        showConfirmModal("Delete Workout", `Are you sure you want to delete "${a.name}"? This cannot be undone.`, async () => {
            await sbDeleteWorkout(t), window.location.hash = "#/workouts"
        })
    });
    const nameEl = document.getElementById("workout-detail-name");
    nameEl && nameEl.addEventListener("click", () => {
        const cur = a.name;
        nameEl.innerHTML = `<input type="text" id="edit-workout-name" class="form-input" value="${cur.replace(/"/g,"&quot;")}" style="font-size:inherit;font-weight:inherit;font-family:inherit;padding:4px 8px;max-width:300px;">`;
        const inp = document.getElementById("edit-workout-name");
        inp.focus();
        inp.select();
        function save() {
            const v = inp.value.trim();
            if (v && v !== cur) {
                a.name = v;
                sbUpdateWorkoutName(t, v);
                showToast("Workout renamed")
            }
            nameEl.innerHTML = `${a.name} <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14" style="opacity:0.4;vertical-align:middle;"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`
        }
        inp.addEventListener("blur", save);
        inp.addEventListener("keydown", e => { if ("Enter" === e.key) inp.blur(); if ("Escape" === e.key) { inp.value = cur; inp.blur() } })
    })
}
function showEditWorkoutModal(workout, workoutId, container) {
    const m = document.createElement("div");
    m.className = "modal-overlay";
    m.id = "edit-workout-modal";
    let editExercises = JSON.parse(JSON.stringify(workout.exercises || []));
    editExercises.forEach(ex => {
        (ex.sets || []).forEach(s => {
            s._displayWeight = kgToDisplay(s.weight_kg || 0);
            if (s.completed === undefined) s.completed = !0
        })
    });
    function renderEditModal() {
        const unitLabel = getUnitLabel();
        m.innerHTML = `
        <div class="modal" style="max-width:600px;max-height:90vh;overflow-y:auto;">
          <div class="modal-header">
            <span class="modal-title">Edit Workout</span>
            <button class="modal-close" id="close-edit-workout">\u2715</button>
          </div>
          <div class="modal-body" style="padding:16px;">
            ${editExercises.map((ex, ei) => `
              <div style="margin-bottom:16px;border:1px solid var(--border);border-radius:var(--radius-md);padding:12px;">
                <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">
                  <span style="font-size:15px;font-weight:600;">${ex.exercise_name}</span>
                  <button class="btn btn-ghost btn-sm edit-remove-exercise" data-ei="${ei}" style="color:var(--danger);padding:4px 8px;font-size:11px;">Remove</button>
                </div>
                <div style="display:grid;grid-template-columns:28px 1fr 1fr 1fr 28px;gap:6px;align-items:center;font-size:11px;color:var(--text-tertiary);margin-bottom:4px;padding:0 2px;">
                  <span>#</span><span>Weight (${unitLabel})</span><span>Reps</span><span>RPE</span><span></span>
                </div>
                ${(ex.sets || []).map((s, si) => `
                  <div style="display:grid;grid-template-columns:28px 1fr 1fr 1fr 28px;gap:6px;align-items:center;margin-bottom:4px;">
                    <span style="font-size:12px;color:var(--text-tertiary);text-align:center;">${si+1}</span>
                    <input type="number" class="form-input edit-set-weight" data-ei="${ei}" data-si="${si}" value="${s._displayWeight || 0}" step="2.5" min="0" style="padding:6px 8px;font-size:13px;">
                    <input type="number" class="form-input edit-set-reps" data-ei="${ei}" data-si="${si}" value="${s.reps || 0}" step="1" min="0" style="padding:6px 8px;font-size:13px;">
                    <input type="number" class="form-input edit-set-rpe" data-ei="${ei}" data-si="${si}" value="${s.rpe || ""}" step="0.5" min="1" max="10" placeholder="\u2014" style="padding:6px 8px;font-size:13px;">
                    <button class="btn btn-ghost btn-sm edit-remove-set" data-ei="${ei}" data-si="${si}" style="color:var(--danger);padding:2px;font-size:11px;" title="Remove set">\u2715</button>
                  </div>
                `).join("")}
                <button class="btn btn-secondary btn-sm edit-add-set" data-ei="${ei}" style="margin-top:4px;width:100%;font-size:12px;padding:6px;">+ Add Set</button>
              </div>
            `).join("")}
            <button class="btn btn-secondary" id="edit-add-exercise" style="width:100%;margin-bottom:16px;">+ Add Exercise</button>
            <div style="display:flex;gap:8px;">
              <button class="btn btn-ghost" id="edit-cancel" style="flex:1;">Cancel</button>
              <button class="btn btn-primary" id="edit-save" style="flex:1;">Save Changes</button>
            </div>
          </div>
        </div>`;
        m.querySelector("#close-edit-workout").addEventListener("click", () => m.remove());
        m.querySelector("#edit-cancel").addEventListener("click", () => m.remove());
        m.addEventListener("click", ev => { if (ev.target === m) m.remove() });
        m.querySelectorAll(".edit-set-weight").forEach(inp => {
            inp.addEventListener("change", () => {
                const ei = +inp.dataset.ei, si = +inp.dataset.si, val = parseFloat(inp.value) || 0;
                editExercises[ei].sets[si]._displayWeight = val;
                editExercises[ei].sets[si].weight_kg = displayToKg(val)
            })
        });
        m.querySelectorAll(".edit-set-reps").forEach(inp => {
            inp.addEventListener("change", () => {
                editExercises[+inp.dataset.ei].sets[+inp.dataset.si].reps = parseInt(inp.value) || 0
            })
        });
        m.querySelectorAll(".edit-set-rpe").forEach(inp => {
            inp.addEventListener("change", () => {
                editExercises[+inp.dataset.ei].sets[+inp.dataset.si].rpe = parseFloat(inp.value) || null
            })
        });
        m.querySelectorAll(".edit-remove-set").forEach(btn => {
            btn.addEventListener("click", () => {
                const ei = +btn.dataset.ei, si = +btn.dataset.si;
                editExercises[ei].sets.splice(si, 1);
                editExercises[ei].sets.forEach((s, i) => s.set_number = i + 1);
                if (editExercises[ei].sets.length === 0) editExercises.splice(ei, 1);
                renderEditModal()
            })
        });
        m.querySelectorAll(".edit-remove-exercise").forEach(btn => {
            btn.addEventListener("click", () => {
                editExercises.splice(+btn.dataset.ei, 1);
                renderEditModal()
            })
        });
        m.querySelectorAll(".edit-add-set").forEach(btn => {
            btn.addEventListener("click", () => {
                const ei = +btn.dataset.ei, sets = editExercises[ei].sets;
                const last = sets.length > 0 ? sets[sets.length - 1] : null;
                sets.push({
                    set_number: sets.length + 1, weight_kg: last ? last.weight_kg : 0,
                    _displayWeight: last ? last._displayWeight : 0, reps: last ? last.reps : 0,
                    rpe: null, set_type: "working", completed: !0
                });
                renderEditModal()
            })
        });
        const addExBtn = m.querySelector("#edit-add-exercise");
        addExBtn && addExBtn.addEventListener("click", () => {
            m.remove();
            showExercisePickerForEdit(editExercises, workout, workoutId, container)
        });
        m.querySelector("#edit-save").addEventListener("click", async () => {
            if (editExercises.length === 0) return showToast("Add at least one exercise", "error");
            const hasSet = editExercises.some(ex => (ex.sets || []).length > 0);
            if (!hasSet) return showToast("Need at least one set", "error");
            const saveBtn = m.querySelector("#edit-save");
            saveBtn.disabled = !0; saveBtn.textContent = "Saving...";
            const ok = await sbUpdateWorkout(workoutId, editExercises);
            m.remove();
            if (ok) {
                showToast("Workout updated!");
                if (!isDemoMode && supabaseClient && AppState.user) { await sbLoadWorkouts(); await sbLoadPersonalRecords() }
                renderWorkoutDetail(container, workoutId)
            }
        })
    }
    renderEditModal();
    document.body.appendChild(m)
}
function showExercisePickerForEdit(editExercises, workout, workoutId, container) {
    const m = document.createElement("div");
    m.className = "modal-overlay";
    m.id = "edit-exercise-picker";
    let searchTerm = "";
    function renderPicker() {
        let exercises = AppState.exercises;
        if (searchTerm) {
            const q = searchTerm.toLowerCase();
            exercises = exercises.filter(e => e.name.toLowerCase().includes(q) || (e.muscle_group || "").includes(q))
        }
        m.innerHTML = `
        <div class="modal" style="max-width:500px;max-height:80vh;overflow-y:auto;">
          <div class="modal-header">
            <span class="modal-title">Add Exercise</span>
            <button class="modal-close" id="close-edit-picker">\u2715</button>
          </div>
          <div class="modal-body">
            <div class="search-bar" style="margin-bottom:12px;">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
              <input type="text" placeholder="Search exercises..." value="${searchTerm}" id="edit-picker-search">
            </div>
            <div class="modal-exercise-list">
              ${exercises.map(e => `
                <div class="modal-exercise-item" data-eid="${e.id}" data-ename="${e.name.replace(/"/g,"&quot;")}" data-emg="${e.muscle_group || "other"}" style="cursor:pointer;padding:10px;border-bottom:1px solid var(--border);">
                  <div style="font-weight:600;font-size:14px;">${e.name}</div>
                  <div style="font-size:12px;color:var(--text-tertiary);text-transform:capitalize;">${e.muscle_group || "other"} \u00b7 ${e.equipment || "N/A"}</div>
                </div>
              `).join("")}
            </div>
          </div>
        </div>`;
        function goBack() { m.remove(); showEditWorkoutModal(Object.assign({}, workout, { exercises: editExercises }), workoutId, container) }
        m.querySelector("#close-edit-picker").addEventListener("click", goBack);
        m.addEventListener("click", ev => { if (ev.target === m) goBack() });
        const search = m.querySelector("#edit-picker-search");
        search && search.addEventListener("input", e => {
            searchTerm = e.target.value; renderPicker();
            setTimeout(() => { const s = m.querySelector("#edit-picker-search"); s && (s.focus(), s.setSelectionRange(s.value.length, s.value.length)) }, 0)
        });
        m.querySelectorAll(".modal-exercise-item").forEach(item => {
            item.addEventListener("click", () => {
                editExercises.push({
                    exercise_id: item.dataset.eid, exercise_name: item.dataset.ename,
                    muscle_group: item.dataset.emg,
                    sets: [{ set_number: 1, weight_kg: 0, _displayWeight: 0, reps: 0, rpe: null, set_type: "working", completed: !0 }]
                });
                m.remove();
                showEditWorkoutModal(Object.assign({}, workout, { exercises: editExercises }), workoutId, container)
            })
        })
    }
    renderPicker();
    document.body.appendChild(m)
}
function showCreateExerciseModal(onCreated) {
    const m = document.createElement("div");
    m.className = "modal-overlay", m.id = "create-exercise-modal";
    const equipList = ["barbell", "dumbbell", "cable", "machine", "bodyweight", "kettlebell", "band", "other"];
    m.innerHTML = `
      <div class="modal">
        <div class="modal-header">
          <span class="modal-title">Create Custom Exercise</span>
          <button class="modal-close" id="close-create-ex">✕</button>
        </div>
        <div class="modal-body">
          <form id="create-exercise-form">
            <div class="form-group">
              <label class="form-label">Exercise Name *</label>
              <input type="text" class="form-input" id="ce-name" required placeholder="e.g., Bulgarian Split Squat">
            </div>
            <div class="form-group">
              <label class="form-label">Muscle Group *</label>
              <select class="form-select" id="ce-muscle" required>
                <option value="">Select...</option>
                ${ALL_MUSCLE_GROUPS.map(g => `<option value="${g}">${formatMuscleGroupLabel(g)}</option>`).join("")}
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Equipment *</label>
              <select class="form-select" id="ce-equipment" required>
                ${equipList.map(eq => `<option value="${eq}" style="text-transform:capitalize;">${eq.charAt(0).toUpperCase() + eq.slice(1)}</option>`).join("")}
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Type</label>
              <select class="form-select" id="ce-modality">
                <option value="reps">Reps-based</option>
                <option value="timed">Time-based (seconds)</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Description <span style="font-size:11px;color:var(--text-tertiary);font-weight:400;">(optional)</span></label>
              <input type="text" class="form-input" id="ce-desc" placeholder="Brief description...">
            </div>
            <div id="ce-error" style="color:var(--danger);font-size:13px;margin-bottom:12px;display:none;"></div>
            <button type="submit" class="btn btn-primary w-full">Create Exercise</button>
          </form>
        </div>
      </div>
    `;
    document.body.appendChild(m);
    m.querySelector("#close-create-ex").addEventListener("click", () => m.remove());
    m.addEventListener("click", e => { e.target === m && m.remove() });
    m.querySelector("#create-exercise-form").addEventListener("submit", async ev => {
        ev.preventDefault();
        const name = m.querySelector("#ce-name").value.trim(),
            muscle = m.querySelector("#ce-muscle").value,
            equip = m.querySelector("#ce-equipment").value,
            modality = m.querySelector("#ce-modality").value,
            desc = m.querySelector("#ce-desc").value.trim(),
            errEl = m.querySelector("#ce-error");
        if (!name) return errEl.textContent = "Name is required", void(errEl.style.display = "block");
        if (AppState.exercises.some(e => e.name.toLowerCase() === name.toLowerCase()))
            return errEl.textContent = "An exercise with this name already exists", void(errEl.style.display = "block");
        const ex = await sbSaveCustomExercise({
            name, muscle_group: muscle, equipment: equip,
            exercise_type: "compound", description: desc, exercise_modality: modality
        });
        m.remove();
        showToast(`Created "${ex.name}"`);
        if (onCreated) onCreated(ex);
    });
    setTimeout(() => { const inp = m.querySelector("#ce-name"); inp && inp.focus() }, 100);
}
function renderExerciseLibrary(e) {
    let t = "",
        a = "";
    ! function render() {
        let s = AppState.exercises;
        if (t) {
            const e = t.toLowerCase();
            s = s.filter(t => t.name.toLowerCase().includes(e) || (t.muscle_group || "").toLowerCase().includes(e) || (t.equipment || "").toLowerCase().includes(e) || (t.description || "").toLowerCase().includes(e))
        }
        a && (s = s.filter(e => e.muscle_group === a));
        const n = {};
        s.forEach(e => {
            const t = e.muscle_group || "other";
            n[t] || (n[t] = []), n[t].push(e)
        });
        const i = ALL_MUSCLE_GROUPS.filter(e => n[e]);
        Object.keys(n).forEach(e => {
            i.includes(e) || i.push(e)
        }), e.innerHTML = `\n      <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;margin-bottom:8px;">\n        <div>\n          <div class="page-title">Exercise Library</div>\n          <div class="page-subtitle">${AppState.exercises.length} exercises available</div>\n        </div>\n        <button class="btn btn-primary btn-sm" id="lib-create-custom">+ Create Custom</button>\n      </div>\n\n      <div class="search-bar">\n        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>\n        <input type="text" placeholder="Search by name, muscle group, or equipment..." value="${t}" id="exercise-search">\n      </div>\n\n      <div class="filter-row">\n        <button class="filter-chip ${""===a?"active":""}" data-group="">All</button>\n        ${ALL_MUSCLE_GROUPS.map(e=>`<button class="filter-chip ${a===e?"active":""}" data-group="${e}">${formatMuscleGroupLabel(e)}</button>`).join("")}\n      </div>\n\n      ${0===i.length?'\n        <div class="empty-state" style="padding:48px;">\n          <div class="empty-state-icon">🔍</div>\n          <div class="empty-state-title">No exercises found</div>\n          <div class="empty-state-text">Try a different search term or filter.</div>\n        </div>\n      ':i.map(e=>`\n        <div style="margin-bottom:24px;">\n          <h3 style="text-transform:capitalize;font-size:16px;margin-bottom:12px;display:flex;align-items:center;gap:8px;">\n            ${getMuscleGroupIcon(e)} ${formatMuscleGroupLabel(e)}\n            <span style="font-size:12px;color:var(--text-tertiary);font-weight:400;">(${n[e].length})</span>\n          </h3>\n          <div class="exercise-grid">\n            ${n[e].map(e=>{const t=AppState.personalRecords[e.id];return`\n                <div class="exercise-card">\n                  <div class="exercise-card-icon" style="background:var(--accent-glow);border-radius:var(--radius-md);">${getEquipmentIcon(e.equipment)}</div>\n                  <div class="exercise-card-info">\n                    <div class="exercise-card-name">${e.name}${e.is_custom?' <span style="font-size:10px;background:var(--accent-glow);color:var(--accent);padding:1px 6px;border-radius:8px;font-weight:600;">Custom</span>':""}</div>\n                    <div class="exercise-card-detail">\n                      <span style="text-transform:capitalize;">${e.equipment||"N/A"}</span>\n                      <span style="color:var(--text-tertiary);margin:0 4px;">·</span>\n                      <span style="text-transform:capitalize;">${e.exercise_type||""}</span>\n                      ${t?`<span style="color:var(--text-tertiary);margin:0 4px;">·</span><span class="text-accent">PR: ${formatWeight(t.max_weight)}</span>`:""}\n                    </div>\n                    ${e.description?`<div style="font-size:11px;color:var(--text-tertiary);margin-top:4px;line-height:1.4;">${e.description}</div>`:""}\n                  </div>\n                </div>\n              `}).join("")}\n          </div>\n        </div>\n      `).join("")}\n    `, document.getElementById("exercise-search").addEventListener("input", e => {
            t = e.target.value, render(), setTimeout(() => {
                const e = document.getElementById("exercise-search");
                e && (e.focus(), e.setSelectionRange(e.value.length, e.value.length))
            }, 0)
        }), e.querySelectorAll(".filter-chip").forEach(e => {
            e.addEventListener("click", () => {
                a = e.dataset.group, render()
            })
        });
        const ccBtn = document.getElementById("lib-create-custom");
        ccBtn && ccBtn.addEventListener("click", () => {
            showCreateExerciseModal(() => render())
        })
    }()
}
function renderAIPlanGenerator(e) {
    let t = !1,
        a = AppState.generatedPlan || null;
    function render() {
        if (t && a) return void renderPlanOutput();
        e.innerHTML = `\n      <div class="page-title">AI Plan Generator</div>\n      <div class="page-subtitle">Get a custom training plan tailored to your goals</div>\n\n      ${AppState.savedPlans.length>0?`\n        <div class="card" style="margin-bottom:24px;">\n          <div class="card-header">\n            <div class="card-title">💾 My Plans</div>\n            <span style="font-size:12px;color:var(--text-tertiary);">${AppState.savedPlans.length} saved</span>\n          </div>\n          <div style="display:flex;flex-direction:column;gap:10px;">\n            ${AppState.savedPlans.map((e,t)=>`\n              <div style="display:flex;align-items:center;justify-content:space-between;padding:10px;background:var(--bg-elevated);border-radius:var(--radius-md);">\n                <div>\n                  <div style="font-weight:700;font-size:14px;">${e.name}</div>\n                  <div style="font-size:12px;color:var(--text-secondary);">${e.days.length}-day · ${e.goal}</div>\n                </div>\n                <div style="display:flex;gap:8px;">\n                  <button class="btn btn-secondary btn-sm load-plan-btn" data-idx="${t}">Load</button>\n                  <button class="btn btn-secondary btn-sm send-saved-plan-btn" data-idx="${t}" title="Send to friend" style="padding:6px 8px;">\n                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M22 2L11 13"/><path d="M22 2L15 22l-4-9-9-4 20-7z"/></svg>\n                  </button>\n                  <button class="btn btn-ghost btn-sm delete-plan-btn" data-idx="${t}" style="color:var(--danger);">Delete</button>\n                </div>\n              </div>\n            `).join("")}\n          </div>\n        </div>\n      `:""}\n\n      <div class="card" style="max-width:560px;">\n        <form id="plan-form">\n          <div class="form-group">\n            <label class="form-label">Training Goal</label>\n            <select class="form-select" id="plan-goal" required>\n              <option value="">Select a goal</option>\n              <option value="strength" ${"strength"===AppState.profile.goal?"selected":""}>Strength</option>\n              <option value="hypertrophy" ${"hypertrophy"===AppState.profile.goal?"selected":""}>Muscle Growth (Hypertrophy)</option>\n              <option value="endurance" ${"endurance"===AppState.profile.goal?"selected":""}>Muscular Endurance</option>\n              <option value="fat_loss" ${"fat_loss"===AppState.profile.goal?"selected":""}>Fat Loss</option>\n              <option value="general" ${"general"===AppState.profile.goal?"selected":""}>General Fitness</option>\n            </select>\n          </div>\n          <div class="form-group">\n            <label class="form-label">Days Per Week</label>\n            <select class="form-select" id="plan-days" required>\n              <option value="3">3 days</option>\n              <option value="4" selected>4 days</option>\n              <option value="5">5 days</option>\n              <option value="6">6 days</option>\n            </select>\n          </div>\n          <div class="form-group">\n            <label class="form-label">Experience Level</label>\n            <select class="form-select" id="plan-exp" required>\n              <option value="beginner" ${"beginner"===AppState.profile.experience?"selected":""}>Beginner</option>\n              <option value="intermediate" ${"intermediate"===AppState.profile.experience?"selected":""}>Intermediate</option>\n              <option value="advanced" ${"advanced"===AppState.profile.experience?"selected":""}>Advanced</option>\n            </select>\n          </div>\n          <div class="form-group">\n            <label class="form-label">Available Equipment</label>\n            <div class="option-grid" id="plan-equipment" style="margin-top:4px;">\n              ${["barbell","dumbbell","cable","machine","bodyweight"].map(e=>`\n                <div class="option-card ${(AppState.profile.equipment||[]).includes(e)?"selected":""}" data-value="${e}" style="padding:10px;">\n                  <div style="font-size:16px;">${getEquipmentIcon(e)}</div>\n                  <div style="text-transform:capitalize;font-size:12px;">${e}</div>\n                </div>\n              `).join("")}\n            </div>\n          </div>\n          <button type="submit" class="btn btn-primary w-full btn-lg">\n            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>\n            Generate Plan\n          </button>\n        </form>\n      </div>\n    `;
        let s = [...AppState.profile.equipment || []];
        e.querySelectorAll("#plan-equipment .option-card").forEach(e => {
            e.addEventListener("click", () => {
                const t = e.dataset.value,
                    a = s.indexOf(t);
                a >= 0 ? (s.splice(a, 1), e.classList.remove("selected")) : (s.push(t), e.classList.add("selected"))
            })
        }), document.getElementById("plan-form").addEventListener("submit", n => {
            n.preventDefault();
            const i = document.getElementById("plan-goal").value,
                o = parseInt(document.getElementById("plan-days").value),
                r = document.getElementById("plan-exp").value;
            e.innerHTML = `\n        <div class="generating-animation">\n          <div class="generating-spinner"></div>\n          <div class="generating-text">Generating your plan...</div>\n          <div class="generating-sub">AI is crafting a ${o}-day ${i} program</div>\n        </div>\n      `, setTimeout(async () => {
                a = generateMockPlan(i, o, r, s), a.experience = r, a.equipment = s;
                const e = await sbSavePlan(a);
                e && (a = e), AppState.generatedPlan = a, t = !0, renderPlanOutput()
            }, 2e3)
        }), e.querySelectorAll(".load-plan-btn").forEach(e => {
            e.addEventListener("click", () => {
                const s = parseInt(e.dataset.idx);
                a = AppState.savedPlans[s], AppState.generatedPlan = a, t = !0, renderPlanOutput()
            })
        }), e.querySelectorAll(".delete-plan-btn").forEach(e => {
            e.addEventListener("click", async () => {
                const t = parseInt(e.dataset.idx),
                    a = AppState.savedPlans[t];
                a && (e.disabled = !0, e.textContent = "...", await sbDeletePlan(a.id || a.db_id), render(), showToast("Plan deleted"))
            })
        }), e.querySelectorAll(".send-saved-plan-btn").forEach(e => {
            e.addEventListener("click", () => {
                const t = parseInt(e.dataset.idx),
                    a = AppState.savedPlans[t];
                a && showFriendPickerModal("Send Plan to Friend", async (e, t) => {
                    await sbSharePlan(a, e, t)
                })
            })
        })
    }
    function renderPlanOutput() {
        e.innerHTML = `\n      <div class="page-header-back">\n        <button class="back-btn" id="back-to-generator">\n          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>\n        </button>\n        <div>\n          <div class="page-title" style="margin-bottom:0;">${a.name}</div>\n          <div style="font-size:13px;color:var(--text-secondary);">${a.days.length}-day program · ${a.goal}</div>\n        </div>\n      </div>\n\n      <div class="badge badge-accent mb-4">AI Generated Plan</div>\n\n      <div class="plan-output" id="plan-output">\n        ${a.days.map((e,t)=>`\n          <div class="plan-day">\n            <div class="plan-day-header" style="display:flex;align-items:center;justify-content:space-between;">\n              <span>${e.name}</span>\n              <button class="btn btn-primary btn-sm" onclick="startAIWorkoutDay(${t})">\n                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><polygon points="5 3 19 12 5 21 5 3"/></svg>\n                Start This Day\n              </button>\n            </div>\n            ${e.exercises.map((e,a)=>`\n              <div class="plan-exercise-row" id="plan-ex-${t}-${a}">\n                <div style="flex:1;">\n                  <div class="plan-exercise-name">${e.name}</div>\n                  <div class="plan-exercise-detail">${formatMuscleGroupLabel(e.muscle_group)}</div>\n                </div>\n                <div style="text-align:right;display:flex;align-items:center;gap:8px;">\n                  <div>\n                    <div style="font-weight:600;font-size:13px;">${e.sets} × ${e.reps}</div>\n                    <div style="font-size:11px;color:var(--text-tertiary);">${e.rest}</div>\n                  </div>\n                  <button class="btn btn-ghost btn-sm swap-btn" onclick="showSwapPicker(${t},${a})" title="Swap exercise" style="padding:6px;">\n                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><path d="M7 16V4m0 0L3 8m4-4l4 4M17 8v12m0 0l4-4m-4 4l-4-4"/></svg>\n                  </button>\n                </div>\n              </div>\n            `).join("")}\n          </div>\n        `).join("")}\n      </div>\n\n      <div style="display:flex;gap:10px;margin-top:24px;flex-wrap:wrap;">\n        <button class="btn btn-secondary" id="generate-another-btn">Generate Another</button>\n        <button class="btn btn-primary" id="start-full-plan-btn">\n          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><polygon points="5 3 19 12 5 21 5 3"/></svg>\n          Start Day 1\n        </button>\n        <button class="btn btn-secondary" id="send-plan-btn">\n          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><path d="M22 2L11 13"/><path d="M22 2L15 22l-4-9-9-4 20-7z"/></svg>\n          Send to Friend\n        </button>\n        <button class="btn btn-ghost" id="copy-plan-btn" style="color:var(--text-secondary);">\n          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>\n          Copy\n        </button>\n      </div>\n    `, document.getElementById("back-to-generator").addEventListener("click", () => {
            t = !1, a = null, AppState.generatedPlan = null, render()
        }), document.getElementById("generate-another-btn").addEventListener("click", () => {
            t = !1, a = null, AppState.generatedPlan = null, render()
        }), document.getElementById("start-full-plan-btn").addEventListener("click", () => {
            startAIWorkoutDay(0)
        }), document.getElementById("send-plan-btn").addEventListener("click", () => {
            showFriendPickerModal("Send Plan to Friend", async (e, t) => {
                await sbSharePlan(a, e, t)
            })
        }), document.getElementById("copy-plan-btn").addEventListener("click", () => {
            const e = shareAIPlan(a);
            navigator.clipboard ? navigator.clipboard.writeText(e).then(() => showToast("Plan copied to clipboard!")).catch(() => showToast("Copy failed", "error")) : showToast("Clipboard not available", "error")
        })
    }
    a && (t = !0), window.startAIWorkoutDay = e => {
        const t = a.days[e];
        if (!t) return;
        clearInterval(AppState.activeWorkoutTimer);
        const s = t.exercises.map(e => {
            const t = AppState.exercises.find(t => t.name === e.name),
                a = t ? t.id : generateId(),
                s = `${e.sets} × ${e.reps}`,
                n = parseInt(e.sets) || 3;
            return {
                exercise_id: a,
                exercise_name: e.name,
                muscle_group: e.muscle_group,
                _aiTarget: s,
                sets: Array.from({
                    length: n
                }, (e, t) => ({
                    set_number: t + 1,
                    weight_kg: 0,
                    _displayWeight: 0,
                    reps: 0,
                    rpe: null,
                    set_type: "working",
                    completed: !1
                }))
            }
        });
        AppState.activeWorkout = {
            id: generateId(),
            name: t.name,
            exercises: s,
            startTime: null,
            is_ai_generated: !0
        }, AppState.activeWorkoutStartTime = null, AppState.activeWorkoutPaused = !1, AppState.activeWorkoutElapsedBeforePause = 0, showToast(`Plan ready: "${t.name}" — tap Start when you're ready to begin!`), window.location.hash = "#/workout/new"
    }, window.showSwapPicker = (e, t) => {
        const s = a.days[e].exercises[t],
            n = s.muscle_group,
            i = document.createElement("div");
        i.className = "modal-overlay";
        let o = "";
        ! function renderSwapModal() {
            let r = AppState.exercises.filter(e => e.muscle_group === n && e.name !== s.name);
            if (o) {
                const e = o.toLowerCase();
                r = r.filter(t => t.name.toLowerCase().includes(e) || (t.equipment || "").toLowerCase().includes(e))
            }
            i.innerHTML = `\n        <div class="modal">\n          <div class="modal-header">\n            <span class="modal-title">Swap: ${s.name}</span>\n            <button class="modal-close" id="close-swap">✕</button>\n          </div>\n          <div class="modal-body">\n            <div style="font-size:12px;color:var(--text-secondary);margin-bottom:12px;">Showing ${formatMuscleGroupLabel(n)} alternatives</div>\n            <div class="search-bar" style="margin-bottom:12px;">\n              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>\n              <input type="text" placeholder="Search alternatives..." value="${o}" id="swap-search">\n            </div>\n            <div class="modal-exercise-list">\n              ${r.map(e=>`\n                <div class="modal-exercise-item" data-ename="${e.name}" data-emg="${e.muscle_group}">\n                  <div class="exercise-card-icon" style="background:var(--accent-glow);border-radius:var(--radius-md);">${getMuscleGroupIcon(e.muscle_group)}</div>\n                  <div class="exercise-card-info">\n                    <div class="exercise-card-name">${e.name}</div>\n                    <div class="exercise-card-detail"><span style="text-transform:capitalize;">${e.equipment||""}</span> · <span style="text-transform:capitalize;">${e.exercise_type||""}</span></div>\n                    ${e.description?`<div style="font-size:11px;color:var(--text-tertiary);margin-top:2px;">${e.description}</div>`:""}\n                  </div>\n                </div>\n              `).join("")}\n              ${0===r.length?'<div style="padding:20px;text-align:center;color:var(--text-tertiary);font-size:13px;">No alternatives found</div>':""}\n            </div>\n          </div>\n        </div>\n      `, i.querySelector("#close-swap").addEventListener("click", () => i.remove()), i.addEventListener("click", e => {
                e.target === i && i.remove()
            }), i.querySelector("#swap-search").addEventListener("input", e => {
                o = e.target.value, renderSwapModal(), setTimeout(() => {
                    const e = i.querySelector("#swap-search");
                    e && (e.focus(), e.setSelectionRange(e.value.length, e.value.length))
                }, 0)
            }), i.querySelectorAll(".modal-exercise-item").forEach(s => {
                s.addEventListener("click", () => {
                    a.days[e].exercises[t].name = s.dataset.ename, a.days[e].exercises[t].muscle_group = s.dataset.emg, AppState.generatedPlan = a, i.remove(), showToast(`Swapped to ${s.dataset.ename}`), renderPlanOutput()
                })
            })
        }(), document.body.appendChild(i), setTimeout(() => {
            const e = i.querySelector("#swap-search");
            e && e.focus()
        }, 100)
    }, render()
}
function generateMockPlan(e, t, a, s) {
    const n = {
            strength: {
                name: "Forge Strength Protocol",
                templates: [{
                    name: "Day 1 — Heavy Upper",
                    focus: ["chest", "shoulders", "arms"]
                }, {
                    name: "Day 2 — Heavy Lower",
                    focus: ["legs", "core"]
                }, {
                    name: "Day 3 — Upper Hypertrophy",
                    focus: ["back", "shoulders", "arms"]
                }, {
                    name: "Day 4 — Lower Hypertrophy",
                    focus: ["legs", "core"]
                }, {
                    name: "Day 5 — Full Body Power",
                    focus: ["chest", "back", "legs"]
                }, {
                    name: "Day 6 — Accessory Work",
                    focus: ["arms", "shoulders", "core"]
                }]
            },
            hypertrophy: {
                name: "Iron Gains Blueprint",
                templates: [{
                    name: "Day 1 — Chest & Triceps",
                    focus: ["chest", "arms"]
                }, {
                    name: "Day 2 — Back & Biceps",
                    focus: ["back", "arms"]
                }, {
                    name: "Day 3 — Legs",
                    focus: ["legs", "core"]
                }, {
                    name: "Day 4 — Shoulders & Arms",
                    focus: ["shoulders", "arms"]
                }, {
                    name: "Day 5 — Upper Body",
                    focus: ["chest", "back"]
                }, {
                    name: "Day 6 — Lower Body",
                    focus: ["legs", "core"]
                }]
            },
            endurance: {
                name: "Endurance Forge",
                templates: [{
                    name: "Day 1 — Full Body Circuit",
                    focus: ["chest", "back", "legs"]
                }, {
                    name: "Day 2 — Upper Endurance",
                    focus: ["chest", "shoulders", "arms"]
                }, {
                    name: "Day 3 — Lower Endurance",
                    focus: ["legs", "core"]
                }, {
                    name: "Day 4 — Push Circuit",
                    focus: ["chest", "shoulders"]
                }, {
                    name: "Day 5 — Pull Circuit",
                    focus: ["back", "arms"]
                }, {
                    name: "Day 6 — Legs & Core",
                    focus: ["legs", "core"]
                }]
            },
            fat_loss: {
                name: "Shred Protocol",
                templates: [{
                    name: "Day 1 — Full Body A",
                    focus: ["chest", "back", "legs"]
                }, {
                    name: "Day 2 — Full Body B",
                    focus: ["shoulders", "legs", "core"]
                }, {
                    name: "Day 3 — Upper Focus",
                    focus: ["chest", "back", "arms"]
                }, {
                    name: "Day 4 — Lower Focus",
                    focus: ["legs", "core"]
                }, {
                    name: "Day 5 — Metabolic",
                    focus: ["chest", "back", "legs"]
                }, {
                    name: "Day 6 — Arms & Core",
                    focus: ["arms", "core"]
                }]
            },
            general: {
                name: "General Fitness Plan",
                templates: [{
                    name: "Day 1 — Push",
                    focus: ["chest", "shoulders", "arms"]
                }, {
                    name: "Day 2 — Pull",
                    focus: ["back", "arms"]
                }, {
                    name: "Day 3 — Legs",
                    focus: ["legs", "core"]
                }, {
                    name: "Day 4 — Upper Body",
                    focus: ["chest", "back", "shoulders"]
                }, {
                    name: "Day 5 — Lower Body",
                    focus: ["legs", "core"]
                }, {
                    name: "Day 6 — Full Body",
                    focus: ["chest", "back", "legs"]
                }]
            }
        },
        i = n[e] || n.general,
        o = i.templates.slice(0, t),
        r = {
            strength: {
                sets: "4-5",
                reps: "3-6",
                rest: "Rest 3-5 min"
            },
            hypertrophy: {
                sets: "3-4",
                reps: "8-12",
                rest: "Rest 60-90s"
            },
            endurance: {
                sets: "3",
                reps: "15-20",
                rest: "Rest 30-45s"
            },
            fat_loss: {
                sets: "3-4",
                reps: "10-15",
                rest: "Rest 45-60s"
            },
            general: {
                sets: "3",
                reps: "8-12",
                rest: "Rest 60-90s"
            }
        },
        l = r[e] || r.general;
    return {
        name: i.name,
        goal: e,
        days: o.map(e => ({
            name: e.name,
            exercises: getExercisesForGroups(e.focus, s, "beginner" === a ? 3 : "intermediate" === a ? 4 : 5).map(e => ({
                name: e.name,
                exercise_id: e.id,
                muscle_group: e.muscle_group,
                sets: l.sets,
                reps: l.reps,
                rest: l.rest
            }))
        }))
    }
}
function getExercisesForGroups(e, t, a) {
    let s = AppState.exercises.filter(t => e.includes(t.muscle_group));
    t && t.length > 0 && (s = s.filter(e => t.includes(e.equipment))), s.length < a && (s = AppState.exercises.filter(t => e.includes(t.muscle_group)));
    return s.sort(() => Math.random() - .5).slice(0, a)
}
function renderSocial(e) {
    let t = "friends";
    ! function render() {
        const a = AppState.friends.filter(e => "accepted" === e.status),
            s = AppState.friends.filter(e => "pending_received" === e.status),
            n = AppState.friends.filter(e => "pending_sent" === e.status),
            i = AppState.sharedPlans.filter(e => "pending" === e.status);
        e.innerHTML = `\n      <div class="page-title">Social</div>\n      <div class="page-subtitle">Connect with training partners, create accountability pacts</div>\n\n      <div class="tab-nav" style="margin-bottom:24px;">\n        <button class="tab-btn ${"friends"===t?"active":""}" data-tab="friends">\n          Friends ${s.length>0?`<span class="badge-count">${s.length}</span>`:""}\n        </button>\n        <button class="tab-btn ${"plans"===t?"active":""}" data-tab="plans">\n          Plans ${i.length>0?`<span class="badge-count">${i.length}</span>`:""}\n        </button>\n        <button class="tab-btn ${"pacts"===t?"active":""}" data-tab="pacts">\n          Pacts <span class="badge-count">${AppState.pacts.length}</span>\n        </button>\n        <button class="tab-btn ${"add"===t?"active":""}" data-tab="add">\n          Add Friends\n        </button>\n      </div>\n\n      ${"friends"===t?function renderFriendsTab(e,t,a){return`\n      ${t.length>0?`\n        <div class="card" style="margin-bottom:20px;">\n          <div class="card-header"><h3 class="card-title">Pending Requests</h3></div>\n          ${t.map(e=>`\n            <div class="friend-row">\n              <div class="friend-avatar">${(e.display_name||e.username||"?")[0].toUpperCase()}</div>\n              <div class="friend-info">\n                <div class="friend-name">${e.display_name||e.username}</div>\n                <div class="friend-meta">@${e.username||"user"} wants to be friends</div>\n              </div>\n              <div style="display:flex;gap:8px;">\n                <button class="btn btn-primary btn-sm" data-accept-id="${e.id}">Accept</button>\n                <button class="btn btn-ghost btn-sm" data-remove-id="${e.id}">Decline</button>\n              </div>\n            </div>\n          `).join("")}\n        </div>\n      `:""}\n\n      <div class="card">\n        <div class="card-header"><h3 class="card-title">Friends (${e.length})</h3></div>\n        ${0===e.length?'\n          <div class="empty-state" style="padding:32px;">\n            <div class="empty-state-icon">👥</div>\n            <div class="empty-state-title">No friends yet</div>\n            <div class="empty-state-text">Add friends to see their progress and create pacts together.</div>\n          </div>\n        ':e.map(e=>`\n          <div class="friend-row friend-row-clickable" data-view-friend="${e.id}" style="cursor:pointer;">\n            <div class="friend-avatar">${(e.display_name||e.username||"?")[0].toUpperCase()}</div>\n            <div class="friend-info">\n              <div class="friend-name">${e.display_name||e.username}</div>\n              <div class="friend-meta">@${e.username||"user"} · ${e.workouts_count||0} workouts · ${e.streak||0} day streak</div>\n            </div>\n            <button class="btn btn-ghost btn-sm" data-remove-id="${e.id}" style="color:var(--text-tertiary);" onclick="event.stopPropagation()">Remove</button>\n          </div>\n        `).join("")}\n      </div>\n\n      ${a.length>0?`\n        <div class="card" style="margin-top:20px;">\n          <div class="card-header"><h3 class="card-title">Sent Requests</h3></div>\n          ${a.map(e=>`\n            <div class="friend-row">\n              <div class="friend-avatar">${(e.display_name||e.username||"?")[0].toUpperCase()}</div>\n              <div class="friend-info">\n                <div class="friend-name">${e.display_name||e.username}</div>\n                <div class="friend-meta">Request pending...</div>\n              </div>\n              <button class="btn btn-ghost btn-sm" data-remove-id="${e.id}" style="color:var(--text-tertiary);">Cancel</button>\n            </div>\n          `).join("")}\n        </div>\n      `:""}\n    `}(a,s,n):""}\n      ${"plans"===t?function renderSharedPlansTab(e){const t=AppState.sharedPlans;return`\n      <div class="card">\n        <div class="card-header"><h3 class="card-title">Received Plans</h3></div>\n        ${0===t.length?'\n          <div class="empty-state" style="padding:32px;">\n            <div class="empty-state-icon" style="font-size:32px;">&#9993;</div>\n            <div class="empty-state-title">No plans received</div>\n            <div class="empty-state-text">When friends send you training plans, they\'ll appear here.</div>\n          </div>\n        ':t.map(e=>{const t=e.plan_data?.days?.length||"?",a=e.plan_data?.goal||"General",s=formatDate(e.created_at);return`\n            <div class="shared-plan-row" style="padding:16px;border-bottom:1px solid var(--border-subtle);">\n              <div style="display:flex;align-items:flex-start;gap:12px;">\n                <div class="friend-avatar" style="width:40px;height:40px;font-size:16px;flex-shrink:0;">${(e.sender_display_name||"?")[0].toUpperCase()}</div>\n                <div style="flex:1;min-width:0;">\n                  <div style="font-weight:700;font-size:14px;">${e.plan_name}</div>\n                  <div style="font-size:12px;color:var(--text-secondary);margin-top:2px;">From @${e.sender_username} &middot; ${t}-day &middot; ${a} &middot; ${s}</div>\n                  ${e.message?`<div style="font-size:13px;color:var(--text-secondary);margin-top:6px;font-style:italic;">&quot;${e.message}&quot;</div>`:""}\n                  <div style="display:flex;gap:8px;margin-top:10px;">\n                    <button class="btn btn-primary btn-sm" data-accept-plan-id="${e.id}">Save to My Plans</button>\n                    <button class="btn btn-secondary btn-sm" data-preview-plan-id="${e.id}">Preview</button>\n                    <button class="btn btn-ghost btn-sm" data-dismiss-plan-id="${e.id}" style="color:var(--text-tertiary);">Dismiss</button>\n                  </div>\n                </div>\n              </div>\n            </div>\n          `}).join("")}\n      </div>\n    `}():""}\n      ${"pacts"===t?function renderPactsTab(){return`\n      <div style="margin-bottom:24px;">\n        <div class="card">\n          <div class="card-header">\n            <h3 class="card-title">Create a Pact</h3>\n          </div>\n          <form id="create-pact-form">\n            <div class="form-group">\n              <label class="form-label">Pact Name</label>\n              <input type="text" class="form-input" id="pact-name" placeholder="e.g., Iron Crew January" required>\n            </div>\n            <div class="form-group">\n              <label class="form-label">Description</label>\n              <input type="text" class="form-input" id="pact-desc" placeholder="What's the mission?">\n            </div>\n            <div class="form-row" style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">\n              <div class="form-group" style="margin-bottom:0;">\n                <label class="form-label">Goal Type</label>\n                <select class="form-select" id="pact-goal-type">\n                  <option value="workouts_per_week">Workouts Per Week</option>\n                  <option value="total_volume">Total Volume</option>\n                  <option value="streak_days">Streak Days</option>\n                  <option value="custom">Custom</option>\n                </select>\n              </div>\n              <div class="form-group" style="margin-bottom:0;">\n                <label class="form-label">Target</label>\n                <input type="number" class="form-input" id="pact-goal-target" value="4" min="1">\n              </div>\n            </div>\n            <button type="submit" class="btn btn-primary w-full" style="margin-top:16px;">\n              Create Pact\n            </button>\n          </form>\n        </div>\n      </div>\n\n      ${0===AppState.pacts.length?'\n        <div class="empty-state" style="padding:48px;">\n          <div class="empty-state-icon">🤝</div>\n          <div class="empty-state-title">No active pacts</div>\n          <div class="empty-state-text">Create a pact with friends to stay accountable together.</div>\n        </div>\n      ':AppState.pacts.map(e=>`\n        <div class="pact-card card" onclick="window.location.hash='#/social/pact/${e.id}'" style="cursor:pointer;margin-bottom:16px;">\n          <div class="pact-card-header">\n            <div>\n              <div class="pact-card-name">${e.name}</div>\n              <div class="pact-card-meta">${e.description||""}</div>\n            </div>\n            <div class="pact-card-badge ${e.is_active?"active":"inactive"}">${e.is_active?"Active":"Ended"}</div>\n          </div>\n          <div class="pact-stats">\n            <div class="pact-stat">\n              <div class="pact-stat-value">${e.member_count||(e.members||[]).length}</div>\n              <div class="pact-stat-label">Members</div>\n            </div>\n            <div class="pact-stat">\n              <div class="pact-stat-value">${formatGoalType(e.goal_type)}</div>\n              <div class="pact-stat-label">Goal Type</div>\n            </div>\n            <div class="pact-stat">\n              <div class="pact-stat-value">${e.goal_target}</div>\n              <div class="pact-stat-label">Target</div>\n            </div>\n            <div class="pact-stat">\n              <div class="pact-stat-value">${getDaysLeft(e.end_date)}</div>\n              <div class="pact-stat-label">Days Left</div>\n            </div>\n          </div>\n          <div class="pact-members-preview">\n            ${(e.members||[]).slice(0,4).map(e=>`<div class="pact-member-avatar" title="${e.display_name}">${(e.display_name||"?")[0].toUpperCase()}</div>`).join("")}\n            ${(e.members||[]).length>4?`<div class="pact-member-avatar">+${(e.members||[]).length-4}</div>`:""}\n          </div>\n        </div>\n      `).join("")}\n    `}():""}\n      ${"add"===t?'\n      <div class="card">\n        <h3 class="card-title" style="margin-bottom:16px;">Find Friends by Username</h3>\n        <form id="add-friend-form">\n          <div class="form-group">\n            <label class="form-label">Username or Display Name</label>\n            <div style="display:flex;gap:8px;">\n              <input type="text" class="form-input" id="friend-username-input" placeholder="Enter username or name..." style="flex:1;">\n              <button type="submit" class="btn btn-primary">Send Request</button>\n            </div>\n          </div>\n        </form>\n      </div>\n\n      <div class="card" style="margin-top:20px;">\n        <h3 class="card-title" style="margin-bottom:16px;">Suggested Training Partners</h3>\n        <div style="color:var(--text-secondary);font-size:13px;">\n          In live mode, suggested partners from your gym or region would appear here based on your training profile.\n        </div>\n      </div>\n    ':""}\n    `, e.querySelectorAll(".tab-btn").forEach(e => {
            e.addEventListener("click", () => {
                t = e.dataset.tab, render()
            })
        }), e.querySelectorAll("[data-view-friend]").forEach(e => {
            e.addEventListener("click", () => {
                showFriendProfileModal(e.dataset.viewFriend)
            })
        }), e.querySelectorAll("[data-accept-id]").forEach(e => {
            e.addEventListener("click", async () => {
                await sbAcceptFriend(e.dataset.acceptId), render()
            })
        }), e.querySelectorAll("[data-remove-id]").forEach(e => {
            e.addEventListener("click", async () => {
                await sbRemoveFriend(e.dataset.removeId), render()
            })
        }), e.querySelectorAll("[data-accept-plan-id]").forEach(e => {
            e.addEventListener("click", async () => {
                e.disabled = !0, e.textContent = "Saving...", await sbAcceptSharedPlan(e.dataset.acceptPlanId), render()
            })
        }), e.querySelectorAll("[data-dismiss-plan-id]").forEach(e => {
            e.addEventListener("click", async () => {
                await sbDismissSharedPlan(e.dataset.dismissPlanId), render()
            })
        }), e.querySelectorAll("[data-preview-plan-id]").forEach(e => {
            e.addEventListener("click", () => {
                const t = AppState.sharedPlans.find(t => t.id === e.dataset.previewPlanId);
                t && showPlanPreviewModal(t)
            })
        });
        const o = document.getElementById("add-friend-form");
        o && o.addEventListener("submit", async e => {
            e.preventDefault();
            const t = document.getElementById("friend-username-input").value.trim();
            if (!t) return;
            const a = o.querySelector('button[type="submit"]');
            a.disabled = !0, a.textContent = "Sending...", await sbSendFriendRequest(t), a.disabled = !1, a.textContent = "Send Request", document.getElementById("friend-username-input").value = ""
        });
        const r = document.getElementById("create-pact-form");
        r && r.addEventListener("submit", async e => {
            e.preventDefault();
            const a = document.getElementById("pact-name").value.trim(),
                s = document.getElementById("pact-desc").value.trim(),
                n = document.getElementById("pact-goal-type").value,
                i = parseFloat(document.getElementById("pact-goal-target").value) || 4,
                o = (new Date).toISOString(),
                l = new Date(Date.now() + 2592e6).toISOString(),
                d = r.querySelector('button[type="submit"]');
            d.disabled = !0, d.textContent = "Creating...";
            const c = await sbCreatePact({
                name: a,
                description: s,
                goal_type: n,
                goal_target: i,
                start_date: o,
                end_date: l
            });
            d.disabled = !1, d.textContent = "Create Pact", c && (t = "pacts", render())
        })
    }()
}
function formatGoalType(e) {
    return {
        workouts_per_week: "Workouts/Week",
        total_volume: "Total Volume",
        streak_days: "Streak Days",
        custom: "Custom"
    } [e] || e
}
function getDaysLeft(e) {
    if (!e) return "—";
    const t = Math.ceil((new Date(e) - new Date) / 864e5);
    return t < 0 ? "Ended" : t
}
// Fetches a friend's recent workouts from Supabase.
// Requires a Supabase RLS policy allowing authenticated users to read workouts
// where they are confirmed friends with the owner. See FORGE handoff for migration SQL.
async function sbLoadFriendWorkouts(friendUserId) {
    if (isDemoMode || !supabaseClient || !AppState.user) return [];
    try {
        const { data, error } = await supabaseClient
            .from("workouts")
            .select("id, name, started_at, duration_minutes, workout_exercises(exercise:exercises(muscle_group), sets(weight_kg, reps, completed))")
            .eq("user_id", friendUserId)
            .order("started_at", { ascending: false })
            .limit(8);
        if (error) throw error;
        return (data || []).map(w => ({
            id: w.id,
            name: w.name || "Workout",
            date: w.started_at,
            duration_minutes: w.duration_minutes || 0,
            volume: (w.workout_exercises || []).reduce((acc, ex) =>
                acc + (ex.sets || []).filter(s => s.completed !== false)
                    .reduce((s2, set) => s2 + (set.weight_kg || 0) * (set.reps || 0), 0), 0),
            muscles: [...new Set((w.workout_exercises || [])
                .map(ex => ex.exercise?.muscle_group).filter(Boolean))]
        }));
    } catch (e) {
        console.warn("sbLoadFriendWorkouts failed (RLS may need updating):", e);
        return [];
    }
}
function showFriendProfileModal(friendId) {
    const f = AppState.friends.find(e => e.id === friendId || e.user_id === friendId);
    if (!f) return;
    const u = getUnitLabel();
    // Build modal shell with loading state for workout section
    const m = document.createElement("div");
    m.className = "modal-overlay";
    m.id = "friend-profile-modal";
    function renderModalContent(recentWorkouts) {
        const vol = recentWorkouts.reduce((acc, w) => acc + (w.volume || 0), 0);
        const volDisplay = vol >= 1e6 ? (vol / 1e6).toFixed(1) + "M" : vol >= 1e3 ? (vol / 1e3).toFixed(0) + "K" : vol || "—";
        const allMuscles = recentWorkouts.flatMap(w => w.muscles || []);
        const muscleFreq = allMuscles.reduce((acc, m) => { acc[m] = (acc[m] || 0) + 1; return acc; }, {});
        const favMuscle = Object.keys(muscleFreq).sort((a, b) => muscleFreq[b] - muscleFreq[a])[0];
        const fav = favMuscle ? formatMuscleGroupLabel(favMuscle) : (f.favorite_muscle ? formatMuscleGroupLabel(f.favorite_muscle) : "—");
        return `
      <div class="modal" style="max-width:440px;">
        <div class="modal-header">
          <span class="modal-title">Friend Profile</span>
          <button class="modal-close" id="close-friend-profile">✕</button>
        </div>
        <div class="modal-body">
          <div style="text-align:center;margin-bottom:20px;">
            <div class="friend-profile-avatar">${(f.display_name || f.username || "?")[0].toUpperCase()}</div>
            <div style="font-size:18px;font-weight:700;margin-top:8px;">${f.display_name || f.username}</div>
            <div style="font-size:13px;color:var(--text-secondary);">@${f.username || "user"}</div>
          </div>
          <div class="stats-grid" style="grid-template-columns:1fr 1fr;gap:12px;margin-bottom:20px;">
            <div class="stat-card" style="padding:12px;">
              <div class="stat-label">Workouts</div>
              <div class="stat-value" style="font-size:22px;">${f.workouts_count || recentWorkouts.length || 0}</div>
            </div>
            <div class="stat-card" style="padding:12px;">
              <div class="stat-label">Login Streak</div>
              <div class="stat-value" style="font-size:22px;">${f.streak || 0} <span style="font-size:12px;font-weight:400;">days</span></div>
            </div>
            <div class="stat-card" style="padding:12px;">
              <div class="stat-label">Recent Volume</div>
              <div class="stat-value" style="font-size:22px;">${volDisplay} <span style="font-size:12px;font-weight:400;">${typeof volDisplay === "number" ? u : ""}</span></div>
            </div>
            <div class="stat-card" style="padding:12px;">
              <div class="stat-label">Favorite</div>
              <div class="stat-value" style="font-size:16px;">${fav}</div>
            </div>
          </div>
          ${recentWorkouts.length > 0 ? `
            <div style="margin-top:4px;">
              <div style="font-size:13px;font-weight:600;color:var(--text-secondary);margin-bottom:8px;">Recent Workouts</div>
              ${recentWorkouts.slice(0, 6).map(w => `
                <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid var(--border-subtle);">
                  <div>
                    <span style="font-size:13px;font-weight:500;">${w.name}</span>
                    ${w.muscles && w.muscles.length > 0 ? `<div style="font-size:11px;color:var(--text-tertiary);margin-top:2px;">${w.muscles.slice(0,3).map(formatMuscleGroupLabel).join(" · ")}</div>` : ""}
                  </div>
                  <span style="font-size:11px;color:var(--text-tertiary);flex-shrink:0;margin-left:12px;">${formatDate(w.date)}</span>
                </div>
              `).join("")}
            </div>
          ` : `<div style="color:var(--text-tertiary);font-size:13px;text-align:center;padding:12px 0;">No recent workouts visible</div>`}
        </div>
      </div>
    `;
    }
    // Show skeleton immediately, then load workouts
    m.innerHTML = `
      <div class="modal" style="max-width:440px;">
        <div class="modal-header">
          <span class="modal-title">Friend Profile</span>
          <button class="modal-close" id="close-friend-profile">✕</button>
        </div>
        <div class="modal-body" style="min-height:200px;display:flex;align-items:center;justify-content:center;">
          <div style="color:var(--text-secondary);font-size:14px;">Loading...</div>
        </div>
      </div>
    `;
    document.body.appendChild(m);
    requestAnimationFrame(() => m.classList.add("active"));
    function close() { m.classList.remove("active"); setTimeout(() => m.remove(), 200); }
    m.addEventListener("click", e => { if (e.target === m) close(); });
    m.querySelector("#close-friend-profile").addEventListener("click", close);
    // Async load workout data, then re-render modal body
    const friendUserId = f.user_id || f.id;
    sbLoadFriendWorkouts(friendUserId).then(workouts => {
        if (!document.contains(m)) return; // modal was closed
        m.innerHTML = renderModalContent(workouts);
        m.querySelector("#close-friend-profile").addEventListener("click", close);
    });
}
function renderPactDetail(e, t) {
    const a = AppState.pacts.find(e => e.id === t);
    if (!a) return void(e.innerHTML = '<div class="empty-state"><div class="empty-state-icon">🤷</div><div class="empty-state-title">Pact not found</div><a href="#/social" class="btn btn-primary">Back to Social</a></div>');
    const s = a.members || [],
        n = [...s].sort((e, t) => (e.rank || 99) - (t.rank || 99)),
        i = s.find(e => e.user_id === (AppState.user?.id || "demo-user")),
        o = Math.max(...s.map(e => e.progress || 0), a.goal_target || 1),
        r = "total_volume" === a.goal_type;
    e.innerHTML = `\n    <div class="page-header-back">\n      <button class="back-btn" onclick="window.location.hash='#/social'">\n        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>\n      </button>\n      <div>\n        <div class="page-title" style="margin-bottom:0;">${a.name}</div>\n        <div style="font-size:13px;color:var(--text-secondary);">${a.description||""}</div>\n      </div>\n      <div class="pact-card-badge active" style="margin-left:auto;flex-shrink:0;">${a.is_active?"Active":"Ended"}</div>\n    </div>\n\n    <div class="stats-grid" style="margin-bottom:24px;">\n      <div class="stat-card">\n        <div class="stat-label">Members</div>\n        <div class="stat-value">${s.length}</div>\n      </div>\n      <div class="stat-card">\n        <div class="stat-label">Goal</div>\n        <div class="stat-value" style="font-size:16px;">${formatGoalType(a.goal_type)}</div>\n      </div>\n      <div class="stat-card">\n        <div class="stat-label">Target</div>\n        <div class="stat-value">${a.goal_target}</div>\n      </div>\n      <div class="stat-card">\n        <div class="stat-label">Days Left</div>\n        <div class="stat-value">${getDaysLeft(a.end_date)}</div>\n      </div>\n    </div>\n\n    ${i?`\n      <div class="card" style="margin-bottom:20px;border-color:var(--accent);">\n        <div class="card-title" style="margin-bottom:12px;">Your Progress</div>\n        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">\n          <span style="font-size:13px;color:var(--text-secondary);">\n            ${r?formatVolumeK(i.progress||0)+" "+getUnitLabel():i.progress||0} / ${r?formatVolumeK(a.goal_target):a.goal_target}\n          </span>\n          <span style="font-size:13px;font-weight:700;color:var(--accent);">Rank #${i.rank||"—"}</span>\n        </div>\n        <div class="progress-bar-bg">\n          <div class="progress-bar-fill" style="width:${Math.min(100,(i.progress||0)/o*100).toFixed(1)}%"></div>\n        </div>\n      </div>\n    `:""}\n\n    <div class="card">\n      <div class="card-header">\n        <h3 class="card-title">🏆 Leaderboard</h3>\n        <span style="font-size:12px;color:var(--text-tertiary);">This period</span>\n      </div>\n      <div class="leaderboard-table">\n        <div class="leaderboard-header">\n          <div>Rank</div>\n          <div>Member</div>\n          <div style="text-align:right;">Progress</div>\n        </div>\n        ${n.map((e,t)=>{const a=e.user_id===(AppState.user?.id||"demo-user"),s=r?formatVolumeK(e.progress||0)+" "+getUnitLabel():e.progress||0,n=Math.min(100,(e.progress||0)/o*100).toFixed(1);return`\n            <div class="leaderboard-row ${a?"current-user":""}">\n              <div class="leaderboard-rank rank-${t+1}">\n                ${0===t?"🥇":1===t?"🥈":2===t?"🥉":`#${t+1}`}\n              </div>\n              <div class="leaderboard-member">\n                <div class="friend-avatar leaderboard-avatar">${(e.display_name||"?")[0].toUpperCase()}</div>\n                <div>\n                  <div style="font-weight:600;font-size:14px;">${e.display_name}${a?" (You)":""}</div>\n                  <div style="width:120px;margin-top:4px;">\n                    <div class="progress-bar-bg" style="height:4px;">\n                      <div class="progress-bar-fill" style="width:${n}%;height:4px;"></div>\n                    </div>\n                  </div>\n                </div>\n              </div>\n              <div style="text-align:right;font-weight:700;color:${0===t?"var(--accent)":"var(--text-primary)"};">${s}</div>\n            </div>\n          `}).join("")}\n      </div>\n    </div>\n  `
}
function renderStats(e) {
    const t = AppState.workouts.length,
        a = getLoginStreak(),
        s = getLongestLoginStreak(),
        wStreak = getStreak(),
        wLongest = getLongestStreak(),
        n = (getWeeklyVolume(), AppState.workouts.reduce((e, t) => e + getTotalVolume(t), 0)),
        i = getUnitLabel(),
        o = [];
    for (let e = 11; e >= 0; e--) {
        const t = new Date(Date.now() - 7 * (e + 1) * 864e5),
            a = new Date(Date.now() - 7 * e * 864e5);
        let s = 0;
        AppState.workouts.forEach(e => {
            const n = new Date(e.date);
            n >= t && n < a && (s += getTotalVolume(e))
        });
        const n = t.toLocaleDateString("en-US", {
            month: "short",
            day: "numeric"
        });
        o.push({
            label: n,
            volume: Math.round(s)
        })
    }
    // Muscle frequency: count completed SETS per muscle group (not volume)
    // This prevents legs from dominating due to heavier absolute loads
    const r = {};
    AppState.workouts.forEach(e => {
        (e.exercises || []).forEach(e => {
            const t = e.muscle_group || "other";
            r[t] || (r[t] = 0);
            (e.sets || []).forEach(s => {
                if (s.completed !== false) r[t]++;
            });
        });
    });
    // Compute extra stats for enhanced analytics
    const _avgDuration = AppState.workouts.length > 0
        ? Math.round(AppState.workouts.reduce((acc, w) => acc + (w.duration_minutes || 0), 0) / AppState.workouts.length)
        : 0;
    const _totalPRs = Object.keys(AppState.personalRecords).length;
    const _workoutsThisWeek = AppState.workouts.filter(w => new Date(w.date) >= new Date(Date.now() - 7*864e5)).length;
    const _bestMonth = (() => {
        const byMonth = {};
        AppState.workouts.forEach(w => {
            const k = new Date(w.date).toLocaleDateString('en-US',{month:'short',year:'numeric'});
            byMonth[k] = (byMonth[k]||0)+1;
        });
        return Object.entries(byMonth).sort((a,b)=>b[1]-a[1])[0];
    })();
    // Workouts per week for last 12 weeks
    const _weeklyCount = [];
    for (let i = 11; i >= 0; i--) {
        const wkStart = new Date(Date.now() - (i+1)*7*864e5);
        const wkEnd   = new Date(Date.now() - i*7*864e5);
        _weeklyCount.push({
            label: wkStart.toLocaleDateString('en-US',{month:'short',day:'numeric'}),
            count: AppState.workouts.filter(w => { const d=new Date(w.date); return d>=wkStart && d<wkEnd; }).length
        });
    }
    const l = new Date(Date.now() - 2592e6),
        d = AppState.workouts.filter(e => new Date(e.date) >= l).length,
        c = buildHeatmapData(90),
        p = [...AppState.bodyMeasurements].sort((e, t) => new Date(e.date) - new Date(t.date));
    e.innerHTML = `\n    <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;margin-bottom:24px;">\n      <div>\n        <div class="page-title">Analytics</div>\n        <div class="page-subtitle">Track your progress over time</div>\n      </div>\n      ${renderUnitToggle()}\n    </div>\n\n    <div class="stats-grid" style="margin-bottom:24px;">\n      <div class="stat-card">\n        <div class="stat-label">Total Workouts</div>\n        <div class="stat-value">${t}</div>\n        <div class="stat-change" style="font-size:11px;color:var(--text-secondary)">This week: ${_workoutsThisWeek}</div>\n      </div>\n      <div class="stat-card">\n        <div class="stat-label">Login Streak</div>\n        <div class="stat-value"><span class="streak-fire">🔥</span> ${a}d</div>\n        <div class="stat-change" style="color:var(--text-secondary);font-size:11px;">Best: ${s}d · Workout: ${wStreak}d</div>\n      </div>\n      <div class="stat-card">\n        <div class="stat-label">This Month</div>\n        <div class="stat-value">${d}</div>\n        <div class="stat-change positive">${_bestMonth ? 'Best: '+_bestMonth[1]+' ('+_bestMonth[0]+')' : 'workouts'}</div>\n      </div>\n      <div class="stat-card">\n        <div class="stat-label">Total Volume</div>\n        <div class="stat-value">${formatVolumeK(n)}<span style="font-size:14px;color:var(--text-secondary);font-weight:400;"> ${i}</span></div>\n      </div>\n      <div class="stat-card">\n        <div class="stat-label">Avg Duration</div>\n        <div class="stat-value">${_avgDuration}<span style="font-size:14px;color:var(--text-secondary);font-weight:400;"> min</span></div>\n      </div>\n      <div class="stat-card">\n        <div class="stat-label">PRs</div>\n        <div class="stat-value">🏆 ${_totalPRs}</div>\n        <div class="stat-change positive">exercises</div>\n      </div>\n    </div>\n\n    <div class="analytics-grid">\n      <div class="card">\n        <div class="card-header">\n          <div class="card-title">Volume Over Time</div>\n          <span style="font-size:11px;color:var(--text-tertiary);">Last 12 weeks</span>\n        </div>\n        <div class="chart-container">\n          <canvas id="volume-chart"></canvas>\n        </div>\n      </div>\n      <div class="card">\n        <div class="card-header">\n          <div class="card-title">Muscle Distribution</div>\n          <span style="font-size:11px;color:var(--text-tertiary);">All time</span>\n        </div>\n        <div class="chart-container">\n          <canvas id="muscle-chart"></canvas>\n        </div>\n      </div>\n    </div>\n\n    <div class="card" style="margin-top:24px;">\n      <div class="card-header">\n        <div class="card-title">\n    <div class="analytics-grid" style="margin-top:24px;">\n      <div class="card">\n        <div class="card-header">\n          <div class="card-title">Workouts Per Week</div>\n          <span style="font-size:11px;color:var(--text-tertiary);">Last 12 weeks</span>\n        </div>\n        <div class="chart-container"><canvas id="frequency-chart"></canvas></div>\n      </div>\n      <div class="card">\n        <div class="card-header">\n          <div class="card-title">Avg Duration / Week</div>\n          <span style="font-size:11px;color:var(--text-tertiary);">Minutes per week</span>\n        </div>\n        <div class="chart-container"><canvas id="duration-chart"></canvas></div>\n      </div>\n    </div>\n\n    <div class="card" style="margin-top:24px;">\n      <div class="card-header">\n        <div class="card-title">Workout Heatmap</div>\n        <span style="font-size:11px;color:var(--text-tertiary);">Last 90 days</span>\n      </div>\n      <div class="heatmap-container" id="workout-heatmap">\n        ${renderHeatmap(c)}\n      </div>\n    </div>\n\n    ${Object.keys(AppState.personalRecords).length>0?`\n      <div class="card" style="margin-top:24px;">\n        <div class="card-header">\n          <div class="card-title">Personal Records</div>\n          <span style="font-size:11px;color:var(--text-tertiary);">${Object.keys(AppState.personalRecords).length} exercises</span>\n        </div>\n        <div class="exercise-grid">\n          ${Object.entries(AppState.personalRecords).map(([e,t])=>{const a=AppState.exercises.find(t=>t.id===e),s=a?a.name:t.exercise_name||"Unknown Exercise";return 0===t.max_weight?"":`\n              <div class="exercise-card" style="position:relative;">\n                <div class="exercise-card-icon" style="background:var(--accent-glow);border-radius:var(--radius-md);color:var(--accent);">🏆</div>\n                <div class="exercise-card-info">\n                  <div class="exercise-card-name">${s}</div>\n                  <div class="exercise-card-detail">\n                    <span class="text-accent" style="font-weight:700;">${formatWeight(t.max_weight)}</span>\n                    <span style="color:var(--text-tertiary);margin:0 4px;">·</span>\n                    <span>Reps @ max: ${t.max_weight_reps || t.max_reps || "\u2014"}</span>\n                  </div>\n                </div>\n                <button class="btn btn-ghost btn-sm delete-pr-btn" data-exid="${e}" style="position:absolute;top:6px;right:4px;color:var(--text-tertiary);padding:4px;font-size:16px;line-height:1;" title="Remove PR">×</button>\n              </div>\n            `}).join("")}\n        </div>\n      </div>\n    `:'\n      <div class="card" style="margin-top:24px;">\n        <div class="empty-state" style="padding:32px;">\n          <div class="empty-state-icon">📊</div>\n          <div class="empty-state-title">No stats yet</div>\n          <div class="empty-state-text">Log some workouts to see your analytics here.</div>\n          <a href="#/workout/new" class="btn btn-primary" style="margin-top:16px;">Start a Workout</a>\n        </div>\n      </div>\n    '}\n\n    <div class="card" style="margin-top:24px;">\n      <div class="card-header">\n        <div class="card-title">Body Composition</div>\n        <button class="btn btn-ghost btn-sm" id="toggle-body-form">Log Measurement</button>\n      </div>\n      <div id="body-form-container" style="display:none;margin-bottom:20px;">\n        <form id="body-measurement-form">\n          <div class="form-row" style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;">\n            <div class="form-group" style="margin-bottom:0;">\n              <label class="form-label">Date</label>\n              <input type="date" class="form-input" id="bm-date" value="${(new Date).toISOString().slice(0,10)}">\n            </div>\n            <div class="form-group" style="margin-bottom:0;">\n              <label class="form-label">Weight (${getUnitLabel()})</label>\n              <input type="number" class="form-input" id="bm-weight" placeholder="${"imperial"===AppState.unitPref?"175":"80"}" step="0.1" min="0">\n            </div>\n            <div class="form-group" style="margin-bottom:0;">\n              <label class="form-label">Body Fat % <span style="font-size:11px;color:var(--text-tertiary);font-weight:400;">(optional)</span></label>\n              <input type="number" class="form-input" id="bm-bf" placeholder="Optional — enter if known" step="0.1" min="0" max="100">\n            </div>\n          </div>\n          <button type="submit" class="btn btn-primary" style="margin-top:12px;">Save Measurement</button>\n        </form>\n      </div>\n      ${p.length>0?`\n        <div class="chart-container" style="height:180px;">\n          <canvas id="body-chart"></canvas>\n        </div>\n        <div style="margin-top:12px;display:flex;gap:16px;font-size:12px;color:var(--text-secondary);">\n          <span>Latest: <strong style="color:var(--text-primary);">${formatWeight(p[p.length-1].weight_kg)}</strong></span>\n          ${p[p.length-1].body_fat_pct?`<span>Body Fat: <strong style="color:var(--text-primary);">${p[p.length-1].body_fat_pct}%</strong></span>`:""}\n          <span>Logged: <strong style="color:var(--text-primary);">${p.length} times</strong></span>\n        </div>\n      `:'\n        <div style="color:var(--text-secondary);font-size:13px;">No measurements logged yet. Use the form above to track your body composition over time.</div>\n      '}\n    </div>\n  `, setTimeout(() => {
        renderVolumeChart(o), renderMuscleChart(r), renderFrequencyChart(_weeklyCount), renderDurationChart(_weeklyCount, o), p.length > 0 && renderBodyChart(p);
        // Wire PR delete buttons
        document.querySelectorAll(".delete-pr-btn").forEach(btn => {
            btn.addEventListener("click", async (ev) => {
                ev.stopPropagation();
                const exId = btn.dataset.exid;
                const exName = (AppState.exercises.find(x => x.id === exId) || {}).name || "this exercise";
                if (!confirm("Remove PR for " + exName + "? This cannot be undone.")) return;
                await sbDeletePR(exId);
                renderStats(e);
            });
        });
    }, 100), document.getElementById("toggle-body-form").addEventListener("click", () => {
        const e = document.getElementById("body-form-container");
        e.style.display = "none" === e.style.display ? "block" : "none"
    }), document.getElementById("body-measurement-form").addEventListener("submit", async t => {
        t.preventDefault();
        const a = document.getElementById("bm-date").value,
            s = parseFloat(document.getElementById("bm-weight").value) || null,
            n = s ? displayToKg(s) : null,
            i = parseFloat(document.getElementById("bm-bf").value) || null;
        n || i ? (await sbSaveBodyMeasurement({
            date: a,
            weight_kg: n,
            body_fat_pct: i,
            notes: ""
        }), renderStats(e)) : showToast("Please enter at least one measurement", "error")
    })
}
function buildHeatmapData(e) {
    const t = [],
        a = new Set(AppState.workouts.map(e => new Date(e.date).toISOString().slice(0, 10)));
    for (let s = e - 1; s >= 0; s--) {
        const e = new Date(Date.now() - 864e5 * s),
            n = e.toISOString().slice(0, 10);
        t.push({
            date: n,
            hasWorkout: a.has(n),
            dayOfWeek: e.getDay()
        })
    }
    return t
}
function renderHeatmap(e) {
    const t = [];
    let a = new Array(e[0].dayOfWeek).fill(null);
    for (const s of e) a.push(s), 6 === s.dayOfWeek && (t.push(a), a = []);
    if (a.length > 0) {
        while (a.length < 7) a.push(null);
        t.push(a)
    }
    const monthLabels = [];
    const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    let lastMonth = -1;
    t.forEach((week, idx) => {
        const firstDay = week.find(d => d !== null);
        if (firstDay) {
            const m = new Date(firstDay.date).getMonth();
            if (m !== lastMonth) {
                monthLabels.push({ idx, label: months[m] });
                lastMonth = m
            }
        }
    });
    return `\n    <div class="heatmap-month-labels" style="display:flex;margin-left:28px;margin-bottom:4px;font-size:10px;color:var(--text-tertiary);position:relative;height:14px;">\n      ${monthLabels.map(m => `<span style="position:absolute;left:${m.idx * 14}px;">${m.label}</span>`).join("")}\n    </div>\n    <div style="display:flex;gap:0;">\n      <div class="heatmap-labels">\n        ${["S","M","T","W","T","F","S"].map(e=>`<div class="heatmap-day-label">${e}</div>`).join("")}\n      </div>\n      <div class="heatmap-grid">\n        ${t.map(e=>`\n          <div class="heatmap-week">\n            ${e.map(e=>e?`<div class="heatmap-cell ${e.hasWorkout?"active":""}" title="${e.date}${e.hasWorkout?" — Worked out":""}"></div>`:'<div class="heatmap-cell empty"></div>').join("")}\n          </div>\n        `).join("")}\n      </div>\n    </div>\n  `
}
function renderVolumeChart(e) {
    const t = document.getElementById("volume-chart");
    if (!t) return;
    const a = e.map(e => ({
        label: e.label,
        volume: "imperial" === AppState.unitPref ? Math.round(2.20462 * e.volume) : e.volume
    }));
    AppState.chartInstances.volume = new Chart(t, {
        type: "line",
        data: {
            labels: a.map(e => e.label),
            datasets: [{
                label: `Volume (${getUnitLabel()})`,
                data: a.map(e => e.volume),
                backgroundColor: "rgba(249, 115, 22, 0.1)",
                borderColor: "rgba(249, 115, 22, 1)",
                borderWidth: 2,
                pointBackgroundColor: "rgba(249, 115, 22, 1)",
                pointRadius: 4,
                pointHoverRadius: 6,
                fill: !0,
                tension: .4
            }]
        },
        options: {
            responsive: !0,
            maintainAspectRatio: !1,
            plugins: {
                legend: {
                    display: !1
                },
                tooltip: {
                    backgroundColor: "#1e1e1e",
                    titleColor: "#f0ece4",
                    bodyColor: "#9a9590",
                    borderColor: "#333",
                    borderWidth: 1,
                    cornerRadius: 8,
                    padding: 10
                }
            },
            scales: {
                x: {
                    grid: {
                        color: "rgba(255,255,255,0.04)"
                    },
                    ticks: {
                        color: "#5c5854",
                        font: {
                            size: 10
                        },
                        maxRotation: 45
                    }
                },
                y: {
                    grid: {
                        color: "rgba(255,255,255,0.04)"
                    },
                    ticks: {
                        color: "#5c5854",
                        font: {
                            size: 11
                        },
                        callback: e => (e / 1e3).toFixed(0) + "k"
                    },
                    beginAtZero: !0
                }
            }
        }
    })
}
function renderMuscleChart(e) {
    const t = document.getElementById("muscle-chart");
    if (!t) return;
    if (0 === Object.keys(e).length) return void(t.parentElement.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:200px;color:var(--text-tertiary);font-size:13px;">No data yet — log some workouts</div>');
    const a = Object.keys(e),
        s = Object.values(e).map(e => "imperial" === AppState.unitPref ? Math.round(2.20462 * e) : e),
        n = {
            chest: "#f87171",
            back: "#60a5fa",
            shoulders: "#a78bfa",
            legs: "#34d399",
            arms: "#fbbf24",
            core: "#f472b6",
            cardio: "#38bdf8",
            full_body: "#a3e635"
        };
    AppState.chartInstances.muscle = new Chart(t, {
        type: "radar",
        data: {
            labels: a.map(e => formatMuscleGroupLabel(e)),
            datasets: [{
                data: s,
                backgroundColor: "rgba(249, 115, 22, 0.2)",
                borderColor: "rgba(249, 115, 22, 0.8)",
                borderWidth: 2,
                pointBackgroundColor: a.map(e => n[e] || "#666"),
                pointRadius: 5
            }]
        },
        options: {
            responsive: !0,
            maintainAspectRatio: !1,
            plugins: {
                legend: {
                    display: !1
                },
                tooltip: {
                    backgroundColor: "#1e1e1e",
                    titleColor: "#f0ece4",
                    bodyColor: "#9a9590",
                    borderColor: "#333",
                    borderWidth: 1,
                    cornerRadius: 8,
                    padding: 10,
                    callbacks: {
                        label: function(e) {
                            const t = e.parsed.r;
                            return `${e.label}: ${t} set${t===1?'':'s'}`
                        }
                    }
                }
            },
            scales: {
                r: {
                    grid: {
                        color: "rgba(255,255,255,0.08)"
                    },
                    pointLabels: {
                        color: "#9a9590",
                        font: {
                            size: 11
                        }
                    },
                    ticks: {
                        display: !1
                    },
                    angleLines: {
                        color: "rgba(255,255,255,0.08)"
                    }
                }
            }
        }
    })
}
function renderFrequencyChart(weekData) {
    const canvas = document.getElementById("frequency-chart");
    if (!canvas) return;
    if (AppState.chartInstances.frequency) { AppState.chartInstances.frequency.destroy(); delete AppState.chartInstances.frequency; }
    const accentColor = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#f97316';
    AppState.chartInstances.frequency = new Chart(canvas, {
        type: "bar",
        data: {
            labels: weekData.map(w => w.label),
            datasets: [{ label: "Workouts", data: weekData.map(w => w.count),
                backgroundColor: accentColor + "55", borderColor: accentColor,
                borderWidth: 2, borderRadius: 6 }]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { display: false },
                tooltip: { backgroundColor: "#1e1e1e", titleColor: "#f0ece4", bodyColor: "#9a9590",
                    borderColor: "#333", borderWidth: 1, cornerRadius: 8, padding: 10 }},
            scales: {
                x: { grid: { color: "rgba(255,255,255,0.05)" }, ticks: { color: "#9a9590", font: { size: 9 }, maxRotation: 45 }},
                y: { grid: { color: "rgba(255,255,255,0.05)" }, ticks: { color: "#9a9590", stepSize: 1, beginAtZero: true }}
            }
        }
    });
}
function renderDurationChart(weekData, volumeData) {
    const canvas = document.getElementById("duration-chart");
    if (!canvas) return;
    if (AppState.chartInstances.duration) { AppState.chartInstances.duration.destroy(); delete AppState.chartInstances.duration; }
    // Compute avg duration per week
    const durationData = weekData.map((wk, i) => {
        const wkStart = new Date(Date.now() - (11 - i + 1) * 7 * 864e5);
        const wkEnd   = new Date(Date.now() - (11 - i) * 7 * 864e5);
        const wkWorkouts = AppState.workouts.filter(w => { const d = new Date(w.date); return d >= wkStart && d < wkEnd; });
        if (wkWorkouts.length === 0) return 0;
        return Math.round(wkWorkouts.reduce((a, w) => a + (w.duration_minutes || 0), 0) / wkWorkouts.length);
    });
    AppState.chartInstances.duration = new Chart(canvas, {
        type: "line",
        data: {
            labels: weekData.map(w => w.label),
            datasets: [{ label: "Avg Duration (min)", data: durationData,
                borderColor: "#60a5fa", backgroundColor: "rgba(96,165,250,0.15)",
                borderWidth: 2, fill: true, tension: 0.4,
                pointBackgroundColor: "#60a5fa", pointRadius: 3 }]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { display: false },
                tooltip: { backgroundColor: "#1e1e1e", titleColor: "#f0ece4", bodyColor: "#9a9590",
                    borderColor: "#333", borderWidth: 1, cornerRadius: 8, padding: 10,
                    callbacks: { label: ctx => `${ctx.parsed.y} min` } }},
            scales: {
                x: { grid: { color: "rgba(255,255,255,0.05)" }, ticks: { color: "#9a9590", font: { size: 9 }, maxRotation: 45 }},
                y: { grid: { color: "rgba(255,255,255,0.05)" }, ticks: { color: "#9a9590" }, beginAtZero: true }
            }
        }
    });
}
function renderBodyChart(e) {
    const t = document.getElementById("body-chart");
    t && (AppState.chartInstances.body = new Chart(t, {
        type: "line",
        data: {
            labels: e.map(e => new Date(e.date).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric"
            })),
            datasets: [{
                label: `Weight (${getUnitLabel()})`,
                data: e.map(e => kgToDisplay(e.weight_kg)),
                borderColor: "#60a5fa",
                backgroundColor: "rgba(96, 165, 250, 0.1)",
                borderWidth: 2,
                pointRadius: 3,
                fill: !1,
                tension: .3,
                yAxisID: "y"
            }, ...e.some(e => e.body_fat_pct) ? [{
                label: "Body Fat %",
                data: e.map(e => e.body_fat_pct),
                borderColor: "#f87171",
                backgroundColor: "rgba(248, 113, 113, 0.1)",
                borderWidth: 2,
                pointRadius: 3,
                fill: !1,
                tension: .3,
                yAxisID: "y1"
            }] : []]
        },
        options: {
            responsive: !0,
            maintainAspectRatio: !1,
            interaction: {
                intersect: !1,
                mode: "index"
            },
            plugins: {
                legend: {
                    labels: {
                        color: "#9a9590",
                        font: {
                            size: 11
                        }
                    }
                },
                tooltip: {
                    backgroundColor: "#1e1e1e",
                    titleColor: "#f0ece4",
                    bodyColor: "#9a9590",
                    borderColor: "#333",
                    borderWidth: 1,
                    cornerRadius: 8
                }
            },
            scales: {
                x: {
                    grid: {
                        color: "rgba(255,255,255,0.04)"
                    },
                    ticks: {
                        color: "#5c5854",
                        font: {
                            size: 10
                        }
                    }
                },
                y: {
                    position: "left",
                    grid: {
                        color: "rgba(255,255,255,0.04)"
                    },
                    ticks: {
                        color: "#5c5854",
                        font: {
                            size: 10
                        }
                    }
                },
                y1: {
                    position: "right",
                    grid: {
                        drawOnChartArea: !1
                    },
                    ticks: {
                        color: "#5c5854",
                        font: {
                            size: 10
                        },
                        callback: e => e + "%"
                    }
                }
            }
        }
    }))
}
function renderProfile(e) {
    const t = AppState.profile.display_name || AppState.profile.name || "User",
        a = t.split(" ").map(e => e[0]).join("").toUpperCase().slice(0, 2),
        s = AppState.cosmetics.length > 0 ? AppState.cosmetics : seedCosmetics(),
        n = AppState.profile.equipped_title ? s.find(e => e.id === AppState.profile.equipped_title) : null,
        i = AppState.profile.equipped_badge ? s.find(e => e.id === AppState.profile.equipped_badge) : null,
        o = (AppState.profile.equipped_frame ? s.find(e => e.id === AppState.profile.equipped_frame) : null) ? "border: 3px solid var(--accent);box-shadow: 0 0 16px var(--accent-glow-strong);" : "";
    e.innerHTML = `\n    <div class="page-title">Profile</div>\n    <div class="page-subtitle">Manage your account and preferences</div>\n\n    <div class="card" style="max-width:560px;">\n      <div style="display:flex;align-items:center;gap:20px;margin-bottom:24px;">\n        <div class="profile-avatar" style="${o}">${i?i.icon:a}</div>\n        <div>\n          <div style="font-family:var(--font-display);font-weight:700;font-size:20px;">${t}</div>\n          ${n?`<div style="font-size:12px;color:var(--accent);font-weight:600;margin-bottom:2px;">${n.icon || ""} ${n.name}</div>`:""}\n          <div style="color:var(--text-secondary);font-size:14px;">${AppState.profile.email}</div>\n          ${isDemoMode?'<div class="badge badge-accent" style="margin-top:6px;">Demo Mode</div>':'<div class="badge badge-success" style="margin-top:6px;">Connected</div>'}\n        </div>\n      </div>\n\n      <div class="section-divider"></div>\n\n      <form id="profile-form">\n        <div class="form-group">\n          <label class="form-label">Display Name</label>\n          <input type="text" class="form-input" value="${t}" id="profile-name">\n        </div>\n        <div class="form-group">\n          <label class="form-label">Email</label>\n          <input type="email" class="form-input" value="${AppState.profile.email}" id="profile-email" readonly ${isDemoMode?"disabled":""} style="${isDemoMode?"opacity:0.5;cursor:not-allowed;":""}">\n        </div>\n        <div class="form-group">\n          <label class="form-label">Fitness Goal</label>\n          <select class="form-select" id="profile-goal">\n            <option value="strength" ${"strength"===AppState.profile.goal?"selected":""}>Strength</option>\n            <option value="hypertrophy" ${"hypertrophy"===AppState.profile.goal?"selected":""}>Muscle Growth</option>\n            <option value="endurance" ${"endurance"===AppState.profile.goal?"selected":""}>Endurance</option>\n            <option value="fat_loss" ${"fat_loss"===AppState.profile.goal?"selected":""}>Fat Loss</option>\n            <option value="general" ${"general"===AppState.profile.goal?"selected":""}>General Fitness</option>\n          </select>\n        </div>\n        <div class="form-group">\n          <label class="form-label">Experience Level</label>\n          <select class="form-select" id="profile-exp">\n            <option value="beginner" ${"beginner"===AppState.profile.experience?"selected":""}>Beginner</option>\n            <option value="intermediate" ${"intermediate"===AppState.profile.experience?"selected":""}>Intermediate</option>\n            <option value="advanced" ${"advanced"===AppState.profile.experience?"selected":""}>Advanced</option>\n          </select>\n        </div>\n        <div class="form-group">\n          <label class="form-label">Weight Unit Preference</label>\n          <div style="display:flex;gap:8px;margin-top:4px;">\n            ${renderUnitToggle()}\n          </div>\n        </div>\n        <button type="submit" class="btn btn-primary" id="profile-save-btn">Save Changes</button>\n      </form>\n\n      <div class="section-divider"></div>\n\n      <div>\n        <h3 style="font-size:14px;color:var(--text-secondary);margin-bottom:12px;text-transform:uppercase;letter-spacing:0.5px;">Account</h3>\n        <div style="display:flex;flex-direction:column;gap:8px;">\n          <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 0;">\n            <span style="font-size:14px;">Workouts logged</span>\n            <span style="font-weight:700;">${AppState.workouts.length}</span>\n          </div>\n          <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 0;">\n            <span style="font-size:14px;">Current streak</span>\n            <span style="font-weight:700;">🔥 ${getStreak()} days</span>\n          </div>\n          <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 0;">\n            <span style="font-size:14px;">Member since</span>\n            <span style="font-weight:700;">Feb 2026</span>\n          </div>\n          <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 0;">\n            <span style="font-size:14px;">Current goal</span>\n            <span class="badge badge-accent">${{strength:"Strength",hypertrophy:"Muscle Growth",endurance:"Endurance",fat_loss:"Fat Loss",general:"General Fitness"}[AppState.profile.goal]||AppState.profile.goal}</span>\n          </div>\n          <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 0;">\n            <span style="font-size:14px;">Mode</span>\n            <span class="badge ${isDemoMode?"badge-accent":"badge-success"}">${isDemoMode?"Demo":"Live"}</span>\n          </div>\n        </div>\n      </div>\n\n      <div class="section-divider"></div>\n\n      <button class="btn btn-danger w-full" id="logout-btn">Log Out</button>\n    </div>\n\n    <div style="text-align:center;margin-top:24px;font-size:12px;color:var(--text-tertiary);">\n      IronPact v0.7.1 · Powered by <a href="https://sigro.ai" target="_blank" rel="noopener noreferrer" style="color:var(--accent);">Sigro.ai</a>\n    </div>\n  `, document.getElementById("profile-form").addEventListener("submit", async t => {
        t.preventDefault();
        const a = document.getElementById("profile-name").value.trim(),
            s = document.getElementById("profile-goal").value,
            n = document.getElementById("profile-exp").value,
            i = document.getElementById("profile-save-btn");
        AppState.profile.name = a, AppState.profile.display_name = a, AppState.profile.goal = s, AppState.profile.experience = n, !isDemoMode && supabaseClient && AppState.user && (i.disabled = !0, i.textContent = "Saving...", await sbUpdateProfile({
            display_name: a,
            goal: s,
            experience: n,
            unit_pref: "imperial" === AppState.unitPref ? "imperial" : "metric",
            updated_at: (new Date).toISOString()
        }), i.disabled = !1, i.textContent = "Save Changes"), showToast("Profile updated"), renderProfile(e)
    }), document.getElementById("logout-btn").addEventListener("click", async () => {
        await handleAuthSignOut(), showToast("Logged out"), window.location.hash = "#/"
    })
}
function renderSupport(e) {
    e.innerHTML = `\n    <div style="display:flex;align-items:center;gap:16px;margin-bottom:24px;">\n      <div>\n        <div class="page-title">Help &amp; Support</div>\n        <div class="page-subtitle">Find answers and get in touch</div>\n      </div>\n    </div>\n\n    <div class="card" style="margin-bottom:24px;">\n      <div class="card-header">\n        <div class="card-title">❓ Frequently Asked Questions</div>\n      </div>\n      <div style="display:flex;flex-direction:column;gap:0;">\n        ${[{q:"How do tokens work?",a:"Tokens (⬡) are the in-app currency. You earn them by completing workouts (up to 3/day) and claiming missions. Spend them in the Cosmetics Shop to unlock badges, themes, titles, and frames."},{q:"How do missions refresh?",a:"Daily missions reset at midnight your local time. Weekly missions reset every Monday. Complete and claim them before they expire to earn tokens."},{q:"What do cosmetics do?",a:"Cosmetics personalise your experience. Themes change the app colour scheme. Titles and badges show on your profile. Frames appear around your profile avatar. Equip them from the Shop tab."},{q:"How does the Mystery Box work?",a:"The Mystery Box costs 30 ⬡ tokens and awards a random cosmetic. Rarities: Common (50%), Rare (30%), Epic (15%), Legendary (5%). You can get any cosmetic, including ones you already own."},{q:"Can I pause a workout?",a:"Yes! Press Start to begin timing, then use the Pause button to pause. Resume when you are ready. The timer only runs while you are actively working out."},{q:"How do I repeat a past workout?",a:"Go to Workout History, find the workout you want to repeat, and tap the Repeat button. It pre-fills the exercise list with your previous weights so you can pick up where you left off."},{q:"How do AI Plans work?",a:"The AI Plan Generator creates a custom training program based on your goal, experience, and available equipment. You can save plans to My Plans, share them, and start any day directly from the plan view."},{q:"What is RPE?",a:"Rate of Perceived Exertion (1-10) measures how hard a set felt. 6-7 = moderate effort, 8 = hard, 9 = very hard, 10 = absolute maximum. Use it to track intensity and auto-regulate your training load."}].map((e,t)=>`\n          <div class="faq-item" id="faq-${t}" style="border-bottom:1px solid var(--border-subtle);">\n            <button class="faq-question" data-idx="${t}" style="width:100%;text-align:left;padding:14px 0;background:none;border:none;color:var(--text-primary);font-size:14px;font-weight:600;cursor:pointer;display:flex;justify-content:space-between;align-items:center;gap:8px;">\n              <span>${e.q}</span>\n              <svg class="faq-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16" style="flex-shrink:0;transition:transform 0.2s;"><path d="M6 9l6 6 6-6"/></svg>\n            </button>\n            <div class="faq-answer" style="display:none;padding-bottom:14px;font-size:13px;color:var(--text-secondary);line-height:1.6;">${e.a}</div>\n          </div>\n        `).join("")}\n      </div>\n    </div>\n\n    <div class="card" style="margin-bottom:24px;">\n      <div class="card-header">\n        <div class="card-title">📧 Contact Support</div>\n      </div>\n      <div style="font-size:14px;color:var(--text-secondary);margin-bottom:16px;">Have a question or found a bug? Send us a message and we'll get back to you.</div>\n      <form id="support-form" style="display:flex;flex-direction:column;gap:12px;">\n        <div class="form-group" style="margin-bottom:0;">\n          <label class="form-label">Your Name</label>\n          <input type="text" class="form-input" id="support-name" placeholder="Enter your name" required>\n        </div>\n        <div class="form-group" style="margin-bottom:0;">\n          <label class="form-label">Email</label>\n          <input type="email" class="form-input" id="support-email" placeholder="you@example.com" required value="${AppState.profile?.email||""}">\n        </div>\n        <div class="form-group" style="margin-bottom:0;">\n          <label class="form-label">Subject</label>\n          <select class="form-input" id="support-subject">\n            <option value="bug">Bug Report</option>\n            <option value="feature">Feature Request</option>\n            <option value="account">Account Issue</option>\n            <option value="general">General Question</option>\n          </select>\n        </div>\n        <div class="form-group" style="margin-bottom:0;">\n          <label class="form-label">Message</label>\n          <textarea class="form-input" id="support-message" rows="4" placeholder="Describe your issue or question..." required style="resize:vertical;min-height:100px;"></textarea>\n        </div>\n        <button type="submit" class="btn btn-primary" id="support-submit-btn" style="align-self:flex-start;">Send Message</button>\n      </form>\n    </div>\n\n    <div class="card">\n      <div class="card-header">\n        <div class="card-title">ℹ️ App Info</div>\n      </div>\n      <div style="display:flex;flex-direction:column;gap:8px;font-size:14px;">\n        <div style="display:flex;justify-content:space-between;"><span style="color:var(--text-secondary);">Version</span><strong>v0.7.1</strong></div>\n        <div style="display:flex;justify-content:space-between;"><span style="color:var(--text-secondary);">Mode</span><span class="badge ${isDemoMode?"badge-accent":"badge-success"}">${isDemoMode?"Demo":"Live"}</span></div>\n        <div style="display:flex;justify-content:space-between;"><span style="color:var(--text-secondary);">Powered by</span><a href="https://sigro.ai" target="_blank" rel="noopener noreferrer" style="color:var(--accent);">Sigro.ai</a></div>\n      </div>\n    </div>\n  `, e.querySelectorAll(".faq-question").forEach(t => {
        t.addEventListener("click", () => {
            const a = t.dataset.idx,
                s = e.querySelector(`#faq-${a} .faq-answer`),
                n = t.querySelector(".faq-arrow"),
                i = "block" === s.style.display;
            s.style.display = i ? "none" : "block", n.style.transform = i ? "" : "rotate(180deg)"
        })
    });
    const t = document.getElementById("support-form");
    t && t.addEventListener("submit", async e => {
        e.preventDefault();
        const a = document.getElementById("support-name").value.trim(),
            s = document.getElementById("support-email").value.trim(),
            n = document.getElementById("support-subject").value,
            i = document.getElementById("support-message").value.trim(),
            o = document.getElementById("support-submit-btn");
        o.disabled = !0, o.textContent = "Sending...";
        const r = {
                bug: "Bug Report",
                feature: "Feature Request",
                account: "Account Issue",
                general: "General Question"
            },
            l = `[IronPact Support] ${r[n]||n} from ${a}`,
            d = `Name: ${a}\nEmail: ${s}\nSubject: ${r[n]}\nMode: ${isDemoMode?"Demo":"Live"}\n\nMessage:\n${i}`;
        try {
            if (!(await fetch("https://formsubmit.co/ajax/pawcz12345@gmail.com", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        Accept: "application/json"
                    },
                    body: JSON.stringify({
                        name: a,
                        email: s,
                        _subject: l,
                        message: d
                    })
                })).ok) throw new Error("Failed");
            showToast("Message sent! We'll get back to you soon.", "success"), t.reset()
        } catch (e) {
            const t = `mailto:pawcz12345@gmail.com?subject=${encodeURIComponent(l)}&body=${encodeURIComponent(d)}`;
            window.open(t, "_blank"), showToast("Opening email client...", "info")
        }
        o.disabled = !1, o.textContent = "Send Message"
    })
}
async function sbLoadTokenBalance() {
    if (!isDemoMode && supabaseClient && AppState.user) try {
        const {
            data: e,
            error: t
        } = await supabaseClient.from("profiles").select("token_balance, is_beta_user, is_premium, subscription_plan, equipped_title, equipped_badge, equipped_theme, equipped_frame, daily_workout_count, last_workout_credited_at, weekly_tokens_earned, week_reset_at").eq("id", AppState.user.id).single();
        if (t) throw t;
        e && (AppState.tokenBalance = e.token_balance || 0, Object.assign(AppState.profile, e), updateTokenDisplay())
    } catch (e) {
        console.error("Failed to load token balance:", e)
    }
}
async function sbEarnTokens(e, t) {
    if (isDemoMode || !supabaseClient || !AppState.user) return AppState.tokenBalance = (AppState.tokenBalance || 0) + e, AppState.profile.token_balance = AppState.tokenBalance, updateTokenDisplay(), !0;
    try {
        const {
            data: a,
            error: s
        } = await supabaseClient.rpc("earn_tokens", {
            p_user_id: AppState.user.id,
            p_amount: e,
            p_reason: t
        });
        if (s) throw s;
        return AppState.tokenBalance = (AppState.tokenBalance || 0) + e, AppState.profile.token_balance = AppState.tokenBalance, updateTokenDisplay(), !0
    } catch (t) {
        try {
            return await supabaseClient.from("profiles").update({
                token_balance: (AppState.tokenBalance || 0) + e
            }).eq("id", AppState.user.id), AppState.tokenBalance = (AppState.tokenBalance || 0) + e, AppState.profile.token_balance = AppState.tokenBalance, updateTokenDisplay(), !0
        } catch (e) {
            return console.error("Failed to earn tokens:", e), !1
        }
    }
}
async function sbSpendTokens(e, t) {
    if (AppState.profile.is_beta_user) return !0;
    const a = AppState.tokenBalance || 0;
    if (a < e) return !1;
    if (isDemoMode || !supabaseClient || !AppState.user) return AppState.tokenBalance = a - e, AppState.profile.token_balance = AppState.tokenBalance, updateTokenDisplay(), !0;
    try {
        return await supabaseClient.from("profiles").update({
            token_balance: a - e
        }).eq("id", AppState.user.id), AppState.tokenBalance = a - e, AppState.profile.token_balance = AppState.tokenBalance, updateTokenDisplay(), await sbLogTokenLedger(-e, t, "spend"), !0
    } catch (e) {
        return console.error("Failed to spend tokens:", e), !1
    }
}
async function sbLogTokenLedger(e, t, a) {
    if (!isDemoMode && supabaseClient && AppState.user) try {
        await supabaseClient.from("token_ledger").insert({
            user_id: AppState.user.id,
            amount: e,
            reason: t,
            transaction_type: a || (e > 0 ? "earn" : "spend"),
            created_at: (new Date).toISOString()
        })
    } catch (e) {
        console.error("Failed to log token ledger:", e)
    }
}
function updateTokenDisplay() {
    document.querySelectorAll(".token-balance-display").forEach(e => {
        e.textContent = AppState.tokenBalance || 0
    })
}
function seedMissions() {
    return [{
        id: "mission-d1",
        title: "Daily Grind",
        description: "Complete 1 workout today",
        mission_type: "daily",
        progress_type: "workout_count",
        target: 1,
        token_reward: 5,
        icon: "💪"
    }, {
        id: "mission-d2",
        title: "Volume Crusher",
        description: "Log 5,000 kg total volume today",
        mission_type: "daily",
        progress_type: "total_volume_kg",
        target: 5e3,
        token_reward: 8,
        icon: "📊"
    }, {
        id: "mission-w1",
        title: "Iron Week",
        description: "Complete 4 workouts this week",
        mission_type: "weekly",
        progress_type: "workout_count",
        target: 4,
        token_reward: 20,
        icon: "🗓️"
    }, {
        id: "mission-w2",
        title: "PR Hunter",
        description: "Set 3 personal records this week",
        mission_type: "weekly",
        progress_type: "pr_count",
        target: 3,
        token_reward: 25,
        icon: "🏆"
    }, {
        id: "mission-w3",
        title: "Balanced Builder",
        description: "Train 3 different muscle groups this week",
        mission_type: "weekly",
        progress_type: "muscle_group_workouts",
        target: 3,
        token_reward: 15,
        icon: "⚖️"
    }, {
        id: "mission-w4",
        title: "Volume King",
        description: "Accumulate 30,000 kg this week",
        mission_type: "weekly",
        progress_type: "total_volume_kg",
        target: 3e4,
        token_reward: 30,
        icon: "👑"
    }, {
        id: "mission-m1",
        title: "Consistency Champion",
        description: "Train 16+ times this month",
        mission_type: "monthly",
        progress_type: "workout_count",
        target: 16,
        token_reward: 75,
        icon: "🏅"
    }, {
        id: "mission-m2",
        title: "Streak Master",
        description: "Maintain a 7-day consecutive streak",
        mission_type: "monthly",
        progress_type: "consecutive_days",
        target: 7,
        token_reward: 50,
        icon: "🔥"
    }, {
        id: "mission-m3",
        title: "Volume Legend",
        description: "Log 120,000 kg total volume this month",
        mission_type: "monthly",
        progress_type: "total_volume_kg",
        target: 12e4,
        token_reward: 100,
        icon: "⚡"
    }, {
        id: "mission-c1",
        title: "Forge Beginner",
        description: "Complete your first 5 workouts",
        mission_type: "chain",
        chain_order: 1,
        progress_type: "workout_count",
        target: 5,
        token_reward: 15,
        icon: "⬡",
        chain_name: "The Forge Path"
    }, {
        id: "mission-c2",
        title: "Forge Apprentice",
        description: "Reach 25 total workouts",
        mission_type: "chain",
        chain_order: 2,
        progress_type: "workout_count",
        target: 25,
        token_reward: 30,
        icon: "🔨",
        chain_name: "The Forge Path"
    }, {
        id: "mission-c3",
        title: "Forge Master",
        description: "Reach 100 total workouts",
        mission_type: "chain",
        chain_order: 3,
        progress_type: "workout_count",
        target: 100,
        token_reward: 100,
        icon: "⚒️",
        chain_name: "The Forge Path"
    }, {
        id: "mission-c4",
        title: "PR Seeker",
        description: "Set your first personal record",
        mission_type: "chain",
        chain_order: 1,
        progress_type: "pr_count",
        target: 1,
        token_reward: 10,
        icon: "🌟",
        chain_name: "PR Legend"
    }, {
        id: "mission-c5",
        title: "PR Collector",
        description: "Set 10 personal records",
        mission_type: "chain",
        chain_order: 2,
        progress_type: "pr_count",
        target: 10,
        token_reward: 40,
        icon: "💫",
        chain_name: "PR Legend"
    }, {
        id: "mission-c6",
        title: "PR Legend",
        description: "Set 50 personal records",
        mission_type: "chain",
        chain_order: 3,
        progress_type: "pr_count",
        target: 50,
        token_reward: 150,
        icon: "🏆",
        chain_name: "PR Legend"
    }, {
        id: "mission-c7",
        title: "Early Adopter",
        description: "Join IronPact during beta",
        mission_type: "chain",
        chain_order: 1,
        progress_type: "workout_count",
        target: 1,
        token_reward: 50,
        icon: "🎖️",
        chain_name: "Founding Member"
    }]
}
function seedCosmetics() {
    return [{
        id: "cos-b1",
        name: "Iron Novice",
        category: "badge",
        rarity: "common",
        cost: 0,
        icon: "🥉",
        description: "Given to all members"
    }, {
        id: "cos-b2",
        name: "Bronze Lifter",
        category: "badge",
        rarity: "common",
        cost: 50,
        icon: "🏅",
        description: "A solid start"
    }, {
        id: "cos-b3",
        name: "Silver Strong",
        category: "badge",
        rarity: "rare",
        cost: 150,
        icon: "🥈",
        description: "Proven dedication"
    }, {
        id: "cos-b4",
        name: "Gold Crusher",
        category: "badge",
        rarity: "epic",
        cost: 300,
        icon: "🥇",
        description: "Elite performance"
    }, {
        id: "cos-b5",
        name: "Diamond Forge",
        category: "badge",
        rarity: "legendary",
        cost: 750,
        icon: "💎",
        description: "Only for the chosen"
    }, {
        id: "cos-b6",
        name: "Iron Pact Founder",
        category: "badge",
        rarity: "legendary",
        cost: 0,
        icon: "⬡",
        description: "Beta founder badge",
        is_earned: !0
    }, {
        id: "cos-b7",
        name: "Streak Hunter",
        category: "badge",
        rarity: "rare",
        cost: 200,
        icon: "🔥",
        description: "7-day streak achiever"
    }, {
        id: "cos-b8",
        name: "PR Machine",
        category: "badge",
        rarity: "epic",
        cost: 400,
        icon: "📈",
        description: "Personal record setter"
    }, {
        id: "cos-t1",
        name: "Default Orange",
        category: "theme",
        rarity: "common",
        cost: 0,
        icon: "🟠",
        description: "The classic IronPact look",
        css_class: "theme-default"
    }, {
        id: "cos-t2",
        name: "Steel Blue",
        category: "theme",
        rarity: "rare",
        cost: 100,
        icon: "🔵",
        description: "Cold steel aesthetic",
        css_class: "theme-blue"
    }, {
        id: "cos-t3",
        name: "Toxic Green",
        category: "theme",
        rarity: "epic",
        cost: 250,
        icon: "🟢",
        description: "Radioactive gains",
        css_class: "theme-green"
    }, {
        id: "cos-t4",
        name: "Royal Purple",
        category: "theme",
        rarity: "epic",
        cost: 250,
        icon: "🟣",
        description: "Royalty in the gym",
        css_class: "theme-purple"
    }, {
        id: "cos-t5",
        name: "Crimson Power",
        category: "theme",
        rarity: "legendary",
        cost: 500,
        icon: "🔴",
        description: "Blood sweat and tears",
        css_class: "theme-red"
    }, {
        id: "cos-t6",
        name: "Gold Rush",
        category: "theme",
        rarity: "legendary",
        cost: 500,
        icon: "🟡",
        description: "For champions only",
        css_class: "theme-gold"
    }, {
        id: "cos-ti1",
        name: "The Lifter",
        category: "title",
        rarity: "common",
        cost: 0,
        icon: "🏷️",
        description: "A simple title"
    }, {
        id: "cos-ti2",
        name: "Iron Warrior",
        category: "title",
        rarity: "rare",
        cost: 120,
        icon: "⚔️",
        description: "Battle-tested"
    }, {
        id: "cos-ti3",
        name: "The Crusher",
        category: "title",
        rarity: "rare",
        cost: 120,
        icon: "💥",
        description: "Crushing goals"
    }, {
        id: "cos-ti4",
        name: "Forge Master",
        category: "title",
        rarity: "epic",
        cost: 280,
        icon: "🔨",
        description: "Master of the forge"
    }, {
        id: "cos-ti5",
        name: "Iron Legend",
        category: "title",
        rarity: "legendary",
        cost: 600,
        icon: "👑",
        description: "A legendary title"
    }, {
        id: "cos-ti6",
        name: "The OG",
        category: "title",
        rarity: "legendary",
        cost: 0,
        icon: "🎖️",
        description: "Original beta tester",
        is_earned: !0
    }, {
        id: "cos-f1",
        name: "Basic Frame",
        category: "frame",
        rarity: "common",
        cost: 0,
        icon: "⬜",
        description: "Simple border"
    }, {
        id: "cos-f2",
        name: "Flame Frame",
        category: "frame",
        rarity: "epic",
        cost: 350,
        icon: "🔥",
        description: "Burning ambition"
    }, {
        id: "cos-f3",
        name: "Circuit Frame",
        category: "frame",
        rarity: "rare",
        cost: 180,
        icon: "⚡",
        description: "Digital circuit aesthetic"
    }, {
        id: "cos-f4",
        name: "Legendary Aura",
        category: "frame",
        rarity: "legendary",
        cost: 800,
        icon: "✨",
        description: "Aura of a champion"
    }]
}
async function sbLoadMissions() {
    if (!isDemoMode && supabaseClient && AppState.user) try {
        const {
            data: e,
            error: t
        } = await supabaseClient.from("missions").select("*").eq("is_active", !0);
        if (t) throw t;
        AppState.missions = e && e.length > 0 ? e : seedMissions()
    } catch (e) {
        console.error("Failed to load missions:", e), AppState.missions = seedMissions()
    } else AppState.missions = seedMissions()
}
async function sbLoadUserMissions() {
    if (!isDemoMode && supabaseClient && AppState.user) {
        try {
            const { data: e, error: t } = await supabaseClient
                .from("user_missions")
                .select("*, mission:missions(*)")
                .eq("user_id", AppState.user.id)
                .neq("status", "expired");
            if (t) throw t;
            const dbRows = (e || []).map(row => {
                // If the mission join came back null (mission_id mismatch or deleted),
                // resolve it from AppState.missions so it still renders
                if (!row.mission && row.mission_id) {
                    const found = AppState.missions.find(m => m.id === row.mission_id);
                    if (found) row.mission = found;
                }
                return row;
            });
            const dbMissionIds = new Set(dbRows.map(r => r.mission_id || r.mission?.id).filter(Boolean));
            const computed = computeUserMissions().filter(m => !dbMissionIds.has(m.mission_id));
            AppState.userMissions = [...dbRows, ...computed];
        } catch (e) {
            console.error("Failed to load user missions:", e);
            AppState.userMissions = computeUserMissions();
        }
    } else {
        AppState.userMissions = computeUserMissions();
    }
}
function computeUserMissions() {
    const e = AppState.missions.length > 0 ? AppState.missions : seedMissions(),
        t = AppState.workouts.length,
        a = Object.keys(AppState.personalRecords).length,
        s = (AppState.workouts.reduce((e, t) => e + getTotalVolume(t), 0), getStreak()),
        n = new Date(Date.now() - 6048e5),
        i = AppState.workouts.filter(e => new Date(e.date) >= n),
        o = i.length,
        r = i.reduce((e, t) => e + getTotalVolume(t), 0),
        l = new Set(i.flatMap(e => (e.exercises || []).map(e => e.muscle_group))).size,
        d = (new Date).toISOString().slice(0, 10),
        c = AppState.workouts.filter(e => new Date(e.date).toISOString().slice(0, 10) === d),
        p = c.length,
        u = c.reduce((e, t) => e + getTotalVolume(t), 0),
        m = new Date,
        g = new Date(m);
    g.setHours(23, 59, 59, 999);
    const h = new Date(m),
        b = m.getDay(),
        v = 0 === b ? 1 : 8 - b;
    h.setDate(m.getDate() + v), h.setHours(0, 0, 0, 0);
    const y = new Date(m.getFullYear(), m.getMonth() + 1, 1);
    return e.map(e => {
        let n = 0,
            i = null;
        switch (e.progress_type) {
            case "workout_count":
                "daily" === e.mission_type ? (n = p, i = g.toISOString()) : "weekly" === e.mission_type ? (n = o, i = h.toISOString()) : "monthly" === e.mission_type ? (n = AppState.workouts.filter(e => new Date(e.date).getMonth() === m.getMonth()).length, i = y.toISOString()) : n = t;
                break;
            case "pr_count":
                n = a, "weekly" === e.mission_type && (n = 0, i = h.toISOString());
                break;
            case "total_volume_kg":
                "daily" === e.mission_type ? (n = Math.round(u), i = g.toISOString()) : "weekly" === e.mission_type ? (n = Math.round(r), i = h.toISOString()) : "monthly" === e.mission_type && (n = Math.round(AppState.workouts.filter(e => new Date(e.date).getMonth() === m.getMonth()).reduce((e, t) => e + getTotalVolume(t), 0)), i = y.toISOString());
                break;
            case "consecutive_days":
                n = s, "monthly" === e.mission_type && (i = y.toISOString());
                break;
            case "muscle_group_workouts":
                "weekly" === e.mission_type && (n = l, i = h.toISOString())
        }
        const d = n >= e.target;
        return {
            id: "um-" + e.id,
            mission_id: e.id,
            mission: e,
            user_id: AppState.user ? AppState.user.id : "demo",
            progress: Math.min(n, e.target),
            status: d ? "completed" : "in_progress",
            claimed: !1,
            expires_at: i,
            created_at: (new Date).toISOString()
        }
    })
}
async function sbClaimMission(e) {
    const t = AppState.userMissions.find(t => t.id === e);
    if (!t || t.claimed || "completed" !== t.status) return !1;
    const a = t.mission ? t.mission.token_reward : 0;
    if (isDemoMode || !supabaseClient || !AppState.user) {
        t.claimed = !0; t.status = "claimed";
        AppState.tokenBalance = (AppState.tokenBalance || 0) + a;
        AppState.profile.token_balance = AppState.tokenBalance;
        updateTokenDisplay();
        showToast(`Claimed ${a} ⬡ tokens!`, "pr", 4e3);
        return !0;
    }
    try {
        // Computed user missions have IDs like "um-mission-d1" — not real DB rows.
        // Detect this and INSERT a real row first, then claim it.
        const isComputedId = String(e).startsWith("um-");
        if (isComputedId) {
            const missionDbId = t.mission?.id || t.mission_id;
            if (!missionDbId) { console.error("sbClaimMission: no mission_id on computed mission"); return !1; }
            const { data: inserted, error: insertErr } = await supabaseClient
                .from("user_missions")
                .insert({
                    user_id: AppState.user.id,
                    mission_id: missionDbId,
                    progress: t.progress || 0,
                    status: "claimed",
                    claimed: true,
                    claimed_at: new Date().toISOString(),
                    expires_at: t.expires_at || null,
                    created_at: new Date().toISOString()
                })
                .select()
                .single();
            if (insertErr) throw insertErr;
            // Update local state to reflect the real DB id for future operations
            if (inserted) t.id = inserted.id;
        } else {
            const { error: updateErr } = await supabaseClient
                .from("user_missions")
                .update({ claimed: true, status: "claimed", claimed_at: new Date().toISOString() })
                .eq("id", e);
            if (updateErr) throw updateErr;
        }
        await sbEarnTokens(a, "mission_claim");
        t.claimed = !0; t.status = "claimed";
        showToast(`Claimed ${a} ⬡ tokens!`, "pr", 4e3);
        return !0;
    } catch (err) {
        console.error("Failed to claim mission:", err);
        return !1;
    }
}
async function sbLoadCosmetics() {
    if (!isDemoMode && supabaseClient && AppState.user) try {
        const {
            data: e,
            error: t
        } = await supabaseClient.from("cosmetics").select("*");
        if (t) throw t;
        AppState.cosmetics = e && e.length > 0 ? e.map(e => ({
            ...e,
            cost: void 0 !== e.token_cost ? e.token_cost : e.cost,
            category: e.type || e.category
        })) : seedCosmetics()
    } catch (e) {
        console.error("Failed to load cosmetics:", e), AppState.cosmetics = seedCosmetics()
    } else AppState.cosmetics = seedCosmetics()
}
async function sbLoadUserCosmetics() {
    if (!isDemoMode && supabaseClient && AppState.user) try {
        const {
            data: e,
            error: t
        } = await supabaseClient.from("user_cosmetics").select("*").eq("user_id", AppState.user.id);
        if (t) throw t;
        AppState.userCosmetics = e || [];
        const a = new Set((e || []).map(e => e.cosmetic_id)),
            s = AppState.cosmetics.filter(e => 0 === e.cost && !a.has(e.id));
        for (const e of s) await sbPurchaseCosmetic(e.id, !0)
    } catch (e) {
        console.error("Failed to load user cosmetics:", e)
    } else AppState.userCosmetics = seedCosmetics().filter(e => 0 === e.cost).map(e => ({
        id: "uc-" + e.id,
        cosmetic_id: e.id,
        user_id: "demo",
        purchased_at: (new Date).toISOString()
    }))
}
function isOwned(e) {
    return AppState.userCosmetics.some(t => t.cosmetic_id === e)
}
function isEquipped(e) {
    const t = (AppState.cosmetics.length > 0 ? AppState.cosmetics : seedCosmetics()).find(t => t.id === e);
    if (!t) return !1;
    const a = AppState.profile,
        s = t.type || t.category;
    return "badge" === s ? a.equipped_badge === e : "theme" === s ? a.equipped_theme === e : "title" === s ? a.equipped_title === e : "frame" === s && a.equipped_frame === e
}
async function sbPurchaseCosmetic(e, t) {
    const a = (AppState.cosmetics.length > 0 ? AppState.cosmetics : seedCosmetics()).find(t => t.id === e);
    if (!a) return !1;
    if (isOwned(e)) return t || showToast("You already own this!"), !0;
    const s = t ? 0 : a.cost;
    if (!t && s > 0) {
        if (!AppState.profile.is_beta_user && AppState.tokenBalance < s) return showToast("Not enough tokens!", "error"), !1;
        if (!AppState.profile.is_beta_user) {
            if (!await sbSpendTokens(s, "cosmetic_purchase:" + e)) return !1
        }
    }
    if (isDemoMode || !supabaseClient || !AppState.user) return AppState.userCosmetics.push({
        id: "uc-" + e + Date.now(),
        cosmetic_id: e,
        user_id: "demo",
        purchased_at: (new Date).toISOString()
    }), showToast("Cosmetic unlocked!"), !0;
    try {
        if (!await ensureSession()) return !1;
        const {
            data: t,
            error: a
        } = await supabaseClient.from("user_cosmetics").insert({
            user_id: AppState.user.id,
            cosmetic_id: e
        }).select().maybeSingle();
        if (a) throw a;
        return t && !AppState.userCosmetics.some(t => t.cosmetic_id === e) && AppState.userCosmetics.push(t), showToast("Cosmetic unlocked!"), !0
    } catch (t) {
        return console.error("Failed to purchase cosmetic:", t, "cosmeticId:", e, "userId:", AppState.user?.id), t && "23505" === t.code ? (AppState.userCosmetics.some(t => t.cosmetic_id === e) || AppState.userCosmetics.push({
            cosmetic_id: e,
            user_id: AppState.user.id
        }), showToast("Cosmetic unlocked!"), !0) : (showToast("Purchase failed — " + (t?.message || "try again"), "error"), !1)
    }
}
async function sbEquipCosmetic(e) {
    const t = (AppState.cosmetics.length > 0 ? AppState.cosmetics : seedCosmetics()).find(t => t.id === e);
    if (!t) return;
    const a = "badge" === (t.type || t.category) ? "equipped_badge" : "theme" === (t.type || t.category) ? "equipped_theme" : "title" === (t.type || t.category) ? "equipped_title" : "equipped_frame";
    if (isEquipped(e) ? (AppState.profile[a] = null, showToast("Unequipped"), "theme" === (t.category || t.type) && applyTheme(null)) : (AppState.profile[a] = e, showToast("Equipped!"), "theme" === (t.category || t.type) && applyTheme(t), "title" === (t.category || t.type) && showToast(`Title "${t.name}" equipped — visible on your profile!`), "badge" === (t.category || t.type) && showToast(`Badge "${t.name}" equipped — visible on your profile!`), "frame" === (t.category || t.type) && showToast(`Frame "${t.name}" equipped — visible around your avatar!`)), !isDemoMode && supabaseClient && AppState.user) try {
        await supabaseClient.from("profiles").update({
            [a]: AppState.profile[a]
        }).eq("id", AppState.user.id)
    } catch (e) {
        console.error("Failed to equip cosmetic:", e)
    }
}
function applyTheme(e) {
    const t = {
            "--accent": "#f97316",
            "--accent-light": "#fb923c",
            "--accent-dark": "#ea580c",
            "--accent-glow": "rgba(249,115,22,0.15)",
            "--accent-glow-strong": "rgba(249,115,22,0.3)",
            "--bg-primary": "#0a0a0a",
            "--bg-secondary": "#111111",
            "--border-focus": "#f97316"
        },
        a = {
            "theme-default": t,
            "cos-t1": t,
            "theme-blue": {
                "--accent": "#4a7fb5",
                "--accent-light": "#60a0d0",
                "--accent-dark": "#3060a0",
                "--accent-glow": "rgba(74,127,181,0.15)",
                "--accent-glow-strong": "rgba(74,127,181,0.3)",
                "--bg-primary": "#0d1117",
                "--bg-secondary": "#13191f",
                "--border-focus": "#4a7fb5"
            },
            "cos-t2": {
                "--accent": "#4a7fb5",
                "--accent-light": "#60a0d0",
                "--accent-dark": "#3060a0",
                "--accent-glow": "rgba(74,127,181,0.15)",
                "--accent-glow-strong": "rgba(74,127,181,0.3)",
                "--bg-primary": "#0d1117",
                "--bg-secondary": "#13191f",
                "--border-focus": "#4a7fb5"
            },
            "theme-green": {
                "--accent": "#00e676",
                "--accent-light": "#33eb91",
                "--accent-dark": "#00b360",
                "--accent-glow": "rgba(0,230,118,0.15)",
                "--accent-glow-strong": "rgba(0,230,118,0.3)",
                "--bg-primary": "#0a1a0a",
                "--bg-secondary": "#0f1f0f",
                "--border-focus": "#00e676"
            },
            "cos-t3": {
                "--accent": "#00e676",
                "--accent-light": "#33eb91",
                "--accent-dark": "#00b360",
                "--accent-glow": "rgba(0,230,118,0.15)",
                "--accent-glow-strong": "rgba(0,230,118,0.3)",
                "--bg-primary": "#0a1a0a",
                "--bg-secondary": "#0f1f0f",
                "--border-focus": "#00e676"
            },
            "theme-purple": {
                "--accent": "#ab47bc",
                "--accent-light": "#c06cc8",
                "--accent-dark": "#8b2fa0",
                "--accent-glow": "rgba(171,71,188,0.15)",
                "--accent-glow-strong": "rgba(171,71,188,0.3)",
                "--bg-primary": "#150a1a",
                "--bg-secondary": "#1c0f22",
                "--border-focus": "#ab47bc"
            },
            "theme-royal-purple": {
                "--accent": "#ab47bc",
                "--accent-light": "#c06cc8",
                "--accent-dark": "#8b2fa0",
                "--accent-glow": "rgba(171,71,188,0.15)",
                "--accent-glow-strong": "rgba(171,71,188,0.3)",
                "--bg-primary": "#150a1a",
                "--bg-secondary": "#1c0f22",
                "--border-focus": "#ab47bc"
            },
            "cos-t4": {
                "--accent": "#ab47bc",
                "--accent-light": "#c06cc8",
                "--accent-dark": "#8b2fa0",
                "--accent-glow": "rgba(171,71,188,0.15)",
                "--accent-glow-strong": "rgba(171,71,188,0.3)",
                "--bg-primary": "#150a1a",
                "--bg-secondary": "#1c0f22",
                "--border-focus": "#ab47bc"
            },
            "theme-red": {
                "--accent": "#c62828",
                "--accent-light": "#d94040",
                "--accent-dark": "#a01010",
                "--accent-glow": "rgba(198,40,40,0.15)",
                "--accent-glow-strong": "rgba(198,40,40,0.3)",
                "--bg-primary": "#1a0a0a",
                "--bg-secondary": "#210f0f",
                "--border-focus": "#c62828"
            },
            "theme-blood-iron": {
                "--accent": "#c62828",
                "--accent-light": "#d94040",
                "--accent-dark": "#a01010",
                "--accent-glow": "rgba(198,40,40,0.15)",
                "--accent-glow-strong": "rgba(198,40,40,0.3)",
                "--bg-primary": "#1a0a0a",
                "--bg-secondary": "#210f0f",
                "--border-focus": "#c62828"
            },
            "cos-t5": {
                "--accent": "#c62828",
                "--accent-light": "#d94040",
                "--accent-dark": "#a01010",
                "--accent-glow": "rgba(198,40,40,0.15)",
                "--accent-glow-strong": "rgba(198,40,40,0.3)",
                "--bg-primary": "#1a0a0a",
                "--bg-secondary": "#210f0f",
                "--border-focus": "#c62828"
            },
            "theme-gold": {
                "--accent": "#ffd700",
                "--accent-light": "#ffe040",
                "--accent-dark": "#c9a800",
                "--accent-glow": "rgba(255,215,0,0.15)",
                "--accent-glow-strong": "rgba(255,215,0,0.3)",
                "--bg-primary": "#1a1400",
                "--bg-secondary": "#211900",
                "--border-focus": "#ffd700"
            },
            "theme-gold-standard": {
                "--accent": "#ffd700",
                "--accent-light": "#ffe040",
                "--accent-dark": "#c9a800",
                "--accent-glow": "rgba(255,215,0,0.15)",
                "--accent-glow-strong": "rgba(255,215,0,0.3)",
                "--bg-primary": "#1a1400",
                "--bg-secondary": "#211900",
                "--border-focus": "#ffd700"
            },
            "cos-t6": {
                "--accent": "#ffd700",
                "--accent-light": "#ffe040",
                "--accent-dark": "#c9a800",
                "--accent-glow": "rgba(255,215,0,0.15)",
                "--accent-glow-strong": "rgba(255,215,0,0.3)",
                "--bg-primary": "#1a1400",
                "--bg-secondary": "#211900",
                "--border-focus": "#ffd700"
            },
            "theme-midnight-steel": {
                "--accent": "#78909c",
                "--accent-light": "#90a4ae",
                "--accent-dark": "#546e7a",
                "--accent-glow": "rgba(120,144,156,0.15)",
                "--accent-glow-strong": "rgba(120,144,156,0.3)",
                "--bg-primary": "#0a0d10",
                "--bg-secondary": "#0f1318",
                "--border-focus": "#78909c"
            },
            "theme-arctic-forge": {
                "--accent": "#00bcd4",
                "--accent-light": "#26c6da",
                "--accent-dark": "#0097a7",
                "--accent-glow": "rgba(0,188,212,0.15)",
                "--accent-glow-strong": "rgba(0,188,212,0.3)",
                "--bg-primary": "#0a1214",
                "--bg-secondary": "#0f181a",
                "--border-focus": "#00bcd4"
            },
            "theme-neon-pump": {
                "--accent": "#e040fb",
                "--accent-light": "#ea80fc",
                "--accent-dark": "#aa00ff",
                "--accent-glow": "rgba(224,64,251,0.15)",
                "--accent-glow-strong": "rgba(224,64,251,0.3)",
                "--bg-primary": "#140a18",
                "--bg-secondary": "#1a0f20",
                "--border-focus": "#e040fb"
            }
        },
        s = e ? e.css_class || e.id : null,
        n = s && (a[s] || a[e.id]) || t,
        i = document.documentElement;
    Object.entries(n).forEach(([e, t]) => i.style.setProperty(e, t)), AppState._activeThemeId = e ? e.id : null
}
async function sbLoadSubscription() {
    if (!isDemoMode && supabaseClient && AppState.user) try {
        const {
            data: e,
            error: t
        } = await supabaseClient.from("subscriptions").select("*").eq("user_id", AppState.user.id).eq("status", "active").maybeSingle();
        if (t) throw t;
        AppState.subscription = e || {
            plan: AppState.profile.subscription_plan || "free",
            status: "active"
        }
    } catch (e) {
        console.error("Failed to load subscription:", e), AppState.subscription = {
            plan: "free",
            status: "active"
        }
    } else AppState.subscription = {
        plan: AppState.profile.subscription_plan || "free",
        status: "active"
    }
}
async function sbLogFraudFlag(e, t, a) {
    if (!isDemoMode && supabaseClient && AppState.user) try {
        await supabaseClient.from("fraud_flags").insert({
            user_id: AppState.user.id,
            workout_id: e,
            reason: t,
            severity: a || "low",
            created_at: (new Date).toISOString()
        })
    } catch (e) {
        console.error("Failed to log fraud flag:", e)
    } else console.warn("Fraud flag (demo):", t)
}
async function checkFraudAndEarnTokens(e, t) {
    const a = e.exercises.reduce((e, t) => e + (t.sets || []).length, 0),
        s = e.duration_seconds || 0,
        n = 45 * a,
        i = AppState.profile.is_beta_user,
        o = new Date,
        r = o.toISOString().slice(0, 10),
        l = AppState.profile.last_workout_credited_at;
    let d = AppState.profile.daily_workout_count || 0;
    if (l && new Date(l).toISOString().slice(0, 10) === r || (d = 0), !i && d >= 3) return await sbLogFraudFlag(t, "daily_cap_exceeded", "low"), void showToast("Workout saved! Daily token limit reached (3/day).", "success");
    if (!i && s > 0 && s < n) return await sbLogFraudFlag(t, "too_short_duration", "medium"), void showToast("Workout saved! Token credit requires minimum workout duration.", "success");
    const c = AppState.profile.weekly_tokens_earned || 0;
    if (!i && c >= 150) return await sbLogFraudFlag(t, "weekly_cap_exceeded", "low"), void showToast("Workout saved! Weekly token limit reached.", "success");
    let p = !1;
    for (const a of e.exercises) {
        const e = AppState.personalRecords[a.exercise_id];
        if (e && e.max_weight > 0) {
            Math.max(...(a.sets || []).map(e => e.weight_kg || 0), 0) > 1.3 * e.max_weight && (p = !0, await sbLogFraudFlag(t, "suspicious_weight_jump:" + a.exercise_name, "medium"))
        }
    }
    const u = d + 1;
    let m = 0;
    if (1 === u ? m = 3 : 2 === u ? m = 2 : 3 === u && (m = 1), AppState.profile.daily_workout_count = u, AppState.profile.last_workout_credited_at = o.toISOString(), AppState.profile.weekly_tokens_earned = c + m, !isDemoMode && supabaseClient && AppState.user) try {
        await supabaseClient.from("profiles").update({
            daily_workout_count: u,
            last_workout_credited_at: o.toISOString(),
            weekly_tokens_earned: c + m
        }).eq("id", AppState.user.id)
    } catch (e) {
        console.error("Failed to update workout count:", e)
    }
    await sbEarnTokens(m, "workout_complete"), await sbLogTokenLedger(m, "workout_complete", "earn"), p ? showToast(`Workout saved! +${m} ⬡ tokens earned (suspicious weight flagged for review).`) : showToast(`Workout complete! +${m} ⬡ tokens earned. 💪`, "pr", 4e3);
    const g = AppState.userMissions,
        h = computeUserMissions();
    h.forEach(e => {
        const t = g.find(t => t.id === e.id);
        t && (t.claimed || "claimed" === t.status) && (e.claimed = !0, e.status = "claimed")
    }), AppState.userMissions = h
}
function renderMissions(e) {
    0 === AppState.missions.length && (AppState.missions = seedMissions()), 0 === AppState.userMissions.length && (AppState.userMissions = computeUserMissions());
    const t = AppState.profile.is_beta_user,
        a = AppState.userMissions.filter(e => e.mission && "daily" === e.mission.mission_type),
        s = AppState.userMissions.filter(e => e.mission && "weekly" === e.mission.mission_type),
        n = AppState.userMissions.filter(e => e.mission && "monthly" === e.mission.mission_type),
        i = AppState.userMissions.filter(e => e.mission && "chain" === e.mission.mission_type);
    function renderMissionCard(e) {
        const t = e.mission;
        if (!t) return "";
        const a = Math.min(100, Math.round(e.progress / t.target * 100)),
            s = "completed" === e.status && !e.claimed,
            n = e.claimed || "claimed" === e.status,
            i = e.expires_at ? (() => {
                const t = Math.ceil((new Date(e.expires_at) - new Date) / 36e5);
                return t < 1 ? "Expires soon" : t < 24 ? `${t}h left` : `${Math.ceil(t/24)}d left`
            })() : "",
            o = "total_volume_kg" === t.progress_type,
            r = getUnitLabel(),
            l = o ? Math.round(kgToDisplay(e.progress)) : e.progress,
            d = o ? Math.round(kgToDisplay(t.target)) : t.target,
            c = o ? t.description.replace(/([\d,]+)\s*kg/gi, (e, t) => {
                const a = parseFloat(t.replace(/,/g, ""));
                return Math.round(kgToDisplay(a)).toLocaleString() + " " + r
            }) : t.description;
        return `\n      <div class="mission-card ${n?"mission-claimed":""} ${s?"mission-claimable":""}">\n        <div class="mission-card-header">\n          <div class="mission-icon">${t.icon||"🎯"}</div>\n          <div class="mission-info">\n            <div class="mission-title">${t.title}</div>\n            <div class="mission-desc">${c}</div>\n            ${i?`<div class="mission-expires">${i}</div>`:""}\n          </div>\n          <div class="mission-reward">\n            <span class="token-reward">${t.token_reward}</span>\n            <span class="token-icon-sm">⬡</span>\n          </div>\n        </div>\n        <div class="mission-progress-row">\n          <div class="progress-bar-bg" style="flex:1;">\n            <div class="progress-bar-fill" style="width:${a}%;"></div>\n          </div>\n          <span class="mission-progress-label">${l}/${d}${o?" "+r:""}</span>\n          ${s?`<button class="btn btn-primary btn-sm mission-claim-btn" data-umid="${e.id}">Claim</button>`:""}\n          ${n?'<span class="mission-claimed-badge">✓ Claimed</span>':""}\n        </div>\n      </div>\n    `
    }
    function renderMissionSection(e, t, a) {
        return 0 === t.length ? "" : `\n      <div class="mission-section">\n        <div class="mission-section-header">\n          <span class="mission-section-icon">${a}</span>\n          <h3 class="mission-section-title">${e}</h3>\n        </div>\n        ${t.map(renderMissionCard).join("")}\n      </div>\n    `
    }
    const o = {};
    i.forEach(e => {
        const t = e.mission && e.mission.chain_name || "Epic Mission";
        o[t] || (o[t] = []), o[t].push(e)
    }), e.innerHTML = `\n    <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;margin-bottom:24px;">\n      <div>\n        <div class="page-title">Missions 🎯</div>\n        <div class="page-subtitle">Complete missions to earn ⬡ tokens</div>\n      </div>\n      <div class="token-balance-card">\n        <span class="token-balance-icon">⬡</span>\n        <span class="token-balance-amount token-balance-display">${AppState.tokenBalance}</span>\n        <span class="token-balance-label">tokens</span>\n        ${t?'<span class="badge-beta">BETA</span>':""}\n      </div>\n    </div>\n\n    <div id="missions-content">\n      ${renderMissionSection("Daily Missions",a,"☀️")}\n      ${renderMissionSection("Weekly Missions",s,"📅")}\n      ${renderMissionSection("Monthly Missions",n,"🏆")}\n      ${Object.entries(o).map(([e,t])=>`\n        <div class="mission-section epic-section">\n          <div class="mission-section-header">\n            <span class="mission-section-icon">⚡</span>\n            <h3 class="mission-section-title">Epic: ${e}</h3>\n          </div>\n          <div class="chain-missions-container">\n            ${t.map(renderMissionCard).join("")}\n          </div>\n        </div>\n      `).join("")}\n    </div>\n\n    ${0===a.length&&0===s.length?'\n      <div class="empty-state">\n        <div class="empty-state-icon">🎯</div>\n        <div class="empty-state-title">No missions available</div>\n        <div class="empty-state-text">Log some workouts to unlock missions!</div>\n        <a href="#/workout/new" class="btn btn-primary" style="margin-top:16px;">Start a Workout</a>\n      </div>\n    ':""}\n  `, e.querySelectorAll(".mission-claim-btn").forEach(t => {
        t.addEventListener("click", async () => {
            const a = t.dataset.umid;
            t.disabled = !0, t.textContent = "Claiming...";
            await sbClaimMission(a) ? renderMissions(e) : (t.disabled = !1, t.textContent = "Claim")
        })
    })
}
function renderShop(e) {
    0 === AppState.cosmetics.length && (AppState.cosmetics = seedCosmetics());
    const t = AppState.profile.is_beta_user;
    let a = "all";
    ! function render() {
        const s = {
            all: "All",
            owned: "My Collection",
            badge: "Badges",
            theme: "Themes",
            title: "Titles",
            frame: "Frames"
        };
        let n;
        n = "all" === a ? AppState.cosmetics : "owned" === a ? AppState.cosmetics.filter(e => isOwned(e.id)) : AppState.cosmetics.filter(e => function getCosmeticType(e) {
            return e.type || e.category || ""
        }(e) === a);
        const i = {
            common: {
                bg: "rgba(158,158,158,0.08)",
                border: "#9e9e9e",
                text: "#9e9e9e",
                label: "Common",
                shadow: "none"
            },
            rare: {
                bg: "rgba(33,150,243,0.08)",
                border: "#2196F3",
                text: "#2196F3",
                label: "Rare",
                shadow: "0 0 10px rgba(33,150,243,0.35)"
            },
            epic: {
                bg: "rgba(156,39,176,0.08)",
                border: "#9C27B0",
                text: "#CE93D8",
                label: "Epic",
                shadow: "0 0 12px rgba(156,39,176,0.40)"
            },
            legendary: {
                bg: "rgba(255,215,0,0.08)",
                border: "#FFD700",
                text: "#FFD700",
                label: "Legendary",
                shadow: "0 0 16px rgba(255,215,0,0.45)"
            }
        };
        e.innerHTML = `\n      <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;margin-bottom:24px;">\n        <div>\n          <div class="page-title">Cosmetics Shop 🛒</div>\n          <div class="page-subtitle">Spend tokens to unlock cosmetics</div>\n        </div>\n        <div class="token-balance-card">\n          <span class="token-balance-icon">⬡</span>\n          <span class="token-balance-amount token-balance-display">${AppState.tokenBalance}</span>\n          <span class="token-balance-label">tokens</span>\n          ${t?'<span class="badge-beta">BETA</span>':""}\n        </div>\n      </div>\n\n      ${t?'<div class="beta-notice">🎖️ <strong>Beta Access:</strong> All cosmetics are FREE for you! Costs shown are for regular users.</div>':""}\n\n      <div class="filter-row" style="margin-bottom:20px;">\n        ${["all","owned","badge","theme","title","frame"].map(e=>`<button class="filter-chip ${a===e?"active":""}" data-cat="${e}">${s[e]}</button>`).join("")}\n      </div>\n\n      <div class="shop-grid">\n        ${0===n.length&&"owned"===a?'\n          <div style="grid-column:1/-1;padding:40px;text-align:center;color:var(--text-secondary);">\n            <div style="font-size:32px;margin-bottom:12px;">🎒</div>\n            <div style="font-weight:600;margin-bottom:6px;">No items in your collection yet</div>\n            <div style="font-size:13px;">Purchase items from the shop to build your collection.</div>\n          </div>\n        ':n.map(e=>{const a=i[e.rarity]||i.common,s=isOwned(e.id),n=isEquipped(e.id),o=e.cost,r=t||AppState.tokenBalance>=o||0===o;return`\n            <div class="shop-item" style="border-color:${a.border};background:${a.bg};box-shadow:${a.shadow};">\n              <div class="shop-item-rarity" style="color:${a.text};">${a.label}</div>\n              <div class="shop-item-icon">${e.icon||"🎁"}</div>\n              <div class="shop-item-name">${e.name}</div>\n              <div class="shop-item-desc">${e.description}</div>\n              <div class="shop-item-cost">\n                ${0===o?'<span style="color:var(--success);font-weight:700;">FREE</span>':t?`<span style="color:var(--success);font-weight:700;">FREE</span> <span style="text-decoration:line-through;color:var(--text-tertiary);font-size:11px;">${o} ⬡</span>`:`<span class="token-icon-sm">⬡</span> <span style="font-weight:700;">${o}</span>`}\n              </div>\n              <div class="shop-item-actions">\n                ${n?`<button class="btn btn-secondary btn-sm w-full shop-unequip-btn" data-cid="${e.id}">Unequip</button>`:s?`<button class="btn btn-primary btn-sm w-full shop-equip-btn" data-cid="${e.id}">Equip</button>`:`<button class="btn btn-primary btn-sm w-full shop-buy-btn ${r?"":"disabled-btn"}" data-cid="${e.id}" ${r?"":"disabled"}>${r?"Purchase":"Need More ⬡"}</button>`}\n              </div>\n            </div>\n          `}).join("")}\n      </div>\n\n      <div style="margin-top:24px;">\n        <button class="btn btn-accent w-full" id="mystery-box-btn" style="background:linear-gradient(135deg,#a855f7,#ec4899);border:none;color:#fff;padding:14px;font-size:15px;font-weight:700;border-radius:var(--radius-md);cursor:pointer;display:flex;align-items:center;justify-content:center;gap:10px;">\n          <span style="font-size:20px;">🎁</span> Mystery Box — Spend 30 ⬡ for a random cosmetic\n        </button>\n      </div>\n    `, e.querySelectorAll(".filter-chip").forEach(e => {
            e.addEventListener("click", () => {
                a = e.dataset.cat, render()
            })
        }), e.querySelectorAll(".shop-buy-btn").forEach(e => {
            e.addEventListener("click", async () => {
                const t = e.dataset.cid;
                e.disabled = !0, e.textContent = "...";
                await sbPurchaseCosmetic(t, !1) ? render() : (e.disabled = !1, e.textContent = "Purchase")
            })
        }), e.querySelectorAll(".shop-equip-btn").forEach(e => {
            e.addEventListener("click", async () => {
                await sbEquipCosmetic(e.dataset.cid), render()
            })
        }), e.querySelectorAll(".shop-unequip-btn").forEach(e => {
            e.addEventListener("click", async () => {
                await sbEquipCosmetic(e.dataset.cid), render()
            })
        });
        const o = e.querySelector("#mystery-box-btn");
        o && o.addEventListener("click", async () => {
            if (!t && AppState.tokenBalance < 30) return void showToast("Need 30 ⬡ tokens for a Mystery Box!", "error");
            const e = document.createElement("div");
            e.style.cssText = "position:fixed;inset:0;background:rgba(0,0,0,0.85);z-index:9999;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:20px;", e.innerHTML = '\n          <div id="mystery-spinner" style="font-size:64px;animation:spin 0.4s linear infinite;">🎁</div>\n          <div style="font-size:18px;font-weight:700;color:#fff;">Opening Mystery Box...</div>\n          <style>@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}</style>\n        ', document.body.appendChild(e), await new Promise(e => setTimeout(e, 1800));
            const a = 100 * Math.random();
            let s;
            s = a < 50 ? "common" : a < 80 ? "rare" : a < 95 ? "epic" : "legendary";
            const n = AppState.cosmetics.length > 0 ? AppState.cosmetics : seedCosmetics(),
                i = n.filter(e => e.rarity === s && !isOwned(e.id)),
                o = i.length > 0 ? i : n.filter(e => e.rarity === s);
            if (0 === o.length) return e.remove(), void showToast("No cosmetics available!", "error");
            const r = o[Math.floor(Math.random() * o.length)];
            t || await sbSpendTokens(30, "mystery_box"), isOwned(r.id) || await sbPurchaseCosmetic(r.id, !0);
            e.innerHTML = `\n          <div style="font-size:72px;animation:pop 0.5s ease;">${r.icon||"🎁"}</div>\n          <div style="font-size:22px;font-weight:800;color:${{common:"#9e9e9e",rare:"#2196F3",epic:"#CE93D8",legendary:"#FFD700"}[s]||"#fff"};text-transform:uppercase;letter-spacing:2px;">${s}</div>\n          <div style="font-size:18px;font-weight:700;color:#fff;">${r.name}</div>\n          <div style="font-size:13px;color:#aaa;">${r.description}</div>\n          <button id="mystery-close" style="margin-top:16px;padding:12px 32px;background:var(--accent);color:#fff;border:none;border-radius:8px;font-size:15px;font-weight:700;cursor:pointer;">Awesome!</button>\n          <style>@keyframes pop{0%{transform:scale(0)}60%{transform:scale(1.2)}100%{transform:scale(1)}}</style>\n        `, e.querySelector("#mystery-close").addEventListener("click", () => {
                e.remove(), render()
            })
        })
    }()
}
function renderSubscription(e) {
    const t = AppState.profile.is_beta_user,
        a = (AppState.profile.is_premium, AppState.subscription ? AppState.subscription.plan : AppState.profile.subscription_plan || "free");
    e.innerHTML = `\n    <div class="page-title">Subscription 💳</div>\n    <div class="page-subtitle">Unlock the full power of IronPact</div>\n\n    ${t?'\n      <div class="beta-premium-banner">\n        <div class="beta-banner-icon">🎖️</div>\n        <div>\n          <div style="font-family:var(--font-display);font-weight:700;font-size:16px;">Beta Access — Free Premium!</div>\n          <div style="font-size:13px;color:var(--text-secondary);margin-top:4px;">As a beta user, you have free access to all premium features. Thank you for helping us build IronPact!</div>\n        </div>\n        <span class="badge-beta" style="font-size:14px;padding:6px 14px;">BETA</span>\n      </div>\n    ':""}\n\n    <div class="plans-grid">\n      ${[{id:"free",name:"Free",price:"$0",period:"forever",color:"var(--text-secondary)",features:["5 workouts/month","50 exercises","Basic stats","10 token daily limit","Access to Missions","Community access"]},{id:"weekly",name:"Weekly",price:"$0.99",period:"/week",color:"#60a5fa",popular:!1,features:["Unlimited workouts","All 135+ exercises","Advanced analytics","30 tokens/day","AI Plan Generator","Priority coaching"]},{id:"monthly",name:"Monthly",price:"$2.99",period:"/month",color:"var(--accent)",popular:!0,features:["Everything in Weekly","Body composition tracking","Social pacts","50 tokens/day","Custom workout names","Export data"]},{id:"quarterly",name:"3 Months",price:"$7.99",period:"/3 months",color:"#a78bfa",popular:!1,features:["Everything in Monthly","Save 11%","75 tokens/day","Early access features","Priority support","Cosmetics shop discount"]},{id:"yearly",name:"Yearly",price:"$24.99",period:"/year",color:"#fbbf24",popular:!1,features:["Everything in 3 Months","Save 47%","150 tokens/day","Exclusive yearly badge","Unlimited AI plans","Founding member perks"]}].map(e=>`\n        <div class="plan-card ${a===e.id?"plan-current":""} ${e.popular?"plan-popular":""}" style="--plan-color:${e.color};">\n          ${e.popular?'<div class="plan-popular-badge">Most Popular</div>':""}\n          <div class="plan-name">${e.name}</div>\n          <div class="plan-price">\n            <span class="plan-price-value">${e.price}</span>\n            <span class="plan-price-period">${e.period}</span>\n          </div>\n          <ul class="plan-features">\n            ${e.features.map(e=>`<li><span style="color:var(--success);">✓</span> ${e}</li>`).join("")}\n          </ul>\n          ${a===e.id?'<div class="btn btn-secondary w-full" style="text-align:center;cursor:default;opacity:0.7;">Current Plan</div>':"free"===e.id?'<div class="btn btn-ghost w-full" style="text-align:center;cursor:default;">Free Forever</div>':`<button class="btn btn-primary w-full subscribe-btn" data-plan="${e.id}" ${t?'title="You have free beta access!"':""}>\n                ${t?"Already Unlocked ✓":"Subscribe — Coming Soon"}\n               </button>`}\n        </div>\n      `).join("")}\n    </div>\n\n    <div class="card" style="margin-top:24px;max-width:640px;">\n      <div class="card-header">\n        <h3 class="card-title">Free vs Premium</h3>\n      </div>\n      <div class="comparison-table">\n        <div class="comparison-row comparison-header">\n          <div>Feature</div>\n          <div>Free</div>\n          <div>Premium</div>\n        </div>\n        ${[["Workout Logging","✓","✓"],["Exercise Library","50 exercises","135+ exercises"],["AI Plan Generator","✗","✓ Unlimited"],["Analytics & Charts","Basic","Full suite"],["Token Earnings","10/day","Up to 150/day"],["Missions","✓","✓ + Bonus"],["Social Pacts","✗","✓"],["Body Composition","✗","✓"],["Coaching Tips","Basic","Advanced"],["Support","Community","Priority"]].map(([e,t,a])=>`\n          <div class="comparison-row">\n            <div>${e}</div>\n            <div style="color:${"✗"===t?"var(--danger)":"var(--success)"};">${t}</div>\n            <div style="color:${"✗"===a?"var(--danger)":"var(--accent)"};">${a}</div>\n          </div>\n        `).join("")}\n      </div>\n    </div>\n\n    <div style="text-align:center;margin-top:24px;font-size:13px;color:var(--text-tertiary);">\n      Payment processing coming soon. Currently in beta — all features free.\n    </div>\n  `,e.querySelectorAll(".subscribe-btn").forEach(e=>{e.addEventListener("click",()=>{e.hasAttribute("data-plan")&&showToast("Payment system coming soon! Stay tuned.","success",4e3)})})}
// ═══════════════════════════════════════════════════════════════════
//  AI COACH  — v1 front-end (backend stub included, not wired yet)
// ═══════════════════════════════════════════════════════════════════
const COACH_TOKEN_COST = 50; // tokens per question
// AI Coach Backend — calls Anthropic claude-haiku-4-5 directly from client.
// NOTE: This uses the Anthropic API key stored client-side which is acceptable
// for a beta app with trusted users. For production, move to a Supabase edge
// function that proxies the request so the key stays server-side.
const ANTHROPIC_API_KEY = ""; // ← CEO: paste your Anthropic API key here
async function callBackendCoachAPI(question, context) {
    if (!ANTHROPIC_API_KEY) {
        return { answer: "AI Coach not yet configured. Add your Anthropic API key to ANTHROPIC_API_KEY in app.js to enable live coaching." };
    }
    // Build a terse but rich system prompt from user context
    const recentSummary = (context.recentWorkouts || []).slice(0, 3).map(w => {
        const exList = (w.exercises || []).slice(0, 4).map(ex => {
            const topSet = (ex.sets || []).slice(-1)[0];
            return topSet ? `${ex.name} ${topSet.weight}kg×${topSet.reps}` : ex.name;
        }).join(", ");
        return `${new Date(w.date).toLocaleDateString("en-US",{month:"short",day:"numeric"})}: ${exList}`;
    }).join("\n");
    const systemPrompt = `You are an expert strength and conditioning coach embedded in IronPact, a fitness app. Keep responses concise (under 200 words). Be direct, practical, and evidence-based. No fluff.
User profile:
- Goal: ${context.profile?.goal || "general fitness"}
- Experience: ${context.profile?.experience || "intermediate"}
- Login streak: ${context.profile?.streak || 0} days
Recent workouts:
${recentSummary || "No recent workouts logged yet."}
Answer the user's question with specific, actionable advice tailored to their data.`;
    try {
        const resp = await fetch("https://api.anthropic.com/v1/messages", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "x-api-key": ANTHROPIC_API_KEY,
                "anthropic-version": "2023-06-01",
                "anthropic-dangerous-direct-browser-access": "true"
            },
            body: JSON.stringify({
                model: "claude-haiku-4-5",
                max_tokens: 400,
                system: systemPrompt,
                messages: [{ role: "user", content: question }]
            })
        });
        if (!resp.ok) {
            const err = await resp.json().catch(() => ({}));
            console.error("[Coach] Anthropic API error:", err);
            return { answer: "Coach is unavailable right now. Please try again shortly." };
        }
        const data = await resp.json();
        const answer = data.content?.[0]?.text || "No response received.";
        return { answer };
    } catch (err) {
        console.error("[Coach] Network error:", err);
        return { answer: "Coach is unavailable — check your internet connection." };
    }
}
function renderCoach(container) {
    const isBeta = AppState.profile.is_beta_user;
    const costLabel = isBeta
        ? '<span style="color:var(--success);font-weight:700;">FREE</span> <span style="text-decoration:line-through;color:var(--text-tertiary);font-size:11px;">50 ⬡</span>'
        : `<span>50 ⬡</span>`;
    const logs = AppState.coachingLogs || [];
    function renderLogList() {
        if (logs.length === 0) return `
            <div class="empty-state" style="padding:48px;">
                <div class="empty-state-icon">🤖</div>
                <div class="empty-state-title">No coaching sessions yet</div>
                <div class="empty-state-text">Ask your first question to get personalised advice from your AI coach.</div>
            </div>`;
        return logs.map(log => `
            <div class="card" style="margin-bottom:12px;border-left:3px solid var(--accent);">
                <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;margin-bottom:8px;">
                    <div style="font-size:13px;font-weight:700;color:var(--accent);">You asked:</div>
                    <div style="font-size:11px;color:var(--text-tertiary);flex-shrink:0;">${formatDate(log.created_at)}</div>
                </div>
                <div style="font-size:14px;color:var(--text-primary);margin-bottom:10px;">${log.message || log.question || ""}</div>
                <div style="font-size:13px;font-weight:700;color:var(--text-secondary);margin-bottom:6px;">Coach:</div>
                <div style="font-size:14px;color:var(--text-primary);line-height:1.6;">
                    ${log.response || log.answer || '<em style="color:var(--text-tertiary);">Waiting for response…</em>'}
                </div>
                <button class="btn btn-ghost btn-sm" data-dismiss-log="${log.id}" style="margin-top:10px;color:var(--text-tertiary);font-size:11px;">Dismiss</button>
            </div>
        `).join('');
    }
    container.innerHTML = `
        <div class="page-title">AI Coach 🤖</div>
        <div class="page-subtitle">Ask anything about your training. Each question costs ${costLabel} tokens.</div>
        <div class="card" style="margin-bottom:24px;">
            <div class="card-header">
                <h3 class="card-title">Ask Your Coach</h3>
                <span style="font-size:12px;color:var(--text-tertiary);">Balance: ${AppState.tokenBalance || 0} ⬡</span>
            </div>
            <div style="display:flex;flex-direction:column;gap:12px;">
                <textarea id="coach-question-input" class="form-input" rows="3"
                    placeholder="e.g. Why is my bench press stalling? How should I program deloads?"
                    style="resize:vertical;min-height:80px;"></textarea>
                <div style="display:flex;align-items:center;gap:12px;">
                    <button id="coach-ask-btn" class="btn btn-primary" style="flex-shrink:0;">
                        Ask Coach — ${costLabel}
                    </button>
                    <span id="coach-status" style="font-size:12px;color:var(--text-secondary);"></span>
                </div>
            </div>
        </div>
        <div class="card-header" style="margin-bottom:12px;">
            <h3 class="card-title" style="margin:0;">Previous Sessions</h3>
        </div>
        <div id="coach-log-list">
            ${renderLogList()}
        </div>
    `;
    const askBtn = container.querySelector('#coach-ask-btn');
    const inputEl = container.querySelector('#coach-question-input');
    const statusEl = container.querySelector('#coach-status');
    // Dismiss buttons
    container.querySelectorAll('[data-dismiss-log]').forEach(btn => {
        btn.addEventListener('click', async () => {
            const logId = btn.dataset.dismissLog;
            await sbDismissCoachingTip(logId);
            renderCoach(container);
        });
    });
    askBtn.addEventListener('click', async () => {
        const question = inputEl.value.trim();
        if (!question) { showToast('Please enter a question', 'error'); return; }
        const cost = isBeta ? 0 : COACH_TOKEN_COST;
        if (!isBeta && (AppState.tokenBalance || 0) < COACH_TOKEN_COST) {
            showToast('Not enough tokens! Earn more by completing workouts and missions.', 'error');
            return;
        }
        askBtn.disabled = true;
        statusEl.textContent = 'Asking coach…';
        // Deduct tokens immediately (optimistic)
        if (!isBeta && cost > 0) {
            await sbSpendTokens(cost, 'ai_coaching');
            container.querySelector('.card-header span').textContent = `Balance: ${AppState.tokenBalance || 0} ⬡`;
        }
        // Build context from recent workouts for the coach
        const recentWorkouts = (AppState.workouts || []).slice(0, 5).map(w => ({
            name: w.name,
            date: w.date,
            exercises: (w.exercises || []).map(ex => ({
                name: ex.name,
                sets: (ex.sets || []).filter(s => s.completed !== false).map(s => ({
                    weight: s.weight_kg, reps: s.reps
                }))
            }))
        }));
        const context = {
            profile: {
                goal: AppState.profile.goal,
                experience: AppState.profile.experience,
                streak: AppState.profile.login_streak || 0
            },
            recentWorkouts
        };
        // Optimistic entry — shows immediately while awaiting response
        const optimisticLog = {
            id: 'optimistic-' + Date.now(),
            message: question,
            question: question,
            response: null,
            answer: null,
            created_at: new Date().toISOString()
        };
        AppState.coachingLogs.unshift(optimisticLog);
        container.querySelector('#coach-log-list').innerHTML = renderLogList();
        try {
            // ── TODO: replace callBackendCoachAPI with real edge function ──
            const result = await callBackendCoachAPI(question, context);
            const answer = result?.answer || "No response received.";
            // Persist to DB (sbSaveCoachingLog handles demo/live branching)
            const saved = await sbSaveCoachingLog({
                message: question,
                response: answer,
                log_type: 'ai_coaching'
            });
            // Replace optimistic entry with real one
            const idx = AppState.coachingLogs.findIndex(l => l.id === optimisticLog.id);
            if (idx !== -1) AppState.coachingLogs.splice(idx, 1, saved || { ...optimisticLog, response: answer, answer });
            inputEl.value = '';
            statusEl.textContent = '';
            container.querySelector('#coach-log-list').innerHTML = renderLogList();
            container.querySelectorAll('[data-dismiss-log]').forEach(btn => {
                btn.addEventListener('click', async () => {
                    await sbDismissCoachingTip(btn.dataset.dismissLog);
                    renderCoach(container);
                });
            });
        } catch (err) {
            console.error('Coach error:', err);
            showToast('Failed to get coaching response', 'error');
            // Remove optimistic entry on error
            AppState.coachingLogs = AppState.coachingLogs.filter(l => l.id !== optimisticLog.id);
            // Refund tokens on error
            if (!isBeta && cost > 0) await sbEarnTokens(cost, 'coaching_refund');
            container.querySelector('#coach-log-list').innerHTML = renderLogList();
        } finally {
            askBtn.disabled = false;
            statusEl.textContent = '';
        }
    });
}
function renderTokenBadge(){const e=AppState.profile.is_beta_user;return`\n    <div class="sidebar-token-display">\n      <span class="token-icon-sm">⬡</span>\n      <span class="token-balance-display">${AppState.tokenBalance||0}</span>\n      <span style="font-size:11px;color:var(--text-tertiary);">tokens</span>\n      ${e?'<span class="badge-beta" style="font-size:9px;padding:2px 6px;margin-left:2px;">BETA</span>':""}\n    </div>\n  `}function getTokenCostDisplay(e){return AppState.profile.is_beta_user?`<span style="color:var(--success);font-weight:700;">FREE</span> <span style="text-decoration:line-through;color:var(--text-tertiary);font-size:11px;">${e} ⬡</span>`:`<span>${e} ⬡</span>`}AppState.tokenBalance=0,AppState.missions=[],AppState.userMissions=[],AppState.cosmetics=[],AppState.userCosmetics=[],AppState.subscription=null,Object.assign(AppState.profile,{token_balance:0,is_beta_user:!1,is_premium:!1,subscription_plan:"free",equipped_title:null,equipped_badge:null,equipped_theme:null,equipped_frame:null,daily_workout_count:0,last_workout_credited_at:null,weekly_tokens_earned:0,week_reset_at:null});const _originalHandleRoute=handleRoute;handleRoute=function handleRoute(){const e=(window.location.hash||"#/").slice(1)||"/";if("/missions"===e){if(!AppState.isAuthenticated)return void(window.location.hash="#/");const e=document.getElementById("sidebar"),t=document.getElementById("bottom-nav"),a=document.getElementById("demo-badge");e&&(e.classList.remove("hidden"),e.style.display=""),t&&(t.classList.remove("hidden"),t.style.display=""),a&&(isDemoMode?a.classList.remove("hidden"):a.classList.add("hidden")),updateActiveNav("/missions");const s=document.getElementById("view-container");return s.innerHTML="",s.className="view-enter",Object.keys(AppState.chartInstances).forEach(e=>{AppState.chartInstances[e]&&(AppState.chartInstances[e].destroy(),delete AppState.chartInstances[e])}),void renderMissions(s)}if("/shop"===e){if(!AppState.isAuthenticated)return void(window.location.hash="#/");const e=document.getElementById("sidebar"),t=document.getElementById("bottom-nav"),a=document.getElementById("demo-badge");e&&(e.classList.remove("hidden"),e.style.display=""),t&&(t.classList.remove("hidden"),t.style.display=""),a&&(isDemoMode?a.classList.remove("hidden"):a.classList.add("hidden")),updateActiveNav("/shop");const s=document.getElementById("view-container");return s.innerHTML="",s.className="view-enter",Object.keys(AppState.chartInstances).forEach(e=>{AppState.chartInstances[e]&&(AppState.chartInstances[e].destroy(),delete AppState.chartInstances[e])}),void renderShop(s)}if("/subscription"===e){if(!AppState.isAuthenticated)return void(window.location.hash="#/");const e=document.getElementById("sidebar"),t=document.getElementById("bottom-nav"),a=document.getElementById("demo-badge");e&&(e.classList.remove("hidden"),e.style.display=""),t&&(t.classList.remove("hidden"),t.style.display=""),a&&(isDemoMode?a.classList.remove("hidden"):a.classList.add("hidden")),updateActiveNav("/subscription");const s=document.getElementById("view-container");return s.innerHTML="",s.className="view-enter",Object.keys(AppState.chartInstances).forEach(e=>{AppState.chartInstances[e]&&(AppState.chartInstances[e].destroy(),delete AppState.chartInstances[e])}),void renderSubscription(s)}if("/coach"===e){if(!AppState.isAuthenticated)return void(window.location.hash="#/");const e=document.getElementById("sidebar"),t=document.getElementById("bottom-nav"),a=document.getElementById("demo-badge");e&&(e.classList.remove("hidden"),e.style.display=""),t&&(t.classList.remove("hidden"),t.style.display=""),a&&(isDemoMode?a.classList.remove("hidden"):a.classList.add("hidden")),updateActiveNav("/coach");const s=document.getElementById("view-container");return s.innerHTML="",s.className="view-enter",Object.keys(AppState.chartInstances).forEach(e=>{AppState.chartInstances[e]&&(AppState.chartInstances[e].destroy(),delete AppState.chartInstances[e])}),void renderCoach(s)}if("/support"===e){if(!AppState.isAuthenticated)return void(window.location.hash="#/");const e=document.getElementById("sidebar"),t=document.getElementById("bottom-nav"),a=document.getElementById("demo-badge");e&&(e.classList.remove("hidden"),e.style.display=""),t&&(t.classList.remove("hidden"),t.style.display=""),a&&(isDemoMode?a.classList.remove("hidden"):a.classList.add("hidden")),updateActiveNav("/support");const s=document.getElementById("view-container");return s.innerHTML="",s.className="view-enter",Object.keys(AppState.chartInstances).forEach(e=>{AppState.chartInstances[e]&&(AppState.chartInstances[e].destroy(),delete AppState.chartInstances[e])}),void renderSupport(s)}_originalHandleRoute()};const _originalUpdateActiveNav=updateActiveNav;updateActiveNav=function updateActiveNav(e){_originalUpdateActiveNav(e),"/missions"===e?document.querySelectorAll('[data-nav="missions"]').forEach(e=>e.classList.add("active")):"/shop"===e?document.querySelectorAll('[data-nav="shop"]').forEach(e=>e.classList.add("active")):"/subscription"===e?document.querySelectorAll('[data-nav="subscription"]').forEach(e=>e.classList.add("active")):"/support"===e?document.querySelectorAll('[data-nav="support"]').forEach(e=>e.classList.add("active")):"/coach"===e&&document.querySelectorAll('[data-nav="coach"]').forEach(e=>e.classList.add("active"))};const _originalHandleAuthSignOut=handleAuthSignOut;handleAuthSignOut=async function handleAuthSignOut(){await _originalHandleAuthSignOut(),AppState.tokenBalance=0,AppState.missions=[],AppState.userMissions=[],AppState.cosmetics=[],AppState.userCosmetics=[],AppState.subscription=null,AppState.sharedPlans=[],Object.assign(AppState.profile,{token_balance:0,is_beta_user:!1,is_premium:!1,subscription_plan:"free",equipped_title:null,equipped_badge:null,equipped_theme:null,equipped_frame:null,daily_workout_count:0,last_workout_credited_at:null,weekly_tokens_earned:0,week_reset_at:null}),applyTheme(null)};const _originalLoadUserData=loadUserData;loadUserData=async function loadUserData(){await _originalLoadUserData(),await Promise.all([sbLoadTokenBalance(),sbLoadMissions(),sbLoadCosmetics()]),await Promise.all([sbLoadUserMissions(),sbLoadUserCosmetics(),sbLoadSubscription()]),await Promise.all([sbLoadPlans(),sbLoadSharedPlans()])};const _originalRenderNewWorkout=renderNewWorkout;renderNewWorkout=function renderNewWorkout(e){_originalRenderNewWorkout(e);const t=window.finishWorkout;window.finishWorkout=async function(){const e=AppState.workouts.length;AppState.tokenBalance,window.showToast;await t();if(AppState.workouts.length>e||null===AppState.activeWorkout){const e=AppState.workouts[0];if(e){const t=e.duration_minutes?60*e.duration_minutes:0,a={exercises:e.exercises||[],duration_seconds:t,id:e.id};await checkFraudAndEarnTokens(a,e.id)}}}};const _originalInitApp=initApp;initApp=async function initApp(){function restoreThemeWhenReady(e){if(AppState.profile.equipped_theme){const e=(AppState.cosmetics.length>0?AppState.cosmetics:seedCosmetics()).find(e=>e.id===AppState.profile.equipped_theme);e&&applyTheme(e)}else e<20&&setTimeout(()=>restoreThemeWhenReady(e+1),200)}await _originalInitApp(),isDemoMode&&(AppState.missions=seedMissions(),AppState.cosmetics=seedCosmetics(),AppState.tokenBalance=75,AppState.profile.token_balance=75,AppState.profile.is_beta_user=!1,AppState.userMissions=computeUserMissions(),AppState.userCosmetics=seedCosmetics().filter(e=>0===e.cost).map(e=>({id:"uc-"+e.id,cosmetic_id:e.id,user_id:"demo",purchased_at:(new Date).toISOString()})),AppState.subscription={plan:"free",status:"active"}),setTimeout(updateTokenDisplay,100),setTimeout(()=>restoreThemeWhenReady(0),150)};const _origDOMContentLoaded=document.addEventListener.bind(document);window.removeEventListener("hashchange",handleRoute);window.addEventListener("hashchange",function _routeWithSave(){if(AppState.activeWorkout)saveActiveWorkoutToStorage();handleRoute();});document.addEventListener("DOMContentLoaded",()=>{injectSocialNav(),initApp()});

App.js