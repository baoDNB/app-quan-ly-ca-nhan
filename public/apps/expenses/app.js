const STORAGE_KEY = "vi-nho-data-v1";
const ADD_BUTTON_POSITION_KEY = "vi-nho-add-button-position-v1";

const categories = {
  expense: [
    { id: "food", name: "Ăn uống", icon: "◉", color: "#ef7d63", bg: "#fbe9e4" },
    { id: "home", name: "Nhà cửa", icon: "⌂", color: "#68a6a0", bg: "#e4f1ef" },
    { id: "transport", name: "Di chuyển", icon: "↗", color: "#f3c969", bg: "#fbf1d7" },
    { id: "shopping", name: "Mua sắm", icon: "◇", color: "#9686bf", bg: "#eeeaf7" },
    { id: "health", name: "Sức khỏe", icon: "+", color: "#da6f7d", bg: "#fae8eb" },
    { id: "fun", name: "Giải trí", icon: "☆", color: "#5f91ca", bg: "#e7eff8" },
    { id: "debt", name: "Trả nợ", icon: "↘", color: "#b56b45", bg: "#f7e9df" },
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

function defaultFunds(saved = {}) {
  const build = (type, name) => {
    const source = saved[type] || {};
    return {
      name,
      balance: Math.max(0, Number(source.balance) || 0),
      target: Math.max(0, Number(source.target) || 0),
      movements: Array.isArray(source.movements) ? source.movements.filter(item => item?.date && Number(item.amount) > 0) : []
    };
  };
  return { travel: build("travel", "Quỹ đi chơi"), savings: build("savings", "Tiền để dành") };
}

function getSeedData() {
  const month = currentMonth();
  return {
    budgets: { [month]: 12000000 },
    debts: [],
    funds: defaultFunds(),
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
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (!saved) return getSeedData();
    return {
      ...saved,
      budgets: saved.budgets && typeof saved.budgets === "object" ? saved.budgets : {},
      transactions: Array.isArray(saved.transactions) ? saved.transactions.map(item =>
        item.type === "expense" && item.category === "other" && (item.note === "Thanh toán khoản nợ" || /^trả nợ(?:\s|$)/i.test(item.name || ""))
          ? { ...item, category: "debt" }
          : item
      ) : [],
      debts: Array.isArray(saved.debts) ? saved.debts : [],
      funds: defaultFunds(saved.funds)
    };
  }
  catch { return getSeedData(); }
}

let data = loadData();
saveData();
let selectedMonth = currentMonth();
let toastTimer;
let undoTimer;
let pendingDeletion = null;
let transactionPage = 1;
let debtPage = 1;
const TRANSACTIONS_PER_PAGE = 10;
const DEBTS_PER_PAGE = 6;

function saveData() { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); }
function getCategory(type, id) { return categories[type].find(item => item.id === id) || categories[type][categories[type].length - 1]; }
function monthTransactions() { return data.transactions.filter(item => item.date.startsWith(selectedMonth)); }

function shiftMonth(monthValue, amount) {
  const [year, month] = monthValue.split("-").map(Number);
  const date = new Date(year, month - 1 + amount, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(monthValue) {
  const [year, month] = monthValue.split("-");
  return `tháng ${Number(month)}/${year}`;
}

function monthCashFlow(monthValue) {
  return data.transactions.filter(item => item.date.startsWith(monthValue)).reduce((total, item) => total + (item.type === "income" ? item.amount : -item.amount), 0);
}

function monthFundAllocation(monthValue) {
  return Object.values(data.funds).flatMap(fund => fund.movements).filter(item => item.date.startsWith(monthValue)).reduce((total, item) => total + (item.action === "withdraw" ? -item.amount : item.amount), 0);
}

function availableForMonth(monthValue) {
  return carryIntoMonth(monthValue) + monthCashFlow(monthValue) - monthFundAllocation(monthValue);
}

function carryIntoMonth(monthValue) {
  const trackedMonths = [
    ...data.transactions.map(item => item.date.slice(0, 7)),
    ...Object.values(data.funds).flatMap(fund => fund.movements.map(item => item.date.slice(0, 7)))
  ].filter(month => month < monthValue).sort();
  if (!trackedMonths.length) return 0;
  let cursor = trackedMonths[0];
  let carry = 0;
  let guard = 0;
  while (cursor < monthValue && guard < 600) {
    carry = Math.max(0, carry + monthCashFlow(cursor) - monthFundAllocation(cursor));
    cursor = shiftMonth(cursor, 1);
    guard += 1;
  }
  return carry;
}

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
  const carryIn = carryIntoMonth(selectedMonth);
  const fundAllocation = monthFundAllocation(selectedMonth);
  const balance = carryIn + income - expense - fundAllocation;
  const carryOut = Math.max(0, balance);
  const budget = data.budgets[selectedMonth] || 0;
  const budgetLeft = budget - expense;
  const availableIncome = income + carryIn;
  const savingRate = availableIncome ? Math.max(0, Math.round(balance / availableIncome * 100)) : 0;
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
  $("#balanceMessage").textContent = balance < 0 ? "Chi tiêu đang vượt số tiền khả dụng" : carryIn ? `Có ${money(carryIn)} chuyển từ tháng trước` : `Bạn đang giữ lại ${savingRate}% tiền khả dụng`;
  $("#savingRateSide").textContent = `${money(data.funds.savings.balance)} đã để dành`;
  $("#budgetCaption").textContent = budget ? `Đã dùng ${Math.round(expense / budget * 100)}% của ${shortMoney(budget)}` : "Nhấn vào đây để đặt hạn mức";
  $("#budgetProgress").style.width = budget ? `${Math.min(100, expense / budget * 100)}%` : "0%";
  $("#budgetProgress").style.background = expense > budget && budget ? "#ef7d63" : "#f3c969";

  renderBars(expenseItems);
  renderCategories(expenseItems, expense);
  renderDebts();
  renderFunds(carryIn, carryOut);
  renderTransactions();
}

function renderFunds(carryIn, carryOut) {
  $("#carryInValue").textContent = money(carryIn);
  $("#carryOutValue").textContent = money(carryOut);
  $("#carryInCaption").textContent = carryIn ? `Đã nhận từ ${shiftMonth(selectedMonth, -1)}` : "Tháng trước không có tiền dư";
  ["travel", "savings"].forEach(type => {
    const fund = data.funds[type];
    const prefix = type === "travel" ? "travelFund" : "savingsFund";
    const progress = fund.target ? Math.min(100, Math.round(fund.balance / fund.target * 100)) : 0;
    $(`#${prefix}Balance`).textContent = money(fund.balance);
    $(`#${prefix}Progress`).style.width = `${progress}%`;
    $(`#${prefix}Caption`).textContent = fund.target ? `${progress}% mục tiêu ${money(fund.target)}` : "Chưa đặt mục tiêu";
  });
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

function debtNumbers(debt) {
  const total = Math.max(0, Number(debt.total) || 0);
  const rawRemaining = Number(debt.remaining);
  const remaining = Math.max(0, Math.min(total, Number.isFinite(rawRemaining) ? rawRemaining : total));
  return { total, remaining, paid: Math.max(0, total - remaining) };
}

function renderDebts() {
  const debts = data.debts.map(debt => ({ ...debt, ...debtNumbers(debt) }));
  const total = debts.reduce((sum, debt) => sum + debt.total, 0);
  const remaining = debts.reduce((sum, debt) => sum + debt.remaining, 0);
  const paid = Math.max(0, total - remaining);
  $("#debtTotalValue").textContent = money(total);
  $("#debtPaidValue").textContent = money(paid);
  $("#debtRemainingValue").textContent = money(remaining);
  $("#debtEmpty").hidden = debts.length !== 0;
  const sortedDebts = debts.sort((a, b) => Number(a.remaining === 0) - Number(b.remaining === 0) || (a.dueDate || "9999").localeCompare(b.dueDate || "9999"));
  const pageCount = Math.max(1, Math.ceil(sortedDebts.length / DEBTS_PER_PAGE));
  debtPage = Math.min(debtPage, pageCount);
  const pageStart = (debtPage - 1) * DEBTS_PER_PAGE;
  const pageItems = sortedDebts.slice(pageStart, pageStart + DEBTS_PER_PAGE);
  $("#debtList").innerHTML = pageItems
    .map(debt => {
      const paidPercent = debt.total ? Math.min(100, Math.round(debt.paid / debt.total * 100)) : 0;
      const remainingPercent = Math.max(0, 100 - paidPercent);
      const due = debt.dueDate ? `Hạn trả ${fullDate(debt.dueDate)}` : "Chưa đặt hạn trả";
      return `<article class="debt-card ${debt.remaining === 0 ? "completed" : ""}">
        <div class="debt-card-head">
          <div><h3>${escapeHtml(debt.creditor || "Không rõ")}</h3><p>${due}${debt.note ? ` · ${escapeHtml(debt.note)}` : ""}</p></div>
          <span class="debt-status">${debt.remaining === 0 ? "Đã trả hết" : `Còn ${remainingPercent}%`}</span>
        </div>
        <div class="debt-figures">
          <div><span>Tổng nợ</span><strong>${money(debt.total)}</strong></div>
          <div><span>Còn phải trả</span><strong>${money(debt.remaining)}</strong></div>
        </div>
        <div class="debt-progress"><span style="width:${paidPercent}%"></span></div>
        <div class="debt-progress-copy"><b>Đã trả ${paidPercent}%</b><span>${money(debt.paid)} / ${money(debt.total)}</span></div>
        <div class="debt-actions">
          <button class="debt-delete-btn" type="button" data-delete-debt="${debt.id}">Xóa</button>
          <button class="debt-pay-btn" type="button" data-pay-debt="${debt.id}" ${debt.remaining === 0 ? "disabled" : ""}>Ghi nhận trả nợ</button>
        </div>
      </article>`;
    }).join("");
  renderDebtPagination(sortedDebts.length, pageCount, pageStart, pageItems.length);
}

function renderDebtPagination(total, pageCount, pageStart, visibleCount) {
  const pagination = $("#debtPagination");
  pagination.hidden = pageCount <= 1;
  if (pageCount <= 1) { pagination.innerHTML = ""; return; }
  const pageButtons = Array.from({ length: pageCount }, (_, index) => {
    const page = index + 1;
    return `<button type="button" data-debt-page="${page}" class="page-number ${page === debtPage ? "active" : ""}" aria-label="Trang ${page}" ${page === debtPage ? 'aria-current="page"' : ""}>${page}</button>`;
  }).join("");
  pagination.innerHTML = `
    <span class="page-range">${pageStart + 1}–${pageStart + visibleCount} / ${total} khoản nợ</span>
    <div class="page-controls">
      <button type="button" data-debt-page="${debtPage - 1}" aria-label="Trang trước" ${debtPage === 1 ? "disabled" : ""}>‹</button>
      ${pageButtons}
      <button type="button" data-debt-page="${debtPage + 1}" aria-label="Trang sau" ${debtPage === pageCount ? "disabled" : ""}>›</button>
    </div>`;
}

function renderTransactions() {
  const query = $("#searchInput").value.trim().toLowerCase();
  const filter = $("#typeFilter").value;
  const categoryFilter = $("#historyCategoryFilter").value;
  const dateFrom = $("#dateFrom").value;
  const dateTo = $("#dateTo").value;
  const source = dateFrom || dateTo ? data.transactions : monthTransactions();
  const filtered = source.filter(item =>
    (!dateFrom || item.date >= dateFrom) &&
    (!dateTo || item.date <= dateTo) &&
    (filter === "all" || item.type === filter) &&
    (categoryFilter === "all" || item.category === categoryFilter) &&
    (item.name.toLowerCase().includes(query) || (item.note || "").toLowerCase().includes(query))
  ).sort((a,b) => b.date.localeCompare(a.date));
  const filteredIncome = filtered.filter(item => item.type === "income").reduce((sum, item) => sum + item.amount, 0);
  const filteredExpense = filtered.filter(item => item.type === "expense").reduce((sum, item) => sum + item.amount, 0);
  const filteredBalance = filteredIncome - filteredExpense;
  $("#filteredCount").textContent = filtered.length;
  $("#filteredIncome").textContent = money(filteredIncome);
  $("#filteredExpense").textContent = money(filteredExpense);
  $("#filteredBalance").textContent = money(filteredBalance);
  $("#filteredBalance").className = filteredBalance > 0 ? "positive" : filteredBalance < 0 ? "negative" : "";
  const pageCount = Math.max(1, Math.ceil(filtered.length / TRANSACTIONS_PER_PAGE));
  transactionPage = Math.min(transactionPage, pageCount);
  const pageStart = (transactionPage - 1) * TRANSACTIONS_PER_PAGE;
  const pageItems = filtered.slice(pageStart, pageStart + TRANSACTIONS_PER_PAGE);
  $("#transactionList").innerHTML = pageItems.map(item => {
    const category = getCategory(item.type, item.category);
    const date = new Date(item.date + "T00:00:00").toLocaleDateString("vi-VN", { day: "2-digit", month: "short", year: "numeric" });
    return `<div class="transaction-item" data-detail="${item.id}" tabindex="0" aria-label="Xem chi tiết ${escapeHtml(item.name)}">
      <div class="transaction-icon" style="color:${category.color};background:${category.bg}">${category.icon}</div>
      <div class="transaction-name"><strong>${escapeHtml(item.name)}</strong><span>${escapeHtml(item.note || (item.type === "income" ? "Khoản thu" : "Khoản chi"))}</span></div>
      <div class="transaction-meta"><span class="transaction-category"><i class="category-dot" style="background:${category.color}"></i>${category.name}</span><span class="transaction-date">${date}</span></div>
      <div class="transaction-amount ${item.type}">${item.type === "income" ? "+" : "−"}${money(item.amount)}</div>
      <div class="transaction-actions">
        <button class="edit-btn" data-edit="${item.id}" aria-label="Sửa ${escapeHtml(item.name)}">✎</button>
        <button class="delete-btn" data-delete="${item.id}" aria-label="Xóa ${escapeHtml(item.name)}">×</button>
      </div>
    </div>`;
  }).join("");
  $("#emptyState").hidden = filtered.length !== 0;
  $("#clearDateFilter").hidden = !dateFrom && !dateTo;
  renderTransactionPagination(filtered.length, pageCount, pageStart, pageItems.length);
}

function renderTransactionPagination(total, pageCount, pageStart, visibleCount) {
  const pagination = $("#transactionPagination");
  pagination.hidden = total === 0;
  if (!total) { pagination.innerHTML = ""; return; }
  const pageButtons = Array.from({ length: pageCount }, (_, index) => {
    const page = index + 1;
    return `<button type="button" data-page="${page}" class="page-number ${page === transactionPage ? "active" : ""}" aria-label="Trang ${page}" ${page === transactionPage ? 'aria-current="page"' : ""}>${page}</button>`;
  }).join("");
  pagination.innerHTML = `
    <span class="page-range">${pageStart + 1}–${pageStart + visibleCount} / ${total} giao dịch</span>
    <div class="page-controls">
      <button type="button" data-page="${transactionPage - 1}" aria-label="Trang trước" ${transactionPage === 1 ? "disabled" : ""}>‹</button>
      ${pageButtons}
      <button type="button" data-page="${transactionPage + 1}" aria-label="Trang sau" ${transactionPage === pageCount ? "disabled" : ""}>›</button>
    </div>`;
}

function fillHistoryCategoryFilter() {
  const selectedType = $("#typeFilter").value;
  const groups = selectedType === "all" ? ["expense", "income"] : [selectedType];
  $("#historyCategoryFilter").innerHTML = `<option value="all">Tất cả danh mục</option>` + groups.map(type =>
    `<optgroup label="${type === "expense" ? "Khoản chi" : "Khoản thu"}">${categories[type].map(category =>
      `<option value="${category.id}">${category.icon} ${category.name}</option>`
    ).join("")}</optgroup>`
  ).join("");
}

function resetTransactionPage() { transactionPage = 1; }

function escapeHtml(text) { const el = document.createElement("div"); el.textContent = text; return el.innerHTML; }
function fillCategories(type) { $("#categoryInput").innerHTML = categories[type].map(item => `<option value="${item.id}">${item.icon}  ${item.name}</option>`).join(""); }
function showToast(message, options = {}) {
  clearTimeout(toastTimer);
  $("#toastMessage").textContent = message;
  $("#undoDeleteBtn").hidden = !options.undo;
  $("#toast").classList.add("show");
  toastTimer = setTimeout(() => $("#toast").classList.remove("show"), options.duration || 2400);
}
function syncModalState() {
  document.body.classList.toggle("modal-open", ["#transactionModal", "#transactionDetailModal", "#budgetModal", "#debtModal", "#repaymentModal", "#fundModal"].some(selector => !$(selector).hidden));
}
function openModal(transaction = null) {
  $("#transactionForm").reset();
  const type = transaction?.type || "expense";
  $("#transactionId").value = transaction?.id || "";
  document.querySelectorAll('input[name="type"]').forEach(input => {
    input.checked = input.value === type;
    input.disabled = Boolean(transaction?.debtId);
  });
  fillCategories(type);
  $("#amountInput").value = transaction ? new Intl.NumberFormat("vi-VN").format(transaction.amount) : "";
  $("#nameInput").value = transaction?.name || "";
  $("#categoryInput").value = transaction?.category || categories[type][0].id;
  $("#categoryInput").disabled = Boolean(transaction?.debtId);
  $("#dateInput").value = transaction?.date || (selectedMonth === currentMonth() ? localDate() : `${selectedMonth}-01`);
  $("#noteInput").value = transaction?.note || "";
  $("#modalTitle").textContent = transaction?.debtId ? "Sửa giao dịch trả nợ" : transaction ? "Sửa giao dịch" : "Thêm giao dịch";
  $("#transactionSubmitBtn").textContent = transaction ? "Cập nhật giao dịch" : "Lưu giao dịch";
  $("#transactionModal").hidden = false;
  syncModalState();
  setTimeout(() => $("#amountInput").focus(), 50);
}
function closeModal() {
  $("#transactionModal").hidden = true;
  $("#transactionForm").reset();
  $("#transactionId").value = "";
  document.querySelectorAll('input[name="type"]').forEach(input => { input.disabled = false; });
  $("#categoryInput").disabled = false;
  fillCategories("expense");
  syncModalState();
}
function openTransactionDetail(transaction) {
  const category = getCategory(transaction.type, transaction.category);
  $("#transactionDetailTitle").textContent = transaction.name;
  $("#transactionDetailAmount").textContent = `${transaction.type === "income" ? "+" : "−"}${money(transaction.amount)}`;
  $("#transactionDetailAmount").className = `detail-amount ${transaction.type}`;
  $("#transactionDetailType").textContent = transaction.type === "income" ? "Khoản thu" : "Khoản chi";
  $("#transactionDetailCategory").textContent = `${category.icon} ${category.name}`;
  $("#transactionDetailDate").textContent = fullDate(transaction.date);
  $("#transactionDetailNote").textContent = transaction.note || "Không có ghi chú";
  $("#transactionDetailModal").hidden = false;
  syncModalState();
}
function closeTransactionDetail() { $("#transactionDetailModal").hidden = true; syncModalState(); }
function openDebtModal() { $("#debtModal").hidden = false; syncModalState(); setTimeout(() => $("#debtCreditorInput").focus(), 50); }
function closeDebtModal() { $("#debtModal").hidden = true; $("#debtForm").reset(); syncModalState(); }
function openRepaymentModal(debt) {
  const { remaining } = debtNumbers(debt);
  $("#repaymentDebtId").value = debt.id;
  $("#repaymentCreditor").textContent = `Nợ ${debt.creditor} · còn ${money(remaining)}`;
  $("#debtPaymentInput").value = "";
  $("#debtPaymentDate").value = localDate();
  $("#repaymentModal").hidden = false;
  syncModalState();
  setTimeout(() => $("#debtPaymentInput").focus(), 50);
}
function closeRepaymentModal() { $("#repaymentModal").hidden = true; $("#repaymentForm").reset(); syncModalState(); }
function openFundModal(type) {
  const fund = data.funds[type];
  if (!fund) return;
  $("#fundForm").reset();
  $("#fundTypeInput").value = type;
  $("#fundModalTitle").textContent = fund.name;
  $("#fundCurrentBalance").textContent = `Hiện có ${money(fund.balance)}`;
  $("#fundTargetInput").value = fund.target ? new Intl.NumberFormat("vi-VN").format(fund.target) : "";
  syncFundActionHint();
  $("#fundModal").hidden = false;
  syncModalState();
  setTimeout(() => $("#fundAmountInput").focus(), 50);
}
function closeFundModal() { $("#fundModal").hidden = true; $("#fundForm").reset(); syncModalState(); }
function syncFundActionHint() {
  const fund = data.funds[$("#fundTypeInput").value];
  if (!fund) return;
  const action = new FormData($("#fundForm")).get("fundAction") || "deposit";
  const available = Math.max(0, availableForMonth(selectedMonth));
  $("#fundMonthSummary").textContent = `Số dư khả dụng ${monthLabel(selectedMonth)}: ${money(available)}`;
  $("#fundAmountHint").textContent = action === "deposit"
    ? `Nạp quỹ sẽ trừ trực tiếp từ tiền dư ${monthLabel(selectedMonth)}.`
    : `Rút quỹ sẽ trả tiền về số dư ${monthLabel(selectedMonth)}.`;
  $("#useFullSurplusBtn").hidden = action !== "deposit" || available <= 0;
  $("#useFullSurplusBtn").dataset.amount = String(available);
}
function parseAmount(value) { return Number(value.replace(/\D/g, "")); }
function formatAmountInput(event) { const value = parseAmount(event.target.value); event.target.value = value ? new Intl.NumberFormat("vi-VN").format(value) : ""; }
function openExpenseSidebar() {
  $(".sidebar").classList.add("open");
  $("#sidebarOverlay").classList.add("open");
  document.body.classList.add("sidebar-open");
  $("#expenseMenuButton").setAttribute("aria-expanded", "true");
}
function closeExpenseSidebar() {
  $(".sidebar").classList.remove("open");
  $("#sidebarOverlay").classList.remove("open");
  document.body.classList.remove("sidebar-open");
  $("#expenseMenuButton").setAttribute("aria-expanded", "false");
}

function initMovableAddButton() {
  const button = $("#mobileAddBtn");
  const edge = 12;
  let drag = null;
  let suppressClick = false;

  function bounds() {
    return {
      maxLeft: Math.max(edge, window.innerWidth - button.offsetWidth - edge),
      maxTop: Math.max(edge, window.innerHeight - button.offsetHeight - edge)
    };
  }

  function place(left, top) {
    const { maxLeft, maxTop } = bounds();
    button.style.left = `${Math.min(maxLeft, Math.max(edge, left))}px`;
    button.style.top = `${Math.min(maxTop, Math.max(edge, top))}px`;
    button.style.right = "auto";
    button.style.bottom = "auto";
  }

  function savePosition() {
    const rect = button.getBoundingClientRect();
    const { maxLeft, maxTop } = bounds();
    const widthRange = Math.max(1, maxLeft - edge);
    const heightRange = Math.max(1, maxTop - edge);
    localStorage.setItem(ADD_BUTTON_POSITION_KEY, JSON.stringify({
      x: (rect.left - edge) / widthRange,
      y: (rect.top - edge) / heightRange
    }));
  }

  function restorePosition() {
    try {
      const saved = JSON.parse(localStorage.getItem(ADD_BUTTON_POSITION_KEY));
      if (!Number.isFinite(saved?.x) || !Number.isFinite(saved?.y)) return;
      const { maxLeft, maxTop } = bounds();
      place(edge + Math.min(1, Math.max(0, saved.x)) * (maxLeft - edge), edge + Math.min(1, Math.max(0, saved.y)) * (maxTop - edge));
    } catch {}
  }

  button.addEventListener("pointerdown", event => {
    if (event.button !== 0) return;
    const rect = button.getBoundingClientRect();
    drag = { pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, left: rect.left, top: rect.top, moved: false };
    button.setPointerCapture(event.pointerId);
    button.classList.add("dragging");
  });
  button.addEventListener("pointermove", event => {
    if (!drag || event.pointerId !== drag.pointerId) return;
    const dx = event.clientX - drag.startX;
    const dy = event.clientY - drag.startY;
    if (Math.hypot(dx, dy) > 5) drag.moved = true;
    if (drag.moved) place(drag.left + dx, drag.top + dy);
  });
  function finishDrag(event) {
    if (!drag || event.pointerId !== drag.pointerId) return;
    suppressClick = drag.moved;
    if (drag.moved) savePosition();
    drag = null;
    button.classList.remove("dragging");
    if (button.hasPointerCapture(event.pointerId)) button.releasePointerCapture(event.pointerId);
    setTimeout(() => { suppressClick = false; }, 0);
  }
  button.addEventListener("pointerup", finishDrag);
  button.addEventListener("pointercancel", finishDrag);
  button.addEventListener("click", event => {
    if (suppressClick) { event.preventDefault(); return; }
    openModal();
  });
  window.addEventListener("resize", restorePosition);
  restorePosition();
}

$("#todayLabel").textContent = new Date().toLocaleDateString("vi-VN", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
$("#monthFilter").value = selectedMonth;
fillCategories("expense");
fillHistoryCategoryFilter();
render();
initMovableAddButton();

$("#expenseMenuButton").addEventListener("click", () => {
  $(".sidebar").classList.contains("open") ? closeExpenseSidebar() : openExpenseSidebar();
});
$("#sidebarOverlay").addEventListener("click", closeExpenseSidebar);
$("#openTransactionBtn").addEventListener("click", () => openModal());
$("#emptyAddBtn").addEventListener("click", () => openModal());
$("#closeModalBtn").addEventListener("click", closeModal);
$("#transactionModal").addEventListener("click", event => { if (event.target === event.currentTarget) closeModal(); });
$("#closeTransactionDetailBtn").addEventListener("click", closeTransactionDetail);
$("#transactionDetailModal").addEventListener("click", event => { if (event.target === event.currentTarget) closeTransactionDetail(); });
$("#openDebtBtn").addEventListener("click", openDebtModal);
$("#closeDebtBtn").addEventListener("click", closeDebtModal);
$("#debtModal").addEventListener("click", event => { if (event.target === event.currentTarget) closeDebtModal(); });
$("#closeRepaymentBtn").addEventListener("click", closeRepaymentModal);
$("#repaymentModal").addEventListener("click", event => { if (event.target === event.currentTarget) closeRepaymentModal(); });
$("#closeFundBtn").addEventListener("click", closeFundModal);
$("#fundModal").addEventListener("click", event => { if (event.target === event.currentTarget) closeFundModal(); });
$(".funds-panel").addEventListener("click", event => {
  const button = event.target.closest("[data-open-fund]");
  if (button) openFundModal(button.dataset.openFund);
});
document.addEventListener("keydown", event => {
  if (event.key !== "Escape") return;
  closeExpenseSidebar();
  closeModal(); closeTransactionDetail(); closeDebtModal(); closeRepaymentModal(); closeFundModal(); $("#budgetModal").hidden = true; syncModalState();
});
document.querySelectorAll('input[name="type"]').forEach(input => input.addEventListener("change", event => fillCategories(event.target.value)));
$("#amountInput").addEventListener("input", formatAmountInput);
$("#budgetInput").addEventListener("input", formatAmountInput);
$("#debtTotalInput").addEventListener("input", formatAmountInput);
$("#debtPaidInput").addEventListener("input", formatAmountInput);
$("#debtPaymentInput").addEventListener("input", formatAmountInput);
$("#fundAmountInput").addEventListener("input", formatAmountInput);
$("#fundTargetInput").addEventListener("input", formatAmountInput);
document.querySelectorAll('input[name="fundAction"]').forEach(input => input.addEventListener("change", syncFundActionHint));
$("#useFullSurplusBtn").addEventListener("click", event => {
  const amount = Number(event.currentTarget.dataset.amount) || 0;
  $("#fundAmountInput").value = amount ? new Intl.NumberFormat("vi-VN").format(amount) : "";
  $("#fundAmountInput").focus();
});
$("#monthFilter").addEventListener("change", event => {
  selectedMonth = event.target.value || currentMonth();
  $("#dateFrom").value = "";
  $("#dateTo").value = "";
  $("#dateFrom").max = "";
  $("#dateTo").min = "";
  resetTransactionPage();
  render();
});
$("#searchInput").addEventListener("input", () => { resetTransactionPage(); renderTransactions(); });
$("#typeFilter").addEventListener("change", () => { resetTransactionPage(); fillHistoryCategoryFilter(); renderTransactions(); });
$("#historyCategoryFilter").addEventListener("change", () => { resetTransactionPage(); renderTransactions(); });
$("#transactionPagination").addEventListener("click", event => {
  const button = event.target.closest("[data-page]");
  if (!button || button.disabled) return;
  transactionPage = Number(button.dataset.page);
  renderTransactions();
  $("#transactionList").scrollIntoView({ behavior: "smooth", block: "start" });
});
function updateDateRange(changedInput) {
  const from = $("#dateFrom");
  const to = $("#dateTo");
  if (from.value && to.value && from.value > to.value) {
    if (changedInput === from) to.value = from.value;
    else from.value = to.value;
  }
  to.min = from.value || "";
  from.max = to.value || "";
  resetTransactionPage();
  renderTransactions();
}
$("#dateFrom").addEventListener("change", event => updateDateRange(event.target));
$("#dateTo").addEventListener("change", event => updateDateRange(event.target));
$("#clearDateFilter").addEventListener("click", () => {
  $("#dateFrom").value = "";
  $("#dateTo").value = "";
  $("#dateFrom").max = "";
  $("#dateTo").min = "";
  resetTransactionPage();
  renderTransactions();
});

$("#fundForm").addEventListener("submit", event => {
  event.preventDefault();
  const type = $("#fundTypeInput").value;
  const fund = data.funds[type];
  if (!fund) return showToast("Không tìm thấy quỹ");
  const amount = parseAmount($("#fundAmountInput").value || "0");
  const targetRaw = $("#fundTargetInput").value.trim();
  const target = targetRaw ? parseAmount(targetRaw) : fund.target;
  const action = new FormData(event.target).get("fundAction");
  const month = selectedMonth;
  const date = selectedMonth === currentMonth() ? localDate() : `${selectedMonth}-01`;
  if (!amount && target === fund.target) return showToast("Nhập số tiền hoặc thay đổi mục tiêu quỹ");
  if (action === "withdraw" && amount > fund.balance) return showToast(`Quỹ chỉ còn ${money(fund.balance)}`);
  if (action === "deposit" && amount) {
    const available = availableForMonth(month);
    if (amount > Math.max(0, available)) return showToast(`Số dư khả dụng chỉ còn ${money(Math.max(0, available))}`);
  }
  fund.target = target;
  if (amount) {
    fund.balance = Math.max(0, fund.balance + (action === "withdraw" ? -amount : amount));
    fund.movements.push({ id: crypto.randomUUID(), action, amount, date });
  }
  saveData(); closeFundModal(); render();
  showToast(amount ? `${action === "withdraw" ? "Đã rút khỏi" : "Đã nạp vào"} ${fund.name} từ ${monthLabel(month)} ✓` : "Đã cập nhật mục tiêu quỹ ✓");
});

$("#debtForm").addEventListener("submit", event => {
  event.preventDefault();
  const creditor = $("#debtCreditorInput").value.trim();
  const total = parseAmount($("#debtTotalInput").value);
  const paid = parseAmount($("#debtPaidInput").value || "0");
  if (!creditor || !total) return showToast("Vui lòng nhập người cho vay và tổng khoản nợ");
  if (paid > total) return showToast("Số tiền đã trả không thể lớn hơn tổng khoản nợ");
  data.debts.push({
    id: crypto.randomUUID(), creditor, total, remaining: total - paid,
    dueDate: $("#debtDueDateInput").value,
    note: $("#debtNoteInput").value.trim(), createdAt: localDate()
  });
  debtPage = 1;
  saveData(); closeDebtModal(); renderDebts(); showToast("Đã thêm khoản nợ ✓");
});

$("#debtList").addEventListener("click", event => {
  const payButton = event.target.closest("[data-pay-debt]");
  if (payButton) {
    const debt = data.debts.find(item => String(item.id) === payButton.dataset.payDebt);
    if (debt) openRepaymentModal(debt);
    return;
  }
  const deleteButton = event.target.closest("[data-delete-debt]");
  if (!deleteButton) return;
  const debt = data.debts.find(item => String(item.id) === deleteButton.dataset.deleteDebt);
  if (!debt || !window.confirm(`Xóa khoản nợ với ${debt.creditor}? Các giao dịch trả nợ đã ghi vẫn được giữ lại.`)) return;
  data.debts = data.debts.filter(item => String(item.id) !== deleteButton.dataset.deleteDebt);
  saveData(); renderDebts(); showToast("Đã xóa khoản nợ");
});

$("#debtPagination").addEventListener("click", event => {
  const button = event.target.closest("[data-debt-page]");
  if (!button || button.disabled) return;
  debtPage = Number(button.dataset.debtPage);
  renderDebts();
  $("#debtList").scrollIntoView({ behavior: "smooth", block: "start" });
});

$("#repaymentForm").addEventListener("submit", event => {
  event.preventDefault();
  const debt = data.debts.find(item => String(item.id) === $("#repaymentDebtId").value);
  if (!debt) return showToast("Không tìm thấy khoản nợ");
  const amount = parseAmount($("#debtPaymentInput").value);
  const date = $("#debtPaymentDate").value;
  const { remaining } = debtNumbers(debt);
  if (!amount) return showToast("Vui lòng nhập số tiền đã trả");
  if (amount > remaining) return showToast(`Số tiền trả tối đa là ${money(remaining)}`);
  debt.remaining = remaining - amount;
  debt.updatedAt = localDate();
  data.transactions.push({
    id: crypto.randomUUID(), type: "expense", amount,
    name: `Trả nợ ${debt.creditor}`, category: "debt", date,
    note: "Thanh toán khoản nợ", debtId: debt.id
  });
  selectedMonth = date.slice(0, 7); $("#monthFilter").value = selectedMonth;
  saveData(); closeRepaymentModal(); render();
  showToast(debt.remaining === 0 ? `Đã trả hết nợ cho ${debt.creditor} ✓` : `Đã ghi nhận trả ${money(amount)} ✓`);
});

$("#transactionForm").addEventListener("submit", event => {
  event.preventDefault();
  const id = $("#transactionId").value;
  const existing = id ? data.transactions.find(item => String(item.id) === id) : null;
  const requestedType = new FormData(event.target).get("type");
  const type = existing?.debtId ? "expense" : requestedType;
  const amount = parseAmount($("#amountInput").value);
  if (!amount) return showToast("Vui lòng nhập số tiền hợp lệ");
  const transaction = {
    type, amount, name: $("#nameInput").value.trim(),
    category: existing?.debtId ? "debt" : $("#categoryInput").value,
    date: $("#dateInput").value, note: $("#noteInput").value.trim()
  };
  if (existing) {
    if (existing.debtId) {
      const debt = data.debts.find(item => String(item.id) === String(existing.debtId));
      if (debt) {
        const numbers = debtNumbers(debt);
        const maximum = numbers.remaining + Number(existing.amount);
        if (amount > maximum) return showToast(`Khoản trả tối đa là ${money(maximum)}`);
        debt.remaining = Math.max(0, Math.min(numbers.total, numbers.remaining + Number(existing.amount) - amount));
        debt.updatedAt = localDate();
      }
    }
    Object.assign(existing, transaction);
  } else {
    data.transactions.push({ id: crypto.randomUUID(), ...transaction });
  }
  selectedMonth = $("#dateInput").value.slice(0, 7); $("#monthFilter").value = selectedMonth;
  saveData(); closeModal(); render(); showToast(existing ? "Đã cập nhật giao dịch ✓" : "Đã lưu giao dịch ✓");
});

$("#transactionList").addEventListener("click", event => {
  const editButton = event.target.closest("[data-edit]");
  if (editButton) {
    const transaction = data.transactions.find(item => String(item.id) === editButton.dataset.edit);
    if (transaction) openModal(transaction);
    return;
  }
  const button = event.target.closest("[data-delete]");
  if (!button) {
    const detailRow = event.target.closest("[data-detail]");
    const transaction = detailRow ? data.transactions.find(item => String(item.id) === detailRow.dataset.detail) : null;
    if (transaction) openTransactionDetail(transaction);
    return;
  }
  const index = data.transactions.findIndex(item => String(item.id) === button.dataset.delete);
  if (index < 0) return showToast("Không tìm thấy giao dịch để xóa");
  clearTimeout(undoTimer);
  pendingDeletion = { item: data.transactions[index], index };
  if (pendingDeletion.item.debtId) {
    const debt = data.debts.find(item => String(item.id) === String(pendingDeletion.item.debtId));
    if (debt) {
      const numbers = debtNumbers(debt);
      debt.remaining = Math.min(numbers.total, numbers.remaining + Number(pendingDeletion.item.amount));
    }
  }
  data.transactions.splice(index, 1);
  saveData(); render(); showToast("Đã xóa giao dịch", { undo: true, duration: 5000 });
  undoTimer = setTimeout(() => { pendingDeletion = null; }, 5000);
});
$("#transactionList").addEventListener("keydown", event => {
  if (!["Enter", " "].includes(event.key) || event.target.closest("button")) return;
  const detailRow = event.target.closest("[data-detail]");
  const transaction = detailRow ? data.transactions.find(item => String(item.id) === detailRow.dataset.detail) : null;
  if (transaction) { event.preventDefault(); openTransactionDetail(transaction); }
});

$("#undoDeleteBtn").addEventListener("click", () => {
  if (!pendingDeletion) return;
  clearTimeout(undoTimer);
  data.transactions.splice(Math.min(pendingDeletion.index, data.transactions.length), 0, pendingDeletion.item);
  if (pendingDeletion.item.debtId) {
    const debt = data.debts.find(item => String(item.id) === String(pendingDeletion.item.debtId));
    if (debt) {
      const numbers = debtNumbers(debt);
      debt.remaining = Math.max(0, numbers.remaining - Number(pendingDeletion.item.amount));
    }
  }
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
  const targets = { overview: ".topbar", transactions: ".transactions-panel", budget: ".summary-grid", debts: ".debts-panel", funds: ".funds-panel" };
  const target = targets[button.dataset.view] || ".topbar";
  document.querySelector(target).scrollIntoView({ behavior: "smooth", block: "start" });
  if (button.dataset.view === "budget") setTimeout(openBudget, 250);
  closeExpenseSidebar();
}));
