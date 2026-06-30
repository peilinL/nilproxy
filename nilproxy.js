export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    // Serve the HTML interface at the root
    if (path === '/' || path === '/index.html') {
      return new Response(getHTML(), {
        headers: { 
          'Content-Type': 'text/html',
          'Cache-Control': 'no-cache, no-store, must-revalidate'
        }
      });
    }

    return new Response('Not found', { status: 404 });
  }
};

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
    <button id="go-btn" class="primary">Go</button>
    <button id="export-btn" class="export">📦 Export</button>
    <button id="cloak-btn">🛡️ Cloak</button>
    <button id="back-btn">←</button>
    <button id="forward-btn">→</button>
    <button id="refresh-btn">↻</button>
  </div>

  <div id="export-panel">
    <div class="panel-title">📦 Export Options</div>
    <label>📄 File Name (without .html)</label>
    <input id="file-name-input" type="text" placeholder="my_page">
    <label>🏷️ Tab Title</label>
    <input id="tab-title-input" type="text" placeholder="My Custom Tab">
    <label>🔗 URL to Open (optional)</label>
    <input id="tab-url-input" type="text" placeholder="https://example.com">
    <div class="actions">
      <button class="save-btn" id="save-file-btn">💾 Save File</button>
      <button class="tab-btn" id="open-tab-btn">📂 Open Tab</button>
      <button class="close-btn" id="close-export-btn">✕</button>
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
      const openTabBtn = document.getElementById('open-tab-btn');
      const closeExportBtn = document.getElementById('close-export-btn');

      let historyStack = [];
      let historyIndex = -1;
      let currentUrl = '';
      let currentHtml = '';
      let currentPageTitle = '';

      const CORS_PROXY = 'https://api.allorigins.win/raw?url=';

      const proxyFetch = async (targetUrl) => {
        console.log('proxyFetch called with:', targetUrl);
        if (!targetUrl) return;
        
        loading.style.display = 'block';
        currentUrlDisplay.textContent = 'Loading: ' + targetUrl;
        
        try {
          const proxyUrl = CORS_PROXY + encodeURIComponent(targetUrl);
          console.log('Fetching from proxy:', proxyUrl);
          
          const response = await fetch(proxyUrl);
          
          if (!response.ok) {
            throw new Error('HTTP ' + response.status + ': ' + response.statusText);
          }
          
          const html = await response.text();
          console.log('Got HTML, length:', html.length);
          currentHtml = html;
          
          const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i);
          currentPageTitle = titleMatch ? titleMatch[1].trim() : 'Untitled';
          
          const rewritten = html.replace(
            /(href|src|action)=["']([^"']*)["']/gi,
            (match, attr, value) => {
              if (value.startsWith('http') || value.startsWith('//')) {
                const full = value.startsWith('//') ? 'https:' + value : value;
                return attr + '="' + CORS_PROXY + encodeURIComponent(full) + '"';
              } else if (value.startsWith('/')) {
                const base = new URL(targetUrl).origin;
                return attr + '="' + CORS_PROXY + encodeURIComponent(base + value) + '"';
              } else if (!value.startsWith('javascript:') && !value.startsWith('data:')) {
                const base = new URL(targetUrl).origin;
                const fixed = value.startsWith('./') ? value.slice(1) : value;
                return attr + '="' + CORS_PROXY + encodeURIComponent(base + '/' + fixed) + '"';
              }
              return match;
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
          
          if (historyIndex < historyStack.length - 1) {
            historyStack = historyStack.slice(0, historyIndex + 1);
          }
          historyStack.push(targetUrl);
          historyIndex = historyStack.length - 1;
          
          console.log('Page loaded successfully');
          
        } catch (err) {
          console.error('proxyFetch error:', err);
          currentHtml = '';
          currentPageTitle = 'Error';
          frame.srcdoc = '<div style="color:red;padding:40px;font-family:system-ui;font-size:16px;">Error: ' + err.message + '</div>';
          currentUrlDisplay.textContent = 'Error: ' + err.message;
        } finally {
          loading.style.display = 'none';
        }
      };

      const downloadCurrentPage = (filename) => {
        if (!currentHtml) {
          alert('No page loaded. Load a URL first.');
          return;
        }

        const safeFilename = (filename || currentPageTitle || 'page')
          .replace(/[^a-z0-9]/gi, '_')
          .substring(0, 50) || 'downloaded_page';
        
        const blob = new Blob([currentHtml], { type: 'text/html;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = safeFilename + '.html';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        currentUrlDisplay.textContent = 'Downloaded: ' + safeFilename + '.html';
      };

      const openAsTab = (title, urlToOpen) => {
        if (!currentHtml && !urlToOpen) {
          alert('No page loaded and no URL provided.');
          return;
        }

        let finalTitle = title || currentPageTitle || 'New Tab';
        let finalUrl = urlToOpen || currentUrl || '';

        if (urlToOpen && urlToOpen !== currentUrl) {
          const w = window.open('about:blank');
          if (!w) {
            alert('Pop-up blocked. Allow pop-ups for this site.');
            return;
          }
          w.document.write(\`
            <!DOCTYPE html>
            <html>
            <head>
              <title>\${finalTitle}</title>
              <style>
                body { margin:0; overflow:hidden; background:#0a0a0f; }
                iframe { width:100%; height:100%; border:none; }
              </style>
            </head>
            <body>
              <iframe src="\${window.location.origin}/?url=\${encodeURIComponent(urlToOpen)}"></iframe>
            </body>
            </html>
          \`);
          w.document.close();
          return;
        }

        const w = window.open('about:blank');
        if (!w) {
          alert('Pop-up blocked. Allow pop-ups for this site.');
          return;
        }
        
        const customHtml = currentHtml.replace(
          /<title[^>]*>([^<]*)<\/title>/i,
          '<title>' + finalTitle + '</title>'
        );
        
        w.document.write(customHtml);
        w.document.close();
        
        currentUrlDisplay.textContent = 'Opened as tab: ' + finalTitle;
      };

      const normalizeUrl = (input) => {
        let url = input.trim();
        if (!url) return null;
        
        if (url.includes(' ') || (!url.includes('.') && !url.includes('/') && !url.includes(':'))) {
          return 'https://www.google.com/search?q=' + encodeURIComponent(url);
        }
        
        if (!url.match(/^https?:\/\//i)) {
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
          proxyFetch(url);
        }
      };

      const goForward = () => {
        if (historyIndex < historyStack.length - 1) {
          historyIndex++;
          const url = historyStack[historyIndex];
          urlBar.value = url;
          proxyFetch(url);
        }
      };

      const refresh = () => {
        if (currentUrl) {
          proxyFetch(currentUrl);
        }
      };

      const openCloaked = () => {
        const url = urlBar.value.trim();
        if (!url) return;
        const normalized = normalizeUrl(url);
        if (!normalized) return;
        
        const w = window.open('about:blank');
        if (!w) {
          alert('Pop-up blocked. Allow pop-ups for this site.');
          return;
        }
        w.document.write(\`
          <!DOCTYPE html>
          <html>
          <head><title></title></head>
          <body style="margin:0;overflow:hidden;">
            <iframe src="\${window.location.origin}/" 
                    style="width:100%;height:100%;border:none;">
            </iframe>
          </body>
          </html>
        \`);
        w.document.close();
        setTimeout(() => {
          w.postMessage({ type: 'navigate', url: normalized }, '*');
        }, 500);
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
        downloadCurrentPage(filename);
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
      
      // Load default page
      urlBar.value = 'example.com';
      console.log('Loading default page: example.com');
      setTimeout(loadUrl, 500);
    })();
  </script>
</body>
</html>`;
}