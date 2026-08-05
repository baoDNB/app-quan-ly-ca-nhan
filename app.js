import { initializeApp } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-app.js";
import {
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js";
import {
  getDatabase,
  get,
  onValue,
  ref,
  serverTimestamp,
  set
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyCZO32lXoh9CyOobGqCm6vtyAw9IHJpGpE",
  authDomain: "app-quan-ly-ca-nhan-bao-dnb.firebaseapp.com",
  databaseURL: "https://app-quan-ly-ca-nhan-bao-dnb-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "app-quan-ly-ca-nhan-bao-dnb",
  storageBucket: "app-quan-ly-ca-nhan-bao-dnb.firebasestorage.app",
  messagingSenderId: "19581417473",
  appId: "1:19581417473:web:3e027371b37158c9e76800"
};

const modules = {
  time: { url: "/apps/time/", title: "Nhịp — Quản lý thời gian" },
  notes: { url: "/apps/notes/", title: "Mây Note — Ghi chú" },
  expenses: { url: "/apps/expenses/", title: "Ví Nhỏ — Quản lý chi tiêu" }
};

const syncEntries = {
  timeTasks: "nhip.tasks",
  timeSessions: "nhip.sessions",
  timeSessionDate: "nhip.sessionDate",
  focusState: "nhip.focus",
  notesData: "may-note-data-v1",
  notesView: "may-note-view",
  notesTheme: "may-note-theme",
  expensesData: "vi-nho-data-v1"
};
const syncKeys = Object.values(syncEntries);

const firebaseApp = initializeApp(firebaseConfig);
const auth = getAuth(firebaseApp);
const database = getDatabase(firebaseApp);
const provider = new GoogleAuthProvider();
const frame = document.querySelector("#app-frame");
const loading = document.querySelector("#loading");
const buttons = [...document.querySelectorAll("[data-module]")];
const accountButton = document.querySelector("#account-button");
const syncStatus = document.querySelector("#sync-status");

let currentUser = null;
let remoteUnsubscribe = null;
let uploadTimer = null;

function setSyncStatus(text, state = "") {
  syncStatus.textContent = text;
  syncStatus.className = `sync-status ${state}`.trim();
}

function localState() {
  const values = {};
  Object.entries(syncEntries).forEach(([cloudKey, key]) => {
    const value = localStorage.getItem(key);
    if (value !== null) values[cloudKey] = value;
  });
  return values;
}

function applyCloudState(values = {}) {
  let changed = false;
  Object.entries(syncEntries).forEach(([cloudKey, key]) => {
    const next = Object.prototype.hasOwnProperty.call(values, cloudKey) ? values[cloudKey] : null;
    const current = localStorage.getItem(key);
    if (next === null && current !== null) {
      localStorage.removeItem(key);
      changed = true;
    } else if (next !== null && current !== next) {
      localStorage.setItem(key, next);
      changed = true;
    }
  });
  if (changed && frame.src) frame.contentWindow.location.reload();
  return changed;
}

async function uploadState() {
  if (!currentUser) return;
  setSyncStatus("Đang đồng bộ…");
  try {
    await set(ref(database, `users/${currentUser.uid}/appState`), {
      values: localState(),
      updatedAt: serverTimestamp()
    });
    setSyncStatus("Đã đồng bộ", "synced");
  } catch (error) {
    console.error(error);
    setSyncStatus("Lỗi đồng bộ", "error");
  }
}

function scheduleUpload() {
  if (!currentUser) return;
  clearTimeout(uploadTimer);
  uploadTimer = setTimeout(uploadState, 650);
}

async function startCloudSync(user) {
  const stateRef = ref(database, `users/${user.uid}/appState`);
  setSyncStatus("Đang tải dữ liệu…");
  try {
    const snapshot = await get(stateRef);
    if (snapshot.exists() && snapshot.val()?.values) {
      applyCloudState(snapshot.val().values);
      setSyncStatus("Đã đồng bộ", "synced");
    } else {
      await uploadState();
    }

    remoteUnsubscribe = onValue(stateRef, (nextSnapshot) => {
      const values = nextSnapshot.val()?.values;
      if (values) {
        applyCloudState(values);
        setSyncStatus("Đã đồng bộ", "synced");
      }
    }, (error) => {
      console.error(error);
      setSyncStatus("Lỗi đồng bộ", "error");
    });
  } catch (error) {
    console.error(error);
    setSyncStatus("Lỗi đồng bộ", "error");
  }
}

function selectModule(key, updateHash = true) {
  const selected = modules[key] ? key : "time";
  const module = modules[selected];
  buttons.forEach((button) => {
    const active = button.dataset.module === selected;
    button.classList.toggle("active", active);
    button.setAttribute("aria-current", active ? "page" : "false");
  });
  frame.classList.remove("ready");
  loading.classList.remove("hidden");
  frame.title = module.title;
  if (frame.getAttribute("src") !== module.url) frame.src = module.url;
  document.title = `${module.title} | Nhà`;
  localStorage.setItem("nha.activeModule", selected);
  if (updateHash && location.hash !== `#${selected}`) history.pushState(null, "", `#${selected}`);
}

accountButton.addEventListener("click", async () => {
  try {
    if (currentUser) {
      await signOut(auth);
    } else {
      await signInWithPopup(auth, provider);
    }
  } catch (error) {
    console.error(error);
    setSyncStatus(error.code === "auth/popup-closed-by-user" ? "Đã hủy đăng nhập" : "Không thể đăng nhập", "error");
  }
});

onAuthStateChanged(auth, async (user) => {
  if (remoteUnsubscribe) remoteUnsubscribe();
  remoteUnsubscribe = null;
  currentUser = user;
  if (!user) {
    accountButton.textContent = "Đăng nhập Google";
    accountButton.title = "Đăng nhập để đồng bộ giữa các thiết bị";
    setSyncStatus("Chưa đồng bộ");
    return;
  }
  accountButton.textContent = user.displayName || user.email || "Đăng xuất";
  accountButton.title = `${user.email || "Tài khoản Google"} — bấm để đăng xuất`;
  await startCloudSync(user);
});

window.addEventListener("storage", (event) => {
  if (syncKeys.includes(event.key)) scheduleUpload();
});
frame.addEventListener("load", () => {
  frame.classList.add("ready");
  loading.classList.add("hidden");
});
buttons.forEach((button) => button.addEventListener("click", () => selectModule(button.dataset.module)));
window.addEventListener("hashchange", () => selectModule(location.hash.slice(1), false));
document.querySelector("#today").textContent = new Intl.DateTimeFormat("vi-VN", {
  weekday: "long",
  day: "2-digit",
  month: "2-digit",
  year: "numeric"
}).format(new Date());
selectModule(location.hash.slice(1) || localStorage.getItem("nha.activeModule") || "time", false);
