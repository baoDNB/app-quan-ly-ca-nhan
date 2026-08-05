const CATEGORIES = {
  work: { name: "Công việc", color: "#d8755d", soft: "#f6e2dc" },
  personal: { name: "Cá nhân", color: "#2d6154", soft: "#dfeae5" },
  health: { name: "Sức khỏe", color: "#6f8fa6", soft: "#e2ebf0" },
  learning: { name: "Học tập", color: "#9b7830", soft: "#f5e9ca" }
};

const pad = n => String(n).padStart(2, "0");
const localDate = date => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
const today = () => localDate(new Date());
const uid = () => `${Date.now()}-${Math.random().toString(16).slice(2)}`;

const sampleTasks = () => [
  { id: uid(), title: "Lên kế hoạch cho tuần mới", date: today(), time: "08:30", duration: 30, category: "personal", note: "Chọn 3 ưu tiên quan trọng nhất.", completed: true },
  { id: uid(), title: "Hoàn thiện bản đề xuất dự án", date: today(), time: "09:30", duration: 90, category: "work", note: "Kiểm tra số liệu và phần kết luận.", completed: false },
  { id: uid(), title: "Đi bộ và nghe podcast", date: today(), time: "12:15", duration: 30, category: "health", note: "", completed: false },
  { id: uid(), title: "Học 20 từ vựng mới", date: today(), time: "19:30", duration: 45, category: "learning", note: "", completed: false }
];

let state = {
  tasks: JSON.parse(localStorage.getItem("nhip.tasks") || "null") || sampleTasks(),
  sessions: Number(localStorage.getItem("nhip.sessions") || 0),
  sessionDate: localStorage.getItem("nhip.sessionDate") || today(),
  selectedDate: today(),
  view: "today"
};
if (state.sessionDate !== today()) { state.sessions = 0; state.sessionDate = today(); }

const FOCUS_KEY = "nhip.focus";
const FOCUS_DURATIONS = { focus: 25 * 60, break: 5 * 60 };
function loadFocusState() {
  const fallback = { mode: "focus", remaining: FOCUS_DURATIONS.focus, running: false, endAt: null, taskId: "" };
  try {
    const saved = JSON.parse(localStorage.getItem(FOCUS_KEY) || "null");
    if (!saved || !FOCUS_DURATIONS[saved.mode]) return fallback;
    return {
      ...fallback,
      ...saved,
      remaining: Math.max(0, Number(saved.remaining) || FOCUS_DURATIONS[saved.mode]),
      endAt: saved.endAt ? Number(saved.endAt) : null
    };
  } catch { return fallback; }
}
let focusState = loadFocusState();

const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];
const els = {
  taskList: $("#taskList"), emptyAdd: $("#emptyAdd"), categoryList: $("#categoryList"),
  progressText: $("#progressText"), progressMessage: $("#progressMessage"), progressRing: $("#progressRing"),
  progressPercent: $("#progressPercent"), plannedTime: $("#plannedTime"), focusStreak: $("#focusStreak"),
  selectedDateLabel: $("#selectedDateLabel"), datePicker: $("#datePicker"), viewTitle: $("#viewTitle"),
  backdrop: $("#modalBackdrop"), form: $("#taskForm"), modalTitle: $("#modalTitle"), deleteTask: $("#deleteTask"),
  timerTime: $("#timerTime"), timerMode: $("#timerMode"), timerToggle: $("#timerToggle"), timerProgress: $("#timerProgress"), sessionDots: $("#sessionDots"),
  focusTaskSelect: $("#focusTaskSelect"), focusOverlay: $("#focusOverlay"), focusOverlayTaskSelect: $("#focusOverlayTaskSelect"),
  focusOverlayTime: $("#focusOverlayTime"), focusOverlayMode: $("#focusOverlayMode"), focusOverlayRing: $("#focusOverlayRing"),
  focusOverlayToggle: $("#focusOverlayToggle"), focusOverlayHint: $("#focusOverlayHint"), focusOverlaySessions: $("#focusOverlaySessions")
};

function save() {
  localStorage.setItem("nhip.tasks", JSON.stringify(state.tasks));
  localStorage.setItem("nhip.sessions", state.sessions);
  localStorage.setItem("nhip.sessionDate", state.sessionDate);
}

function formatDate(dateString, long = false) {
  const date = new Date(`${dateString}T12:00:00`);
  return new Intl.DateTimeFormat("vi-VN", long
    ? { weekday: "long", day: "numeric", month: "long", year: "numeric" }
    : { day: "numeric", month: "numeric" }).format(date);
}

function displayDateLabel() {
  const date = new Date(`${state.selectedDate}T12:00:00`);
  const diff = Math.round((date - new Date(`${today()}T12:00:00`)) / 86400000);
  return diff === 0 ? "Hôm nay" : diff === 1 ? "Ngày mai" : diff === -1 ? "Hôm qua" : formatDate(state.selectedDate);
}

function getVisibleTasks() {
  let tasks = [...state.tasks];
  if (state.view === "completed") return tasks.filter(t => t.completed).sort((a, b) => b.date.localeCompare(a.date) || a.time.localeCompare(b.time));
  if (state.view === "upcoming") return tasks.filter(t => t.date >= today() && !t.completed).sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time));
  return tasks.filter(t => t.date === state.selectedDate).sort((a, b) => a.time.localeCompare(b.time));
}

function render() {
  const visible = getVisibleTasks();
  els.taskList.innerHTML = visible.map(task => {
    const cat = CATEGORIES[task.category] || CATEGORIES.personal;
    const end = addMinutes(task.time, task.duration);
    return `<article class="task-item ${task.completed ? "completed" : ""}" data-id="${task.id}">
      <div class="task-time">${task.time}<small>${end}</small></div>
      <input class="task-check" type="checkbox" ${task.completed ? "checked" : ""} aria-label="Đánh dấu ${escapeHtml(task.title)} hoàn thành">
      <div class="task-info">
        <p class="task-title">${escapeHtml(task.title)}</p>
        <div class="task-meta"><span class="task-category" style="--category-soft:${cat.soft};--category-color:${cat.color}">${cat.name}</span><span>${task.duration} phút</span>${state.view !== "today" ? `<span>· ${formatDate(task.date)}</span>` : ""}</div>
      </div>
      <button class="task-more" aria-label="Sửa công việc">···</button>
    </article>`;
  }).join("");
  els.emptyAdd.classList.toggle("hidden", visible.length > 0);

  const dayTasks = state.tasks.filter(t => t.date === state.selectedDate);
  const done = dayTasks.filter(t => t.completed).length;
  const percent = dayTasks.length ? Math.round(done / dayTasks.length * 100) : 0;
  els.progressText.textContent = `${done}/${dayTasks.length} công việc`;
  els.progressPercent.textContent = `${percent}%`;
  els.progressRing.style.setProperty("--progress", percent);
  els.progressMessage.textContent = percent === 100 && dayTasks.length ? "Tuyệt vời, bạn đã hoàn thành hôm nay!" : percent >= 50 ? "Bạn đang có một nhịp độ rất tốt." : "Hãy bắt đầu với một việc nhỏ.";
  const minutes = dayTasks.reduce((sum, t) => sum + t.duration, 0);
  els.plannedTime.textContent = minutes >= 60 ? `${Math.floor(minutes / 60)}g ${minutes % 60 ? `${minutes % 60}p` : ""}` : `${minutes} phút`;
  els.focusStreak.textContent = `${state.sessions} phiên`;
  els.selectedDateLabel.textContent = displayDateLabel();
  els.datePicker.value = state.selectedDate;
  els.viewTitle.textContent = state.view === "completed" ? "Công việc đã hoàn thành" : state.view === "upcoming" ? "Những việc sắp tới" : "Lịch trình hôm nay";
  renderCategories();
  renderSessionDots();
  renderFocusTaskOptions();
}

function renderCategories() {
  els.categoryList.innerHTML = Object.entries(CATEGORIES).map(([key, cat]) => {
    const count = state.tasks.filter(t => t.category === key && !t.completed).length;
    return `<div class="category-item"><span class="category-dot" style="background:${cat.color}"></span><span>${cat.name}</span><span class="category-count">${count}</span></div>`;
  }).join("");
}

function addMinutes(time, minutes) {
  const [h, m] = time.split(":").map(Number);
  const total = h * 60 + m + Number(minutes);
  return `${pad(Math.floor(total / 60) % 24)}:${pad(total % 60)}`;
}

function escapeHtml(value = "") {
  return value.replace(/[&<>'"]/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[char]));
}

function toast(message) {
  const el = $("#toast"); el.textContent = message; el.classList.add("show");
  clearTimeout(toast.timer); toast.timer = setTimeout(() => el.classList.remove("show"), 2200);
}

function openModal(task = null) {
  els.form.reset();
  $("#taskId").value = task?.id || "";
  $("#taskTitle").value = task?.title || "";
  $("#taskDate").value = task?.date || state.selectedDate;
  $("#taskTime").value = task?.time || "09:00";
  $("#taskDuration").value = task?.duration || 60;
  $("#taskCategory").value = task?.category || "work";
  $("#taskNote").value = task?.note || "";
  els.modalTitle.textContent = task ? "Chỉnh sửa công việc" : "Thêm công việc mới";
  els.deleteTask.classList.toggle("hidden", !task);
  els.backdrop.classList.remove("hidden");
  setTimeout(() => $("#taskTitle").focus(), 50);
}

function closeModal() { els.backdrop.classList.add("hidden"); }

els.form.addEventListener("submit", event => {
  event.preventDefault();
  const id = $("#taskId").value;
  const data = {
    title: $("#taskTitle").value.trim(), date: $("#taskDate").value, time: $("#taskTime").value,
    duration: Number($("#taskDuration").value), category: $("#taskCategory").value, note: $("#taskNote").value.trim()
  };
  if (id) {
    state.tasks = state.tasks.map(t => t.id === id ? { ...t, ...data } : t);
    toast("Đã cập nhật công việc");
  } else {
    state.tasks.push({ id: uid(), ...data, completed: false });
    state.selectedDate = data.date; state.view = "today";
    toast("Đã thêm vào lịch trình");
  }
  save(); closeModal(); render();
});

els.taskList.addEventListener("click", event => {
  const item = event.target.closest(".task-item"); if (!item) return;
  const task = state.tasks.find(t => t.id === item.dataset.id); if (!task) return;
  if (event.target.classList.contains("task-check")) {
    task.completed = event.target.checked; save(); render();
    toast(task.completed ? "Hoàn thành rồi — tuyệt lắm!" : "Đã chuyển về chưa hoàn thành");
  } else if (event.target.closest(".task-info") || event.target.closest(".task-more")) openModal(task);
});

els.deleteTask.addEventListener("click", () => {
  const id = $("#taskId").value;
  state.tasks = state.tasks.filter(t => t.id !== id); save(); closeModal(); render(); toast("Đã xóa công việc");
});

$("#taskCategory").innerHTML = Object.entries(CATEGORIES).map(([key, cat]) => `<option value="${key}">${cat.name}</option>`).join("");
$("#openTask").addEventListener("click", () => openModal());
els.emptyAdd.addEventListener("click", () => openModal());
$$('.close-modal').forEach(btn => btn.addEventListener("click", closeModal));
els.backdrop.addEventListener("click", e => { if (e.target === els.backdrop) closeModal(); });
document.addEventListener("keydown", e => {
  if (e.key !== "Escape") return;
  closeSidebar();
  if (!els.focusOverlay.classList.contains("hidden")) closeFocusOverlay();
  else closeModal();
});

function changeDay(amount) {
  const date = new Date(`${state.selectedDate}T12:00:00`); date.setDate(date.getDate() + amount);
  state.selectedDate = localDate(date); state.view = "today"; setActiveNav("today"); render();
}
$("#prevDay").addEventListener("click", () => changeDay(-1));
$("#nextDay").addEventListener("click", () => changeDay(1));
$("#datePickerButton").addEventListener("click", () => els.datePicker.showPicker());
els.datePicker.addEventListener("change", () => { state.selectedDate = els.datePicker.value; state.view = "today"; setActiveNav("today"); render(); });

function setActiveNav(view) {
  $$(".nav-item").forEach(btn => btn.classList.toggle("active", btn.dataset.view === view));
}
function closeSidebar() {
  $(".sidebar").classList.remove("open");
  $("#sidebarOverlay").classList.remove("open");
  document.body.classList.remove("sidebar-open");
  $("#menuButton").setAttribute("aria-expanded", "false");
}
function openSidebar() {
  $(".sidebar").classList.add("open");
  $("#sidebarOverlay").classList.add("open");
  document.body.classList.add("sidebar-open");
  $("#menuButton").setAttribute("aria-expanded", "true");
}
$$('.nav-item').forEach(btn => btn.addEventListener("click", () => {
  state.view = btn.dataset.view; if (state.view === "today") state.selectedDate = today();
  setActiveNav(state.view); render(); closeSidebar();
}));
$("#menuButton").setAttribute("aria-expanded", "false");
$("#menuButton").addEventListener("click", () => $(".sidebar").classList.contains("open") ? closeSidebar() : openSidebar());
$("#sidebarOverlay").addEventListener("click", closeSidebar);

let timerInterval = null;
let audioContext = null;

function saveFocus() { localStorage.setItem(FOCUS_KEY, JSON.stringify(focusState)); }

function currentTimerLeft() {
  if (focusState.running && focusState.endAt) return Math.max(0, Math.ceil((focusState.endAt - Date.now()) / 1000));
  return Math.max(0, focusState.remaining);
}

function selectedFocusTask() { return state.tasks.find(task => task.id === focusState.taskId); }

function renderFocusTaskOptions() {
  const available = state.tasks
    .filter(task => !task.completed)
    .sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time));
  if (focusState.taskId && !available.some(task => task.id === focusState.taskId)) {
    focusState.taskId = ""; saveFocus();
  }
  const options = `<option value="">Không chọn công việc</option>${available.map(task =>
    `<option value="${task.id}">${escapeHtml(task.title)} · ${formatDate(task.date)}</option>`
  ).join("")}`;
  [els.focusTaskSelect, els.focusOverlayTaskSelect].forEach(select => {
    select.innerHTML = options;
    select.value = focusState.taskId;
  });
}

function updateTimer() {
  const left = currentTimerLeft();
  if (focusState.running && left <= 0) { completeTimer(); return; }
  const total = FOCUS_DURATIONS[focusState.mode];
  const formatted = `${pad(Math.floor(left / 60))}:${pad(left % 60)}`;
  const remainingPercent = Math.max(0, Math.min(100, left / total * 100));
  const modeLabel = focusState.mode === "focus" ? "Tập trung" : "Nghỉ ngắn";
  const toggleLabel = focusState.running ? "Tạm dừng" : left < total ? "Tiếp tục" : focusState.mode === "focus" ? "Bắt đầu phiên" : "Bắt đầu nghỉ";
  els.timerTime.textContent = formatted;
  els.timerMode.textContent = modeLabel;
  els.timerProgress.style.strokeDashoffset = 603.2 * (1 - remainingPercent / 100);
  els.timerToggle.textContent = toggleLabel;
  els.focusOverlayTime.textContent = formatted;
  els.focusOverlayMode.textContent = modeLabel;
  els.focusOverlayToggle.textContent = toggleLabel;
  els.focusOverlayRing.style.setProperty("--timer-progress", remainingPercent);
  els.focusOverlay.classList.toggle("break-mode", focusState.mode === "break");
  $("#focusOverlayEyebrow").textContent = focusState.mode === "focus" ? "PHIÊN TẬP TRUNG" : "NGHỈ NGẮN";
  $("#focusOverlayTitle").textContent = focusState.mode === "focus" ? "Dành trọn sự chú ý cho một việc" : "Thả lỏng để lấy lại năng lượng";
  $("#focusSkip").textContent = focusState.mode === "focus" ? "Chuyển sang nghỉ" : "Bỏ qua nghỉ";
  const task = selectedFocusTask();
  els.focusOverlayHint.textContent = focusState.mode === "break"
    ? "Đứng dậy, uống nước và để mắt nghỉ khỏi màn hình."
    : task ? `Bạn đang tập trung vào: ${task.title}` : "Tắt thông báo không cần thiết và bắt đầu khi bạn sẵn sàng.";
  els.focusOverlaySessions.textContent = `${state.sessions} phiên hôm nay`;
  document.title = focusState.running ? `${formatted} · ${modeLabel} — Nhịp` : "Nhịp — Quản lý thời gian";
}

function restartTimerInterval() {
  clearInterval(timerInterval);
  timerInterval = focusState.running ? setInterval(updateTimer, 500) : null;
}

function primeAudio() {
  try {
    audioContext ||= new (window.AudioContext || window.webkitAudioContext)();
    if (audioContext.state === "suspended") audioContext.resume();
  } catch {}
}

function playCompletionSound() {
  try {
    primeAudio();
    [0, .18].forEach((delay, index) => {
      const oscillator = audioContext.createOscillator();
      const gain = audioContext.createGain();
      oscillator.frequency.value = index ? 740 : 587;
      gain.gain.setValueAtTime(.0001, audioContext.currentTime + delay);
      gain.gain.exponentialRampToValueAtTime(.18, audioContext.currentTime + delay + .02);
      gain.gain.exponentialRampToValueAtTime(.0001, audioContext.currentTime + delay + .28);
      oscillator.connect(gain).connect(audioContext.destination);
      oscillator.start(audioContext.currentTime + delay);
      oscillator.stop(audioContext.currentTime + delay + .3);
    });
  } catch {}
}

function sendFocusNotification(title, body) {
  if (!("Notification" in window) || Notification.permission !== "granted") return;
  try { new Notification(title, { body, tag: "nhip-focus" }); } catch {}
}

function requestFocusNotifications() {
  if ("Notification" in window && Notification.permission === "default") Notification.requestPermission().catch(() => {});
}

function completeTimer() {
  const completedMode = focusState.mode;
  focusState.running = false;
  focusState.endAt = null;
  if (completedMode === "focus") {
    if (state.sessionDate !== today()) { state.sessions = 0; state.sessionDate = today(); }
    state.sessions++;
    focusState.mode = "break";
    focusState.remaining = FOCUS_DURATIONS.break;
    save();
    toast("Hoàn thành phiên tập trung — nghỉ 5 phút nhé! ✦");
    sendFocusNotification("Hoàn thành phiên tập trung", "Đã đến lúc nghỉ ngắn 5 phút.");
  } else {
    focusState.mode = "focus";
    focusState.remaining = FOCUS_DURATIONS.focus;
    toast("Hết giờ nghỉ — sẵn sàng cho phiên mới!");
    sendFocusNotification("Kết thúc giờ nghỉ", "Bạn đã sẵn sàng cho phiên tập trung tiếp theo.");
  }
  saveFocus(); playCompletionSound(); restartTimerInterval(); render(); updateTimer();
}

function toggleTimer() {
  if (focusState.running) {
    focusState.remaining = currentTimerLeft();
    focusState.running = false;
    focusState.endAt = null;
  } else {
    if (focusState.remaining <= 0) focusState.remaining = FOCUS_DURATIONS[focusState.mode];
    focusState.running = true;
    focusState.endAt = Date.now() + focusState.remaining * 1000;
    primeAudio(); requestFocusNotifications();
  }
  saveFocus(); restartTimerInterval(); updateTimer();
}

function resetTimer() {
  focusState.running = false;
  focusState.endAt = null;
  focusState.remaining = FOCUS_DURATIONS[focusState.mode];
  saveFocus(); restartTimerInterval(); updateTimer();
}

function switchTimerMode() {
  focusState.mode = focusState.mode === "focus" ? "break" : "focus";
  focusState.running = false;
  focusState.endAt = null;
  focusState.remaining = FOCUS_DURATIONS[focusState.mode];
  saveFocus(); restartTimerInterval(); updateTimer();
}

function openFocusOverlay() {
  els.focusOverlay.classList.remove("hidden");
  document.body.classList.add("focus-open");
  updateTimer();
}
function closeFocusOverlay() {
  els.focusOverlay.classList.add("hidden");
  document.body.classList.remove("focus-open");
}

function selectFocusTask(event) {
  focusState.taskId = event.target.value;
  saveFocus();
  [els.focusTaskSelect, els.focusOverlayTaskSelect].forEach(select => { select.value = focusState.taskId; });
  updateTimer();
}

els.timerToggle.addEventListener("click", toggleTimer);
els.focusOverlayToggle.addEventListener("click", toggleTimer);
$("#timerReset").addEventListener("click", resetTimer);
$("#focusOverlayReset").addEventListener("click", resetTimer);
$("#focusSkip").addEventListener("click", switchTimerMode);
$("#openFocus").addEventListener("click", openFocusOverlay);
$("#focusSettings").addEventListener("click", openFocusOverlay);
$("#closeFocus").addEventListener("click", closeFocusOverlay);
els.focusTaskSelect.addEventListener("change", selectFocusTask);
els.focusOverlayTaskSelect.addEventListener("change", selectFocusTask);
document.addEventListener("visibilitychange", () => { if (!document.hidden) updateTimer(); });
function renderSessionDots() { els.sessionDots.innerHTML = Array.from({ length: Math.max(4, state.sessions) }, (_, i) => `<span class="session-dot ${i < state.sessions ? "done" : ""}"></span>`).join(""); }

const now = new Date();
$("#todayLabel").textContent = formatDate(today(), true);
$("#greeting").textContent = now.getHours() < 11 ? "Chào buổi sáng!" : now.getHours() < 18 ? "Chào buổi chiều!" : "Chào buổi tối!";
render(); restartTimerInterval(); updateTimer();
