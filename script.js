const STORAGE_KEY = "neurodirect_v1_state";
const DEFAULT_STATE = {
  profileName: "",
  parentPin: "1234",
  theme: "light",
  accent: "blue",
  coins: 0,
  checkins: [],
  tasks: [],
  timerMinutes: 10
};

let state = loadState();
let parentUnlocked = false;
let timer = {
  totalSeconds: (state.timerMinutes || 10) * 60,
  remainingSeconds: (state.timerMinutes || 10) * 60,
  interval: null,
  running: false
};

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => Array.from(document.querySelectorAll(selector));

function loadState() {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return { ...DEFAULT_STATE, ...stored };
  } catch {
    return { ...DEFAULT_STATE };
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function showToast(message) {
  const toast = $("#toast");
  toast.textContent = message;
  toast.classList.add("show");
  window.clearTimeout(showToast.timeout);
  showToast.timeout = window.setTimeout(() => toast.classList.remove("show"), 2200);
}

function applyTheme() {
  document.documentElement.dataset.theme = state.theme || "light";
  document.documentElement.dataset.accent = state.accent || "blue";
  $("#themeToggle").textContent = state.theme === "dark" ? "Light" : "Dark";
  const themeSelect = $("#themeSelect");
  const accentSelect = $("#accentSelect");
  if (themeSelect) themeSelect.value = state.theme;
  if (accentSelect) accentSelect.value = state.accent;
}

function setActiveTab(tabId) {
  $$(".nav-item").forEach((item) => item.classList.toggle("active", item.dataset.tab === tabId));
  $$(".tab-panel").forEach((panel) => panel.classList.toggle("active", panel.id === tabId));
  $("#sideNav").classList.remove("open");
  if (tabId === "parent") renderParentView();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function formatDateTime(iso) {
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(iso));
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function calculateScore(latest) {
  if (!latest) return 0;
  const energy = Number(latest.energy || 0);
  const focus = Number(latest.focus || 0);
  const stressBalance = 11 - Number(latest.stress || 0);
  return Math.max(0, Math.min(100, Math.round(((energy + focus + stressBalance) / 30) * 100)));
}

function updateProfileLabels() {
  const name = state.profileName || "NeuroDirect";
  $("#profileNameLabel").textContent = name;
  $("#profileSubLabel").textContent = state.profileName ? "Teen local profile" : "Private local profile";
  $("#avatarInitial").textContent = name.trim().charAt(0).toUpperCase() || "N";
  $("#dashboardGreeting").textContent = state.profileName
    ? `${state.profileName}, build the day in smaller steps.`
    : "Build the day in smaller steps.";
  $("#profileNameInput").value = state.profileName || "";
}

function latestCheckin() {
  return [...state.checkins].sort((a, b) => new Date(b.date) - new Date(a.date))[0];
}

function renderDashboard() {
  const latest = latestCheckin();
  const completedTasks = state.tasks.filter((task) => task.done).length;
  const score = calculateScore(latest);

  $("#todayScore").textContent = score;
  $("#dashMood").textContent = latest ? latest.mood : "Not logged";
  $("#dashMoodHint").textContent = latest ? `Last logged ${formatDateTime(latest.date)}` : "Add a check-in to start the day.";
  $("#dashEnergy").textContent = latest ? `${latest.energy}/10` : "—";
  $("#dashTaskCount").textContent = completedTasks;
  $("#dashCoins").textContent = state.coins;

  const nextAction = getNextAction(latest);
  $("#nextActionTitle").textContent = nextAction.title;
  $("#nextActionText").textContent = nextAction.text;

  const recent = state.checkins
    .slice()
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, 4);

  const recentEl = $("#recentCheckins");
  if (!recent.length) {
    recentEl.className = "timeline-list empty-state";
    recentEl.textContent = "No check-ins yet.";
  } else {
    recentEl.className = "timeline-list";
    recentEl.innerHTML = recent.map((entry) => `
      <article class="timeline-item">
        <div>
          <h4>${escapeHtml(entry.mood)} · stress ${entry.stress}/10</h4>
          <p>${formatDateTime(entry.date)}${entry.flagged ? " · Flagged for parent view" : ""}</p>
          ${entry.note ? `<p>${escapeHtml(entry.note)}</p>` : ""}
        </div>
      </article>
    `).join("");
  }
}

function getNextAction(latest) {
  if (!latest) {
    return {
      title: "Add one realistic task.",
      text: "Choose something that takes under 10 minutes. Momentum beats perfect planning."
    };
  }
  if (Number(latest.stress) >= 8) {
    return {
      title: "Use a reset tool before pushing harder.",
      text: "High stress usually needs regulation first. Try grounding or breathing, then pick one tiny next step."
    };
  }
  if (Number(latest.energy) <= 3) {
    return {
      title: "Lower the demand.",
      text: "Energy is low. Choose a tiny task or a short recovery step rather than forcing a big task."
    };
  }
  if (Number(latest.focus) <= 4) {
    return {
      title: "Use a 5-minute focus block.",
      text: "Pick one task and set the timer for five minutes. Starting is the win."
    };
  }
  return {
    title: "Use the momentum.",
    text: "Focus looks usable. Choose an important small task and finish one clean step."
  };
}

function renderTasks() {
  const todo = state.tasks.filter((task) => !task.done);
  const done = state.tasks.filter((task) => task.done);
  $("#todoCount").textContent = todo.length;
  $("#doneCount").textContent = done.length;
  renderTaskList("#todoList", todo, false);
  renderTaskList("#doneList", done, true);
}

function renderTaskList(selector, tasks, isDone) {
  const el = $(selector);
  if (!tasks.length) {
    el.className = "task-list empty-state";
    el.textContent = isDone ? "No completed tasks yet." : "No tasks added.";
    return;
  }
  el.className = "task-list";
  el.innerHTML = tasks.map((task) => `
    <article class="task-item ${task.done ? "done" : ""}">
      <div>
        <h4>${escapeHtml(task.title)}</h4>
        <p>${escapeHtml(task.size)} · ${escapeHtml(task.priority)} · ${formatDateTime(task.createdAt)}</p>
      </div>
      <div class="item-actions">
        <button class="mini-btn" data-task-toggle="${task.id}">${task.done ? "Undo" : "Done"}</button>
        <button class="mini-btn" data-task-delete="${task.id}" aria-label="Delete task">×</button>
      </div>
    </article>
  `).join("");
}

function renderRewards() {
  $("#coinTotalBig").textContent = state.coins;
  const rewards = [
    { cost: 5, title: "Choose the music", text: "Pick music for a car ride, room reset or family task." },
    { cost: 10, title: "Screen bonus", text: "Agree a sensible extra screen-time block with a parent/carer." },
    { cost: 15, title: "Favourite snack", text: "Trade effort points for a planned treat." },
    { cost: 25, title: "Bigger reward", text: "Choose a family activity, game time or outing." }
  ];
  $("#rewardList").innerHTML = rewards.map((reward) => `
    <article class="reward-item">
      <div>
        <h4>${reward.cost} coins · ${reward.title}</h4>
        <p>${reward.text}</p>
      </div>
      <button class="mini-btn" data-redeem="${reward.cost}">Redeem</button>
    </article>
  `).join("");
}

function renderParentView() {
  $("#pinGate").classList.toggle("hidden", parentUnlocked);
  $("#parentContent").classList.toggle("hidden", !parentUnlocked);
  if (!parentUnlocked) return;

  const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const recent = state.checkins.filter((entry) => new Date(entry.date).getTime() >= sevenDaysAgo);
  const flagged = recent.filter((entry) => entry.flagged);
  const avgStress = recent.length
    ? (recent.reduce((sum, entry) => sum + Number(entry.stress || 0), 0) / recent.length).toFixed(1)
    : "—";

  $("#parentCheckinCount").textContent = recent.length;
  $("#parentAvgStress").textContent = avgStress === "—" ? "—" : `${avgStress}/10`;
  $("#parentFlagged").textContent = flagged.length;
  $("#parentCoins").textContent = state.coins;
  $("#reportOutput").textContent = buildReportText();
}

function buildReportText() {
  const name = state.profileName || "Teen";
  const lines = [];
  lines.push(`NeuroDirect report for ${name}`);
  lines.push(`Generated: ${new Date().toLocaleString("en-GB")}`);
  lines.push("");
  lines.push(`Coins: ${state.coins}`);
  lines.push(`Tasks complete: ${state.tasks.filter((task) => task.done).length}/${state.tasks.length}`);
  lines.push("");
  lines.push("Check-ins:");

  if (!state.checkins.length) {
    lines.push("No check-ins recorded yet.");
  } else {
    state.checkins
      .slice()
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .forEach((entry) => {
        lines.push(`- ${formatDateTime(entry.date)} | Mood: ${entry.mood} | Energy: ${entry.energy}/10 | Stress: ${entry.stress}/10 | Focus: ${entry.focus}/10 | Sleep: ${entry.sleep} | Pressure: ${entry.pressure}${entry.flagged ? " | FLAGGED" : ""}`);
        if (entry.note) lines.push(`  Note: ${entry.note}`);
      });
  }

  lines.push("");
  lines.push("Important: This is a personal tracking report, not a medical or diagnostic report.");
  return lines.join("\n");
}

function updateRangeLabels() {
  $("#energyValue").textContent = $("#energyInput").value;
  $("#stressValue").textContent = $("#stressInput").value;
  $("#focusValue").textContent = $("#focusInput").value;
}

function setTimerMinutes(minutes) {
  timer.totalSeconds = minutes * 60;
  timer.remainingSeconds = minutes * 60;
  timer.running = false;
  clearInterval(timer.interval);
  state.timerMinutes = minutes;
  saveState();
  renderTimer();
  $("#timerLabel").textContent = `Ready for a ${minutes}-minute focus block.`;
}

function renderTimer() {
  const minutes = Math.floor(timer.remainingSeconds / 60).toString().padStart(2, "0");
  const seconds = (timer.remainingSeconds % 60).toString().padStart(2, "0");
  $("#timerFace").textContent = `${minutes}:${seconds}`;
}

function startTimer() {
  if (timer.running) return;
  timer.running = true;
  $("#timerLabel").textContent = "Focus block running.";
  timer.interval = window.setInterval(() => {
    timer.remainingSeconds -= 1;
    renderTimer();
    if (timer.remainingSeconds <= 0) {
      clearInterval(timer.interval);
      timer.running = false;
      timer.remainingSeconds = timer.totalSeconds;
      state.coins += 2;
      saveState();
      renderAll();
      showToast("Focus block complete. +2 coins earned.");
      $("#timerLabel").textContent = "Complete. Take a reset break.";
      if (navigator.vibrate) navigator.vibrate([120, 80, 120]);
    }
  }, 1000);
}

function pauseTimer() {
  timer.running = false;
  clearInterval(timer.interval);
  $("#timerLabel").textContent = "Paused.";
}

function renderTool(tool) {
  const tools = {
    breathing: {
      title: "Box breathing",
      text: "1. Breathe in for 4 seconds.\n2. Hold for 4 seconds.\n3. Breathe out for 4 seconds.\n4. Hold for 4 seconds.\nRepeat four times."
    },
    grounding: {
      title: "5-4-3-2-1 grounding",
      text: "Name 5 things you can see.\nName 4 things you can feel.\nName 3 things you can hear.\nName 2 things you can smell.\nName 1 thing you can taste."
    },
    shrinker: {
      title: "Task shrinker",
      text: "Write the task. Now make it smaller. Then smaller again.\nExample: Revise science → open book → read one page → write three bullet points."
    },
    help: {
      title: "Help script",
      text: "Try this: I am finding this hard to start. I am not refusing. I need help making the first step smaller. Can you help me for five minutes?"
    }
  };
  const selected = tools[tool];
  $("#toolOutput").innerHTML = `<p class="eyebrow">Selected tool</p><h3>${selected.title}</h3><p>${selected.text.replaceAll("\n", "<br>")}</p>`;
}

function exportData() {
  const data = JSON.stringify(state, null, 2);
  const blob = new Blob([data], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `neurodirect-export-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function renderAll() {
  applyTheme();
  updateProfileLabels();
  renderDashboard();
  renderTasks();
  renderRewards();
  renderParentView();
  renderTimer();
}

function bindEvents() {
  $$(".nav-item").forEach((item) => item.addEventListener("click", () => setActiveTab(item.dataset.tab)));
  $$('[data-jump]').forEach((btn) => btn.addEventListener("click", () => setActiveTab(btn.dataset.jump)));
  $("#menuToggle").addEventListener("click", () => $("#sideNav").classList.toggle("open"));
  $("#quickCheckBtn").addEventListener("click", () => setActiveTab("checkin"));

  $("#themeToggle").addEventListener("click", () => {
    state.theme = state.theme === "dark" ? "light" : "dark";
    saveState();
    applyTheme();
  });

  ["#energyInput", "#stressInput", "#focusInput"].forEach((selector) => {
    $(selector).addEventListener("input", updateRangeLabels);
  });

  $("#checkinForm").addEventListener("submit", (event) => {
    event.preventDefault();
    state.checkins.push({
      id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
      date: new Date().toISOString(),
      mood: $("#moodInput").value,
      energy: Number($("#energyInput").value),
      stress: Number($("#stressInput").value),
      focus: Number($("#focusInput").value),
      sleep: $("#sleepInput").value,
      pressure: $("#pressureInput").value,
      note: $("#noteInput").value.trim(),
      flagged: $("#shareFlagInput").checked
    });
    state.coins += 1;
    saveState();
    renderAll();
    showToast("Check-in saved. +1 coin earned.");
    setActiveTab("dashboard");
  });

  $("#resetCheckinBtn").addEventListener("click", () => {
    $("#noteInput").value = "";
    $("#shareFlagInput").checked = false;
    $("#energyInput").value = 5;
    $("#stressInput").value = 5;
    $("#focusInput").value = 5;
    updateRangeLabels();
  });

  $("#taskForm").addEventListener("submit", (event) => {
    event.preventDefault();
    const title = $("#taskTitle").value.trim();
    if (!title) return;
    state.tasks.unshift({
      id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
      title,
      size: $("#taskSize").value,
      priority: $("#taskPriority").value,
      done: false,
      createdAt: new Date().toISOString(),
      completedAt: null
    });
    $("#taskTitle").value = "";
    saveState();
    renderAll();
    showToast("Task added.");
  });

  document.body.addEventListener("click", (event) => {
    const toggleId = event.target.dataset.taskToggle;
    const deleteId = event.target.dataset.taskDelete;
    const redeemCost = event.target.dataset.redeem;

    if (toggleId) {
      const task = state.tasks.find((item) => item.id === toggleId);
      if (task) {
        task.done = !task.done;
        task.completedAt = task.done ? new Date().toISOString() : null;
        if (task.done) state.coins += 1;
        saveState();
        renderAll();
        showToast(task.done ? "Task complete. +1 coin earned." : "Task moved back to To do.");
      }
    }

    if (deleteId) {
      state.tasks = state.tasks.filter((task) => task.id !== deleteId);
      saveState();
      renderAll();
      showToast("Task deleted.");
    }

    if (redeemCost) {
      const cost = Number(redeemCost);
      if (state.coins < cost) {
        showToast("Not enough coins yet.");
        return;
      }
      state.coins -= cost;
      saveState();
      renderAll();
      showToast(`${cost} coins redeemed.`);
    }
  });

  $$('[data-minutes]').forEach((button) => {
    button.addEventListener("click", () => setTimerMinutes(Number(button.dataset.minutes)));
  });
  $("#startTimerBtn").addEventListener("click", startTimer);
  $("#pauseTimerBtn").addEventListener("click", pauseTimer);
  $("#resetTimerBtn").addEventListener("click", () => setTimerMinutes(state.timerMinutes || 10));

  $$('[data-tool]').forEach((button) => {
    button.addEventListener("click", () => renderTool(button.dataset.tool));
  });

  $("#addCoinBtn").addEventListener("click", () => {
    state.coins += 1;
    saveState();
    renderAll();
  });
  $("#removeCoinBtn").addEventListener("click", () => {
    state.coins = Math.max(0, state.coins - 1);
    saveState();
    renderAll();
  });

  $("#unlockParentBtn").addEventListener("click", () => {
    if ($("#pinInput").value === state.parentPin) {
      parentUnlocked = true;
      $("#pinInput").value = "";
      renderParentView();
      showToast("Parent view unlocked.");
    } else {
      showToast("Incorrect PIN.");
    }
  });

  $("#copyReportBtn").addEventListener("click", async () => {
    const report = buildReportText();
    try {
      await navigator.clipboard.writeText(report);
      showToast("Report copied.");
    } catch {
      showToast("Copy failed. Select the report text manually.");
    }
  });

  $("#exportDataBtn").addEventListener("click", exportData);

  $("#settingsForm").addEventListener("submit", (event) => {
    event.preventDefault();
    state.profileName = $("#profileNameInput").value.trim();
    const newPin = $("#pinSetInput").value.trim();
    if (newPin) state.parentPin = newPin;
    state.theme = $("#themeSelect").value;
    state.accent = $("#accentSelect").value;
    $("#pinSetInput").value = "";
    saveState();
    renderAll();
    showToast("Settings saved.");
  });

  $("#importDataBtn").addEventListener("click", () => $("#importFileInput").click());
  $("#importFileInput").addEventListener("change", async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    try {
      const imported = JSON.parse(await file.text());
      state = { ...DEFAULT_STATE, ...imported };
      saveState();
      parentUnlocked = false;
      renderAll();
      showToast("Data imported.");
    } catch {
      showToast("Import failed. Use a valid NeuroDirect JSON export.");
    }
  });

  $("#wipeDataBtn").addEventListener("click", () => {
    const confirmed = confirm("Wipe all NeuroDirect data on this device?");
    if (!confirmed) return;
    localStorage.removeItem(STORAGE_KEY);
    state = { ...DEFAULT_STATE };
    parentUnlocked = false;
    renderAll();
    showToast("App data wiped.");
    showOnboardingIfNeeded(true);
  });

  $("#onboardingForm").addEventListener("submit", (event) => {
    event.preventDefault();
    state.profileName = $("#onboardName").value.trim();
    const pin = $("#onboardPin").value.trim();
    state.parentPin = pin || "1234";
    saveState();
    $("#onboardingDialog").close();
    renderAll();
    showToast("NeuroDirect is ready.");
  });
}

function showOnboardingIfNeeded(force = false) {
  const dialog = $("#onboardingDialog");
  if ((force || !state.profileName) && typeof dialog.showModal === "function") {
    dialog.showModal();
  }
}

function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch(() => {
      // App still works without offline caching.
    });
  });
}

bindEvents();
updateRangeLabels();
renderAll();
showOnboardingIfNeeded(false);
registerServiceWorker();
