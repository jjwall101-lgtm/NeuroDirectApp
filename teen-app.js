import { firebaseConfig } from "./firebase-config.js?v=28";
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-app.js";
import {
  getAuth,
  signInAnonymously,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.15.0/firebase-auth.js";
import {
  getFirestore,
  doc,
  setDoc,
  deleteDoc,
  collection,
  getDocs,
  updateDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js";

const app = initializeApp(firebaseConfig, "neurodirect-teen-v28");
const auth = getAuth(app);
const db = getFirestore(app);

const STORAGE = "neurodirect_teen_v22";
const $ = s => document.querySelector(s);
const $$ = s => Array.from(document.querySelectorAll(s));

let currentUser = null;
let state = loadState();
let timer = { total:600, remaining:600, interval:null, running:false };

function defaultState(){
  return {
    displayName: "Teen",
    familyCode: "",
    accent: "red",
    mode: "light",
    localTasks: [],
    localEvents: [],
    localCheckins: []
  };
}

function loadState(){
  try { return {...defaultState(), ...JSON.parse(localStorage.getItem(STORAGE) || "{}")}; }
  catch { return defaultState(); }
}

function saveState(){
  localStorage.setItem(STORAGE, JSON.stringify(state));
}

function toast(msg){
  const el = $("#toast");
  if(!el) return;
  el.textContent = msg;
  el.classList.add("show");
  clearTimeout(toast.t);
  toast.t = setTimeout(() => el.classList.remove("show"), 2600);
}

function esc(v){
  return String(v || "")
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}

function makeId(prefix){
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2,8)}`;
}

function familyCode(){
  return (state.familyCode || "").trim().toUpperCase();
}

function teenName(){
  return (state.displayName || "Teen").trim();
}

async function copyFamilyCodeValue(){
  const code = familyCode();
  if(!code){
    toast("No family code to copy");
    return;
  }
  try{
    await navigator.clipboard.writeText(code);
    toast("Family code copied");
  }catch{
    toast(code);
  }
}


function applyAppearance(){
  document.documentElement.dataset.accent = state.accent || "red";
  document.documentElement.dataset.theme = state.mode || "light";

  const accent = $("#accentSelect");
  const mode = $("#modeSelect");

  if(accent) accent.value = state.accent || "red";
  if(mode) mode.value = state.mode || "light";

  const themeButton = $("#themeButton");
  if(themeButton) themeButton.textContent = (state.mode || "light") === "dark" ? "Light" : "Dark";
}


function familyDoc(){
  const code = familyCode();
  if(!code) throw new Error("Set a family code first.");
  return code;
}

function setTab(id){
  $$(".nav-link").forEach(b => b.classList.toggle("active", b.dataset.tab === id));
  $$(".tab").forEach(t => t.classList.toggle("active", t.id === id));
  $("#sidebar")?.classList.remove("open");

  if(id === "calendar") renderCalendarPage();
  if(id === "planner") renderTaskList();

  window.scrollTo({top:0, behavior:"smooth"});
}

function formatDate(dateStr, timeStr=""){
  const d = new Date(`${dateStr}T${timeStr || "00:00"}`);
  return new Intl.DateTimeFormat("en-GB", {
    weekday:"short",
    day:"2-digit",
    month:"short"
  }).format(d);
}

function updateAuthUI(){
  applyAppearance();
  const connected = !!currentUser;

  $("#authPill").textContent = connected ? "Connected" : "Connecting";
  $("#authStatus").textContent = connected
    ? "Background connection active. Saves will sync to the family code."
    : "Starting secure background connection...";

  const name = teenName();
  $("#profileName").textContent = name;
  $("#avatarInitial").textContent = name.charAt(0).toUpperCase() || "N";
  $("#greeting").textContent = `${name}, build the day in smaller steps.`;
  const mockHello = $("#mockHello");
  if(mockHello) mockHello.textContent = `Hello, ${name}! 👋`;

  $("#familyCodeInput").value = state.familyCode || "";
  $("#displayNameInput").value = state.displayName || "";
  $("#familyCodeLabel").textContent = state.familyCode || "Not linked yet";
}

async function saveFamilyProfile(){
  if(!currentUser) throw new Error("Firebase is still connecting.");
  const code = familyDoc();

  await setDoc(doc(db, "families", code), {
    code,
    createdFrom: "teen-app",
    updatedAt: serverTimestamp()
  }, {merge:true});

  await setDoc(doc(db, "families", code, "members", currentUser.uid), {
    uid: currentUser.uid,
    displayName: teenName(),
    role: "teen",
    updatedAt: serverTimestamp()
  }, {merge:true});

  await setDoc(doc(db, "families", code, "children", currentUser.uid), {
    uid: currentUser.uid,
    displayName: teenName(),
    updatedAt: serverTimestamp()
  }, {merge:true});
}

async function syncAll(){
  if(!currentUser || !familyCode()) return false;

  try{
    const code = familyDoc();
    await saveFamilyProfile();

    for(const item of state.localTasks){
      await setDoc(doc(db, "families", code, "tasks", item.id), {
        ...item,
        childUid: currentUser.uid,
        childName: teenName(),
        synced: true,
        updatedAt: serverTimestamp()
      }, {merge:true});
      item.synced = true;
    }

    for(const item of state.localEvents){
      await setDoc(doc(db, "families", code, "calendar", item.id), {
        ...item,
        childUid: currentUser.uid,
        childName: teenName(),
        synced: true,
        updatedAt: serverTimestamp()
      }, {merge:true});
      item.synced = true;

      if(item.notifyParent && !item.notificationSent){
        await setDoc(doc(db, "families", code, "notifications", `notif_${item.id}`), {
          id: `notif_${item.id}`,
          type: "calendar",
          title: "New calendar plan",
          message: `${teenName()} added: ${item.title} on ${item.date} at ${item.start}.`,
          childUid: currentUser.uid,
          childName: teenName(),
          read: false,
          createdAtIso: new Date().toISOString(),
          updatedAt: serverTimestamp()
        }, {merge:true});
        item.notificationSent = true;
      }
    }

    for(const item of state.localCheckins){
      await setDoc(doc(db, "families", code, "checkins", item.id), {
        ...item,
        childUid: currentUser.uid,
        childName: teenName(),
        synced: true,
        updatedAt: serverTimestamp()
      }, {merge:true});
      item.synced = true;

      if((item.flagged || Number(item.stress) >= 8) && !item.notificationSent){
        await setDoc(doc(db, "families", code, "notifications", `notif_${item.id}`), {
          id: `notif_${item.id}`,
          type: "checkin",
          title: "Check-in flagged",
          message: `${teenName()} logged ${item.mood} mood with stress ${item.stress}/10.`,
          childUid: currentUser.uid,
          childName: teenName(),
          read: false,
          createdAtIso: new Date().toISOString(),
          updatedAt: serverTimestamp()
        }, {merge:true});
        item.notificationSent = true;
      }
    }

    saveState();
    return true;
  }catch(err){
    console.error(err);
    toast("Saved on this device. Firebase sync failed.");
    return false;
  }
}

function renderLocalDashboard(){
  const today = new Date().toISOString().slice(0,10);

  const upcoming = state.localEvents
    .filter(e => e.date >= today)
    .sort((a,b) => (a.date + a.start).localeCompare(b.date + b.start));

  const latest = [...state.localCheckins]
    .sort((a,b) => (b.createdAtIso || "").localeCompare(a.createdAtIso || ""))[0];

  const doneTasks = state.localTasks.filter(t => t.done).length;
  const totalTasks = state.localTasks.length;
  const progress = totalTasks ? Math.round((doneTasks / totalTasks) * 100) : 0;

  $("#dashPlans").textContent = upcoming.length;
  $("#dashTasks").textContent = doneTasks;

  $("#nextPlanTitle").textContent = upcoming[0] ? upcoming[0].title : "Nothing planned";
  $("#nextPlanTime").textContent = upcoming[0] ? `${formatDate(upcoming[0].date, upcoming[0].start)} ${upcoming[0].start || ""}` : "Add a calendar item.";

  const railTasks = $("#railTasks");
  const ring = $("#taskProgressRing");
  const railNext = $("#railNextEvent");
  const railNextTime = $("#railNextEventTime");
  const railFocus = $("#railFocusTime");

  if(railTasks) railTasks.textContent = `${doneTasks}/${totalTasks || 0}`;
  if(ring) ring.style.setProperty("--progress", `${progress}%`);
  if(railNext) railNext.textContent = upcoming[0] ? upcoming[0].title : "Nothing planned";
  if(railNextTime) railNextTime.textContent = upcoming[0] ? `${formatDate(upcoming[0].date, upcoming[0].start)} ${upcoming[0].start || ""}` : "Add a calendar item";
  if(railFocus) railFocus.textContent = formatTimer(timer.remaining || timer.total || 600);

  $("#dashMood").textContent = latest ? latest.mood : "—";
  $("#dashStress").textContent = latest ? `${latest.stress}/10` : "—";
  $("#dashMoodHint").textContent = latest ? "Latest saved." : "No check-in yet.";

  renderEventList("#upcomingList", upcoming.slice(0,4), false);
}

function renderTaskList(){
  const box = $("#taskList");
  if(!box) return;

  const tasks = state.localTasks;

  if(!tasks.length){
    box.className = "list empty-state";
    box.textContent = "No tasks yet.";
    return;
  }

  box.className = "list";
  box.innerHTML = tasks.map(t => `
    <div class="item">
      <div>
        <strong>${esc(t.title)}</strong>
        <small>${esc(t.priority)} · ${esc(t.size)} · ${t.done ? "Done" : "To do"}${t.synced ? " · synced" : " · saved locally"}</small>
      </div>
      <div class="button-row">
        ${t.done ? "" : `<button class="primary-button small" data-done-task="${esc(t.id)}">Done</button>`}
        <button class="danger-button small" data-delete-task="${esc(t.id)}">Delete</button>
      </div>
    </div>
  `).join("");
}

function renderCalendarPage(){
  const today = new Date().toISOString().slice(0,10);
  const events = state.localEvents
    .filter(e => e.date >= today)
    .sort((a,b) => (a.date + a.start).localeCompare(b.date + b.start));

  renderEventList("#calendarList", events, true);
}

function renderEventList(selector, events, controls){
  const box = $(selector);
  if(!box) return;

  if(!events.length){
    box.className = selector === "#calendarList" ? "day-list empty-state" : "list empty-state";
    box.textContent = "No upcoming plans yet.";
    return;
  }

  box.className = selector === "#calendarList" ? "day-list" : "list";
  box.innerHTML = events.map(e => `
    <div class="item">
      <div class="date-pill">${new Date(e.date + "T00:00").getDate()}<span>${new Date(e.date + "T00:00").toLocaleString("en-GB",{month:"short"})}</span></div>
      <div style="flex:1;">
        <strong>${esc(e.title)}</strong>
        <small>${esc(e.category)} · ${formatDate(e.date,e.start)} · ${esc(e.start || "")} ${e.end ? `- ${esc(e.end)}` : ""}${e.synced ? " · synced" : " · saved locally"}</small>
        ${e.details ? `<p>${esc(e.details)}</p>` : ""}
      </div>
      ${controls ? `<div class="button-row"><button class="secondary-button small" data-edit-event="${esc(e.id)}">Edit</button><button class="danger-button small" data-delete-event="${esc(e.id)}">Delete</button></div>` : ""}
    </div>
  `).join("");
}

function updateRanges(){
  ["stress","focus","energy"].forEach(n => {
    const val = $(`#${n}Input`)?.value || "5";
    const out = $(`#${n}Value`);
    if(out) out.textContent = val;
  });
}

function setTimer(min){
  timer.total = min * 60;
  timer.remaining = timer.total;
  updateTimer();
}

function updateTimer(){
  const m = Math.floor(timer.remaining / 60);
  const s = timer.remaining % 60;
  $("#timerFace").textContent = `${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}`;
}

function startTimer(){
  if(timer.running) return;
  timer.running = true;
  $("#timerLabel").textContent = "Focus block running.";
  timer.interval = setInterval(() => {
    timer.remaining--;
    updateTimer();
    if(timer.remaining <= 0){
      clearInterval(timer.interval);
      timer.running = false;
      timer.remaining = timer.total;
      updateTimer();
      $("#timerLabel").textContent = "Focus block complete.";
      toast("Focus block complete");
    }
  }, 1000);
}

function pauseTimer(){
  timer.running = false;
  clearInterval(timer.interval);
  $("#timerLabel").textContent = "Paused.";
}

function resetTimer(){
  pauseTimer();
  timer.remaining = timer.total;
  updateTimer();
  $("#timerLabel").textContent = "Timer reset.";
}

function refreshAll(){
  renderLocalDashboard();
  renderTaskList();
  renderCalendarPage();
}

function bind(){
  $("#menuButton").onclick = () => {
    $("#sidebar").classList.toggle("open");
  };
  $$(".nav-link").forEach(b => b.onclick = () => setTab(b.dataset.tab));
  $$("[data-go]").forEach(b => b.onclick = () => setTab(b.dataset.go));

  $("#themeButton").onclick = () => {
    state.mode = (state.mode || "light") === "dark" ? "light" : "dark";
    saveState();
    applyAppearance();
    toast(`${state.mode === "dark" ? "Dark" : "Light"} mode applied`);
  };

  const saveAppearance = $("#saveAppearance");
  if(saveAppearance){
    saveAppearance.onclick = () => {
      state.accent = $("#accentSelect")?.value || "red";
      state.mode = $("#modeSelect")?.value || "light";
      saveState();
      applyAppearance();
      toast("Appearance saved");
    };
  }

  const copyFamilyCode = $("#copyFamilyCode");
  if(copyFamilyCode) copyFamilyCode.onclick = copyFamilyCodeValue;

  const copyFamilyCodeSettings = $("#copyFamilyCodeSettings");
  if(copyFamilyCodeSettings) copyFamilyCodeSettings.onclick = copyFamilyCodeValue;

  ["stress","focus","energy"].forEach(n => $(`#${n}Input`).oninput = updateRanges);

  $("#saveName").onclick = async () => {
    state.displayName = $("#displayNameInput").value.trim() || "Teen";
    state.localTasks.forEach(x => x.synced = false);
    state.localEvents.forEach(x => x.synced = false);
    state.localCheckins.forEach(x => x.synced = false);
    saveState();
    updateAuthUI();
    toast("Name saved");
    const ok = await syncAll();
    if(ok) toast("Name saved and synced");
    refreshAll();
  };

  $("#generateFamilyCode").onclick = async () => {
    state.familyCode = ("ND" + Math.random().toString(36).slice(2,8)).toUpperCase();
    state.localTasks.forEach(x => x.synced = false);
    state.localEvents.forEach(x => x.synced = false);
    state.localCheckins.forEach(x => x.synced = false);
    saveState();
    updateAuthUI();
    toast("Family code generated");
    await copyFamilyCodeValue();
    const ok = await syncAll();
    if(ok) toast("Family code generated, copied and synced");
    refreshAll();
  };

  $("#saveFamilyCode").onclick = async () => {
    state.familyCode = $("#familyCodeInput").value.trim().toUpperCase();
    state.localTasks.forEach(x => x.synced = false);
    state.localEvents.forEach(x => x.synced = false);
    state.localCheckins.forEach(x => x.synced = false);
    saveState();
    updateAuthUI();
    toast("Family code saved");
    const ok = await syncAll();
    if(ok) toast("Family code saved and synced");
    refreshAll();
  };

  $("#checkinForm").onsubmit = async e => {
    e.preventDefault();

    if(!familyCode()){
      toast("Set a family code first.");
      setTab("settings");
      return;
    }

    const data = {
      id: makeId("checkin"),
      mood: $("#moodInput").value,
      stress: Number($("#stressInput").value),
      focus: Number($("#focusInput").value),
      energy: Number($("#energyInput").value),
      notes: $("#checkinNotes").value.trim(),
      flagged: $("#flagParent").checked,
      createdAtIso: new Date().toISOString(),
      synced: false,
      notificationSent: false
    };

    state.localCheckins.push(data);
    saveState();

    $("#checkinNotes").value = "";
    $("#flagParent").checked = false;

    toast("Check-in saved");
    refreshAll();

    const ok = await syncAll();
    if(ok) toast("Check-in saved and synced");

    refreshAll();
    setTab("dashboard");
  };

  $("#taskForm").onsubmit = async e => {
    e.preventDefault();

    if(!familyCode()){
      toast("Set a family code first.");
      setTab("settings");
      return;
    }

    const data = {
      id: makeId("task"),
      title: $("#taskTitle").value.trim(),
      priority: $("#taskPriority").value,
      size: $("#taskSize").value,
      done: false,
      createdAtIso: new Date().toISOString(),
      synced: false
    };

    state.localTasks.push(data);
    saveState();

    $("#taskTitle").value = "";
    toast("Task saved");
    refreshAll();

    const ok = await syncAll();
    if(ok) toast("Task saved and synced");

    refreshAll();
  };

  $("#eventForm").onsubmit = async e => {
    e.preventDefault();

    if(!familyCode()){
      toast("Set a family code first.");
      setTab("settings");
      return;
    }

    const id = $("#editingEventId").value;

    if(id){
      const local = state.localEvents.find(x => x.id === id);
      if(local){
        local.title = $("#eventTitle").value.trim();
        local.date = $("#eventDate").value;
        local.start = $("#eventStart").value;
        local.end = $("#eventEnd").value;
        local.category = $("#eventCategory").value;
        local.details = $("#eventDetails").value.trim();
        local.notifyParent = $("#eventNotifyParent").checked;
        local.synced = false;
        local.notificationSent = false;
      }
      toast("Calendar item updated");
    }else{
      state.localEvents.push({
        id: makeId("event"),
        title: $("#eventTitle").value.trim(),
        date: $("#eventDate").value,
        start: $("#eventStart").value,
        end: $("#eventEnd").value,
        category: $("#eventCategory").value,
        details: $("#eventDetails").value.trim(),
        notifyParent: $("#eventNotifyParent").checked,
        createdAtIso: new Date().toISOString(),
        synced: false,
        notificationSent: false
      });
      toast("Calendar item saved");
    }

    saveState();
    $("#eventForm").reset();
    $("#editingEventId").value = "";
    refreshAll();

    const ok = await syncAll();
    if(ok) toast("Calendar item saved and synced");

    refreshAll();
  };

  $("#clearEventForm").onclick = () => {
    $("#eventForm").reset();
    $("#editingEventId").value = "";
  };

  $("#refreshButton").onclick = async () => {
    const ok = await syncAll();
    toast(ok ? "Synced" : "Saved locally only");
    refreshAll();
  };

  $$("[data-minutes]").forEach(b => b.onclick = () => setTimer(Number(b.dataset.minutes)));
  $("#startTimer").onclick = startTimer;
  $("#pauseTimer").onclick = pauseTimer;
  $("#resetTimer").onclick = resetTimer;

  document.addEventListener("click", async e => {
    const done = e.target.closest("[data-done-task]")?.dataset.doneTask;
    const delTask = e.target.closest("[data-delete-task]")?.dataset.deleteTask;
    const delEvent = e.target.closest("[data-delete-event]")?.dataset.deleteEvent;
    const edit = e.target.closest("[data-edit-event]")?.dataset.editEvent;

    if(done){
      const item = state.localTasks.find(t => t.id === done);
      if(item){
        item.done = true;
        item.synced = false;
        saveState();
        refreshAll();
        const ok = await syncAll();
        toast(ok ? "Task updated and synced" : "Task updated locally");
        refreshAll();
      }
    }

    if(delTask){
      state.localTasks = state.localTasks.filter(t => t.id !== delTask);
      saveState();

      if(currentUser && familyCode()){
        await deleteDoc(doc(db, "families", familyCode(), "tasks", delTask)).catch(()=>{});
      }

      toast("Task deleted");
      refreshAll();
    }

    if(delEvent){
      state.localEvents = state.localEvents.filter(x => x.id !== delEvent);
      saveState();

      if(currentUser && familyCode()){
        await deleteDoc(doc(db, "families", familyCode(), "calendar", delEvent)).catch(()=>{});
        await deleteDoc(doc(db, "families", familyCode(), "notifications", `notif_${delEvent}`)).catch(()=>{});
      }

      toast("Calendar item deleted");
      refreshAll();
    }

    if(edit){
      const local = state.localEvents.find(x => x.id === edit);
      if(local){
        $("#editingEventId").value = local.id;
        $("#eventTitle").value = local.title || "";
        $("#eventDate").value = local.date || "";
        $("#eventStart").value = local.start || "";
        $("#eventEnd").value = local.end || "";
        $("#eventCategory").value = local.category || "Personal";
        $("#eventDetails").value = local.details || "";
        $("#eventNotifyParent").checked = !!local.notifyParent;
        window.scrollTo({top:0, behavior:"smooth"});
      }
    }
  });
}

onAuthStateChanged(auth, async user => {
  currentUser = user;
  updateAuthUI();

  if(user && familyCode()){
    await syncAll();
    refreshAll();
  }
});

signInAnonymously(auth).catch(err => {
  console.error(err);
  toast("Firebase not connected. Enable Anonymous sign-in.");
});

bind();
applyAppearance();
updateRanges();
updateTimer();
updateAuthUI();
refreshAll();
