const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const { spawn } = require("node:child_process");
const requestedPort = process.argv.slice(2).find((argument) => /^\d+$/.test(argument));
const port = Number(process.env.PORT || requestedPort || 4320);
const appRoot = __dirname;
const routes = [{ prefix: "/", root: appRoot }];
const types = { ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".mjs": "text/javascript; charset=utf-8", ".json": "application/json; charset=utf-8", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp", ".ico": "image/x-icon" };
function resolveRequest(url) {
  const pathname = decodeURIComponent(url.split("?")[0]);
  const route = routes.find((item) => pathname.startsWith(item.prefix));
  if (!route) return null;
  let relative = pathname.slice(route.prefix.length);
  if (!relative || relative.endsWith("/")) relative += "index.html";
  const file = path.resolve(route.root, relative);
  const relation = path.relative(route.root, file);
  if (relation.startsWith("..") || path.isAbsolute(relation)) return null;
  return file;
}
const server = http.createServer((request, response) => {
  const file = resolveRequest(request.url || "/");
  if (!file) { response.writeHead(403, { "Content-Type": "text/plain; charset=utf-8" }); response.end("Không được phép"); return; }
  fs.readFile(file, (error, data) => {
    if (error) { response.writeHead(error.code === "ENOENT" ? 404 : 500, { "Content-Type": "text/plain; charset=utf-8" }); response.end(error.code === "ENOENT" ? "Không tìm thấy" : "Không thể đọc tệp"); return; }
    response.writeHead(200, { "Content-Type": types[path.extname(file).toLowerCase()] || "application/octet-stream" }); response.end(data);
  });
});
server.listen(port, "127.0.0.1", () => {
  const url = `http://127.0.0.1:${port}`;
  console.log(`App quản lý cá nhân đang chạy tại ${url}`);
  if (!process.argv.includes("--no-open")) spawn("cmd", ["/c", "start", "", url], { detached: true, stdio: "ignore", windowsHide: true }).unref();
});

module.exports = server;
