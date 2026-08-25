import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getFirestore,
  doc,
  onSnapshot,
  runTransaction,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyAC1bNuWAD8noagHV2SD0y4PP0ABhxDdqo",
  authDomain: "students-68430.firebaseapp.com",
  projectId: "students-68430",
  storageBucket: "students-68430.firebasestorage.app",
  messagingSenderId: "202641775624",
  appId: "1:202641775624:web:fe2d70e4ec92d62d5b85bd"
};

const app = getApps().find((existingApp) => existingApp.name === "student-session")
  || initializeApp(firebaseConfig, "student-session");
const db = getFirestore(app);
const sessionTokenKey = "studentSessionToken";
let unsubscribe = null;
let redirecting = false;

function getStudentId() {
  const params = new URLSearchParams(window.location.search);
  return (params.get("code") || localStorage.getItem("userId") || localStorage.getItem("savedCode") || "").trim();
}

function clearStudentAccess() {
  ["savedCode", "userId", "userName", "userRole", "completedLessons", sessionTokenKey]
    .forEach((key) => localStorage.removeItem(key));
}

function redirectToLogin(message) {
  if (redirecting) return;
  redirecting = true;
  clearStudentAccess();
  if (message) alert(message);
  window.location.replace("code.html");
}

function tokenForThisBrowser() {
  let token = localStorage.getItem(sessionTokenKey);
  if (!token) {
    token = crypto.randomUUID();
    localStorage.setItem(sessionTokenKey, token);
  }
  return token;
}

export async function claimStudentSession(studentId) {
  const canonicalId = String(studentId || "").trim();
  if (!canonicalId) throw new Error("Missing student ID.");

  const token = tokenForThisBrowser();
  await runTransaction(db, async (transaction) => {
    const sessionRef = doc(db, "studentSessions", canonicalId);
    const sessionSnap = await transaction.get(sessionRef);

    if (sessionSnap.exists() && sessionSnap.data().token !== token) {
      const error = new Error("This ID is already active on another device.");
      error.code = "SESSION_IN_USE";
      throw error;
    }

    transaction.set(sessionRef, {
      token,
      updatedAt: serverTimestamp()
    });
  });

  localStorage.setItem(sessionTokenKey, token);
  return token;
}

export async function forceTakeoverStudentSession(studentId) {
  const canonicalId = String(studentId || "").trim();
  if (!canonicalId) throw new Error("Missing student ID.");

  const token = tokenForThisBrowser();
  await runTransaction(db, async (transaction) => {
    transaction.set(doc(db, "studentSessions", canonicalId), {
      token,
      updatedAt: serverTimestamp()
    });
  });

  localStorage.setItem(sessionTokenKey, token);
  return token;
}

export async function releaseStudentSession() {
  const studentId = getStudentId();
  const token = localStorage.getItem(sessionTokenKey);

  if (studentId && token) {
    try {
      await runTransaction(db, async (transaction) => {
        const sessionRef = doc(db, "studentSessions", studentId);
        const sessionSnap = await transaction.get(sessionRef);
        if (sessionSnap.exists() && sessionSnap.data().token === token) {
          transaction.delete(sessionRef);
        }
      });
    } catch (error) {
      console.error("Could not release student session:", error);
    }
  }

  clearStudentAccess();
}

export async function requireStudentSession() {
  const studentId = getStudentId();
  const token = localStorage.getItem(sessionTokenKey);

  if (!studentId || !token) {
    redirectToLogin();
    return false;
  }

  try {
    const sessionRef = doc(db, "studentSessions", studentId);
    const sessionReady = await new Promise((resolve, reject) => {
      let settled = false;
      unsubscribe?.();
      unsubscribe = onSnapshot(sessionRef, (sessionSnap) => {
        const ownsSession = sessionSnap.exists() && sessionSnap.data().token === token;
        if (!ownsSession) {
          redirectToLogin("Another device is using this account. Please sign out from that device first.");
          if (!settled) {
            settled = true;
            resolve(false);
          }
          return;
        }
        if (!settled) {
          settled = true;
          resolve(true);
        }
      }, (error) => {
        if (!settled) {
          settled = true;
          reject(error);
        }
      });
    });
    return sessionReady;
  } catch (error) {
    console.error("Could not verify student session:", error);
    redirectToLogin("Your session could not be verified. Please sign in again.");
    return false;
  }
}

function attachSignOutHandling() {
  document.addEventListener("click", (event) => {
    const link = event.target.closest("a, button");
    if (!link || !/sign\s*out/i.test(link.textContent || "")) return;

    event.preventDefault();
    event.stopImmediatePropagation();
    releaseStudentSession().finally(() => {
      window.location.href = link.getAttribute("href") && link.getAttribute("href") !== "#"
        ? link.getAttribute("href")
        : "index.html";
    });
  }, true);
}

const pageName = window.location.pathname.split("/").pop().toLowerCase();
if (!["code.html", "loading1.html", "loading2.html"].includes(pageName)) {
  attachSignOutHandling();
  requireStudentSession();
}
