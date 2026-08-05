const STORAGE_KEY = 'may-note-data-v1';

const seedNotes = [
  { id: crypto.randomUUID(), title: 'Ý tưởng cho chuyến đi Đà Lạt', content: 'Ghé tiệm cà phê trong rừng vào sáng sớm.\nThuê xe máy đi đồi chè Cầu Đất và mang theo máy ảnh.', label: 'Cá nhân', pinned: true, trashed: false, createdAt: Date.now() - 86400000 * 4, updatedAt: Date.now() - 3600000 * 2 },
  { id: crypto.randomUUID(), title: 'Kế hoạch tuần này', content: 'Hoàn thiện bản thiết kế trang chủ\nHọp cùng nhóm vào thứ Tư\nĐọc xong cuốn sách đang dở', label: 'Công việc', pinned: false, trashed: false, createdAt: Date.now() - 86400000 * 3, updatedAt: Date.now() - 86400000 },
  { id: crypto.randomUUID(), title: 'Một câu mình thích', content: '“Những điều tốt đẹp cần thời gian, nhưng chúng luôn xứng đáng để chờ đợi.”', label: 'Cảm hứng', pinned: false, trashed: false, createdAt: Date.now() - 86400000 * 8, updatedAt: Date.now() - 86400000 * 3 },
  { id: crypto.randomUUID(), title: 'Danh sách sách muốn đọc', content: 'Rừng Na Uy — Haruki Murakami\nBước chậm lại giữa thế gian vội vã\nThe Creative Act — Rick Rubin', label: 'Học tập', pinned: false, trashed: false, createdAt: Date.now() - 86400000 * 10, updatedAt: Date.now() - 86400000 * 5 },
  { id: crypto.randomUUID(), title: 'Công thức pasta sốt kem', content: 'Pasta, nấm, kem tươi, parmesan, tiêu đen. Nhớ giữ lại một ít nước luộc mì để làm sốt mượt hơn.', label: 'Cá nhân', pinned: false, trashed: false, createdAt: Date.now() - 86400000 * 11, updatedAt: Date.now() - 86400000 * 7 }
];

const defaultLabels = [
  { name: 'Công việc', color: '#4979a8', tint: '#eef4f8' },
  { name: 'Cá nhân', color: '#ca775d', tint: '#fbf1ed' },
  { name: 'Học tập', color: '#9a7ab0', tint: '#f5f0f7' },
  { name: 'Cảm hứng', color: '#c59539', tint: '#fbf6e8' }
];

let data = loadData();
let state = { filter: 'all', label: null, query: '', view: localStorage.getItem('may-note-view') || 'grid', sort: 'updated', editingId: null, draftPinned: false };

const $ = (id) => document.getElementById(id);
const els = {
  grid: $('notesGrid'), template: $('noteCardTemplate'), empty: $('emptyState'), emptyText: $('emptyText'),
  title: $('pageTitle'), subtitle: $('pageSubtitle'), eyebrow: $('eyebrow'), search: $('searchInput'),
  modal: $('editorModal'), noteTitle: $('noteTitle'), noteContent: $('noteContent'), noteLabel: $('noteLabel'),
  pin: $('pinButton'), deleteButton: $('deleteButton'), editorMeta: $('editorMeta'), editorLabelDot: $('editorLabelDot'), labelList: $('labelList'), toast: $('toast')
};

function loadData() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (parsed?.notes && parsed?.labels) return parsed;
  } catch (_) {}
  return { notes: seedNotes, labels: defaultLabels };
}

function saveData() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  updateCounts();
}

function escapeHTML(text = '') {
  return text.replace(/[&<>'"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c]));
}

function getLabel(name) { return data.labels.find(label => label.name === name) || data.labels[0]; }

function formatDate(timestamp) {
  const date = new Date(timestamp);
  const today = new Date();
  const yesterday = new Date(Date.now() - 86400000);
  const same = d => d.toDateString() === date.toDateString();
  if (same(today)) return `Hôm nay, ${date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}`;
  if (same(yesterday)) return 'Hôm qua';
  return date.toLocaleDateString('vi-VN', { day: 'numeric', month: 'short' });
}

function wordCount(text) { return text.trim() ? text.trim().split(/\s+/).length : 0; }

function visibleNotes() {
  let result = data.notes.filter(note => state.filter === 'trash' ? note.trashed : !note.trashed);
  if (state.filter === 'pinned') result = result.filter(note => note.pinned);
  if (state.label) result = result.filter(note => note.label === state.label);
  if (state.query) {
    const query = state.query.toLocaleLowerCase('vi');
    result = result.filter(note => `${note.title} ${note.content}`.toLocaleLowerCase('vi').includes(query));
  }
  result.sort((a, b) => {
    if (state.sort === 'title') return a.title.localeCompare(b.title, 'vi');
    return b[state.sort === 'created' ? 'createdAt' : 'updatedAt'] - a[state.sort === 'created' ? 'createdAt' : 'updatedAt'];
  });
  if (state.filter !== 'trash') result.sort((a, b) => Number(b.pinned) - Number(a.pinned));
  return result;
}

function render() {
  const notes = visibleNotes();
  els.grid.innerHTML = '';
  els.grid.classList.toggle('list-view', state.view === 'list');
  notes.forEach(note => {
    const card = els.template.content.firstElementChild.cloneNode(true);
    const label = getLabel(note.label);
    card.dataset.id = note.id;
    card.style.setProperty('--dot', label?.color || '#777');
    card.style.setProperty('--card-tint', document.documentElement.dataset.theme === 'dark' ? 'var(--surface)' : label?.tint || 'var(--surface)');
    card.querySelector('.card-label b').textContent = note.label;
    card.querySelector('h2').textContent = note.title || 'Ghi chú không tiêu đề';
    card.querySelector('.card-content').textContent = note.content || 'Không có nội dung';
    card.querySelector('time').textContent = formatDate(note.updatedAt);
    card.querySelector('.word-count').textContent = `${wordCount(note.content)} từ`;
    const pin = card.querySelector('.pin-card');
    pin.classList.toggle('active', note.pinned);
    pin.title = note.pinned ? 'Bỏ ghim' : 'Ghim';
    pin.addEventListener('click', event => { event.stopPropagation(); togglePin(note.id); });
    card.addEventListener('click', () => openEditor(note.id));
    card.addEventListener('keydown', event => { if (event.key === 'Enter') openEditor(note.id); });
    els.grid.appendChild(card);
  });
  els.empty.hidden = notes.length > 0;
  if (!notes.length) {
    els.emptyText.textContent = state.query ? 'Không tìm thấy ghi chú phù hợp với từ khóa này.' : state.filter === 'trash' ? 'Những ghi chú đã xóa sẽ xuất hiện tại đây.' : 'Bắt đầu bằng một ý tưởng nhỏ. Phần còn lại sẽ tự tìm đến.';
  }
  renderLabels();
  updateHeading();
  updateCounts();
}

function renderLabels() {
  els.labelList.innerHTML = '';
  els.noteLabel.innerHTML = '';
  data.labels.forEach(label => {
    const count = data.notes.filter(n => !n.trashed && n.label === label.name).length;
    const button = document.createElement('button');
    button.className = `label-item${state.label === label.name ? ' active' : ''}`;
    button.style.setProperty('--dot', label.color);
    button.innerHTML = `<i></i><span>${escapeHTML(label.name)}</span><span class="nav-count">${count}</span>`;
    button.addEventListener('click', () => setLabel(label.name));
    els.labelList.appendChild(button);
    const option = document.createElement('option');
    option.value = label.name; option.textContent = label.name;
    els.noteLabel.appendChild(option);
  });
}

function updateHeading() {
  const headings = {
    all: ['KHÔNG GIAN CỦA BẠN', 'Mọi <em>ý tưởng</em>', 'Thu thập suy nghĩ, kế hoạch và những điều bạn không muốn quên.'],
    pinned: ['QUAN TRỌNG', 'Ghi chú <em>đã ghim</em>', 'Những ý tưởng quan trọng nhất luôn nằm trong tầm mắt.'],
    trash: ['LƯU TRỮ TẠM THỜI', 'Thùng <em>rác</em>', 'Mở ghi chú để khôi phục hoặc xóa vĩnh viễn.']
  };
  let value = headings[state.filter];
  if (state.label) value = ['BỘ SƯU TẬP', `<em>${escapeHTML(state.label)}</em>`, `Tất cả ghi chú được gắn nhãn ${escapeHTML(state.label)}.`];
  els.eyebrow.textContent = value[0]; els.title.innerHTML = value[1]; els.subtitle.textContent = value[2];
}

function updateCounts() {
  $('allCount').textContent = data.notes.filter(n => !n.trashed).length;
  $('pinnedCount').textContent = data.notes.filter(n => !n.trashed && n.pinned).length;
  $('trashCount').textContent = data.notes.filter(n => n.trashed).length;
  const bytes = new Blob([JSON.stringify(data)]).size;
  $('storageText').textContent = bytes < 1024 ? `${bytes} B` : `${(bytes / 1024).toFixed(1)} KB`;
  $('storageBar').style.width = `${Math.max(1, Math.min(100, bytes / 50000))}%`;
}

function setFilter(filter) {
  state.filter = filter; state.label = null;
  document.querySelectorAll('.nav-item').forEach(el => el.classList.toggle('active', el.dataset.filter === filter));
  closeSidebar(); render();
}

function setLabel(label) {
  state.label = label; state.filter = 'all';
  document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
  closeSidebar(); render();
}

function openEditor(id = null) {
  state.editingId = id;
  const note = id ? data.notes.find(item => item.id === id) : null;
  els.noteTitle.value = note?.title || '';
  els.noteContent.value = note?.content || '';
  els.noteLabel.value = note?.label || data.labels[0]?.name || '';
  state.draftPinned = note?.pinned || false;
  els.pin.classList.toggle('active', state.draftPinned);
  els.deleteButton.textContent = note?.trashed ? 'Xóa vĩnh viễn' : 'Xóa';
  els.deleteButton.style.visibility = note ? 'visible' : 'hidden';
  els.editorMeta.textContent = note ? `Cập nhật ${formatDate(note.updatedAt)} · ${wordCount(note.content)} từ` : 'Ghi chú mới';
  updateEditorDot();
  els.modal.classList.add('open'); els.modal.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';
  setTimeout(() => els.noteTitle.focus(), 100);
}

function closeEditor() {
  els.modal.classList.remove('open'); els.modal.setAttribute('aria-hidden', 'true'); document.body.style.overflow = '';
}

function saveNote() {
  const title = els.noteTitle.value.trim();
  const content = els.noteContent.value.trim();
  if (!title && !content) { showToast('Hãy viết một chút trước khi lưu'); return; }
  const now = Date.now();
  if (state.editingId) {
    const note = data.notes.find(n => n.id === state.editingId);
    Object.assign(note, { title, content, label: els.noteLabel.value, pinned: state.draftPinned, updatedAt: now });
    showToast('Đã cập nhật ghi chú');
  } else {
    data.notes.unshift({ id: crypto.randomUUID(), title, content, label: els.noteLabel.value, pinned: state.draftPinned, trashed: false, createdAt: now, updatedAt: now });
    showToast('Đã tạo ghi chú mới');
  }
  saveData(); closeEditor(); render();
}

function deleteNote() {
  if (!state.editingId) return;
  const note = data.notes.find(n => n.id === state.editingId);
  if (note.trashed) {
    if (!confirm('Xóa vĩnh viễn ghi chú này? Hành động này không thể hoàn tác.')) return;
    data.notes = data.notes.filter(n => n.id !== note.id);
    showToast('Đã xóa vĩnh viễn');
  } else {
    note.trashed = true; note.pinned = false; note.updatedAt = Date.now();
    showToast('Đã chuyển vào thùng rác');
  }
  saveData(); closeEditor(); render();
}

function togglePin(id) {
  const note = data.notes.find(n => n.id === id);
  note.pinned = !note.pinned; note.updatedAt = Date.now(); saveData(); render();
  showToast(note.pinned ? 'Đã ghim ghi chú' : 'Đã bỏ ghim');
}

function restoreNote() {
  const note = data.notes.find(n => n.id === state.editingId);
  if (!note?.trashed) return;
  note.trashed = false; note.updatedAt = Date.now(); saveData(); closeEditor(); render(); showToast('Đã khôi phục ghi chú');
}

function updateEditorDot() { els.editorLabelDot.style.background = getLabel(els.noteLabel.value)?.color || '#777'; }
let toastTimer;
function showToast(message) { clearTimeout(toastTimer); els.toast.querySelector('p').textContent = message; els.toast.classList.add('show'); toastTimer = setTimeout(() => els.toast.classList.remove('show'), 2400); }
function closeSidebar() { $('sidebar').classList.remove('open'); $('sidebarOverlay').classList.remove('open'); }

document.querySelectorAll('[data-filter]').forEach(el => el.addEventListener('click', () => setFilter(el.dataset.filter)));
$('newNoteButton').addEventListener('click', () => openEditor());
$('emptyCreateButton').addEventListener('click', () => state.filter === 'trash' ? null : openEditor());
$('closeEditorButton').addEventListener('click', closeEditor);
$('saveButton').addEventListener('click', saveNote);
$('deleteButton').addEventListener('click', deleteNote);
els.pin.addEventListener('click', () => { state.draftPinned = !state.draftPinned; els.pin.classList.toggle('active', state.draftPinned); });
els.noteLabel.addEventListener('change', updateEditorDot);
els.modal.addEventListener('mousedown', event => { if (event.target === els.modal) closeEditor(); });
els.search.addEventListener('input', event => { state.query = event.target.value.trim(); render(); });
$('sortSelect').addEventListener('change', event => { state.sort = event.target.value; render(); });
document.querySelectorAll('[data-view]').forEach(button => button.addEventListener('click', () => {
  state.view = button.dataset.view; localStorage.setItem('may-note-view', state.view);
  document.querySelectorAll('[data-view]').forEach(el => el.classList.toggle('active', el === button)); render();
}));
document.querySelectorAll('[data-view]').forEach(el => el.classList.toggle('active', el.dataset.view === state.view));
$('addLabelButton').addEventListener('click', () => {
  const name = prompt('Tên nhãn mới:')?.trim();
  if (!name || data.labels.some(l => l.name.toLowerCase() === name.toLowerCase())) return;
  const colors = ['#5d8a78', '#b46965', '#657faa', '#a8799b', '#b58d43'];
  data.labels.push({ name, color: colors[data.labels.length % colors.length], tint: '#f2f2ed' }); saveData(); render(); showToast('Đã thêm nhãn mới');
});
$('themeButton').addEventListener('click', () => {
  const dark = document.documentElement.dataset.theme !== 'dark';
  document.documentElement.dataset.theme = dark ? 'dark' : ''; localStorage.setItem('may-note-theme', dark ? 'dark' : 'light'); render();
});
$('menuButton').addEventListener('click', () => { $('sidebar').classList.add('open'); $('sidebarOverlay').classList.add('open'); });
$('sidebarClose').addEventListener('click', closeSidebar); $('sidebarOverlay').addEventListener('click', closeSidebar);
document.addEventListener('keydown', event => {
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); els.search.focus(); }
  if ((event.metaKey || event.ctrlKey) && event.key === 'Enter' && els.modal.classList.contains('open')) { event.preventDefault(); saveNote(); }
  if (event.key === 'Escape' && els.modal.classList.contains('open')) closeEditor();
  if (event.key.toLowerCase() === 'n' && !['INPUT','TEXTAREA'].includes(document.activeElement.tagName)) openEditor();
});

// Double-click a trashed note's editor header to quickly restore it.
document.querySelector('.editor-toolbar').addEventListener('dblclick', restoreNote);
document.documentElement.dataset.theme = localStorage.getItem('may-note-theme') === 'dark' ? 'dark' : '';
saveData(); render();
