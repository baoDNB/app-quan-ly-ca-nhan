"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { initializeApp, getApps } from "firebase/app";
import {
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
} from "firebase/auth";
import {
  getDatabase,
  get,
  onValue,
  ref,
  serverTimestamp,
  set,
} from "firebase/database";

const firebaseConfig = {
  apiKey: "AIzaSyCZO32lXoh9CyOobGqCm6vtyAw9IHJpGpE",
  authDomain: "app-quan-ly-ca-nhan-bao-dnb.firebaseapp.com",
  databaseURL: "https://app-quan-ly-ca-nhan-bao-dnb-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "app-quan-ly-ca-nhan-bao-dnb",
  storageBucket: "app-quan-ly-ca-nhan-bao-dnb.firebasestorage.app",
  messagingSenderId: "19581417473",
  appId: "1:19581417473:web:3e027371b37158c9e76800",
};

const modules = {
  time: { url: "/apps/time/index.html", title: "Nhịp — Quản lý thời gian", icon: "◷", label: "Thời gian" },
  notes: { url: "/apps/notes/index.html", title: "Mây Note — Ghi chú", icon: "✦", label: "Ghi chú" },
  expenses: { url: "/apps/expenses/index.html", title: "Ví Nhỏ — Quản lý chi tiêu", icon: "₫", label: "Chi tiêu" },
};

const syncEntries = {
  timeTasks: "nhip.tasks",
  timeSessions: "nhip.sessions",
  timeSessionDate: "nhip.sessionDate",
  focusState: "nhip.focus",
  notesData: "may-note-data-v1",
  notesView: "may-note-view",
  notesTheme: "may-note-theme",
  expensesData: "vi-nho-data-v1",
};
const syncKeys = Object.values(syncEntries);

function readLocalState() {
  const values = {};
  Object.entries(syncEntries).forEach(([cloudKey, key]) => {
    const value = localStorage.getItem(key);
    if (value !== null) values[cloudKey] = value;
  });
  return values;
}

export default function Home() {
  const [activeModule, setActiveModule] = useState("time");
  const [loading, setLoading] = useState(true);
  const [today, setToday] = useState("");
  const [user, setUser] = useState(null);
  const [sync, setSync] = useState({ text: "Chưa đồng bộ", state: "" });
  const [frameVersion, setFrameVersion] = useState(0);
  const userRef = useRef(null);
  const uploadTimerRef = useRef(null);

  const applyCloudState = useCallback((values = {}) => {
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
    if (changed) setFrameVersion((version) => version + 1);
  }, []);

  const uploadState = useCallback(async () => {
    const currentUser = userRef.current;
    if (!currentUser) return;
    setSync({ text: "Đang đồng bộ…", state: "" });
    try {
      const app = getApps()[0] || initializeApp(firebaseConfig);
      await set(ref(getDatabase(app), `users/${currentUser.uid}/appState`), {
        values: readLocalState(),
        updatedAt: serverTimestamp(),
      });
      setSync({ text: "Đã đồng bộ", state: "synced" });
    } catch (error) {
      console.error(error);
      setSync({ text: "Lỗi đồng bộ", state: "error" });
    }
  }, []);

  const selectModule = useCallback((key, updateHash = true) => {
    const selected = modules[key] ? key : "time";
    setLoading(true);
    setActiveModule(selected);
    localStorage.setItem("nha.activeModule", selected);
    document.title = `${modules[selected].title} | Nhà`;
    if (updateHash && location.hash !== `#${selected}`) history.pushState(null, "", `#${selected}`);
  }, []);

  useEffect(() => {
    setToday(new Intl.DateTimeFormat("vi-VN", {
      weekday: "long",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }).format(new Date()));

    selectModule(location.hash.slice(1) || localStorage.getItem("nha.activeModule") || "time", false);
    const onHashChange = () => selectModule(location.hash.slice(1), false);
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, [selectModule]);

  useEffect(() => {
    const app = getApps()[0] || initializeApp(firebaseConfig);
    const auth = getAuth(app);
    const database = getDatabase(app);
    let stopRemote = null;

    const stopAuth = onAuthStateChanged(auth, async (nextUser) => {
      if (stopRemote) stopRemote();
      stopRemote = null;
      userRef.current = nextUser;
      setUser(nextUser);

      if (!nextUser) {
        setSync({ text: "Chưa đồng bộ", state: "" });
        return;
      }

      const stateRef = ref(database, `users/${nextUser.uid}/appState`);
      setSync({ text: "Đang tải dữ liệu…", state: "" });
      try {
        const snapshot = await get(stateRef);
        if (snapshot.exists() && snapshot.val()?.values) {
          applyCloudState(snapshot.val().values);
          setSync({ text: "Đã đồng bộ", state: "synced" });
        } else {
          await uploadState();
        }

        stopRemote = onValue(stateRef, (nextSnapshot) => {
          const values = nextSnapshot.val()?.values;
          if (values) applyCloudState(values);
          setSync({ text: "Đã đồng bộ", state: "synced" });
        }, (error) => {
          console.error(error);
          setSync({ text: "Lỗi đồng bộ", state: "error" });
        });
      } catch (error) {
        console.error(error);
        setSync({ text: "Lỗi đồng bộ", state: "error" });
      }
    });

    const onStorage = (event) => {
      if (!syncKeys.includes(event.key) || !userRef.current) return;
      clearTimeout(uploadTimerRef.current);
      uploadTimerRef.current = setTimeout(uploadState, 650);
    };
    window.addEventListener("storage", onStorage);

    return () => {
      stopAuth();
      if (stopRemote) stopRemote();
      clearTimeout(uploadTimerRef.current);
      window.removeEventListener("storage", onStorage);
    };
  }, [applyCloudState, uploadState]);

  async function handleAccount() {
    const app = getApps()[0] || initializeApp(firebaseConfig);
    const auth = getAuth(app);
    try {
      if (user) await signOut(auth);
      else await signInWithPopup(auth, new GoogleAuthProvider());
    } catch (error) {
      console.error(error);
      setSync({
        text: error.code === "auth/popup-closed-by-user" ? "Đã hủy đăng nhập" : "Không thể đăng nhập",
        state: "error",
      });
    }
  }

  const current = modules[activeModule];

  return (
    <div className="shell">
      <header className="topbar">
        <button className="brand" type="button" onClick={() => selectModule("time")} aria-label="Trang quản lý cá nhân">
          <span className="brand-mark">N</span>
          <span><strong>Nhà</strong><small>Không gian của bạn</small></span>
        </button>
        <nav className="module-nav" aria-label="Chọn ứng dụng">
          {Object.entries(modules).map(([key, module]) => (
            <button
              className={`nav-item${activeModule === key ? " active" : ""}`}
              type="button"
              key={key}
              onClick={() => selectModule(key)}
              aria-current={activeModule === key ? "page" : undefined}
            >
              <span className="nav-icon" aria-hidden="true">{module.icon}</span>
              <span>{module.label}</span>
            </button>
          ))}
        </nav>
        <div className="account-area">
          <div className="today" aria-label="Ngày hôm nay">{today}</div>
          <span className={`sync-status ${sync.state}`.trim()} aria-live="polite">{sync.text}</span>
          <button
            className="account-button"
            type="button"
            onClick={handleAccount}
            title={user ? `${user.email || "Tài khoản Google"} — bấm để đăng xuất` : "Đăng nhập để đồng bộ giữa các thiết bị"}
          >
            {user?.displayName || user?.email || "Đăng nhập Google"}
          </button>
        </div>
      </header>
      <main className="workspace">
        <div className={`loading${loading ? "" : " hidden"}`} aria-live="polite">
          <span /><p>Đang mở ứng dụng…</p>
        </div>
        <iframe
          id="app-frame"
          key={`${activeModule}-${frameVersion}`}
          className={loading ? "" : "ready"}
          src={current.url}
          title={current.title}
          onLoad={() => setLoading(false)}
        />
      </main>
    </div>
  );
}
