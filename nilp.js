const http = require("node:http");
const https = require("node:https");
const net = require("node:net");
const dns = require("node:dns/promises");
const { URL } = require("node:url");

const host = process.env.HOST || "127.0.0.1";
const port = Number(process.env.PORT || 8787);
const token = process.env.PROXY_TOKEN || "";
const corsOrigin = process.env.CORS_ORIGIN || "*";
const publicBaseUrl = normalizePublicBaseUrl(process.env.PUBLIC_BASE_URL || "");
const allowedHosts = new Set(
  (process.env.ALLOWED_HOSTS || "")
    .split(",")
    .map(value => value.trim().toLowerCase())
    .filter(Boolean)
);
const allowedMethods = new Set(["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"]);
const hopByHopHeaders = new Set([
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
  "host",
  "origin",
  "referer"
]);
const maxBodyBytes = Number(process.env.MAX_BODY_BYTES || 5 * 1024 * 1024);
const timeoutMs = Number(process.env.TIMEOUT_MS || 15000);

function createHttpError(message, statusCode) {
  return Object.assign(new Error(message), { statusCode });
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function safeFileName(value) {
  const normalized = String(value || "website")
    .trim()
    .replace(/^https?:\/\//i, "")
    .replace(/^www\./i, "")
    .replace(/[^a-z0-9._-]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);

  return normalized || "website";
}

function sendJson(res, statusCode, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(body),
    "access-control-allow-origin": corsOrigin,
    "access-control-allow-methods": "GET,HEAD,POST,PUT,PATCH,DELETE,OPTIONS",
    "access-control-allow-headers": "authorization,content-type,x-proxy-token",
    "access-control-max-age": "600",
    "vary": "origin"
  });
  res.end(res.skipBody ? undefined : body);
}

function sendHtml(res, statusCode, body, headers = {}) {
  res.writeHead(statusCode, {
    "content-type": "text/html; charset=utf-8",
    "content-length": Buffer.byteLength(body),
    "access-control-allow-origin": corsOrigin,
    "referrer-policy": "no-referrer",
    "x-content-type-options": "nosniff",
    ...headers
  });
  res.end(res.skipBody ? undefined : body);
}

function sendNoContent(res) {
  res.writeHead(204, {
    "access-control-allow-origin": corsOrigin,
    "access-control-allow-methods": "GET,HEAD,POST,PUT,PATCH,DELETE,OPTIONS",
    "access-control-allow-headers": "authorization,content-type,x-proxy-token",
    "access-control-max-age": "600",
    "vary": "origin"
  });
  res.end();
}

function parsePublicUrl(rawTarget) {
  let target;

  try {
    target = new URL(rawTarget);
  } catch {
    throw createHttpError("Invalid URL", 400);
  }

  if (!["http:", "https:"].includes(target.protocol)) {
    throw createHttpError("Only http and https URLs are supported", 400);
  }

  return target;
}

function normalizePublicBaseUrl(rawUrl) {
  if (!rawUrl) return "";

  const url = parsePublicUrl(rawUrl);
  url.pathname = "/";
  url.search = "";
  url.hash = "";

  return url.href;
}

function publicAppUrl(req) {
  if (publicBaseUrl) {
    return publicBaseUrl;
  }

  return `http://${req.headers.host || `${host}:${port}`}/`;
}

function buildChromebookFile(target, title) {
  const pageTitle = escapeHtml(title || target.hostname);
  const href = escapeHtml(target.href);

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="refresh" content="0; url=${href}">
<title>${pageTitle}</title>
<style>
html,body{height:100%;margin:0}
body{display:grid;place-items:center;font:16px system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;background:#f8fafc;color:#0f172a}
a{color:#0f766e}
</style>
</head>
<body>
<main>
<p>Opening <a href="${href}" rel="noopener noreferrer">${href}</a></p>
</main>
</body>
</html>`;
}

function buildHomePage(appUrl) {
  const escapedAppUrl = escapeHtml(appUrl);
  const publicUrlBlock = publicBaseUrl
    ? `<p>Public app URL: <a href="${escapedAppUrl}" rel="noopener noreferrer">${escapedAppUrl}</a></p>`
    : "";

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Chromebook URL File Maker</title>
<style>
*{box-sizing:border-box}
body{margin:0;min-height:100vh;display:grid;place-items:center;padding:24px;font:16px system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;background:#f8fafc;color:#0f172a}
main{width:min(720px,100%)}
h1{font-size:28px;line-height:1.1;margin:0 0 18px}
form{display:grid;gap:12px}
label{font-weight:650}
input{width:100%;border:1px solid #94a3b8;border-radius:8px;padding:12px 14px;font:inherit;background:white;color:#0f172a}
button{width:max-content;border:0;border-radius:8px;padding:11px 16px;font:700 15px system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;background:#0f766e;color:white;cursor:pointer}
button:hover{background:#115e59}
p{color:#475569;line-height:1.5}
a{color:#0f766e}
</style>
</head>
<body>
<main>
<h1>Chromebook URL File Maker</h1>
<form action="/chromebook-file" method="get">
<label for="url">Paste any website URL</label>
<input id="url" name="url" type="url" placeholder="https://example.com" required>
<input name="title" type="text" placeholder="Optional file name">
<button type="submit">Download file</button>
</form>
<p>The downloaded HTML file can live in your Chromebook Files app and opens the pasted URL in Chrome.</p>
${publicUrlBlock}
</main>
</body>
</html>`;
}

function isPrivateAddress(address) {
  if (net.isIPv4(address)) {
    const parts = address.split(".").map(Number);
    return parts[0] === 10 ||
      parts[0] === 127 ||
      (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) ||
      (parts[0] === 192 && parts[1] === 168) ||
      (parts[0] === 169 && parts[1] === 254) ||
      parts[0] === 0;
  }

  if (net.isIPv6(address)) {
    const normalized = address.toLowerCase();
    return normalized === "::1" ||
      normalized === "::" ||
      normalized.startsWith("fc") ||
      normalized.startsWith("fd") ||
      normalized.startsWith("fe80:");
  }

  return true;
}

function authorize(req) {
  if (!token) return true;
  const authorization = req.headers.authorization || "";
  return authorization === `Bearer ${token}` || req.headers["x-proxy-token"] === token;
}

function cleanRequestHeaders(headers, target) {
  const nextHeaders = {};

  for (const [name, value] of Object.entries(headers)) {
    const lowerName = name.toLowerCase();
    if (!hopByHopHeaders.has(lowerName) && value !== undefined) {
      nextHeaders[name] = value;
    }
  }

  nextHeaders.host = target.host;
  nextHeaders["x-forwarded-host"] = headers.host || "";
  nextHeaders["x-forwarded-proto"] = headers["x-forwarded-proto"] || "http";

  return nextHeaders;
}

function cleanResponseHeaders(headers) {
  const nextHeaders = {
    "access-control-allow-origin": corsOrigin,
    "access-control-expose-headers": "*",
    "vary": "origin"
  };

  for (const [name, value] of Object.entries(headers)) {
    if (!hopByHopHeaders.has(name.toLowerCase()) && value !== undefined) {
      nextHeaders[name] = value;
    }
  }

  return nextHeaders;
}

async function validateTarget(rawTarget) {
  let target;

  try {
    target = new URL(rawTarget);
  } catch {
    throw createHttpError("Invalid target URL", 400);
  }

  if (!["http:", "https:"].includes(target.protocol)) {
    throw createHttpError("Only http and https targets are allowed", 400);
  }

  const hostname = target.hostname.toLowerCase();

  if (allowedHosts.size === 0) {
    throw createHttpError("Set ALLOWED_HOSTS before starting the proxy", 500);
  }

  if (!allowedHosts.has(hostname)) {
    throw createHttpError("Target host is not allowed", 403);
  }

  const addresses = await dns.lookup(hostname, { all: true, verbatim: true });
  const blocksPrivateNetworks = process.env.ALLOW_PRIVATE_NETWORKS !== "true";

  if (blocksPrivateNetworks && addresses.some(entry => isPrivateAddress(entry.address))) {
    throw createHttpError("Target resolves to a private network address", 403);
  }

  return target;
}

function readLimitedBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let total = 0;

    req.on("data", chunk => {
      total += chunk.length;

      if (total > maxBodyBytes) {
        reject(createHttpError("Request body is too large", 413));
        req.destroy();
        return;
      }

      chunks.push(chunk);
    });

    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

async function proxy(req, res, target) {
  const body = ["GET", "HEAD"].includes(req.method) ? null : await readLimitedBody(req);
  const transport = target.protocol === "https:" ? https : http;

  const options = {
    protocol: target.protocol,
    hostname: target.hostname,
    port: target.port || (target.protocol === "https:" ? 443 : 80),
    method: req.method,
    path: `${target.pathname}${target.search}`,
    headers: cleanRequestHeaders(req.headers, target),
    timeout: timeoutMs
  };

  const upstream = transport.request(options, upstreamRes => {
    res.writeHead(upstreamRes.statusCode || 502, cleanResponseHeaders(upstreamRes.headers));
    upstreamRes.pipe(res);
  });

  upstream.on("timeout", () => upstream.destroy(createHttpError("Upstream timed out", 504)));
  upstream.on("error", error => {
    if (!res.headersSent) {
      sendJson(res, error.statusCode || 502, { error: error.message || "Proxy request failed" });
    } else {
      res.destroy(error);
    }
  });

  if (body && body.length > 0) {
    upstream.end(body);
  } else {
    upstream.end();
  }
}

const server = http.createServer(async (req, res) => {
  res.skipBody = req.method === "HEAD";

  try {
    if (req.method === "OPTIONS") {
      sendNoContent(res);
      return;
    }

    if (req.url === "/health") {
      sendJson(res, 200, { ok: true });
      return;
    }

    if (!allowedMethods.has(req.method)) {
      sendJson(res, 405, { error: "Method not allowed" });
      return;
    }

    const requestUrl = new URL(req.url, `http://${req.headers.host || "localhost"}`);

    if (requestUrl.pathname === "/") {
      sendHtml(res, 200, buildHomePage(publicAppUrl(req)));
      return;
    }

    if (requestUrl.pathname === "/chromebook-file") {
      const rawTarget = requestUrl.searchParams.get("url");

      if (!rawTarget) {
        sendJson(res, 400, { error: "Missing url parameter" });
        return;
      }

      const target = parsePublicUrl(rawTarget);
      const title = requestUrl.searchParams.get("title") || target.hostname;
      const body = buildChromebookFile(target, title);
      const filename = `${safeFileName(title || target.hostname)}.html`;

      sendHtml(res, 200, body, {
        "content-disposition": `attachment; filename="${filename}"`,
        "x-content-type-options": "nosniff"
      });
      return;
    }

    if (!authorize(req)) {
      sendJson(res, 401, { error: "Unauthorized" });
      return;
    }

    if (requestUrl.pathname !== "/proxy") {
      sendJson(res, 404, { error: "Use / or /proxy?url=https://allowed.example/path" });
      return;
    }

    const rawTarget = requestUrl.searchParams.get("url");

    if (!rawTarget) {
      sendJson(res, 400, { error: "Missing url parameter" });
      return;
    }

    const target = await validateTarget(rawTarget);
    await proxy(req, res, target);
  } catch (error) {
    if (!res.headersSent) {
      sendJson(res, error.statusCode || 500, { error: error.message || "Unexpected proxy error" });
    } else {
      res.destroy(error);
    }
  }
});

server.on("error", error => {
  console.error(`server failed to start: ${error.message}`);
  process.exitCode = 1;
});

server.listen(port, host, () => {
  const hosts = [...allowedHosts].join(", ") || "none";
  console.log(`secure proxy listening on http://${host}:${port}`);
  if (publicBaseUrl) console.log(`public URL: ${publicAppUrl({ headers: {} })}`);
  console.log(`allowed hosts: ${hosts}`);
  console.log(`auth: ${token ? "enabled" : "disabled"}`);
});
