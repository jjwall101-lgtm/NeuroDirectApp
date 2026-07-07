import { firebaseConfig, firebaseEnabled } from "./firebase-config.js?v=16";
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-app.js";
import {
  getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword,
  signOut, updateProfile, onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.15.0/firebase-auth.js";
import {
  getFirestore, doc, setDoc, getDoc, collection, addDoc, updateDoc, deleteDoc,
  query, orderBy, limit, getDocs, serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const STORAGE = "neurodirect_teen_v15";
const $ = s => document.querySelector(s);
const $$ = s => Array.from(document.querySelectorAll(s));

let currentUser = null;
let state = loadState();
let timer = { total:600, remaining:600, interval:null, running:false };

function loadState(){
  try { return JSON.parse(localStorage.getItem(STORAGE) || "{}"); }
  catch { return {}; }
}
function saveState(){ localStorage.setItem(STORAGE, JSON.stringify(state)); }
function toast(msg){
  const el=$("#toast"); el.textContent=msg; el.classList.add("show");
  clearTimeout(toast.t); toast.t=setTimeout(()=>el.classList.remove("show"),2200);
}
function esc(v){return String(v||"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;")}
function familyCode(){ return (state.familyCode || "").trim().toUpperCase(); }
function childPath(){ if(!currentUser || !familyCode()) return null; return ["families", familyCode(), "children", currentUser.uid]; }
function setTab(id){
  $$(".nav-link").forEach(b=>b.classList.toggle("active", b.dataset.tab===id));
  $$(".tab").forEach(t=>t.classList.toggle("active", t.id===id));
  $("#sidebar").classList.remove("open");
  if(id==="calendar") loadCalendar();
  if(id==="planner") loadTasks();
  window.scrollTo({top:0,behavior:"smooth"});
}
function formatDate(dateStr,timeStr=""){
  const d = new Date(`${dateStr}T${timeStr || "00:00"}`);
  return new Intl.DateTimeFormat("en-GB",{weekday:"short",day:"2-digit",month:"short"}).format(d);
}
function updateAuthUI(){
  const signedIn = !!currentUser;
  $("#authPill").textContent = signedIn ? "Signed in" : "Signed out";
  $("#authStatus").textContent = signedIn ? `${currentUser.email}` : "Not signed in";
  $("#signedOutBox").classList.toggle("hidden", signedIn);
  $("#signedInBox").classList.toggle("hidden", !signedIn);
  const name = currentUser?.displayName || state.displayName || "NeuroDirect";
  $("#profileName").textContent = signedIn ? name : "Not signed in";
  $("#avatarInitial").textContent = name.trim().charAt(0).toUpperCase() || "N";
  $("#greeting").textContent = signedIn ? `${name}, build the day in smaller steps.` : "Build the day in smaller steps.";
  $("#familyCodeInput").value = state.familyCode || "";
  $("#familyCodeLabel").textContent = state.familyCode || "Not linked yet";
}
async function saveUserProfile(){
  if(!currentUser) throw new Error("Sign in first.");
  const code = familyCode();
  await setDoc(doc(db,"users",currentUser.uid),{
    uid:currentUser.uid,
    email:currentUser.email,
    displayName: currentUser.displayName || state.displayName || "Teen user",
    role:"teen",
    familyCode:code || null,
    updatedAt:serverTimestamp()
  },{merge:true});
  if(code){
    await setDoc(doc(db,"families",code),{code,updatedAt:serverTimestamp()},{merge:true});
    await setDoc(doc(db,"families",code,"members",currentUser.uid),{
      uid:currentUser.uid,
      email:currentUser.email,
      displayName: currentUser.displayName || state.displayName || "Teen user",
      role:"teen",
      updatedAt:serverTimestamp()
    },{merge:true});
    await setDoc(doc(db,"families",code,"children",currentUser.uid),{
      uid:currentUser.uid,
      email:currentUser.email,
      displayName: currentUser.displayName || state.displayName || "Teen user",
      updatedAt:serverTimestamp()
    },{merge:true});
  }
}
async function notifyParent(type,title,message){
  if(!currentUser || !familyCode()) return;
  await addDoc(collection(db,"families",familyCode(),"notifications"),{
    type,title,message,
    childUid:currentUser.uid,
    childName:currentUser.displayName || state.displayName || "Teen",
    read:false,
    createdAt:serverTimestamp()
  });
}
async function loadDashboard(){
  if(!currentUser || !familyCode()) return;
  await Promise.all([loadCalendar(true), loadTasks(true), loadLatestCheckin()]);
}
async function loadLatestCheckin(){
  const p = childPath(); if(!p) return;
  const q = query(collection(db,...p,"checkins"), orderBy("createdAt","desc"), limit(1));
  const snap = await getDocs(q);
  if(snap.empty){ $("#dashMood").textContent="—"; $("#dashMoodHint").textContent="No check-in yet."; $("#dashStress").textContent="—"; return; }
  const c=snap.docs[0].data();
  $("#dashMood").textContent=c.mood || "—";
  $("#dashStress").textContent=c.stress ? `${c.stress}/10` : "—";
  $("#dashMoodHint").textContent=c.createdAt?.toDate ? c.createdAt.toDate().toLocaleString("en-GB") : "Latest check-in";
}
async function loadTasks(summaryOnly=false){
  const p=childPath(); if(!p) return;
  const q=query(collection(db,...p,"tasks"), orderBy("createdAt","desc"), limit(50));
  const snap=await getDocs(q);
  const tasks=snap.docs.map(d=>({id:d.id,...d.data()}));
  $("#dashTasks").textContent=tasks.filter(t=>t.done).length;
  if(summaryOnly) return;
  const box=$("#taskList");
  if(!tasks.length){box.className="list empty-state";box.textContent="No tasks yet.";return;}
  box.className="list";
  box.innerHTML=tasks.map(t=>`<div class="item"><div><strong>${esc(t.title)}</strong><small>${esc(t.priority)} · ${esc(t.size)} · ${t.done?"Done":"To do"}</small></div><div class="button-row">${t.done?"":`<button class="primary-button small" data-done-task="${t.id}">Done</button>`}<button class="danger-button small" data-delete-task="${t.id}">Delete</button></div></div>`).join("");
}
async function loadCalendar(summaryOnly=false){
  const p=childPath(); if(!p) return;
  const q=query(collection(db,...p,"calendar"), orderBy("date","asc"), orderBy("start","asc"), limit(60));
  const snap=await getDocs(q);
  const nowDate=new Date().toISOString().slice(0,10);
  const events=snap.docs.map(d=>({id:d.id,...d.data()})).filter(e=>e.date>=nowDate);
  $("#dashPlans").textContent=events.length;
  const first=events[0];
  $("#nextPlanTitle").textContent=first ? first.title : "Nothing planned";
  $("#nextPlanTime").textContent=first ? `${formatDate(first.date,first.start)} ${first.start || ""}` : "Add a calendar item.";
  renderEventList("#upcomingList", events.slice(0,4));
  if(summaryOnly) return;
  renderEventList("#calendarList", events);
}
function renderEventList(selector, events){
  const box=$(selector);
  if(!events.length){box.className=selector==="#calendarList"?"day-list empty-state":"list empty-state";box.textContent="No upcoming plans yet.";return;}
  box.className=selector==="#calendarList"?"day-list":"list";
  box.innerHTML=events.map(e=>`<div class="item">
    <div class="date-pill">${new Date(e.date+"T00:00").getDate()}<span>${new Date(e.date+"T00:00").toLocaleString("en-GB",{month:"short"})}</span></div>
    <div style="flex:1;"><strong>${esc(e.title)}</strong><small>${esc(e.category)} · ${formatDate(e.date,e.start)} · ${esc(e.start||"")} ${e.end?`- ${esc(e.end)}`:""}</small>${e.details?`<p>${esc(e.details)}</p>`:""}</div>
    ${selector==="#calendarList"?`<div class="button-row"><button class="secondary-button small" data-edit-event="${e.id}">Edit</button><button class="danger-button small" data-delete-event="${e.id}">Delete</button></div>`:""}
  </div>`).join("");
}
function updateRanges(){["stress","focus","energy"].forEach(n=>{$(`#${n}Value`).textContent=$(`#${n}Input`).value})}
function setTimer(min){timer.total=min*60;timer.remaining=timer.total;updateTimer()}
function updateTimer(){const m=Math.floor(timer.remaining/60),s=timer.remaining%60;$("#timerFace").textContent=`${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}`}
function startTimer(){if(timer.running)return;timer.running=true;$("#timerLabel").textContent="Focus block running.";timer.interval=setInterval(()=>{timer.remaining--;updateTimer();if(timer.remaining<=0){clearInterval(timer.interval);timer.running=false;timer.remaining=timer.total;updateTimer();$("#timerLabel").textContent="Focus block complete.";toast("Focus block complete");}},1000)}
function pauseTimer(){timer.running=false;clearInterval(timer.interval);$("#timerLabel").textContent="Paused."}
function resetTimer(){pauseTimer();timer.remaining=timer.total;updateTimer();$("#timerLabel").textContent="Timer reset."}
function bind(){
  $("#menuButton").onclick=()=>$("#sidebar").classList.toggle("open");
  $$(".nav-link").forEach(b=>b.onclick=()=>setTab(b.dataset.tab));
  $$("[data-go]").forEach(b=>b.onclick=()=>setTab(b.dataset.go));
  $("#themeButton").onclick=()=>{document.documentElement.dataset.theme=document.documentElement.dataset.theme==="dark"?"light":"dark";$("#themeButton").textContent=document.documentElement.dataset.theme==="dark"?"Light":"Dark";}
  ["stress","focus","energy"].forEach(n=>$(`#${n}Input`).oninput=updateRanges);

  $("#createAccount").onclick=async()=>{try{const email=$("#emailInput").value.trim(),pass=$("#passwordInput").value,name=$("#displayNameInput").value.trim();const cred=await createUserWithEmailAndPassword(auth,email,pass);if(name) await updateProfile(cred.user,{displayName:name});state.displayName=name;saveState();await saveUserProfile();toast("Account created");}catch(e){toast(e.message)}};
  $("#signIn").onclick=async()=>{try{await signInWithEmailAndPassword(auth,$("#emailInput").value.trim(),$("#passwordInput").value);toast("Signed in");}catch(e){toast(e.message)}};
  $("#signOut").onclick=async()=>{await signOut(auth);toast("Signed out")};
  $("#saveProfile").onclick=async()=>{try{await saveUserProfile();toast("Profile saved")}catch(e){toast(e.message)}};
  $("#generateFamilyCode").onclick=()=>{state.familyCode=("ND"+Math.random().toString(36).slice(2,8)).toUpperCase();saveState();updateAuthUI();toast("Family code generated")};
  $("#saveFamilyCode").onclick=async()=>{state.familyCode=$("#familyCodeInput").value.trim().toUpperCase();saveState();updateAuthUI();try{await saveUserProfile();toast("Family code saved")}catch(e){toast(e.message)}};

  $("#checkinForm").onsubmit=async(e)=>{e.preventDefault();try{const p=childPath();if(!p)throw new Error("Sign in and set a family code first.");const data={mood:$("#moodInput").value,stress:Number($("#stressInput").value),focus:Number($("#focusInput").value),energy:Number($("#energyInput").value),notes:$("#checkinNotes").value.trim(),flagged:$("#flagParent").checked,createdAt:serverTimestamp()};await addDoc(collection(db,...p,"checkins"),data);if(data.flagged || data.stress>=8){await notifyParent("checkin","Check-in flagged",`${currentUser.displayName||"Teen"} logged ${data.mood} mood with stress ${data.stress}/10.`)}$("#checkinNotes").value="";$("#flagParent").checked=false;toast("Check-in saved");await loadDashboard();setTab("dashboard")}catch(err){toast(err.message)}};
  $("#taskForm").onsubmit=async(e)=>{e.preventDefault();try{const p=childPath();if(!p)throw new Error("Sign in and set a family code first.");await addDoc(collection(db,...p,"tasks"),{title:$("#taskTitle").value.trim(),priority:$("#taskPriority").value,size:$("#taskSize").value,done:false,createdAt:serverTimestamp()});$("#taskTitle").value="";toast("Task added");await loadTasks()}catch(err){toast(err.message)}};
  $("#eventForm").onsubmit=async(e)=>{e.preventDefault();try{const p=childPath();if(!p)throw new Error("Sign in and set a family code first.");const id=$("#editingEventId").value;const data={title:$("#eventTitle").value.trim(),date:$("#eventDate").value,start:$("#eventStart").value,end:$("#eventEnd").value,category:$("#eventCategory").value,details:$("#eventDetails").value.trim(),updatedAt:serverTimestamp()};if(id){await updateDoc(doc(db,...p,"calendar",id),data);toast("Calendar item updated")}else{data.createdAt=serverTimestamp();await addDoc(collection(db,...p,"calendar"),data);toast("Calendar item added");if($("#eventNotifyParent").checked) await notifyParent("calendar","New calendar plan",`${currentUser.displayName||"Teen"} added: ${data.title} on ${data.date} at ${data.start}.`)}$("#eventForm").reset();$("#editingEventId").value="";await loadCalendar();await loadDashboard()}catch(err){toast(err.message)}};
  $("#clearEventForm").onclick=()=>{$("#eventForm").reset();$("#editingEventId").value=""};
  $("#refreshButton").onclick=()=>loadCalendar();
  $$("[data-minutes]").forEach(b=>b.onclick=()=>setTimer(Number(b.dataset.minutes)));
  $("#startTimer").onclick=startTimer;$("#pauseTimer").onclick=pauseTimer;$("#resetTimer").onclick=resetTimer;

  document.addEventListener("click",async e=>{
    const done=e.target.closest("[data-done-task]")?.dataset.doneTask;
    const delTask=e.target.closest("[data-delete-task]")?.dataset.deleteTask;
    const delEvent=e.target.closest("[data-delete-event]")?.dataset.deleteEvent;
    const edit=e.target.closest("[data-edit-event]")?.dataset.editEvent;
    const p=childPath(); if(!p) return;
    if(done){await updateDoc(doc(db,...p,"tasks",done),{done:true,doneAt:serverTimestamp()});toast("Task marked done");loadTasks();loadDashboard();}
    if(delTask){await deleteDoc(doc(db,...p,"tasks",delTask));toast("Task deleted");loadTasks();loadDashboard();}
    if(delEvent){await deleteDoc(doc(db,...p,"calendar",delEvent));toast("Calendar item deleted");loadCalendar();loadDashboard();}
    if(edit){const snap=await getDoc(doc(db,...p,"calendar",edit));if(snap.exists()){const x=snap.data();$("#editingEventId").value=edit;$("#eventTitle").value=x.title||"";$("#eventDate").value=x.date||"";$("#eventStart").value=x.start||"";$("#eventEnd").value=x.end||"";$("#eventCategory").value=x.category||"Personal";$("#eventDetails").value=x.details||"";window.scrollTo({top:0,behavior:"smooth"});}}
  });
}
onAuthStateChanged(auth,async user=>{currentUser=user;if(user){const snap=await getDoc(doc(db,"users",user.uid));if(snap.exists() && snap.data().familyCode){state.familyCode=snap.data().familyCode;saveState();}await saveUserProfile().catch(()=>{});await loadDashboard().catch(()=>{});}updateAuthUI();});
bind();updateRanges();updateTimer();updateAuthUI();
