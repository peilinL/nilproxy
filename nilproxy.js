export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    if (path === '/' || path === '/index.html') {
      return new Response(getHTML(), {
        headers: {
          'Content-Type': 'text/html',
          'Cache-Control': 'no-cache, no-store, must-revalidate'
        }
      });
    }

    if (path === '/proxy') {
      if (request.method === 'OPTIONS') {
        return new Response(null, {
          status: 204,
          headers: corsHeaders()
        });
      }

      return proxyRequest(url, env);
    }

    return new Response('Not found', { status: 404 });
  }
};

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,HEAD,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '600'
  };
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders()
    }
  });
}

function allowedHosts(env) {
  return new Set(
    String(env.ALLOWED_HOSTS || '')
      .split(',')
      .map(host => host.trim().toLowerCase())
      .filter(Boolean)
  );
}

function parseTarget(rawUrl) {
  const normalizedUrl = normalizeTargetUrl(rawUrl);
  let target;

  try {
    target = new URL(normalizedUrl);
  } catch {
    return null;
  }

  if (target.protocol !== 'http:' && target.protocol !== 'https:') {
    return null;
  }

  return target;
}

function normalizeTargetUrl(rawUrl) {
  const value = String(rawUrl || '').trim();

  if (!value) {
    return '';
  }

  if (/^https?:\/\//i.test(value)) {
    return value;
  }

  if (/^[a-z][a-z0-9+.-]*:/i.test(value)) {
    return value;
  }

  return `https://${value}`;
}

async function proxyRequest(url, env) {
  const target = parseTarget(url.searchParams.get('url') || '');

  if (!target) {
    return json({ error: 'Enter a valid http or https URL.' }, 400);
  }

  const hosts = allowedHosts(env);

  if (hosts.size === 0) {
    return json({ error: 'Set ALLOWED_HOSTS in wrangler.jsonc before using the proxy.' }, 500);
  }

  if (!hosts.has(target.hostname.toLowerCase())) {
    return json({ error: 'This host is not in ALLOWED_HOSTS.' }, 403);
  }

  const upstream = await fetch(target.href, { redirect: 'follow' });
  const headers = new Headers(upstream.headers);

  for (const [name, value] of Object.entries(corsHeaders())) {
    headers.set(name, value);
  }

  headers.delete('Content-Security-Policy');
  headers.delete('X-Frame-Options');
  headers.delete('Frame-Options');

  return new Response(upstream.body, {
    status: upstream.status,
    headers
  });
}

function getHTML() {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Unblocked Browser</title>
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    body { 
      font-family: system-ui, sans-serif; 
      background: #0a0a0f; 
      height: 100vh; 
      overflow: hidden;
      color: #e0e0e0;
    }
    #toolbar {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      z-index: 100;
      background: #1a1a2e;
      padding: 8px 16px;
      display: flex;
      gap: 6px;
      align-items: center;
      box-shadow: 0 2px 8px rgba(0,0,0,0.3);
      flex-wrap: wrap;
    }
    #toolbar .logo {
      color: #6c63ff;
      font-weight: 600;
      font-size: 13px;
      white-space: nowrap;
    }
    #url-bar {
      flex: 1;
      min-width: 120px;
      padding: 6px 12px;
      border: 1px solid #333;
      border-radius: 16px;
      font-size: 13px;
      outline: none;
      background: #2a2a40;
      color: #e0e0e0;
    }
    #url-bar:focus {
      border-color: #6c63ff;
      background: #333350;
    }
    #url-bar::placeholder {
      color: #888;
    }
    #toolbar button {
      padding: 6px 12px;
      background: #2a2a4a;
      border: none;
      border-radius: 16px;
      color: #e0e0e0;
      font-weight: 500;
      cursor: pointer;
      font-size: 12px;
      white-space: nowrap;
      transition: background 0.2s;
    }
    #toolbar button:hover {
      background: #3a3a5a;
    }
    #toolbar button.primary {
      background: #6c63ff;
      color: white;
    }
    #toolbar button.primary:hover {
      background: #7b73ff;
    }
    #toolbar button.export {
      background: #f5a623;
      color: #1a1a2e;
      font-weight: 700;
      box-shadow: 0 0 12px rgba(245, 166, 35, 0.3);
    }
    #toolbar button.export:hover {
      background: #f7c948;
      box-shadow: 0 0 20px rgba(245, 166, 35, 0.5);
      transform: scale(1.05);
    }
    #export-panel {
      display: none;
      position: fixed;
      top: 55px;
      right: 16px;
      z-index: 200;
      background: #1a1a2e;
      border: 1px solid #f5a623;
      border-radius: 12px;
      padding: 20px 24px;
      min-width: 300px;
      max-width: 380px;
      box-shadow: 0 8px 32px rgba(0,0,0,0.7);
      animation: slideIn 0.25s ease-out;
    }
    @keyframes slideIn {
      from { opacity: 0; transform: translateY(-10px); }
      to { opacity: 1; transform: translateY(0); }
    }
    #export-panel.show {
      display: block;
    }
    #export-panel .panel-title {
      color: #f5a623;
      font-size: 16px;
      font-weight: 600;
      margin-bottom: 14px;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    #export-panel label {
      display: block;
      font-size: 12px;
      color: #aaa;
      margin-bottom: 4px;
      margin-top: 12px;
    }
    #export-panel label:first-of-type {
      margin-top: 0;
    }
    #export-panel input {
      width: 100%;
      padding: 8px 12px;
      background: #2a2a40;
      border: 1px solid #444;
      border-radius: 8px;
      color: #e0e0e0;
      font-size: 13px;
      outline: none;
      transition: border-color 0.2s;
    }
    #export-panel input:focus {
      border-color: #f5a623;
    }
    #export-panel .actions {
      display: flex;
      gap: 10px;
      margin-top: 16px;
      flex-wrap: wrap;
    }
    #export-panel .actions button {
      flex: 1;
      padding: 8px 14px;
      border: none;
      border-radius: 8px;
      cursor: pointer;
      font-weight: 600;
      font-size: 12px;
      min-width: 70px;
      transition: all 0.2s;
    }
    #export-panel .actions .save-btn {
      background: #2d8a4e;
      color: white;
    }
    #export-panel .actions .save-btn:hover {
      background: #3aa85e;
    }
    #export-panel .actions .private-btn {
      background: #0f766e;
      color: white;
    }
    #export-panel .actions .private-btn:hover {
      background: #11998a;
    }
    #export-panel .actions .tab-btn {
      background: #6c63ff;
      color: white;
    }
    #export-panel .actions .tab-btn:hover {
      background: #7b73ff;
    }
    #export-panel .actions .close-btn {
      background: #444;
      color: #e0e0e0;
      flex: 0.4;
    }
    #export-panel .actions .close-btn:hover {
      background: #555;
    }
    #frame-container {
      position: fixed;
      top: 50px;
      left: 0;
      right: 0;
      bottom: 0;
      background: #111;
    }
    #content-frame {
      width: 100%;
      height: 100%;
      border: none;
      background: white;
    }
    #loading {
      display: none;
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      color: #f5a623;
      font-size: 16px;
      z-index: 50;
      background: rgba(10,10,15,0.9);
      padding: 16px 32px;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.5);
    }
    #status-bar {
      position: fixed;
      bottom: 0;
      left: 0;
      right: 0;
      z-index: 100;
      background: rgba(26,26,46,0.95);
      padding: 4px 16px;
      color: #888;
      font-size: 11px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      height: 24px;
    }
    #status-bar .url-display {
      opacity: 0.7;
      font-family: monospace;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      max-width: 55%;
    }
    #status-bar .status-text {
      display: flex;
      gap: 12px;
      align-items: center;
    }
    .badge {
      background: rgba(255,255,255,0.1);
      padding: 2px 10px;
      border-radius: 12px;
      font-size: 10px;
    }
  </style>
</head>
<body>
  <div id="toolbar">
    <span class="logo">🔒 Proxy</span>
    <input id="url-bar" type="text" placeholder="Enter URL" spellcheck="false" autofocus>
    <button id="go-btn" class="primary" type="button">Go</button>
    <button id="export-btn" class="export" type="button">📦 Export</button>
    <button id="cloak-btn" type="button">🛡️ Cloak</button>
    <button id="back-btn" type="button">←</button>
    <button id="forward-btn" type="button">→</button>
    <button id="refresh-btn" type="button">↻</button>
  </div>

  <div id="export-panel">
    <div class="panel-title">📦 Export Options</div>
    <label>📄 Launcher File Name (without .html)</label>
    <input id="file-name-input" type="text" placeholder="my_page">
    <label>🏷️ Launcher Tab Name</label>
    <input id="tab-title-input" type="text" placeholder="Inbox">
    <label>🔗 URL to Open</label>
    <input id="tab-url-input" type="text" placeholder="https://example.com">
    <div class="actions">
      <button class="save-btn" id="save-file-btn" type="button">💾 Save File</button>
      <button class="private-btn" id="private-launcher-btn" type="button">🔐 Private Launcher</button>
      <button class="tab-btn" id="open-tab-btn" type="button">📂 Open Tab</button>
      <button class="close-btn" id="close-export-btn" type="button">✕</button>
    </div>
  </div>

  <div id="loading">Loading...</div>

  <div id="frame-container">
    <iframe id="content-frame" sandbox="allow-scripts allow-forms allow-same-origin allow-popups"></iframe>
  </div>

  <div id="status-bar">
    <span class="url-display" id="current-url">Ready</span>
    <span class="status-text">
      <span class="badge">📄 HTML</span>
      <span>🛡️ Proxy active</span>
    </span>
  </div>

  <script>
    (function() {
      console.log('Proxy script loaded');
      
      const frame = document.getElementById('content-frame');
      const urlBar = document.getElementById('url-bar');
      const goBtn = document.getElementById('go-btn');
      const exportBtn = document.getElementById('export-btn');
      const cloakBtn = document.getElementById('cloak-btn');
      const backBtn = document.getElementById('back-btn');
      const forwardBtn = document.getElementById('forward-btn');
      const refreshBtn = document.getElementById('refresh-btn');
      const loading = document.getElementById('loading');
      const currentUrlDisplay = document.getElementById('current-url');

      const exportPanel = document.getElementById('export-panel');
      const fileNameInput = document.getElementById('file-name-input');
      const tabTitleInput = document.getElementById('tab-title-input');
      const tabUrlInput = document.getElementById('tab-url-input');
      const saveFileBtn = document.getElementById('save-file-btn');
      const privateLauncherBtn = document.getElementById('private-launcher-btn');
      const openTabBtn = document.getElementById('open-tab-btn');
      const closeExportBtn = document.getElementById('close-export-btn');

      let historyStack = [];
      let historyIndex = -1;
      let currentUrl = '';
      let currentHtml = '';
      let currentPageTitle = '';

      const CORS_PROXY = '/proxy?url=';

      const escapeHTML = (value) => String(value)
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;');

      const proxyUrlFor = (targetUrl) => CORS_PROXY + encodeURIComponent(targetUrl);

      const proxiedAttribute = (attr, value, targetUrl) => {
        const trimmed = value.trim();

        if (
          !trimmed ||
          trimmed.startsWith('#') ||
          trimmed.startsWith('javascript:') ||
          trimmed.startsWith('data:') ||
          trimmed.startsWith('mailto:') ||
          trimmed.startsWith('tel:')
        ) {
          return attr + '="' + escapeHTML(value) + '"';
        }

        try {
          return attr + '="' + proxyUrlFor(new URL(trimmed, targetUrl).href) + '"';
        } catch {
          return attr + '="' + escapeHTML(value) + '"';
        }
      };

      const showFrameError = (message) => {
        frame.srcdoc = '<div style="color:#f87171;background:#111827;min-height:100%;padding:40px;font-family:system-ui;font-size:16px;line-height:1.5;">' + escapeHTML(message) + '</div>';
      };

      const safeFilename = (value) => {
        const normalized = String(value || 'website')
          .trim()
          .replace(/^https?:\\/\\//i, '')
          .replace(/^www\\./i, '')
          .replace(/[^a-z0-9._-]+/gi, '_')
          .replace(/^_+|_+$/g, '')
          .substring(0, 70);

        return normalized || 'website';
      };

      const buildChromebookFile = (targetUrl, title) => {
        const safeTitle = escapeHTML(title || new URL(targetUrl).hostname || 'Website');
        const safeUrl = escapeHTML(targetUrl);

        return '<!doctype html>\\n' +
          '<html lang="en">\\n' +
          '<head>\\n' +
          '<meta charset="utf-8">\\n' +
          '<meta name="viewport" content="width=device-width,initial-scale=1">\\n' +
          '<title>' + safeTitle + '</title>\\n' +
          '<style>html,body{height:100%;margin:0;background:#fff}iframe{width:100%;height:100%;border:0}main{display:none;font:16px system-ui,-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;padding:24px;color:#0f172a}a{color:#4f46e5;overflow-wrap:anywhere}@supports not (display:grid){main{display:block}}</style>\\n' +
          '</head>\\n' +
          '<body>\\n' +
          '<iframe src="' + safeUrl + '" referrerpolicy="no-referrer"></iframe>\\n' +
          '<main><p>Open <a href="' + safeUrl + '" rel="noopener noreferrer">' + safeUrl + '</a></p></main>\\n' +
          '</body>\\n' +
          '</html>';
      };

      const buildPrivateLauncherFile = (targetUrl, title) => {
        const safeTitle = escapeHTML(title || 'Inbox');
        const safeUrl = escapeHTML(targetUrl);
        const icon = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="#f8fafc"/><path fill="#2563eb" d="M12 18h40a4 4 0 0 1 4 4v20a4 4 0 0 1-4 4H12a4 4 0 0 1-4-4V22a4 4 0 0 1 4-4z"/><path fill="#eff6ff" d="M12 23.5 32 36l20-12.5V28L32 40.5 12 28z"/></svg>');

        return '<!doctype html>\\n' +
          '<html lang="en">\\n' +
          '<head>\\n' +
          '<meta charset="utf-8">\\n' +
          '<meta name="viewport" content="width=device-width,initial-scale=1">\\n' +
          '<meta name="referrer" content="no-referrer">\\n' +
          '<link rel="icon" href="' + icon + '">\\n' +
          '<title>' + safeTitle + '</title>\\n' +
          '<style>html,body{height:100%;margin:0;background:#0b1120;color:#e5e7eb;font:16px system-ui,-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif}main{min-height:100%;display:grid;place-items:center;padding:24px;text-align:center}a{color:#5eead4;overflow-wrap:anywhere}.box{max-width:720px}.title{font-size:20px;font-weight:700;margin-bottom:10px}.hint{color:#94a3b8}</style>\\n' +
          '</head>\\n' +
          '<body>\\n' +
          '<main><div class="box"><div class="title">' + safeTitle + '</div><p class="hint">Opening your selected page.</p><p><a href="' + safeUrl + '" rel="noopener noreferrer">Open now</a></p></div></main>\\n' +
          '<script>location.replace(' + JSON.stringify(targetUrl) + ');<\\/script>\\n' +
          '</body>\\n' +
          '</html>';
      };

      const proxyFetch = async (targetUrl, options = {}) => {
        const pushHistory = options.pushHistory !== false;
        console.log('proxyFetch called with:', targetUrl);
        if (!targetUrl) return;
        
        loading.style.display = 'block';
        currentUrlDisplay.textContent = 'Loading: ' + targetUrl;
        
        try {
          const proxyUrl = proxyUrlFor(targetUrl);
          console.log('Fetching from proxy:', proxyUrl);
          
          const response = await fetch(proxyUrl);
          const contentType = response.headers.get('content-type') || '';
          
          if (!response.ok) {
            if (contentType.includes('application/json')) {
              const data = await response.json();
              throw new Error(data.error || ('HTTP ' + response.status));
            }

            throw new Error('HTTP ' + response.status + ': ' + response.statusText);
          }
          
          const html = await response.text();
          console.log('Got HTML, length:', html.length);
          currentHtml = html;
          
          const titleMatch = html.match(/<title[^>]*>([^<]*)<\\/title>/i);
          currentPageTitle = titleMatch ? titleMatch[1].trim() : 'Untitled';
          
          const rewritten = html.replace(
            /(href|src|action)=["']([^"']*)["']/gi,
            (match, attr, value) => {
              return proxiedAttribute(attr, value, targetUrl);
            }
          );
          
          frame.srcdoc = rewritten;
          
          currentUrl = targetUrl;
          currentUrlDisplay.textContent = targetUrl;
          urlBar.value = targetUrl;
          
          const sanitizedTitle = currentPageTitle.replace(/[^a-z0-9]/gi, '_').substring(0, 50) || 'page';
          fileNameInput.value = sanitizedTitle;
          tabTitleInput.value = currentPageTitle;
          tabUrlInput.value = targetUrl;
          
          if (pushHistory) {
            if (historyIndex < historyStack.length - 1) {
              historyStack = historyStack.slice(0, historyIndex + 1);
            }

            if (historyStack[historyStack.length - 1] !== targetUrl) {
              historyStack.push(targetUrl);
            }

            historyIndex = historyStack.length - 1;
          }
          
          console.log('Page loaded successfully');
          
        } catch (err) {
          console.error('proxyFetch error:', err);
          currentHtml = '';
          currentPageTitle = 'Error';
          showFrameError('Error: ' + err.message);
          currentUrlDisplay.textContent = 'Error: ' + err.message;
        } finally {
          loading.style.display = 'none';
        }
      };

      const downloadChromebookFile = (filename, urlToOpen, title) => {
        const normalized = normalizeUrl(urlToOpen || currentUrl || urlBar.value);

        if (!normalized) {
          alert('Enter a valid http or https URL to export.');
          return;
        }

        let target;

        try {
          target = new URL(normalized);
        } catch {
          alert('Enter a valid http or https URL to export.');
          return;
        }

        if (target.protocol !== 'http:' && target.protocol !== 'https:') {
          alert('Enter a valid http or https URL to export.');
          return;
        }

        const finalTitle = title || currentPageTitle || target.hostname || 'Website';
        const finalFilename = safeFilename(filename || finalTitle || normalized);
        const html = buildChromebookFile(target.href, finalTitle);
        const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = finalFilename + '.html';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        currentUrlDisplay.textContent = 'Downloaded Chromebook file: ' + finalFilename + '.html';
      };

      const downloadPrivateLauncherFile = (filename, urlToOpen, title) => {
        const normalized = normalizeUrl(urlToOpen || currentUrl || urlBar.value);

        if (!normalized) {
          alert('Enter a valid http or https URL to export.');
          return;
        }

        let target;

        try {
          target = new URL(normalized);
        } catch {
          alert('Enter a valid http or https URL to export.');
          return;
        }

        if (target.protocol !== 'http:' && target.protocol !== 'https:') {
          alert('Enter a valid http or https URL to export.');
          return;
        }

        const finalTitle = title || 'Inbox';
        const finalFilename = safeFilename(filename || finalTitle || normalized);
        const html = buildPrivateLauncherFile(target.href, finalTitle);
        const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = finalFilename + '.html';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        currentUrlDisplay.textContent = 'Downloaded private launcher: ' + finalFilename + '.html';
      };

      const openAsTab = (title, urlToOpen) => {
        if (!currentHtml && !urlToOpen) {
          alert('No page loaded and no URL provided.');
          return;
        }

        const finalTitle = title || currentPageTitle || 'New Tab';
        const finalUrl = normalizeUrl(urlToOpen || currentUrl || '');
        const params = new URLSearchParams({ url: finalUrl || '', title: finalTitle });
        const w = finalUrl ? window.open(window.location.origin + '/?' + params.toString(), '_blank') : null;

        if (!w) {
          alert('Pop-up blocked. Allow pop-ups for this site.');
          return;
        }

        currentUrlDisplay.textContent = 'Opened as tab: ' + finalTitle;
      };

      const normalizeUrl = (input) => {
        let url = input.trim();
        if (!url) return null;
        
        if (url.includes(' ') || (!url.includes('.') && !url.includes('/') && !url.includes(':'))) {
          return 'https://www.google.com/search?q=' + encodeURIComponent(url);
        }
        
        if (!url.match(/^https?:\\/\\//i)) {
          url = 'https://' + url;
        }
        return url;
      };

      const loadUrl = () => {
        console.log('loadUrl called, value:', urlBar.value);
        const normalized = normalizeUrl(urlBar.value);
        console.log('normalized:', normalized);
        if (normalized) {
          proxyFetch(normalized);
        } else {
          console.log('Normalization returned null');
        }
      };

      const goBack = () => {
        if (historyIndex > 0) {
          historyIndex--;
          const url = historyStack[historyIndex];
          urlBar.value = url;
          proxyFetch(url, { pushHistory: false });
        }
      };

      const goForward = () => {
        if (historyIndex < historyStack.length - 1) {
          historyIndex++;
          const url = historyStack[historyIndex];
          urlBar.value = url;
          proxyFetch(url, { pushHistory: false });
        }
      };

      const refresh = () => {
        if (currentUrl) {
          proxyFetch(currentUrl, { pushHistory: false });
        }
      };

      const openCloaked = () => {
        const url = urlBar.value.trim();
        if (!url) return;
        const normalized = normalizeUrl(url);
        if (!normalized) return;
        
        const launchTitle = tabTitleInput.value.trim() || currentPageTitle || document.title || 'New Tab';
        const params = new URLSearchParams({ url: normalized, title: launchTitle });
        const launchUrl = window.location.origin + '/?' + params.toString();
        const w = window.open(launchUrl, '_blank');
        if (!w) {
          alert('Pop-up blocked. Allow pop-ups for this site.');
          return;
        }
      };

      const toggleExportPanel = () => {
        exportPanel.classList.toggle('show');
        if (exportPanel.classList.contains('show')) {
          fileNameInput.value = currentPageTitle.replace(/[^a-z0-9]/gi, '_').substring(0, 50) || 'page';
          tabTitleInput.value = currentPageTitle || 'New Tab';
          tabUrlInput.value = currentUrl || '';
        }
      };

      // Debug: log all click events
      document.addEventListener('click', function(e) {
        console.log('Click detected on:', e.target.tagName, e.target.id, e.target.className);
      });

      console.log('Setting up event listeners');
      
      urlBar.addEventListener('keydown', function(e) {
        console.log('keydown on url-bar:', e.key);
        if (e.key === 'Enter') {
          console.log('Enter pressed, calling loadUrl');
          loadUrl();
        }
      });

      goBtn.addEventListener('click', function(e) {
        console.log('goBtn clicked');
        loadUrl();
      });

      exportBtn.addEventListener('click', function(e) {
        console.log('exportBtn clicked');
        toggleExportPanel();
      });
      
      cloakBtn.addEventListener('click', function(e) {
        console.log('cloakBtn clicked');
        openCloaked();
      });
      
      backBtn.addEventListener('click', function(e) {
        console.log('backBtn clicked');
        goBack();
      });
      
      forwardBtn.addEventListener('click', function(e) {
        console.log('forwardBtn clicked');
        goForward();
      });
      
      refreshBtn.addEventListener('click', function(e) {
        console.log('refreshBtn clicked');
        refresh();
      });

      saveFileBtn.addEventListener('click', function(e) {
        console.log('saveFileBtn clicked');
        const filename = fileNameInput.value.trim() || currentPageTitle || 'page';
        const title = tabTitleInput.value.trim() || currentPageTitle || 'Website';
        const url = tabUrlInput.value.trim() || currentUrl || urlBar.value.trim();
        downloadChromebookFile(filename, url, title);
        exportPanel.classList.remove('show');
      });

      privateLauncherBtn.addEventListener('click', function(e) {
        console.log('privateLauncherBtn clicked');
        const filename = fileNameInput.value.trim() || currentPageTitle || 'private_launcher';
        const title = tabTitleInput.value.trim() || 'Inbox';
        const url = tabUrlInput.value.trim() || currentUrl || urlBar.value.trim();
        downloadPrivateLauncherFile(filename, url, title);
        exportPanel.classList.remove('show');
      });

      openTabBtn.addEventListener('click', function(e) {
        console.log('openTabBtn clicked');
        const title = tabTitleInput.value.trim() || currentPageTitle || 'New Tab';
        const url = tabUrlInput.value.trim() || currentUrl || '';
        openAsTab(title, url);
        exportPanel.classList.remove('show');
      });

      closeExportBtn.addEventListener('click', function(e) {
        console.log('closeExportBtn clicked');
        exportPanel.classList.remove('show');
      });

      document.addEventListener('click', function(e) {
        if (exportPanel.classList.contains('show')) {
          if (!exportPanel.contains(e.target) && e.target !== exportBtn) {
            exportPanel.classList.remove('show');
          }
        }
      });

      window.addEventListener('message', function(e) {
        if (e.data && e.data.type === 'navigate') {
          const normalized = normalizeUrl(e.data.url);
          if (normalized) {
            urlBar.value = normalized;
            proxyFetch(normalized);
          }
        }
      });

      console.log('All event listeners set up');
      
      const startupParams = new URLSearchParams(window.location.search);
      const startupTitle = startupParams.get('title');
      if (startupTitle) {
        document.title = startupTitle;
      }

      const startupUrl = startupParams.get('url') || 'example.com';
      urlBar.value = startupUrl;
      console.log('Loading startup page:', startupUrl);
      setTimeout(loadUrl, 500);
    })();
  </script>
</body>
</html>`;
}
