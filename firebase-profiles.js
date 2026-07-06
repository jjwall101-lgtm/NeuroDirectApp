import { firebaseConfig, firebaseEnabled } from "./firebase-config.js?v=11";
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

const STORAGE_KEY = "neurodirect_v1_state";
const $ = (id) => document.getElementById(id);

let app = null;
let auth = null;
let db = null;
let currentUser = null;

function setText(id, text) {
  const el = $(id);
  if (el) el.textContent = text;
}

function show(id, shouldShow) {
  const el = $(id);
  if (el) el.classList.toggle("hidden", !shouldShow);
}

function toast(message) {
  const el = $("toast");
  if (!el) return;
  el.textContent = message;
  el.classList.add("show");
  window.clearTimeout(toast.timeout);
  toast.timeout = window.setTimeout(() => el.classList.remove("show"), 2400);
}

function getLocalState() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
  } catch {
    return {};
  }
}

function saveLocalState(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function isMissingConfig() {
  return !firebaseEnabled ||
    !firebaseConfig ||
    String(firebaseConfig.apiKey || "").includes("PASTE_") ||
    String(firebaseConfig.projectId || "").includes("PASTE_") ||
    !firebaseConfig.apiKey ||
    !firebaseConfig.projectId;
}

function updateUI() {
  if (isMissingConfig()) {
    setText("firebaseAuthState", "Not configured");
    setText("firebaseStatusText", "Paste your Firebase web config into firebase-config.js and set firebaseEnabled to true.");
    show("firebaseConfigHelp", true);
    show("signedOutProfileTools", false);
    show("signedInProfileTools", false);
    return;
  }

  show("firebaseConfigHelp", false);

  if (!currentUser) {
    setText("firebaseAuthState", "Signed out");
    setText("firebaseStatusText", "Create a profile or sign in.");
    show("signedOutProfileTools", true);
    show("signedInProfileTools", false);
    return;
  }

  const local = getLocalState();
  const displayName = currentUser.displayName || local.profileName || "NeuroDirect user";
  const email = currentUser.email || "";

  setText("firebaseAuthState", "Signed in");
  setText("firebaseStatusText", "Firebase profile connected.");
  setText("cloudProfileName", displayName);
  setText("cloudProfileEmail", email);
  setText("cloudAvatarInitial", displayName.trim().charAt(0).toUpperCase() || "N");

  show("signedOutProfileTools", false);
  show("signedInProfileTools", true);
}

function getFields() {
  const email = $("firebaseEmail")?.value.trim();
  const password = $("firebasePassword")?.value;
  const displayName = $("firebaseDisplayName")?.value.trim();

  if (!email || !password) {
    throw new Error("Enter an email and password.");
  }

  if (password.length < 6) {
    throw new Error("Password must be at least 6 characters.");
  }

  return { email, password, displayName };
}

async function ensureProfileDoc(user, displayName = "") {
  const ref = doc(db, "users", user.uid);
  const snap = await getDoc(ref);

  if (!snap.exists()) {
    await setDoc(ref, {
      uid: user.uid,
      email: user.email || "",
      displayName: displayName || user.displayName || "NeuroDirect user",
      role: "teen",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    }, { merge: true });
  }
}

async function saveCloudProfile() {
  if (!currentUser) throw new Error("Sign in first.");

  const local = getLocalState();
  const displayName = currentUser.displayName || local.profileName || "NeuroDirect user";

  await setDoc(doc(db, "users", currentUser.uid), {
    uid: currentUser.uid,
    email: currentUser.email || "",
    displayName,
    role: "teen",
    profileSummary: {
      profileName: local.profileName || displayName,
      coins: Number(local.coins || 0),
      totalCheckins: Array.isArray(local.checkins) ? local.checkins.length : 0,
      totalTasks: Array.isArray(local.tasks) ? local.tasks.length : 0,
      parentPinSet: Boolean(local.parentPin)
    },
    updatedAt: serverTimestamp()
  }, { merge: true });

  setText("firebaseStatusText", "Cloud profile saved.");
  toast("Cloud profile saved");
}

async function loadCloudProfile() {
  if (!currentUser) throw new Error("Sign in first.");

  const snap = await getDoc(doc(db, "users", currentUser.uid));
  if (!snap.exists()) {
    setText("firebaseStatusText", "No cloud profile found.");
    toast("No cloud profile found");
    return;
  }

  const cloud = snap.data();
  const local = getLocalState();
  local.profileName = cloud.displayName || local.profileName || "NeuroDirect user";
  local.updatedAt = new Date().toISOString();
  saveLocalState(local);

  setText("profileNameLabel", local.profileName);
  setText("avatarInitial", local.profileName.trim().charAt(0).toUpperCase() || "N");
  setText("firebaseStatusText", "Cloud profile loaded. Refresh if the dashboard has not updated.");
  toast("Cloud profile loaded");
}

function attachEvents() {
  $("firebaseSignUpBtn")?.addEventListener("click", async () => {
    try {
      const { email, password, displayName } = getFields();
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      if (displayName) await updateProfile(cred.user, { displayName });
      await ensureProfileDoc(cred.user, displayName);
      setText("firebaseStatusText", "Profile created.");
      toast("Profile created");
    } catch (err) {
      setText("firebaseStatusText", err.message || "Could not create profile.");
      toast(err.message || "Could not create profile");
    }
  });

  $("firebaseSignInBtn")?.addEventListener("click", async () => {
    try {
      const { email, password } = getFields();
      await signInWithEmailAndPassword(auth, email, password);
      setText("firebaseStatusText", "Signed in.");
      toast("Signed in");
    } catch (err) {
      setText("firebaseStatusText", err.message || "Could not sign in.");
      toast(err.message || "Could not sign in");
    }
  });

  $("firebaseSignOutBtn")?.addEventListener("click", async () => {
    try {
      await signOut(auth);
      toast("Signed out");
    } catch (err) {
      setText("firebaseStatusText", err.message || "Could not sign out.");
    }
  });

  $("saveCloudProfileBtn")?.addEventListener("click", async () => {
    try {
      await saveCloudProfile();
    } catch (err) {
      setText("firebaseStatusText", err.message || "Could not save cloud profile.");
      toast(err.message || "Could not save");
    }
  });

  $("loadCloudProfileBtn")?.addEventListener("click", async () => {
    try {
      await loadCloudProfile();
    } catch (err) {
      setText("firebaseStatusText", err.message || "Could not load cloud profile.");
      toast(err.message || "Could not load");
    }
  });
}

function startFirebase() {
  attachEvents();

  if (isMissingConfig()) {
    updateUI();
    return;
  }

  try {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);

    onAuthStateChanged(auth, async (user) => {
      currentUser = user;
      if (user) {
        await ensureProfileDoc(user);
      }
      updateUI();
    });
  } catch (err) {
    setText("firebaseAuthState", "Error");
    setText("firebaseStatusText", err.message || "Firebase failed to start.");
    show("firebaseConfigHelp", true);
  }
}

document.addEventListener("DOMContentLoaded", startFirebase);
