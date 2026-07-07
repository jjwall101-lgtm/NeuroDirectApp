import { firebaseConfig } from "./firebase-config.js?v=19";
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
  getDoc,
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  limit,
  getDocs,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js";

const app = initializeApp(firebaseConfig, "neurodirect-teen-v19");
const auth = getAuth(app);
const db = getFirestore(app);

const STORAGE = "neurodirect_teen_v19";
const $ = s => document.querySelector(s);
const $$ = s => Array.from(document.querySelectorAll(s));

let currentUser = null;
let firebaseReady = false;
let state = loadState();
let timer = { total:600, remaining:600, interval:null, running:false };

function loadState(){
  try {
    return {
      displayName: "Teen",
      familyCode: "",
      localTasks: [],
      localEvents: [],
      localCheckins: [],
      ...JSON.parse(localStorage.getItem(STORAGE) || "{}")
    };
  } catch {
    return { displayName:"Teen", familyCode:"", localTasks:[], localEvents:[], localCheckins:[] };
  }
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

function familyCode(){
  return (state.familyCode || "").trim().toUpperCase();
}

function teenName(){
  return (state.displayName || "Teen").trim();
}

function childPath(){
  if(!currentUser || !familyCode()) return null;
  return ["families", familyCode(), "children", currentUser.uid];
}

function makeId(){
  return "local_" + Date.now() + "_" + Math.random().toString(36).slice(2,8);
}

function setTab(id){
  $$(".nav-link").forEach(b => b.classList.toggle("active", b.dataset.tab === id));
  $$(".tab").forEach(t => t.classList.toggle("active", t.id === id));
  $("#sidebar")?.classList.remove("open");

  if(id === "calendar") loadCalendar();
  if(id === "planner") loadTasks();

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
  const connected = !!currentUser;
  $("#authPill").textContent = connected ? "Connected" : "Connecting";
  $("#authStatus").textContent = connected
    ? "Background Firebase connection active. No sign-in needed."
    : "Starting secure background connection...";

  const name = teenName();
  $("#profileName").textContent = name;
  $("#avatarInitial").textContent = name.charAt(0).toUpperCase() || "N";
  $("#greeting").textContent = `${name}, build the day in smaller steps.`;
  $("#familyCodeInput").value = state.familyCode || "";
  $("#displayNameInput").value = state.displayName || "";
  $("#familyCodeLabel").textContent = state.familyCode || "Not linked yet";
}

async function saveFamilyProfile(){
  if(!currentUser) throw new Error("Background connection is still starting.");
  const code = familyCode();
  if(!code) throw new Error("Set a family code first.");

  await setDoc(doc(db, "families", code), {
    code,
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

async function syncLocalData(){
  if(!currentUser || !familyCode()) return;

  try{
    await saveFamilyProfile();

    const p = childPath();
    if(!p) return;

    for(const t of state.localTasks.filter(x => !x.synced)){
      const ref = await addDoc(collection(db, ...p, "tasks"), {
        title: t.title,
        priority: t.priority,
        size: t.size,
        done: !!t.done,
        createdAt: serverTimestamp()
      });
      t.synced = true;
      t.cloudId = ref.id;
    }

    for(const e of state.localEvents.filter(x => !x.synced)){
      const ref = await addDoc(collection(db, ...p, "calendar"), {
        title: e.title,
        date: e.date,
        start: e.start,
        end: e.end,
        category: e.category,
        details: e.details,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      e.synced = true;
      e.cloudId = ref.id;

      if(e.notifyParent){
        await notifyParent("calendar", "New calendar plan", `${teenName()} added: ${e.title} on ${e.date} at ${e.start}.`);
      }
    }

    for(const c of state.localCheckins.filter(x => !x.synced)){
      const ref = await addDoc(collection(db, ...p, "checkins"), {
        mood: c.mood,
        stress: c.stress,
        focus: c.focus,
        energy: c.energy,
        notes: c.notes,
        flagged: c.flagged,
        createdAt: serverTimestamp()
      });
      c.synced = true;
      c.cloudId = ref.id;

      if(c.flagged || Number(c.stress) >= 8){
        await notifyParent("checkin", "Check-in flagged", `${teenName()} logged ${c.mood} mood with stress ${c.stress}/10.`);
      }
    }

    saveState();
  }catch(err){
    console.error(err);
    toast("Saved on this device. Firebase sync failed.");
  }
}

async function notifyParent(type, title, message){
  if(!currentUser || !familyCode()) return;
  await addDoc(collection(db, "families", familyCode(), "notifications"), {
    type,
    title,
    message,
    childUid: currentUser.uid,
    childName: teenName(),
    read: false,
    createdAt: serverTimestamp()
  });
}

async function loadDashboard(){
  renderLocalDashboard();
  if(!currentUser || !familyCode()) return;

  await syncLocalData();
  await Promise.all([
    loadCalendar(true),
    loadTasks(true),
    loadLatestCheckin()
  ]).catch(err => console.error(err));
}

function renderLocalDashboard(){
  const today = new Date().toISOString().slice(0,10);
  const upcoming = state.localEvents
    .filter(e => e.date >= today)
    .sort((a,b) => (a.date + a.start).localeCompare(b.date + b.start));
  const latest = [...state.localCheckins].sort((a,b) => (b.createdAt || "").localeCompare(a.createdAt || ""))[0];

  $("#dashPlans").textContent = upcoming.length;
  $("#dashTasks").textContent = state.localTasks.filter(t => t.done).length;

  $("#nextPlanTitle").textContent = upcoming[0] ? upcoming[0].title : "Nothing planned";
  $("#nextPlanTime").textContent = upcoming[0] ? `${formatDate(upcoming[0].date, upcoming[0].start)} ${upcoming[0].start || ""}` : "Add a calendar item.";

  $("#dashMood").textContent = latest ? latest.mood : "—";
  $("#dashStress").textContent = latest ? `${latest.stress}/10` : "—";
  $("#dashMoodHint").textContent = latest ? "Latest saved on this device." : "No check-in yet.";

  renderEventList("#upcomingList", upcoming.slice(0,4));
}

async function loadLatestCheckin(){
  const p = childPath();
  if(!p) return;

  const q = query(collection(db, ...p, "checkins"), orderBy("createdAt", "desc"), limit(1));
  const snap = await getDocs(q);

  if(snap.empty) return;

  const c = snap.docs[0].data();
  $("#dashMood").textContent = c.mood || "—";
  $("#dashStress").textContent = c.stress ? `${c.stress}/10` : "—";
  $("#dashMoodHint").textContent = c.createdAt?.toDate ? c.createdAt.toDate().toLocaleString("en-GB") : "Latest check-in";
}

async function loadTasks(summaryOnly=false){
  renderTaskList(state.localTasks);

  if(!currentUser || !familyCode()){
    $("#dashTasks").textContent = state.localTasks.filter(t => t.done).length;
    return;
  }

  try{
    const p = childPath();
    if(!p) return;

    const q = query(collection(db, ...p, "tasks"), orderBy("createdAt", "desc"), limit(50));
    const snap = await getDocs(q);
    const cloudTasks = snap.docs.map(d => ({id:d.id, cloud:true, ...d.data()}));

    $("#dashTasks").textContent = cloudTasks.filter(t => t.done).length;

    if(!summaryOnly) renderTaskList(cloudTasks);
  }catch(err){
    console.error(err);
    if(!summaryOnly) renderTaskList(state.localTasks);
  }
}

function renderTaskList(tasks){
  const box = $("#taskList");
  if(!box) return;

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
        <small>${esc(t.priority)} · ${esc(t.size)} · ${t.done ? "Done" : "To do"}${t.synced === false ? " · saved locally" : ""}</small>
      </div>
      <div class="button-row">
        ${t.done ? "" : `<button class="primary-button small" data-done-task="${esc(t.cloud ? t.id : t.id)}" data-local="${t.cloud ? "0" : "1"}">Done</button>`}
        <button class="danger-button small" data-delete-task="${esc(t.cloud ? t.id : t.id)}" data-local="${t.cloud ? "0" : "1"}">Delete</button>
      </div>
    </div>
  `).join("");
}

async function loadCalendar(summaryOnly=false){
  const today = new Date().toISOString().slice(0,10);
  const localEvents = state.localEvents
    .filter(e => e.date >= today)
    .sort((a,b) => (a.date + a.start).localeCompare(b.date + b.start));

  $("#dashPlans").textContent = localEvents.length;
  $("#nextPlanTitle").textContent = localEvents[0] ? localEvents[0].title : "Nothing planned";
  $("#nextPlanTime").textContent = localEvents[0] ? `${formatDate(localEvents[0].date, localEvents[0].start)} ${localEvents[0].start || ""}` : "Add a calendar item.";
  renderEventList("#upcomingList", localEvents.slice(0,4));

  if(!currentUser || !familyCode()){
    if(!summaryOnly) renderEventList("#calendarList", localEvents);
    return;
  }

  try{
    const p = childPath();
    if(!p) return;

    const snap = await getDocs(collection(db, ...p, "calendar"));
    const events = snap.docs
      .map(d => ({id:d.id, cloud:true, ...d.data()}))
      .filter(e => e.date >= today)
      .sort((a,b) => (a.date + a.start).localeCompare(b.date + b.start));

    $("#dashPlans").textContent = events.length;
    const first = events[0];
    $("#nextPlanTitle").textContent = first ? first.title : "Nothing planned";
    $("#nextPlanTime").textContent = first ? `${formatDate(first.date, first.start)} ${first.start || ""}` : "Add a calendar item.";

    renderEventList("#upcomingList", events.slice(0,4));
    if(!summaryOnly) renderEventList("#calendarList", events);
  }catch(err){
    console.error(err);
    if(!summaryOnly) renderEventList("#calendarList", localEvents);
  }
}

function renderEventList(selector, events){
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
        <small>${esc(e.category)} · ${formatDate(e.date,e.start)} · ${esc(e.start || "")} ${e.end ? `- ${esc(e.end)}` : ""}${e.synced === false ? " · saved locally" : ""}</small>
        ${e.details ? `<p>${esc(e.details)}</p>` : ""}
      </div>
      ${selector === "#calendarList" ? `<div class="button-row"><button class="secondary-button small" data-edit-event="${esc(e.cloud ? e.id : e.id)}" data-local="${e.cloud ? "0" : "1"}">Edit</button><button class="danger-button small" data-delete-event="${esc(e.cloud ? e.id : e.id)}" data-local="${e.cloud ? "0" : "1"}">Delete</button></div>` : ""}
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

function bind(){
  $("#menuButton").onclick = () => $("#sidebar").classList.toggle("open");
  $$(".nav-link").forEach(b => b.onclick = () => setTab(b.dataset.tab));
  $$("[data-go]").forEach(b => b.onclick = () => setTab(b.dataset.go));

  $("#themeButton").onclick = () => {
    document.documentElement.dataset.theme = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    $("#themeButton").textContent = document.documentElement.dataset.theme === "dark" ? "Light" : "Dark";
  };

  ["stress","focus","energy"].forEach(n => $(`#${n}Input`).oninput = updateRanges);

  $("#saveName").onclick = async () => {
    state.displayName = $("#displayNameInput").value.trim() || "Teen";
    saveState();
    updateAuthUI();
    toast("Name saved");
    syncLocalData();
  };

  $("#generateFamilyCode").onclick = () => {
    state.familyCode = ("ND" + Math.random().toString(36).slice(2,8)).toUpperCase();
    saveState();
    updateAuthUI();
    toast("Family code generated");
    syncLocalData();
  };

  $("#saveFamilyCode").onclick = async () => {
    state.familyCode = $("#familyCodeInput").value.trim().toUpperCase();
    saveState();
    updateAuthUI();
    toast("Family code saved");
    await syncLocalData();
    await loadDashboard();
  };

  $("#checkinForm").onsubmit = async e => {
    e.preventDefault();

    if(!familyCode()){
      toast("Set a family code first.");
      setTab("settings");
      return;
    }

    const data = {
      id: makeId(),
      mood: $("#moodInput").value,
      stress: Number($("#stressInput").value),
      focus: Number($("#focusInput").value),
      energy: Number($("#energyInput").value),
      notes: $("#checkinNotes").value.trim(),
      flagged: $("#flagParent").checked,
      createdAt: new Date().toISOString(),
      synced: false
    };

    state.localCheckins.push(data);
    saveState();

    $("#checkinNotes").value = "";
    $("#flagParent").checked = false;

    toast("Check-in saved");
    renderLocalDashboard();
    await syncLocalData();
    await loadDashboard();
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
      id: makeId(),
      title: $("#taskTitle").value.trim(),
      priority: $("#taskPriority").value,
      size: $("#taskSize").value,
      done: false,
      createdAt: new Date().toISOString(),
      synced: false
    };

    state.localTasks.push(data);
    saveState();

    $("#taskTitle").value = "";
    toast("Task saved");

    renderTaskList(state.localTasks);
    renderLocalDashboard();
    await syncLocalData();
    await loadTasks();
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
        local.synced = false;
      }
      saveState();
      toast("Calendar item updated");
    } else {
      const data = {
        id: makeId(),
        title: $("#eventTitle").value.trim(),
        date: $("#eventDate").value,
        start: $("#eventStart").value,
        end: $("#eventEnd").value,
        category: $("#eventCategory").value,
        details: $("#eventDetails").value.trim(),
        notifyParent: $("#eventNotifyParent").checked,
        createdAt: new Date().toISOString(),
        synced: false
      };

      state.localEvents.push(data);
      saveState();
      toast("Calendar item saved");
    }

    $("#eventForm").reset();
    $("#editingEventId").value = "";

    renderLocalDashboard();
    renderEventList("#calendarList", state.localEvents);
    await syncLocalData();
    await loadCalendar();
    await loadDashboard();
  };

  $("#clearEventForm").onclick = () => {
    $("#eventForm").reset();
    $("#editingEventId").value = "";
  };

  $("#refreshButton").onclick = () => {
    loadCalendar();
    syncLocalData();
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
      const local = state.localTasks.find(t => t.id === done || t.cloudId === done);
      if(local){
        local.done = true;
        local.synced = false;
        saveState();
      }

      if(currentUser && familyCode() && !e.target.closest("[data-done-task]")?.dataset.local){
        const p = childPath();
        if(p) await updateDoc(doc(db, ...p, "tasks", done), {done:true, doneAt:serverTimestamp()}).catch(console.error);
      }

      toast("Task marked done");
      await syncLocalData();
      await loadTasks();
      await loadDashboard();
    }

    if(delTask){
      state.localTasks = state.localTasks.filter(t => t.id !== delTask && t.cloudId !== delTask);
      saveState();

      const p = childPath();
      if(p) await deleteDoc(doc(db, ...p, "tasks", delTask)).catch(()=>{});

      toast("Task deleted");
      await loadTasks();
      await loadDashboard();
    }

    if(delEvent){
      state.localEvents = state.localEvents.filter(x => x.id !== delEvent && x.cloudId !== delEvent);
      saveState();

      const p = childPath();
      if(p) await deleteDoc(doc(db, ...p, "calendar", delEvent)).catch(()=>{});

      toast("Calendar item deleted");
      await loadCalendar();
      await loadDashboard();
    }

    if(edit){
      const local = state.localEvents.find(x => x.id === edit || x.cloudId === edit);
      if(local){
        $("#editingEventId").value = local.id;
        $("#eventTitle").value = local.title || "";
        $("#eventDate").value = local.date || "";
        $("#eventStart").value = local.start || "";
        $("#eventEnd").value = local.end || "";
        $("#eventCategory").value = local.category || "Personal";
        $("#eventDetails").value = local.details || "";
        window.scrollTo({top:0, behavior:"smooth"});
        return;
      }

      const p = childPath();
      if(p){
        const snap = await getDoc(doc(db, ...p, "calendar", edit));
        if(snap.exists()){
          const x = snap.data();
          $("#editingEventId").value = edit;
          $("#eventTitle").value = x.title || "";
          $("#eventDate").value = x.date || "";
          $("#eventStart").value = x.start || "";
          $("#eventEnd").value = x.end || "";
          $("#eventCategory").value = x.category || "Personal";
          $("#eventDetails").value = x.details || "";
          window.scrollTo({top:0, behavior:"smooth"});
        }
      }
    }
  });
}

onAuthStateChanged(auth, async user => {
  currentUser = user;
  firebaseReady = !!user;
  updateAuthUI();

  if(user){
    await syncLocalData();
    await loadDashboard();
  }
});

signInAnonymously(auth).catch(err => {
  console.error(err);
  toast("Firebase not connected. Enable Anonymous sign-in.");
});

bind();
updateRanges();
updateTimer();
updateAuthUI();
renderLocalDashboard();
