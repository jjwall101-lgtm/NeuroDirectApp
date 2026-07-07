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
  collection,
  getDocs,
  updateDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js";

const app = initializeApp(firebaseConfig, "neurodirect-parent-v19");
const auth = getAuth(app);
const db = getFirestore(app);

const STORAGE = "neurodirect_parent_v19";
const $ = s => document.querySelector(s);
const $$ = s => Array.from(document.querySelectorAll(s));

let currentUser = null;
let state = loadState();

function loadState(){
  try {
    return {
      displayName: "Parent",
      familyCode: "",
      ...JSON.parse(localStorage.getItem(STORAGE) || "{}")
    };
  } catch {
    return { displayName:"Parent", familyCode:"" };
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
    ? "Background Firebase connection active. No sign-in needed."
    : "Starting secure background connection...";

  const name = parentName();
  $("#profileName").textContent = name;
  $("#avatarInitial").textContent = name.charAt(0).toUpperCase() || "P";
  $("#familyCodeInput").value = state.familyCode || "";
  $("#displayNameInput").value = state.displayName || "";
  $("#familyCodeLabel").textContent = state.familyCode || "Not linked yet";
}

async function saveFamilyProfile(){
  if(!currentUser) throw new Error("Background connection is still starting.");
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

async function getChildren(){
  if(!familyCode()) return [];
  const snap = await getDocs(collection(db, "families", familyCode(), "children"));
  return snap.docs.map(d => ({id:d.id, ...d.data()}));
}

function formatDate(dateStr, timeStr=""){
  const d = new Date(`${dateStr}T${timeStr || "00:00"}`);
  return new Intl.DateTimeFormat("en-GB", {
    weekday:"short",
    day:"2-digit",
    month:"short"
  }).format(d);
}

async function loadDashboard(){
  if(!currentUser || !familyCode()) return;

  try{
    await saveFamilyProfile();

    const [notifs, events, checkins, members] = await Promise.all([
      loadNotifications(true),
      loadCalendar(true),
      loadCheckins(true),
      getDocs(collection(db, "families", familyCode(), "members"))
    ]);

    $("#dashUnread").textContent = notifs.filter(n => !n.read).length;
    $("#dashPlans").textContent = events.length;
    $("#dashCheckins").textContent = checkins.length;
    $("#dashMembers").textContent = members.size;

    renderNotifications("#latestNotifications", notifs.slice(0,4));
  }catch(err){
    console.error(err);
    toast("Parent data could not sync yet.");
  }
}

async function loadNotifications(summaryOnly=false){
  if(!familyCode()) return [];

  try{
    const snap = await getDocs(collection(db, "families", familyCode(), "notifications"));
    const list = snap.docs
      .map(d => ({id:d.id, ...d.data()}))
      .sort((a,b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));

    if(!summaryOnly) renderNotifications("#notificationList", list);
    return list;
  }catch(err){
    console.error(err);
    if(!summaryOnly) renderNotifications("#notificationList", []);
    return [];
  }
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
        <small>${esc(n.childName || "Teen")} · ${n.createdAt?.toDate ? n.createdAt.toDate().toLocaleString("en-GB") : ""}</small>
        <p>${esc(n.message || "")}</p>
      </div>
      ${n.read ? '<span class="pill">Read</span>' : `<button class="primary-button small" data-read="${n.id}">Mark read</button>`}
    </div>
  `).join("");
}

async function loadCalendar(summaryOnly=false){
  const children = await getChildren();
  const all = [];

  for(const child of children){
    try{
      const snap = await getDocs(collection(db, "families", familyCode(), "children", child.id, "calendar"));
      snap.docs.forEach(d => all.push({
        id:d.id,
        childId:child.id,
        childName:child.displayName || "Teen",
        ...d.data()
      }));
    }catch(err){
      console.error(err);
    }
  }

  const today = new Date().toISOString().slice(0,10);
  const events = all
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
        <small>${esc(e.childName)} · ${esc(e.category)} · ${formatDate(e.date,e.start)} · ${esc(e.start || "")} ${e.end ? `- ${esc(e.end)}` : ""}</small>
        ${e.details ? `<p>${esc(e.details)}</p>` : ""}
      </div>
    </div>
  `).join("");
}

async function loadCheckins(summaryOnly=false){
  const children = await getChildren();
  const all = [];

  for(const child of children){
    try{
      const snap = await getDocs(collection(db, "families", familyCode(), "children", child.id, "checkins"));
      snap.docs.forEach(d => all.push({
        id:d.id,
        childId:child.id,
        childName:child.displayName || "Teen",
        ...d.data()
      }));
    }catch(err){
      console.error(err);
    }
  }

  all.sort((a,b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));

  if(!summaryOnly) renderCheckins(all);
  return all;
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
        <small>${esc(c.childName)} · Stress ${c.stress}/10 · Focus ${c.focus}/10 · ${c.createdAt?.toDate ? c.createdAt.toDate().toLocaleString("en-GB") : ""}</small>
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
    if(currentUser && familyCode()) {
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
    }catch(err){
      console.error(err);
      toast("Family code saved locally. Firebase sync failed.");
    }
  };

  $("#refreshCalendar").onclick = () => loadCalendar();

  $("#markAllRead").onclick = async () => {
    const list = await loadNotifications(true);
    await Promise.all(list.filter(n => !n.read).map(n =>
      updateDoc(doc(db, "families", familyCode(), "notifications", n.id), {
        read:true,
        readAt:serverTimestamp()
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
        read:true,
        readAt:serverTimestamp()
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
