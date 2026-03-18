/**
 * ============================================================
 * STUDY BUDDY — Complete JavaScript
 * AI powered by OpenRouter (works in Nepal, free tier)
 * API key loaded from config.js (never pushed to GitHub)
 * ============================================================
 */

/* ============================================================
   1. STATE MANAGEMENT
   ============================================================ */

const STATE_KEY = "studyBuddyState_v3";

const defaultState = {
  theme: "light",
  timerMode: "focus",
  timerRunning: false,
  timerSecondsLeft: 25 * 60,
  pomodoroCount: 0,
  totalSessions: 0,
  totalFocusMinutes: 0,
  sessionStartedAt: null,
  tasks: [],
  notes: "",
  weeklyData: [0, 0, 0, 0, 0, 0, 0],
  weekStartDate: null,
  lastStudyDate: null,
  streak: 0,
};

function loadState() {
  try {
    const raw = localStorage.getItem(STATE_KEY);
    if (!raw) return { ...defaultState };
    return { ...defaultState, ...JSON.parse(raw) };
  } catch {
    return { ...defaultState };
  }
}

function saveState() {
  try {
    localStorage.setItem(STATE_KEY, JSON.stringify(state));
  } catch {
    console.warn("localStorage unavailable");
  }
}

let state = loadState();

// Reset weekly data if new week has started
(function checkWeekReset() {
  const now    = new Date();
  const sunday = new Date(now);
  sunday.setDate(now.getDate() - now.getDay());
  const weekStart = sunday.toISOString().slice(0, 10);
  if (state.weekStartDate !== weekStart) {
    state.weeklyData    = [0, 0, 0, 0, 0, 0, 0];
    state.weekStartDate = weekStart;
    saveState();
  }
})();

/* ============================================================
   2. THEME
   ============================================================ */

const themeToggle = document.getElementById("themeToggle");

function applyTheme() {
  if (state.theme === "dark") {
    document.body.classList.add("dark");
    themeToggle.textContent = "☀️";
  } else {
    document.body.classList.remove("dark");
    themeToggle.textContent = "🌙";
  }
}

themeToggle.addEventListener("click", () => {
  state.theme = state.theme === "dark" ? "light" : "dark";
  applyTheme();
  saveState();
});

applyTheme();

/* ============================================================
   3. ANALYTICS
   ============================================================ */

const statTasksDone = document.getElementById("statTasksDone");
const statSessions  = document.getElementById("statSessions");
const statStreak    = document.getElementById("statStreak");
const statFocusMin  = document.getElementById("statFocusMin");

function updateAnalytics() {
  const done = state.tasks.filter(t => t.completed).length;
  statTasksDone.textContent = done;
  statSessions.textContent  = state.totalSessions;
  statStreak.textContent    = state.streak;
  statFocusMin.textContent  = state.totalFocusMinutes;
}

updateAnalytics();

/* ============================================================
   4. POMODORO TIMER
   ============================================================ */

const TIMER_DURATIONS    = { focus: 25 * 60, short: 5 * 60, long: 15 * 60 };
const POMODORO_CYCLE     = 4;
const MODE_LABELS        = { focus: "Focus Session", short: "Short Break", long: "Long Break" };
const RING_CIRCUMFERENCE = 553; // 2 * π * 88

const timerDisplay   = document.getElementById("timerDisplay");
const timerModeLabel = document.getElementById("timerModeLabel");
const startPauseBtn  = document.getElementById("startPauseBtn");
const resetBtn       = document.getElementById("resetBtn");
const skipBtn        = document.getElementById("skipBtn");
const ringProgress   = document.getElementById("ringProgress");
const pomDots        = document.getElementById("pomDots");
const modeTabs       = document.querySelectorAll(".mode-tab");

let timerInterval = null;

function renderTimerDisplay() {
  const s   = state.timerSecondsLeft;
  const m   = Math.floor(s / 60);
  const sec = s % 60;
  timerDisplay.textContent   = `${m}:${sec < 10 ? "0" + sec : sec}`;
  timerModeLabel.textContent = MODE_LABELS[state.timerMode];

  const total  = TIMER_DURATIONS[state.timerMode];
  const offset = RING_CIRCUMFERENCE * (1 - s / total);
  ringProgress.style.strokeDashoffset = offset;

  if (state.timerMode !== "focus") {
    ringProgress.classList.add("break-mode");
  } else {
    ringProgress.classList.remove("break-mode");
  }
}

function renderPomDots() {
  pomDots.innerHTML = "";
  for (let i = 0; i < POMODORO_CYCLE; i++) {
    const dot = document.createElement("div");
    dot.className = "pom-dot";
    if (i < state.pomodoroCount) {
      dot.classList.add("done");
    } else if (i === state.pomodoroCount && state.timerRunning && state.timerMode === "focus") {
      dot.classList.add("active");
    }
    pomDots.appendChild(dot);
  }
}

function startTimer() {
  if (timerInterval) return;
  state.timerRunning        = true;
  startPauseBtn.textContent = "⏸ Pause";

  timerInterval = setInterval(() => {
    if (state.timerSecondsLeft > 0) {
      state.timerSecondsLeft--;
      renderTimerDisplay();
      saveState();
    } else {
      handleSessionComplete();
    }
  }, 1000);

  renderPomDots();
  saveState();
}

function pauseTimer() {
  clearInterval(timerInterval);
  timerInterval             = null;
  state.timerRunning        = false;
  startPauseBtn.textContent = "▶ Resume";
  saveState();
}

function handleSessionComplete() {
  clearInterval(timerInterval);
  timerInterval      = null;
  state.timerRunning = false;

  if (state.timerMode === "focus") {
    state.totalSessions++;
    state.totalFocusMinutes += Math.round(TIMER_DURATIONS.focus / 60);
    state.pomodoroCount++;

    const dayOfWeek = new Date().getDay();
    state.weeklyData[dayOfWeek]++;

    updateStreak();

    if (state.pomodoroCount >= POMODORO_CYCLE) {
      state.pomodoroCount = 0;
      switchMode("long");
      showToast("🎉 4 sessions done! Time for a long break.");
    } else {
      switchMode("short");
      showToast(`✅ Session ${state.totalSessions} done! Short break time.`);
    }

    sendBrowserNotification("Focus session complete!", "Time to take a break. 🎉");
    updateAnalytics();
    updateChart();

  } else {
    switchMode("focus");
    showToast("⏱ Break over! Ready to focus?");
    sendBrowserNotification("Break's over!", "Let's get back to work. 💪");
  }

  renderPomDots();
  saveState();
}

function switchMode(mode) {
  state.timerMode           = mode;
  state.timerSecondsLeft    = TIMER_DURATIONS[mode];
  startPauseBtn.textContent = "▶ Start";

  modeTabs.forEach(btn => {
    btn.classList.toggle("active", btn.dataset.mode === mode);
  });

  renderTimerDisplay();
}

modeTabs.forEach(btn => {
  btn.addEventListener("click", () => {
    if (timerInterval) pauseTimer();
    switchMode(btn.dataset.mode);
  });
});

startPauseBtn.addEventListener("click", () => {
  if (state.timerRunning) pauseTimer();
  else startTimer();
});

resetBtn.addEventListener("click", () => {
  pauseTimer();
  state.timerSecondsLeft    = TIMER_DURATIONS[state.timerMode];
  startPauseBtn.textContent = "▶ Start";
  renderTimerDisplay();
  saveState();
});

skipBtn.addEventListener("click", () => {
  pauseTimer();
  handleSessionComplete();
});

renderTimerDisplay();
renderPomDots();
if (state.timerRunning) startTimer();

/* ============================================================
   5. TASK SYSTEM
   ============================================================ */

const taskInput      = document.getElementById("taskInput");
const prioritySelect = document.getElementById("prioritySelect");
const addTaskBtn     = document.getElementById("addTaskBtn");
const taskList       = document.getElementById("taskList");
const taskCount      = document.getElementById("taskCount");
const clearDoneBtn   = document.getElementById("clearDoneBtn");
const filterBtns     = document.querySelectorAll(".filter-btn");

let currentFilter = "all";
let editingTaskId  = null;

const editModal          = document.getElementById("editModal");
const editTaskInput      = document.getElementById("editTaskInput");
const editPrioritySelect = document.getElementById("editPrioritySelect");
const saveEditBtn        = document.getElementById("saveEditBtn");
const cancelEditBtn      = document.getElementById("cancelEditBtn");

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

function renderTasks() {
  taskList.innerHTML = "";

  let filtered = state.tasks;
  if (currentFilter === "active") filtered = state.tasks.filter(t => !t.completed);
  if (currentFilter === "done")   filtered = state.tasks.filter(t => t.completed);

  if (filtered.length === 0) {
    taskList.innerHTML = `<li style="text-align:center;padding:20px;color:var(--text-muted);font-size:0.85rem;">
      ${currentFilter === "done" ? "No completed tasks yet." : "No tasks. Add one above! ✍️"}
    </li>`;
  } else {
    filtered.forEach(task => {
      const li      = document.createElement("li");
      li.className  = `task-item${task.completed ? " done" : ""}`;
      li.dataset.id = task.id;

      li.innerHTML = `
        <div class="task-checkbox">${task.completed ? "✓" : ""}</div>
        <div class="priority-dot ${task.priority}"></div>
        <span class="task-text">${escapeHTML(task.text)}</span>
        <div class="task-actions">
          <button class="task-act-btn edit-btn" title="Edit">✏️</button>
          <button class="task-act-btn del del-btn" title="Delete">🗑</button>
        </div>
      `;

      li.querySelector(".task-checkbox").addEventListener("click", e => { e.stopPropagation(); toggleTask(task.id); });
      li.querySelector(".task-text").addEventListener("click", () => toggleTask(task.id));
      li.querySelector(".edit-btn").addEventListener("click", e => { e.stopPropagation(); openEditModal(task.id); });
      li.querySelector(".del-btn").addEventListener("click", e => { e.stopPropagation(); deleteTask(task.id); });

      taskList.appendChild(li);
    });
  }

  const remaining       = state.tasks.filter(t => !t.completed).length;
  taskCount.textContent = `${remaining} left`;

  updateAnalytics();
  saveState();
}

function addTask() {
  const text = taskInput.value.trim();
  if (!text) return;

  state.tasks.unshift({
    id:        uid(),
    text,
    priority:  prioritySelect.value,
    completed: false,
    createdAt: Date.now(),
  });

  taskInput.value = "";
  renderTasks();
}

function toggleTask(id) {
  const task = state.tasks.find(t => t.id === id);
  if (!task) return;
  task.completed = !task.completed;
  if (task.completed) { updateStreak(); updateChart(); }
  renderTasks();
}

function deleteTask(id) {
  state.tasks = state.tasks.filter(t => t.id !== id);
  renderTasks();
}

function openEditModal(id) {
  const task = state.tasks.find(t => t.id === id);
  if (!task) return;
  editingTaskId            = id;
  editTaskInput.value      = task.text;
  editPrioritySelect.value = task.priority;
  editModal.classList.remove("hidden");
  editTaskInput.focus();
}

saveEditBtn.addEventListener("click", () => {
  const text = editTaskInput.value.trim();
  if (!text || !editingTaskId) return;
  const task = state.tasks.find(t => t.id === editingTaskId);
  if (task) { task.text = text; task.priority = editPrioritySelect.value; }
  editModal.classList.add("hidden");
  editingTaskId = null;
  renderTasks();
});

cancelEditBtn.addEventListener("click", () => {
  editModal.classList.add("hidden");
  editingTaskId = null;
});

editModal.addEventListener("click", e => {
  if (e.target === editModal) { editModal.classList.add("hidden"); editingTaskId = null; }
});

taskInput.addEventListener("keydown", e => { if (e.key === "Enter") addTask(); });
addTaskBtn.addEventListener("click", addTask);

filterBtns.forEach(btn => {
  btn.addEventListener("click", () => {
    filterBtns.forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    currentFilter = btn.dataset.filter;
    renderTasks();
  });
});

clearDoneBtn.addEventListener("click", () => {
  state.tasks = state.tasks.filter(t => !t.completed);
  renderTasks();
  showToast("🧹 Completed tasks cleared.");
});

renderTasks();

/* ============================================================
   6. NOTES
   ============================================================ */

const notesArea     = document.getElementById("notesArea");
const saveIndicator = document.getElementById("saveIndicator");
const charCount     = document.getElementById("charCount");
const clearNotesBtn = document.getElementById("clearNotesBtn");

let notesSaveTimeout = null;

notesArea.value = state.notes;
updateCharCount();

notesArea.addEventListener("input", () => {
  state.notes = notesArea.value;
  updateCharCount();
  clearTimeout(notesSaveTimeout);
  saveIndicator.classList.remove("visible");
  notesSaveTimeout = setTimeout(() => {
    saveState();
    saveIndicator.classList.add("visible");
    setTimeout(() => saveIndicator.classList.remove("visible"), 2500);
  }, 700);
});

clearNotesBtn.addEventListener("click", () => {
  if (!notesArea.value.trim()) return;
  if (confirm("Clear all notes?")) {
    notesArea.value = "";
    state.notes     = "";
    saveState();
    updateCharCount();
  }
});

function updateCharCount() {
  charCount.textContent = `${notesArea.value.length} chars`;
}

/* ============================================================
   7. PROGRESS CHART (Chart.js)
   ============================================================ */

const chartCanvas   = document.getElementById("progressChart");
const resetChartBtn = document.getElementById("resetChartBtn");
let progressChart   = null;

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function buildChart() {
  if (!window.Chart) return;
  const ctx        = chartCanvas.getContext("2d");
  const isDark     = document.body.classList.contains("dark");
  const gridColor  = isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)";
  const labelColor = isDark ? "#6b6460" : "#a09890";

  progressChart = new Chart(ctx, {
    type: "bar",
    data: {
      labels: DAY_LABELS,
      datasets: [{
        label: "Sessions",
        data:  [...state.weeklyData],
        backgroundColor: DAY_LABELS.map((_, i) =>
          i === new Date().getDay()
            ? "rgba(249, 115, 22, 0.9)"
            : "rgba(249, 115, 22, 0.3)"
        ),
        borderRadius:  8,
        borderSkipped: false,
      }],
    },
    options: {
      responsive:          true,
      maintainAspectRatio: false,
      plugins: {
        legend:  { display: false },
        tooltip: { callbacks: { label: ctx => ` ${ctx.parsed.y} session${ctx.parsed.y !== 1 ? "s" : ""}` } },
      },
      scales: {
        x: { grid: { color: gridColor }, ticks: { color: labelColor, font: { size: 11, family: "'DM Sans', sans-serif" } } },
        y: { beginAtZero: true, ticks: { stepSize: 1, color: labelColor, font: { size: 11, family: "'DM Sans', sans-serif" } }, grid: { color: gridColor } },
      },
    },
  });
}

function updateChart() {
  if (!progressChart) return;
  progressChart.data.datasets[0].data = [...state.weeklyData];
  progressChart.data.datasets[0].backgroundColor = DAY_LABELS.map((_, i) =>
    i === new Date().getDay()
      ? "rgba(249, 115, 22, 0.9)"
      : "rgba(249, 115, 22, 0.3)"
  );
  progressChart.update();
}

resetChartBtn.addEventListener("click", () => {
  if (!confirm("Reset this week's chart data?")) return;
  state.weeklyData = [0, 0, 0, 0, 0, 0, 0];
  saveState();
  updateChart();
});

window.addEventListener("load", () => {
  buildChart();
  themeToggle.addEventListener("click", () => {
    if (progressChart) { progressChart.destroy(); buildChart(); }
  });
});

/* ============================================================
   8. FOCUS SOUNDS (Web Audio API)
   ============================================================ */

const soundBtns    = document.querySelectorAll(".sound-btn");
const volumeSlider = document.getElementById("volumeSlider");
const soundStatus  = document.getElementById("soundStatus");

let audioCtx    = null;
let activeSound = null;
let gainNode    = null;
let soundNodes  = [];

function ensureAudioCtx() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  if (audioCtx.state === "suspended") audioCtx.resume();
}

function stopSound() {
  soundNodes.forEach(n => { try { n.stop(); } catch {} try { n.disconnect(); } catch {} });
  soundNodes  = [];
  gainNode    = null;
  activeSound = null;
  soundStatus.textContent = "Off";
  soundStatus.classList.remove("on");
  soundBtns.forEach(b => b.classList.remove("active"));
}

function createWhiteNoiseBuffer() {
  const bufferSize = audioCtx.sampleRate * 2;
  const buffer     = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
  const data       = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
  return buffer;
}

function playSound(type) {
  ensureAudioCtx();
  if (activeSound === type) { stopSound(); return; }
  stopSound();

  activeSound         = type;
  gainNode            = audioCtx.createGain();
  gainNode.gain.value = parseFloat(volumeSlider.value);
  gainNode.connect(audioCtx.destination);

  if (type === "white") {
    const src  = audioCtx.createBufferSource();
    src.buffer = createWhiteNoiseBuffer();
    src.loop   = true;
    src.connect(gainNode);
    src.start();
    soundNodes.push(src);
  }

  if (type === "rain") {
    const src    = audioCtx.createBufferSource();
    src.buffer   = createWhiteNoiseBuffer();
    src.loop     = true;
    const filter = audioCtx.createBiquadFilter();
    filter.type  = "lowpass";
    filter.frequency.value = 1000;
    filter.Q.value         = 0.5;
    src.connect(filter);
    filter.connect(gainNode);
    src.start();
    soundNodes.push(src);
  }

  if (type === "cafe") {
    const src    = audioCtx.createBufferSource();
    src.buffer   = createWhiteNoiseBuffer();
    src.loop     = true;
    const filter = audioCtx.createBiquadFilter();
    filter.type  = "bandpass";
    filter.frequency.value = 600;
    filter.Q.value         = 0.3;
    src.connect(filter);
    filter.connect(gainNode);
    src.start();
    soundNodes.push(src);

    const osc          = audioCtx.createOscillator();
    osc.type           = "sine";
    osc.frequency.value = 55;
    const humGain      = audioCtx.createGain();
    humGain.gain.value = 0.05;
    osc.connect(humGain);
    humGain.connect(gainNode);
    osc.start();
    soundNodes.push(osc);
  }

  if (type === "forest") {
    const src    = audioCtx.createBufferSource();
    src.buffer   = createWhiteNoiseBuffer();
    src.loop     = true;
    const filter = audioCtx.createBiquadFilter();
    filter.type  = "bandpass";
    filter.frequency.value = 800;
    filter.Q.value         = 1.5;

    const lfo          = audioCtx.createOscillator();
    lfo.frequency.value = 0.3;
    const lfoGain      = audioCtx.createGain();
    lfoGain.gain.value = 500;
    lfo.connect(lfoGain);
    lfoGain.connect(filter.frequency);
    lfo.start();
    soundNodes.push(lfo);

    src.connect(filter);
    filter.connect(gainNode);
    src.start();
    soundNodes.push(src);
  }

  soundStatus.textContent = type.charAt(0).toUpperCase() + type.slice(1);
  soundStatus.classList.add("on");
  soundBtns.forEach(b => b.classList.toggle("active", b.dataset.sound === type));
}

soundBtns.forEach(btn => btn.addEventListener("click", () => playSound(btn.dataset.sound)));
volumeSlider.addEventListener("input", () => {
  if (gainNode) gainNode.gain.value = parseFloat(volumeSlider.value);
});

/* ============================================================
   9. NOTIFICATIONS
   ============================================================ */

const notifBtn = document.getElementById("notifBtn");

function sendBrowserNotification(title, body) {
  if (Notification.permission !== "granted") return;
  new Notification(title, { body });
}

notifBtn.addEventListener("click", () => {
  if (!("Notification" in window)) { showToast("❌ Notifications not supported."); return; }
  Notification.requestPermission().then(perm => {
    if (perm === "granted") {
      showToast("🔔 Notifications enabled!");
      notifBtn.style.color = "var(--accent)";
    } else {
      showToast("🔕 Notifications blocked.");
    }
  });
});

if (Notification.permission === "granted") notifBtn.style.color = "var(--accent)";

/* ============================================================
   10. STREAK
   ============================================================ */

function updateStreak() {
  const today     = new Date().toISOString().slice(0, 10);
  if (state.lastStudyDate === today) return;
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  state.streak    = state.lastStudyDate === yesterday ? state.streak + 1 : 1;
  state.lastStudyDate = today;
  saveState();
  updateAnalytics();
}

/* ============================================================
   11. UTILITIES
   ============================================================ */

function escapeHTML(str) {
  const div = document.createElement("div");
  div.appendChild(document.createTextNode(str));
  return div.innerHTML;
}

function showToast(message) {
  document.querySelectorAll(".toast").forEach(t => t.remove());
  const toast       = document.createElement("div");
  toast.className   = "toast";
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 3100);
}

/* ============================================================
   INIT
   ============================================================ */

updateAnalytics();

/* ============================================================
   AI CHAT MODULE
   ============================================================
   Uses OpenRouter API — works in Nepal, free tier available.
   Sign up at openrouter.ai and get a free key.

   KEY SECURITY:
   - The key lives in config.js (separate file)
   - config.js is listed in .gitignore
   - config.js will NEVER be pushed to GitHub
   - Only config.example.js (no real key) goes to GitHub
   ============================================================ */

// ── Load API key from config.js ──────────────────────────────
// config.js must be loaded BEFORE script.js in index.html
// It defines: const CONFIG = { apiKey: "sk-or-..." }
const AI_KEY = (typeof CONFIG !== "undefined" && CONFIG.apiKey)
  ? CONFIG.apiKey
  : "";

// OpenRouter API endpoint
const AI_URL = "https://openrouter.ai/api/v1/chat/completions";

// Free model that works great for study help
// Full list of free models: openrouter.ai/models?q=free
const AI_MODEL = "google/gemini-2.0-flash-exp:free";

// ── DOM references ───────────────────────────────────────────
const chatWindow      = document.getElementById("chatWindow");
const chatInput       = document.getElementById("chatInput");
const chatSendBtn     = document.getElementById("chatSendBtn");
const chatSuggestions = document.getElementById("chatSuggestions");
const clearChatBtn    = document.getElementById("clearChatBtn");
const buddyStatusEl   = document.getElementById("buddyStatus");
const buddyStatusDot  = document.getElementById("buddyStatusDot");

// ── Conversation history ─────────────────────────────────────
const MAX_HISTORY_TURNS = 10;
let chatHistory = [];

// ── Build system prompt with live app context ────────────────
function buildSystemPrompt() {
  const totalTasks   = state.tasks.length;
  const doneTasks    = state.tasks.filter(t => t.completed);
  const pendingTasks = state.tasks.filter(t => !t.completed);
  const highPriority = pendingTasks.filter(t => t.priority === "high");

  const taskSummary = totalTasks === 0
    ? "The student has no tasks added yet."
    : [
        `Total tasks: ${totalTasks}`,
        `Completed: ${doneTasks.length} (${doneTasks.map(t => `"${t.text}"`).join(", ") || "none"})`,
        `Pending: ${pendingTasks.length} (${pendingTasks.map(t => `[${t.priority}] "${t.text}"`).join(", ") || "none"})`,
        highPriority.length > 0
          ? `HIGH priority: ${highPriority.map(t => `"${t.text}"`).join(", ")}`
          : "",
      ].filter(Boolean).join("\n");

  return `You are an expert AI study tutor inside a web app called StudyBuddy. Be warm, encouraging, and pedagogically sharp.

YOUR RULES:
- Act like a Socratic tutor — guide with questions, don't just give answers directly
- Explain concepts step-by-step with simple examples
- Keep responses concise (2-4 paragraphs max) unless the student asks for more detail
- Never start with filler phrases like "Certainly!", "Of course!", or "Great question!"
- Reference the student's actual task names when relevant — it shows you're paying attention
- End with a follow-up question about 60% of the time to deepen understanding
- If asked something off-topic, answer briefly then redirect back to studying

STUDENT'S LIVE CONTEXT (use this to personalise your responses):
${taskSummary}
Pomodoro sessions today: ${state.totalSessions}
Total focus minutes: ${state.totalFocusMinutes}
Study streak: ${state.streak} day(s)
Timer status: ${state.timerRunning ? "RUNNING (" + state.timerMode + " mode)" : "not running"}
Notes: ${state.notes?.trim() ? '"' + state.notes.trim().slice(0, 300) + '"' : "no notes yet"}

BEHAVIOUR BASED ON CONTEXT:
- More than 5 pending tasks → gently suggest prioritising before studying more
- No tasks at all → suggest the student plans their session first
- All tasks completed → celebrate and suggest reviewing material
- Timer is running → keep your reply shorter so they stay in flow state`;
}

// ── Render a chat bubble into the chat window ────────────────
function renderMessage(role, text, variant = "") {
  const wrapper     = document.createElement("div");
  wrapper.className = `chat-msg ${role}${variant ? " " + variant : ""}`;

  const avatar          = document.createElement("div");
  avatar.className      = "chat-avatar";
  avatar.textContent    = role === "user" ? "YOU" : "🤖";

  const bubble          = document.createElement("div");
  bubble.className      = "chat-bubble";

  if (variant === "typing") {
    bubble.innerHTML = `<div class="typing-dots"><span></span><span></span><span></span></div>`;
  } else {
    bubble.innerHTML = formatBubbleText(text);
  }

  wrapper.appendChild(avatar);
  wrapper.appendChild(bubble);
  chatWindow.appendChild(wrapper);
  chatWindow.scrollTop = chatWindow.scrollHeight;

  return wrapper; // returned so typing indicator can be removed later
}

// ── Convert basic markdown to safe HTML ─────────────────────
function formatBubbleText(text) {
  return escapeHTML(text)
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>") // **bold**
    .replace(/`([^`]+)`/g,     "<code>$1</code>")     // `code`
    .replace(/^(\d+\.) /gm,    "<strong>$1</strong> ") // 1. lists
    .replace(/\n/g,             "<br>");               // line breaks
}

// ── Update the status dot and label ─────────────────────────
function setStatus(status) {
  const labels          = { idle: "Ready", thinking: "Thinking…", online: "Online" };
  buddyStatusEl.textContent = labels[status] || status;
  buddyStatusDot.className  = `buddy-status-dot ${status === "idle" ? "online" : status}`;
}

// ── Main function: send message to OpenRouter ────────────────
async function sendMessage(userText) {
  const text = userText.trim();
  if (!text) return;

  // ── Guard: check API key is configured ──────────────────
  if (!AI_KEY || AI_KEY === "PASTE_YOUR_OPENROUTER_KEY_HERE" || AI_KEY.trim() === "") {
    renderMessage("ai",
      "⚠️ No API key found!\n\n" +
      "1. Open config.js in your project folder\n" +
      "2. Replace PASTE_YOUR_OPENROUTER_KEY_HERE with your key\n" +
      "3. Get a free key at openrouter.ai/keys\n" +
      "4. Save config.js and refresh this page",
      "error"
    );
    return;
  }

  // Hide suggestion chips after first message
  chatSuggestions.classList.add("hidden");

  // Render user's message immediately
  renderMessage("user", text);

  // Add to history
  chatHistory.push({ role: "user", content: text });

  // Trim history to rolling window to save tokens
  if (chatHistory.length > MAX_HISTORY_TURNS * 2) {
    chatHistory = chatHistory.slice(-MAX_HISTORY_TURNS * 2);
  }

  // Show typing indicator and lock input while waiting
  const typingEl       = renderMessage("ai", "", "typing");
  chatInput.value      = "";
  chatInput.disabled   = true;
  chatSendBtn.disabled = true;
  setStatus("thinking");

  try {
    // ── Call OpenRouter API ────────────────────────────────
    const response = await fetch(AI_URL, {
      method: "POST",
      headers: {
        "Content-Type":  "application/json",
        "Authorization": `Bearer ${AI_KEY}`,
        // OpenRouter recommended headers
        "HTTP-Referer":  window.location.href,
        "X-Title":       "StudyBuddy",
      },
      body: JSON.stringify({
        model:    AI_MODEL,
        messages: [
          // System prompt always goes first with full live context
          { role: "system", content: buildSystemPrompt() },
          // Then the full conversation history
          ...chatHistory,
        ],
        max_tokens:  1000,
        temperature: 0.7,
      }),
    });

    // ── Handle non-200 responses ───────────────────────────
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err?.error?.message || `API error ${response.status}`);
    }

    // ── Parse the reply ────────────────────────────────────
    const data    = await response.json();
    const aiReply = data.choices?.[0]?.message?.content?.trim()
      || "I couldn't generate a response. Please try again.";

    // Remove typing indicator and show real reply
    typingEl.remove();
    renderMessage("ai", aiReply);

    // Save AI reply to history for next turn
    chatHistory.push({ role: "assistant", content: aiReply });

    setStatus("online");

  } catch (err) {
    // ── Show a helpful error message ───────────────────────
    typingEl.remove();

    let msg = `Something went wrong: ${err.message}`;

    if (err.message.includes("401"))
      msg = "❌ Invalid API key. Open config.js and check your OpenRouter key is correct.";
    else if (err.message.includes("402"))
      msg = "💳 Out of credits. Go to openrouter.ai to add free credits.";
    else if (err.message.includes("429"))
      msg = "⏳ Rate limited — wait 30 seconds and try again.";
    else if (err.message.includes("Failed to fetch"))
      msg = "🌐 Network error. Check your internet connection, or turn off Brave Shields for this page (click the lion icon in the address bar).";

    renderMessage("ai", msg, "error");
    setStatus("idle");
    console.error("[AI Chat Error]", err);

  } finally {
    // Always re-enable input whether success or failure
    chatInput.disabled   = false;
    chatSendBtn.disabled = false;
    chatInput.focus();
  }
}

// ── Event listeners ──────────────────────────────────────────

// Send button click
chatSendBtn.addEventListener("click", () => sendMessage(chatInput.value));

// Enter key to send (Shift+Enter does nothing so user can't add newlines by accident)
chatInput.addEventListener("keydown", e => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    sendMessage(chatInput.value);
  }
});

// Suggestion chip clicks
document.querySelectorAll(".suggestion-chip").forEach(chip => {
  chip.addEventListener("click", () => sendMessage(chip.dataset.prompt));
});

// Clear chat button
clearChatBtn.addEventListener("click", () => {
  chatHistory          = [];
  chatWindow.innerHTML = "";
  renderMessage("ai", "Chat cleared! Fresh start — what would you like to work on?");
  chatSuggestions.classList.remove("hidden");
  setStatus("online");
});

// Set initial status on page load
setStatus("online");
