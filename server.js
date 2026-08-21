const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".json": "application/json",
};

function contentType(pathname) {
  const dot = pathname.lastIndexOf(".");
  if (dot === -1) return "application/octet-stream";
  return MIME[pathname.slice(dot).toLowerCase()] ?? "application/octet-stream";
}

/** Empêche d'accéder à des fichiers hors du projet (ex: ../../etc/passwd). */
function isSafePath(pathname) {
  if (pathname.includes("\0")) return false;
  const normalized = pathname.replace(/\\/g, "/");
  if (normalized.includes("..")) return false;
  return true;
}

const server = Bun.serve({
  port: 3000,

  async fetch(request) {
    const url = new URL(request.url);
    let pathname = url.pathname;

    if (pathname === "/") pathname = "/index.html";

    if (!isSafePath(pathname)) {
      return new Response("Forbidden", { status: 403 });
    }

    // Enlève le "/" initial → chemin relatif au projet
    const filePath = pathname.slice(1);
    const file = Bun.file(filePath);

    if (await file.exists()) {
      return new Response(file, {
        headers: {
          "Content-Type": contentType(pathname),
        },
      });
    }

    return new Response("Page not found", { status: 404 });
  },
});

console.log(`Site disponible sur http://localhost:${server.port}`);
