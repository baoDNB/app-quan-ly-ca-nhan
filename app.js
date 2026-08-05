const modules = {
  time: { url: "/apps/time/", title: "Nhịp — Quản lý thời gian" },
  notes: { url: "/apps/notes/", title: "Mây Note — Ghi chú" },
  expenses: { url: "/apps/expenses/", title: "Ví Nhỏ — Quản lý chi tiêu" }
};
const frame = document.querySelector("#app-frame");
const loading = document.querySelector("#loading");
const buttons = [...document.querySelectorAll("[data-module]")];
function selectModule(key, updateHash = true) {
  const selected = modules[key] ? key : "time";
  const module = modules[selected];
  buttons.forEach((button) => { const active = button.dataset.module === selected; button.classList.toggle("active", active); button.setAttribute("aria-current", active ? "page" : "false"); });
  frame.classList.remove("ready"); loading.classList.remove("hidden"); frame.title = module.title;
  if (frame.getAttribute("src") !== module.url) frame.src = module.url;
  document.title = `${module.title} | Nhà`;
  localStorage.setItem("nha.activeModule", selected);
  if (updateHash && location.hash !== `#${selected}`) history.pushState(null, "", `#${selected}`);
}
frame.addEventListener("load", () => { frame.classList.add("ready"); loading.classList.add("hidden"); });
buttons.forEach((button) => button.addEventListener("click", () => selectModule(button.dataset.module)));
window.addEventListener("hashchange", () => selectModule(location.hash.slice(1), false));
document.querySelector("#today").textContent = new Intl.DateTimeFormat("vi-VN", { weekday: "long", day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date());
selectModule(location.hash.slice(1) || localStorage.getItem("nha.activeModule") || "time", false);
