import { firebaseConfig } from "./firebase-config.js?v=20";
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
  collection,
  getDocs,
  updateDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js";

const app = initializeApp(firebaseConfig, "neurodirect-parent-v20");
const auth = getAuth(app);
const db = getFirestore(app);

const STORAGE = "neurodirect_parent_v20";
const $ = s => document.querySelector(s);
const $$ = s => Array.from(document.querySelectorAll(s));

let currentUser = null;
let state = loadState();

function defaultState(){
  return {
    displayName: "Parent",
    familyCode: ""
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

function familyCode(){
  return (state.familyCode || "").trim().toUpperCase();
}

function parentName(){
  return (state.displayName || "Parent").trim();
}

function setTab(id){
  $$(".nav-link").forEach(b => b.classList.toggle("active", b.dataset.tab === id));
  $$(".tab").forEach(t => t.classList.toggle("active", t.id === id));
  $("#sidebar")?.classList.remove("open");

  if(id === "calendar") loadCalendar();
  if(id === "notifications") loadNotifications();
  if(id === "checkins") loadCheckins();

  window.scrollTo({top:0, behavior:"smooth"});
}

function updateAuthUI(){
  const connected = !!currentUser;

  $("#authPill").textContent = connected ? "Connected" : "Connecting";
  $("#authStatus").textContent = connected
    ? "Background connection active. Parent app reads from the family code."
    : "Starting secure background connection...";

  const name = parentName();
  $("#profileName").textContent = name;
  $("#avatarInitial").textContent = name.charAt(0).toUpperCase() || "P";
  $("#familyCodeInput").value = state.familyCode || "";
  $("#displayNameInput").value = state.displayName || "";
  $("#familyCodeLabel").textContent = state.familyCode || "Not linked yet";
}

async function saveFamilyProfile(){
  if(!currentUser) throw new Error("Firebase is still connecting.");
  const code = familyCode();
  if(!code) throw new Error("Enter the family code first.");

  await setDoc(doc(db, "families", code), {
    code,
    updatedAt: serverTimestamp()
  }, {merge:true});

  await setDoc(doc(db, "families", code, "members", currentUser.uid), {
    uid: currentUser.uid,
    displayName: parentName(),
    role: "parent",
    updatedAt: serverTimestamp()
  }, {merge:true});
}

function formatDate(dateStr, timeStr=""){
  const d = new Date(`${dateStr}T${timeStr || "00:00"}`);
  return new Intl.DateTimeFormat("en-GB", {
    weekday:"short",
    day:"2-digit",
    month:"short"
  }).format(d);
}

async function readFamilyCollection(name){
  if(!currentUser || !familyCode()) return [];

  try{
    const snap = await getDocs(collection(db, "families", familyCode(), name));
    return snap.docs.map(d => ({id:d.id, ...d.data()}));
  }catch(err){
    console.error(err);
    toast(`Could not load ${name}. Check Firestore rules.`);
    return [];
  }
}

async function loadDashboard(){
  if(!currentUser || !familyCode()) return;

  try{
    await saveFamilyProfile();

    const [notifs, events, checkins, members] = await Promise.all([
      loadNotifications(true),
      loadCalendar(true),
      loadCheckins(true),
      readFamilyCollection("members")
    ]);

    $("#dashUnread").textContent = notifs.filter(n => !n.read).length;
    $("#dashPlans").textContent = events.length;
    $("#dashCheckins").textContent = checkins.length;
    $("#dashMembers").textContent = members.length;

    renderNotifications("#latestNotifications", notifs.slice(0,4));
  }catch(err){
    console.error(err);
    toast("Parent data could not sync yet.");
  }
}

async function loadNotifications(summaryOnly=false){
  const list = await readFamilyCollection("notifications");
  list.sort((a,b) => (b.createdAtIso || "").localeCompare(a.createdAtIso || ""));

  if(!summaryOnly) renderNotifications("#notificationList", list);
  return list;
}

function renderNotifications(selector, list){
  const box = $(selector);
  if(!box) return;

  if(!list.length){
    box.className = "list empty-state";
    box.textContent = "No notifications yet.";
    return;
  }

  box.className = "list";
  box.innerHTML = list.map(n => `
    <div class="item ${n.read ? "" : "notification-unread"}">
      <div>
        <strong>${esc(n.title || "Notification")}</strong>
        <small>${esc(n.childName || "Teen")} · ${n.createdAtIso ? new Date(n.createdAtIso).toLocaleString("en-GB") : ""}</small>
        <p>${esc(n.message || "")}</p>
      </div>
      ${n.read ? '<span class="pill">Read</span>' : `<button class="primary-button small" data-read="${esc(n.id)}">Mark read</button>`}
    </div>
  `).join("");
}

async function loadCalendar(summaryOnly=false){
  const today = new Date().toISOString().slice(0,10);

  const events = (await readFamilyCollection("calendar"))
    .filter(e => e.date >= today)
    .sort((a,b) => (a.date + a.start).localeCompare(b.date + b.start));

  if(!summaryOnly) renderCalendar(events);
  return events;
}

function renderCalendar(events){
  const box = $("#calendarList");
  if(!box) return;

  if(!events.length){
    box.className = "day-list empty-state";
    box.textContent = "No calendar items yet.";
    return;
  }

  box.className = "day-list";
  box.innerHTML = events.map(e => `
    <div class="item">
      <div class="date-pill">${new Date(e.date + "T00:00").getDate()}<span>${new Date(e.date + "T00:00").toLocaleString("en-GB",{month:"short"})}</span></div>
      <div style="flex:1;">
        <strong>${esc(e.title)}</strong>
        <small>${esc(e.childName || "Teen")} · ${esc(e.category)} · ${formatDate(e.date,e.start)} · ${esc(e.start || "")} ${e.end ? `- ${esc(e.end)}` : ""}</small>
        ${e.details ? `<p>${esc(e.details)}</p>` : ""}
      </div>
    </div>
  `).join("");
}

async function loadCheckins(summaryOnly=false){
  const list = await readFamilyCollection("checkins");
  list.sort((a,b) => (b.createdAtIso || "").localeCompare(a.createdAtIso || ""));

  if(!summaryOnly) renderCheckins(list);
  return list;
}

function renderCheckins(list){
  const box = $("#checkinList");
  if(!box) return;

  if(!list.length){
    box.className = "list empty-state";
    box.textContent = "No check-ins yet.";
    return;
  }

  box.className = "list";
  box.innerHTML = list.map(c => `
    <div class="item">
      <div>
        <strong>${esc(c.mood || "Check-in")}</strong>
        <small>${esc(c.childName || "Teen")} · Stress ${c.stress}/10 · Focus ${c.focus}/10 · ${c.createdAtIso ? new Date(c.createdAtIso).toLocaleString("en-GB") : ""}</small>
        ${c.notes ? `<p>${esc(c.notes)}</p>` : ""}
      </div>
      ${c.flagged ? '<span class="pill">Flagged</span>' : ""}
    </div>
  `).join("");
}

function bind(){
  $("#menuButton").onclick = () => $("#sidebar").classList.toggle("open");
  $$(".nav-link").forEach(b => b.onclick = () => setTab(b.dataset.tab));
  $$("[data-go]").forEach(b => b.onclick = () => setTab(b.dataset.go));

  $("#themeButton").onclick = () => {
    document.documentElement.dataset.theme = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    $("#themeButton").textContent = document.documentElement.dataset.theme === "dark" ? "Light" : "Dark";
  };

  $("#saveName").onclick = async () => {
    state.displayName = $("#displayNameInput").value.trim() || "Parent";
    saveState();
    updateAuthUI();
    toast("Name saved");

    if(currentUser && familyCode()){
      await saveFamilyProfile().catch(err => {
        console.error(err);
        toast("Name saved locally. Firebase sync failed.");
      });
      await loadDashboard();
    }
  };

  $("#saveFamilyCode").onclick = async () => {
    state.familyCode = $("#familyCodeInput").value.trim().toUpperCase();
    saveState();
    updateAuthUI();
    toast("Family code saved");

    try{
      await saveFamilyProfile();
      await loadDashboard();
      toast("Family code linked");
    }catch(err){
      console.error(err);
      toast("Family code saved locally. Firebase sync failed.");
    }
  };

  $("#refreshCalendar").onclick = async () => {
    await loadCalendar();
    await loadDashboard();
  };

  $("#markAllRead").onclick = async () => {
    const list = await loadNotifications(true);

    await Promise.all(list.filter(n => !n.read).map(n =>
      updateDoc(doc(db, "families", familyCode(), "notifications", n.id), {
        read: true,
        readAtIso: new Date().toISOString(),
        updatedAt: serverTimestamp()
      })
    )).catch(console.error);

    toast("Notifications marked read");
    await loadNotifications();
    await loadDashboard();
  };

  document.addEventListener("click", async e => {
    const id = e.target.closest("[data-read]")?.dataset.read;

    if(id){
      await updateDoc(doc(db, "families", familyCode(), "notifications", id), {
        read: true,
        readAtIso: new Date().toISOString(),
        updatedAt: serverTimestamp()
      }).catch(console.error);

      toast("Marked read");
      await loadNotifications();
      await loadDashboard();
    }
  });
}

onAuthStateChanged(auth, async user => {
  currentUser = user;
  updateAuthUI();

  if(user && familyCode()){
    await saveFamilyProfile().catch(console.error);
    await loadDashboard();
  }
});

signInAnonymously(auth).catch(err => {
  console.error(err);
  toast("Firebase not connected. Enable Anonymous sign-in.");
});

bind();
updateAuthUI();
