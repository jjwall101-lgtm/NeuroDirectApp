import { firebaseConfig } from "./firebase-config.js?v=16";
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-app.js";
import {
  getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword,
  signOut, updateProfile, onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.15.0/firebase-auth.js";
import {
  getFirestore, doc, setDoc, getDoc, collection, query, orderBy, limit, getDocs,
  updateDoc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const STORAGE = "neurodirect_parent_v15";
const $ = s => document.querySelector(s);
const $$ = s => Array.from(document.querySelectorAll(s));

let currentUser = null;
let state = loadState();

function loadState(){try{return JSON.parse(localStorage.getItem(STORAGE)||"{}")}catch{return {}}}
function saveState(){localStorage.setItem(STORAGE,JSON.stringify(state))}
function toast(msg){const el=$("#toast");el.textContent=msg;el.classList.add("show");clearTimeout(toast.t);toast.t=setTimeout(()=>el.classList.remove("show"),2200)}
function esc(v){return String(v||"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;")}
function familyCode(){return (state.familyCode||"").trim().toUpperCase()}
function setTab(id){$$(".nav-link").forEach(b=>b.classList.toggle("active",b.dataset.tab===id));$$(".tab").forEach(t=>t.classList.toggle("active",t.id===id));$("#sidebar").classList.remove("open");if(id==="calendar")loadCalendar();if(id==="notifications")loadNotifications();if(id==="checkins")loadCheckins();window.scrollTo({top:0,behavior:"smooth"})}
function updateAuthUI(){
  const signedIn=!!currentUser;
  $("#authPill").textContent=signedIn?"Signed in":"Signed out";
  $("#authStatus").textContent=signedIn?currentUser.email:"Not signed in";
  $("#signedOutBox").classList.toggle("hidden",signedIn);
  $("#signedInBox").classList.toggle("hidden",!signedIn);
  const name=currentUser?.displayName||state.displayName||"Parent";
  $("#profileName").textContent=signedIn?name:"Parent";
  $("#avatarInitial").textContent=name.trim().charAt(0).toUpperCase()||"P";
  $("#familyCodeInput").value=state.familyCode||"";
  $("#familyCodeLabel").textContent=state.familyCode||"Not linked yet";
}
async function saveUserProfile(){
  if(!currentUser) throw new Error("Sign in first.");
  const code=familyCode();
  await setDoc(doc(db,"users",currentUser.uid),{
    uid:currentUser.uid,email:currentUser.email,displayName:currentUser.displayName||state.displayName||"Parent user",
    role:"parent",familyCode:code||null,updatedAt:serverTimestamp()
  },{merge:true});
  if(code){
    await setDoc(doc(db,"families",code),{code,updatedAt:serverTimestamp()},{merge:true});
    await setDoc(doc(db,"families",code,"members",currentUser.uid),{
      uid:currentUser.uid,email:currentUser.email,displayName:currentUser.displayName||state.displayName||"Parent user",
      role:"parent",updatedAt:serverTimestamp()
    },{merge:true});
  }
}
async function getChildren(){
  if(!familyCode()) return [];
  const snap=await getDocs(collection(db,"families",familyCode(),"children"));
  return snap.docs.map(d=>({id:d.id,...d.data()}));
}
function formatDate(dateStr,timeStr=""){
  const d=new Date(`${dateStr}T${timeStr||"00:00"}`);
  return new Intl.DateTimeFormat("en-GB",{weekday:"short",day:"2-digit",month:"short"}).format(d);
}
async function loadDashboard(){
  if(!currentUser||!familyCode())return;
  const [notifs,events,checkins,members]=await Promise.all([loadNotifications(true),loadCalendar(true),loadCheckins(true),getDocs(collection(db,"families",familyCode(),"members"))]);
  $("#dashUnread").textContent=notifs.filter(n=>!n.read).length;
  $("#dashPlans").textContent=events.length;
  $("#dashCheckins").textContent=checkins.length;
  $("#dashMembers").textContent=members.size;
  renderNotifications("#latestNotifications",notifs.slice(0,4));
}
async function loadNotifications(summaryOnly=false){
  if(!familyCode())return [];
  const q=query(collection(db,"families",familyCode(),"notifications"),orderBy("createdAt","desc"),limit(50));
  const snap=await getDocs(q);
  const list=snap.docs.map(d=>({id:d.id,...d.data()}));
  if(!summaryOnly) renderNotifications("#notificationList",list);
  return list;
}
function renderNotifications(selector,list){
  const box=$(selector);
  if(!list.length){box.className="list empty-state";box.textContent="No notifications yet.";return;}
  box.className="list";
  box.innerHTML=list.map(n=>`<div class="item ${n.read?"":"notification-unread"}"><div><strong>${esc(n.title||"Notification")}</strong><small>${esc(n.childName||"Teen")} · ${n.createdAt?.toDate?n.createdAt.toDate().toLocaleString("en-GB"):""}</small><p>${esc(n.message||"")}</p></div>${n.read?'<span class="pill">Read</span>':`<button class="primary-button small" data-read="${n.id}">Mark read</button>`}</div>`).join("");
}
async function loadCalendar(summaryOnly=false){
  const children=await getChildren();
  const all=[];
  for(const child of children){
    const q=query(collection(db,"families",familyCode(),"children",child.id,"calendar"),orderBy("date","asc"),orderBy("start","asc"),limit(50));
    const snap=await getDocs(q);
    snap.docs.forEach(d=>all.push({id:d.id,childId:child.id,childName:child.displayName||"Teen",...d.data()}));
  }
  const today=new Date().toISOString().slice(0,10);
  const events=all.filter(e=>e.date>=today).sort((a,b)=>(a.date+a.start).localeCompare(b.date+b.start));
  if(!summaryOnly) renderCalendar(events);
  return events;
}
function renderCalendar(events){
  const box=$("#calendarList");
  if(!events.length){box.className="day-list empty-state";box.textContent="No calendar items yet.";return;}
  box.className="day-list";
  box.innerHTML=events.map(e=>`<div class="item"><div class="date-pill">${new Date(e.date+"T00:00").getDate()}<span>${new Date(e.date+"T00:00").toLocaleString("en-GB",{month:"short"})}</span></div><div style="flex:1;"><strong>${esc(e.title)}</strong><small>${esc(e.childName)} · ${esc(e.category)} · ${formatDate(e.date,e.start)} · ${esc(e.start||"")} ${e.end?`- ${esc(e.end)}`:""}</small>${e.details?`<p>${esc(e.details)}</p>`:""}</div></div>`).join("");
}
async function loadCheckins(summaryOnly=false){
  const children=await getChildren();
  const all=[];
  for(const child of children){
    const q=query(collection(db,"families",familyCode(),"children",child.id,"checkins"),orderBy("createdAt","desc"),limit(20));
    const snap=await getDocs(q);
    snap.docs.forEach(d=>all.push({id:d.id,childId:child.id,childName:child.displayName||"Teen",...d.data()}));
  }
  all.sort((a,b)=>(b.createdAt?.seconds||0)-(a.createdAt?.seconds||0));
  if(!summaryOnly) renderCheckins(all);
  return all;
}
function renderCheckins(list){
  const box=$("#checkinList");
  if(!list.length){box.className="list empty-state";box.textContent="No check-ins yet.";return;}
  box.className="list";
  box.innerHTML=list.map(c=>`<div class="item"><div><strong>${esc(c.mood||"Check-in")}</strong><small>${esc(c.childName)} · Stress ${c.stress}/10 · Focus ${c.focus}/10 · ${c.createdAt?.toDate?c.createdAt.toDate().toLocaleString("en-GB"):""}</small>${c.notes?`<p>${esc(c.notes)}</p>`:""}</div>${c.flagged?'<span class="pill">Flagged</span>':""}</div>`).join("");
}
function bind(){
  $("#menuButton").onclick=()=>$("#sidebar").classList.toggle("open");
  $$(".nav-link").forEach(b=>b.onclick=()=>setTab(b.dataset.tab));
  $$("[data-go]").forEach(b=>b.onclick=()=>setTab(b.dataset.go));
  $("#themeButton").onclick=()=>{document.documentElement.dataset.theme=document.documentElement.dataset.theme==="dark"?"light":"dark";$("#themeButton").textContent=document.documentElement.dataset.theme==="dark"?"Light":"Dark";}
  $("#createAccount").onclick=async()=>{try{const email=$("#emailInput").value.trim(),pass=$("#passwordInput").value,name=$("#displayNameInput").value.trim();const cred=await createUserWithEmailAndPassword(auth,email,pass);if(name)await updateProfile(cred.user,{displayName:name});state.displayName=name;saveState();await saveUserProfile();toast("Parent account created")}catch(e){toast(e.message)}};
  $("#signIn").onclick=async()=>{try{await signInWithEmailAndPassword(auth,$("#emailInput").value.trim(),$("#passwordInput").value);toast("Signed in")}catch(e){toast(e.message)}};
  $("#signOut").onclick=async()=>{await signOut(auth);toast("Signed out")};
  $("#saveProfile").onclick=async()=>{try{await saveUserProfile();toast("Profile saved");loadDashboard()}catch(e){toast(e.message)}};
  $("#saveFamilyCode").onclick=async()=>{state.familyCode=$("#familyCodeInput").value.trim().toUpperCase();saveState();updateAuthUI();try{await saveUserProfile();toast("Family code saved");loadDashboard()}catch(e){toast(e.message)}};
  $("#refreshCalendar").onclick=()=>loadCalendar();
  $("#markAllRead").onclick=async()=>{const list=await loadNotifications(true);await Promise.all(list.filter(n=>!n.read).map(n=>updateDoc(doc(db,"families",familyCode(),"notifications",n.id),{read:true,readAt:serverTimestamp()})));toast("Notifications marked read");loadNotifications();loadDashboard();};
  document.addEventListener("click",async e=>{const id=e.target.closest("[data-read]")?.dataset.read;if(id){await updateDoc(doc(db,"families",familyCode(),"notifications",id),{read:true,readAt:serverTimestamp()});toast("Marked read");loadNotifications();loadDashboard();}});
}
onAuthStateChanged(auth,async user=>{currentUser=user;if(user){const snap=await getDoc(doc(db,"users",user.uid));if(snap.exists()&&snap.data().familyCode){state.familyCode=snap.data().familyCode;saveState()}await saveUserProfile().catch(()=>{});await loadDashboard().catch(()=>{})}updateAuthUI()});
bind();updateAuthUI();
