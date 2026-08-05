const STORAGE_KEY = "vi-nho-data-v1";

const categories = {
  expense: [
    { id: "food", name: "Ăn uống", icon: "◉", color: "#ef7d63", bg: "#fbe9e4" },
    { id: "home", name: "Nhà cửa", icon: "⌂", color: "#68a6a0", bg: "#e4f1ef" },
    { id: "transport", name: "Di chuyển", icon: "↗", color: "#f3c969", bg: "#fbf1d7" },
    { id: "shopping", name: "Mua sắm", icon: "◇", color: "#9686bf", bg: "#eeeaf7" },
    { id: "health", name: "Sức khỏe", icon: "+", color: "#da6f7d", bg: "#fae8eb" },
    { id: "fun", name: "Giải trí", icon: "☆", color: "#5f91ca", bg: "#e7eff8" },
    { id: "other", name: "Khác", icon: "•••", color: "#8b9994", bg: "#edf0ef" }
  ],
  income: [
    { id: "salary", name: "Lương", icon: "₫", color: "#1f6b57", bg: "#dcefe5" },
    { id: "bonus", name: "Thưởng", icon: "✦", color: "#c49533", bg: "#fbf1d7" },
    { id: "investment", name: "Đầu tư", icon: "↗", color: "#5f91ca", bg: "#e7eff8" },
    { id: "other-income", name: "Thu nhập khác", icon: "+", color: "#9686bf", bg: "#eeeaf7" }
  ]
};

const $ = (selector) => document.querySelector(selector);
const money = (value) => new Intl.NumberFormat("vi-VN").format(Math.round(value)) + " ₫";
const shortMoney = (value) => value >= 1e6 ? (value / 1e6).toLocaleString("vi-VN", { maximumFractionDigits: 1 }) + "tr" : new Intl.NumberFormat("vi-VN").format(value) + "đ";
const localDate = (date = new Date()) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};
const currentMonth = () => localDate().slice(0, 7);

function getSeedData() {
  const month = currentMonth();
  return {
    budgets: { [month]: 12000000 },
    transactions: [
      { id: crypto.randomUUID(), type: "income", amount: 18000000, name: "Lương tháng", category: "salary", date: `${month}-01`, note: "" },
      { id: crypto.randomUUID(), type: "expense", amount: 1450000, name: "Tiền thuê nhà", category: "home", date: `${month}-03`, note: "" },
      { id: crypto.randomUUID(), type: "expense", amount: 168000, name: "Đi chợ cuối tuần", category: "food", date: `${month}-05`, note: "Rau củ và đồ ăn" },
      { id: crypto.randomUUID(), type: "expense", amount: 85000, name: "Đổ xăng", category: "transport", date: `${month}-08`, note: "" },
      { id: crypto.randomUUID(), type: "expense", amount: 320000, name: "Áo sơ mi", category: "shopping", date: `${month}-12`, note: "" },
      { id: crypto.randomUUID(), type: "expense", amount: 125000, name: "Bữa tối cùng bạn", category: "food", date: `${month}-15`, note: "" }
    ]
  };
}

function loadData() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || getSeedData(); }
  catch { return getSeedData(); }
}

let data = loadData();
let selectedMonth = currentMonth();
let toastTimer;
let undoTimer;
let pendingDeletion = null;

function saveData() { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); }
function getCategory(type, id) { return categories[type].find(item => item.id === id) || categories[type][categories[type].length - 1]; }
function monthTransactions() { return data.transactions.filter(item => item.date.startsWith(selectedMonth)); }

function weekRange(dateValue) {
  const [year, month, day] = dateValue.split("-").map(Number);
  const reference = new Date(year, month - 1, day);
  const mondayOffset = (reference.getDay() + 6) % 7;
  const start = new Date(year, month - 1, day - mondayOffset);
  const end = new Date(start); end.setDate(start.getDate() + 6);
  return { start: localDate(start), end: localDate(end) };
}

function shortDate(dateValue) {
  return new Date(dateValue + "T00:00:00").toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" });
}

function fullDate(dateValue) {
  return new Date(dateValue + "T00:00:00").toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function render() {
  const items = monthTransactions();
  const incomeItems = items.filter(item => item.type === "income");
  const expenseItems = items.filter(item => item.type === "expense");
  const income = incomeItems.reduce((sum, item) => sum + item.amount, 0);
  const expense = expenseItems.reduce((sum, item) => sum + item.amount, 0);
  const balance = income - expense;
  const budget = data.budgets[selectedMonth] || 0;
  const budgetLeft = budget - expense;
  const savingRate = income ? Math.max(0, Math.round(balance / income * 100)) : 0;
  const referenceDate = selectedMonth === currentMonth() ? localDate() : `${selectedMonth}-01`;
  const week = weekRange(referenceDate);
  const weeklyExpense = data.transactions
    .filter(item => item.type === "expense" && item.date >= week.start && item.date <= week.end)
    .reduce((sum, item) => sum + item.amount, 0);

  $("#balanceValue").textContent = money(balance);
  $("#incomeValue").textContent = money(income);
  $("#expenseValue").textContent = money(expense);
  $("#weeklyExpenseValue").textContent = money(weeklyExpense);
  $("#weeklyExpenseCaption").textContent = `${shortDate(week.start)} – ${shortDate(week.end)}`;
  $("#budgetLeftValue").textContent = budget ? money(budgetLeft) : "Chưa đặt";
  $("#incomeCount").textContent = `${incomeItems.length} khoản thu`;
  $("#expenseCount").textContent = `${expenseItems.length} khoản chi`;
  $("#balanceMessage").textContent = balance >= 0 ? `Bạn đang giữ lại ${savingRate}% thu nhập` : "Chi tiêu đang vượt thu nhập";
  $("#savingRateSide").textContent = `${savingRate}% thu nhập đã tiết kiệm`;
  $("#budgetCaption").textContent = budget ? `Đã dùng ${Math.round(expense / budget * 100)}% của ${shortMoney(budget)}` : "Nhấn vào đây để đặt hạn mức";
  $("#budgetProgress").style.width = budget ? `${Math.min(100, expense / budget * 100)}%` : "0%";
  $("#budgetProgress").style.background = expense > budget && budget ? "#ef7d63" : "#f3c969";

  renderBars(expenseItems);
  renderCategories(expenseItems, expense);
  renderTransactions();
}

function renderBars(expenses) {
  const daysInMonth = new Date(Number(selectedMonth.slice(0,4)), Number(selectedMonth.slice(5,7)), 0).getDate();
  const weekCount = Math.ceil(daysInMonth / 7);
  const weeks = Array.from({ length: weekCount }, () => 0);
  expenses.forEach(item => { weeks[Math.floor((Number(item.date.slice(8,10)) - 1) / 7)] += item.amount; });
  const max = Math.max(...weeks, 1);
  const [year, month] = selectedMonth.split("-").map(Number);
  $("#barChart").innerHTML = weeks.map((value, index) => {
    const startDay = index * 7 + 1;
    const endDay = Math.min(startDay + 6, daysInMonth);
    const start = `${year}-${String(month).padStart(2, "0")}-${String(startDay).padStart(2, "0")}`;
    const end = `${year}-${String(month).padStart(2, "0")}-${String(endDay).padStart(2, "0")}`;
    const label = `Tuần ${index + 1}, từ ${fullDate(start)} đến ${fullDate(end)}, chi ${money(value)}`;
    return `<div class="bar-group">
      <div class="bar" tabindex="0" role="img" aria-label="${label}" style="height:${Math.max(2, value / max * 100)}%">
        <span class="bar-tooltip"><b>Tuần ${index + 1}</b><span>${fullDate(start)} – ${fullDate(end)}</span><strong>${money(value)}</strong></span>
      </div>
      <span class="bar-label">Tuần ${index + 1}</span>
    </div>`;
  }).join("");
}

function renderCategories(expenses, total) {
  const totals = categories.expense.map(category => ({ ...category, value: expenses.filter(item => item.category === category.id).reduce((sum, item) => sum + item.amount, 0) })).filter(item => item.value > 0).sort((a,b) => b.value - a.value);
  let cursor = 0;
  const stops = totals.map(item => {
    const start = cursor; cursor += total ? item.value / total * 100 : 0;
    return `${item.color} ${start}% ${cursor}%`;
  });
  $("#categoryDonut").style.background = stops.length ? `conic-gradient(${stops.join(",")})` : "#edf0ea";
  $("#donutTotal").textContent = shortMoney(total);
  $("#categoryLegend").innerHTML = totals.length ? totals.slice(0, 5).map(item => `
    <div class="legend-item"><i style="background:${item.color}"></i><span>${item.name}</span><b>${Math.round(item.value / total * 100)}%</b></div>
  `).join("") : '<span class="muted">Chưa có khoản chi</span>';
}

function renderTransactions() {
  const query = $("#searchInput").value.trim().toLowerCase();
  const filter = $("#typeFilter").value;
  const dateFrom = $("#dateFrom").value;
  const dateTo = $("#dateTo").value;
  const source = dateFrom || dateTo ? data.transactions : monthTransactions();
  const filtered = source.filter(item =>
    (!dateFrom || item.date >= dateFrom) &&
    (!dateTo || item.date <= dateTo) &&
    (filter === "all" || item.type === filter) &&
    (item.name.toLowerCase().includes(query) || (item.note || "").toLowerCase().includes(query))
  ).sort((a,b) => b.date.localeCompare(a.date));
  $("#transactionList").innerHTML = filtered.map(item => {
    const category = getCategory(item.type, item.category);
    const date = new Date(item.date + "T00:00:00").toLocaleDateString("vi-VN", { day: "2-digit", month: "short", year: "numeric" });
    return `<div class="transaction-item">
      <div class="transaction-icon" style="color:${category.color};background:${category.bg}">${category.icon}</div>
      <div class="transaction-name"><strong>${escapeHtml(item.name)}</strong><span>${escapeHtml(item.note || (item.type === "income" ? "Khoản thu" : "Khoản chi"))}</span></div>
      <div class="transaction-meta"><span class="transaction-category"><i class="category-dot" style="background:${category.color}"></i>${category.name}</span><span class="transaction-date">${date}</span></div>
      <div class="transaction-amount ${item.type}">${item.type === "income" ? "+" : "−"}${money(item.amount)}</div>
      <button class="delete-btn" data-delete="${item.id}" aria-label="Xóa ${escapeHtml(item.name)}">×</button>
    </div>`;
  }).join("");
  $("#emptyState").hidden = filtered.length !== 0;
  $("#clearDateFilter").hidden = !dateFrom && !dateTo;
}

function escapeHtml(text) { const el = document.createElement("div"); el.textContent = text; return el.innerHTML; }
function fillCategories(type) { $("#categoryInput").innerHTML = categories[type].map(item => `<option value="${item.id}">${item.icon}  ${item.name}</option>`).join(""); }
function showToast(message, options = {}) {
  clearTimeout(toastTimer);
  $("#toastMessage").textContent = message;
  $("#undoDeleteBtn").hidden = !options.undo;
  $("#toast").classList.add("show");
  toastTimer = setTimeout(() => $("#toast").classList.remove("show"), options.duration || 2400);
}
function syncModalState() { document.body.classList.toggle("modal-open", !$("#transactionModal").hidden || !$("#budgetModal").hidden); }
function openModal() { $("#transactionModal").hidden = false; syncModalState(); $("#dateInput").value = selectedMonth === currentMonth() ? localDate() : `${selectedMonth}-01`; setTimeout(() => $("#amountInput").focus(), 50); }
function closeModal() { $("#transactionModal").hidden = true; syncModalState(); $("#transactionForm").reset(); fillCategories("expense"); }
function parseAmount(value) { return Number(value.replace(/\D/g, "")); }
function formatAmountInput(event) { const value = parseAmount(event.target.value); event.target.value = value ? new Intl.NumberFormat("vi-VN").format(value) : ""; }

$("#todayLabel").textContent = new Date().toLocaleDateString("vi-VN", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
$("#monthFilter").value = selectedMonth;
fillCategories("expense");
render();

$("#openTransactionBtn").addEventListener("click", openModal);
$("#mobileAddBtn").addEventListener("click", openModal);
$("#emptyAddBtn").addEventListener("click", openModal);
$("#closeModalBtn").addEventListener("click", closeModal);
$("#transactionModal").addEventListener("click", event => { if (event.target === event.currentTarget) closeModal(); });
document.addEventListener("keydown", event => { if (event.key === "Escape") { closeModal(); $("#budgetModal").hidden = true; syncModalState(); } });
document.querySelectorAll('input[name="type"]').forEach(input => input.addEventListener("change", event => fillCategories(event.target.value)));
$("#amountInput").addEventListener("input", formatAmountInput);
$("#budgetInput").addEventListener("input", formatAmountInput);
$("#monthFilter").addEventListener("change", event => {
  selectedMonth = event.target.value || currentMonth();
  $("#dateFrom").value = "";
  $("#dateTo").value = "";
  $("#dateFrom").max = "";
  $("#dateTo").min = "";
  render();
});
$("#searchInput").addEventListener("input", renderTransactions);
$("#typeFilter").addEventListener("change", renderTransactions);
function updateDateRange(changedInput) {
  const from = $("#dateFrom");
  const to = $("#dateTo");
  if (from.value && to.value && from.value > to.value) {
    if (changedInput === from) to.value = from.value;
    else from.value = to.value;
  }
  to.min = from.value || "";
  from.max = to.value || "";
  renderTransactions();
}
$("#dateFrom").addEventListener("change", event => updateDateRange(event.target));
$("#dateTo").addEventListener("change", event => updateDateRange(event.target));
$("#clearDateFilter").addEventListener("click", () => {
  $("#dateFrom").value = "";
  $("#dateTo").value = "";
  $("#dateFrom").max = "";
  $("#dateTo").min = "";
  renderTransactions();
});

$("#transactionForm").addEventListener("submit", event => {
  event.preventDefault();
  const type = new FormData(event.target).get("type");
  const amount = parseAmount($("#amountInput").value);
  if (!amount) return showToast("Vui lòng nhập số tiền hợp lệ");
  data.transactions.push({ id: crypto.randomUUID(), type, amount, name: $("#nameInput").value.trim(), category: $("#categoryInput").value, date: $("#dateInput").value, note: $("#noteInput").value.trim() });
  selectedMonth = $("#dateInput").value.slice(0, 7); $("#monthFilter").value = selectedMonth;
  saveData(); closeModal(); render(); showToast("Đã lưu giao dịch ✓");
});

$("#transactionList").addEventListener("click", event => {
  const button = event.target.closest("[data-delete]");
  if (!button) return;
  const index = data.transactions.findIndex(item => String(item.id) === button.dataset.delete);
  if (index < 0) return showToast("Không tìm thấy giao dịch để xóa");
  clearTimeout(undoTimer);
  pendingDeletion = { item: data.transactions[index], index };
  data.transactions.splice(index, 1);
  saveData(); render(); showToast("Đã xóa giao dịch", { undo: true, duration: 5000 });
  undoTimer = setTimeout(() => { pendingDeletion = null; }, 5000);
});

$("#undoDeleteBtn").addEventListener("click", () => {
  if (!pendingDeletion) return;
  clearTimeout(undoTimer);
  data.transactions.splice(Math.min(pendingDeletion.index, data.transactions.length), 0, pendingDeletion.item);
  pendingDeletion = null;
  saveData(); render(); showToast("Đã khôi phục giao dịch ✓");
});

function openBudget() { $("#budgetInput").value = data.budgets[selectedMonth] ? new Intl.NumberFormat("vi-VN").format(data.budgets[selectedMonth]) : ""; $("#budgetModal").hidden = false; syncModalState(); setTimeout(() => $("#budgetInput").focus(), 50); }
$("#openBudgetBtn").addEventListener("click", openBudget);
$("#closeBudgetBtn").addEventListener("click", () => { $("#budgetModal").hidden = true; syncModalState(); });
$("#budgetModal").addEventListener("click", event => { if (event.target === event.currentTarget) { event.currentTarget.hidden = true; syncModalState(); } });
$("#budgetForm").addEventListener("submit", event => { event.preventDefault(); const value = parseAmount($("#budgetInput").value); if (!value) return showToast("Vui lòng nhập ngân sách hợp lệ"); data.budgets[selectedMonth] = value; saveData(); $("#budgetModal").hidden = true; syncModalState(); render(); showToast("Đã cập nhật ngân sách ✓"); });

document.querySelectorAll(".nav-item").forEach(button => button.addEventListener("click", () => {
  document.querySelectorAll(".nav-item").forEach(item => item.classList.remove("active")); button.classList.add("active");
  const target = button.dataset.view === "overview" ? ".topbar" : button.dataset.view === "transactions" ? ".transactions-panel" : ".summary-grid";
  document.querySelector(target).scrollIntoView({ behavior: "smooth", block: "start" });
  if (button.dataset.view === "budget") setTimeout(openBudget, 250);
}));
