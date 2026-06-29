export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    if (path === '/' || path === '/index.html') {
      return new Response(getCloakedApp(), {
        headers: { 
          'Content-Type': 'text/html',
          'Cache-Control': 'no-cache, no-store, must-revalidate'
        }
      });
    }

    if (path === '/cloak') {
      const target = url.searchParams.get('url');
      if (!target) {
        return new Response('Missing url', { status: 400 });
      }

      try {
        // Normalize the URL - auto-add https if missing
        let targetUrl;
        try {
          // If it doesn't have a protocol, add https
          if (!target.match(/^https?:\/\//i)) {
            targetUrl = new URL('https://' + target);
          } else {
            targetUrl = new URL(target);
          }
        } catch (e) {
          return new Response('Invalid URL: ' + target, { status: 400 });
        }

        const response = await fetch(targetUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
          }
        });

        const contentType = response.headers.get('content-type') || '';
        
        if (contentType.includes('text/html')) {
          const baseUrl = targetUrl.origin;
          const proxyBase = url.origin;

          // Rewrite ALL links to go through the proxy
          class LinkRewriter {
            constructor(attribute, baseUrl, proxyBase) {
              this.attribute = attribute;
              this.baseUrl = baseUrl;
              this.proxyBase = proxyBase;
            }
            element(element) {
              const attr = element.getAttribute(this.attribute);
              if (!attr) return;
              if (attr.startsWith('javascript:') || attr.startsWith('data:') || attr.startsWith('#')) return;
              
              let fullUrl;
              try {
                fullUrl = new URL(attr, this.baseUrl).href;
              } catch {
                return;
              }
              
              if (fullUrl.startsWith(this.proxyBase)) return;
              
              // Preserve the protocol for external links
              const proxyUrl = `${this.proxyBase}/cloak?url=${encodeURIComponent(fullUrl)}`;
              element.setAttribute(this.attribute, proxyUrl);
            }
          }

          const rewriter = new HTMLRewriter()
            .on('a', new LinkRewriter('href', baseUrl, proxyBase))
            .on('link', new LinkRewriter('href', baseUrl, proxyBase))
            .on('img', new LinkRewriter('src', baseUrl, proxyBase))
            .on('script', new LinkRewriter('src', baseUrl, proxyBase))
            .on('form', new LinkRewriter('action', baseUrl, proxyBase));

          const rewrittenResponse = rewriter.transform(response);
          
          const headers = new Headers(rewrittenResponse.headers);
          headers.set('Access-Control-Allow-Origin', '*');
          headers.delete('Content-Security-Policy');
          headers.delete('X-Frame-Options');
          headers.set('Cache-Control', 'no-cache, no-store, must-revalidate');

          // Strip monitoring scripts
          const body = await rewrittenResponse.text();
          const strippedBody = body
            .replace(/<script[^>]*src=["'][^"']*securly[^"']*["'][^>]*><\/script>/gi, '')
            .replace(/<script[^>]*>.*?securly.*?<\/script>/gis, '')
            .replace(/<script[^>]*src=["'][^"']*gaggle[^"']*["'][^>]*><\/script>/gi, '')
            .replace(/<script[^>]*>.*?gaggle.*?<\/script>/gis, '')
            .replace(/securly/gi, '')
            .replace(/gaggle/gi, '')
            .replace(/goguardian/gi, '');

          return new Response(strippedBody, {
            status: rewrittenResponse.status,
            headers: headers
          });
        }

        const headers = new Headers(response.headers);
        headers.set('Access-Control-Allow-Origin', '*');
        return new Response(response.body, {
          status: response.status,
          headers: headers
        });

      } catch (error) {
        return new Response(`Error: ${error.message}`, { 
          status: 500,
          headers: { 'Content-Type': 'text/plain' }
        });
      }
    }

    return new Response('404 Not Found', { status: 404 });
  }
};

function getCloakedApp() {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Google Classroom</title>
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    body { 
      font-family: 'Google Sans', system-ui, sans-serif; 
      background: #f8f9fa; 
      height: 100vh; 
      overflow: hidden;
    }
    #toolbar {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      z-index: 100;
      background: #1a73e8;
      padding: 10px 20px;
      display: flex;
      gap: 10px;
      align-items: center;
      box-shadow: 0 2px 8px rgba(0,0,0,0.2);
      flex-wrap: wrap;
    }
    #toolbar .logo {
      color: white;
      font-weight: 500;
      font-size: 16px;
      white-space: nowrap;
    }
    #url-bar {
      flex: 1;
      min-width: 200px;
      padding: 8px 16px;
      border: none;
      border-radius: 20px;
      font-size: 14px;
      outline: none;
      background: rgba(255,255,255,0.95);
      color: #202124;
    }
    #url-bar:focus {
      background: white;
      box-shadow: 0 0 0 2px rgba(255,255,255,0.4);
    }
    #toolbar button {
      padding: 8px 18px;
      background: rgba(255,255,255,0.2);
      border: none;
      border-radius: 20px;
      color: white;
      font-weight: 500;
      cursor: pointer;
      font-size: 13px;
      white-space: nowrap;
      transition: background 0.2s;
    }
    #toolbar button:hover {
      background: rgba(255,255,255,0.3);
    }
    #toolbar button.primary {
      background: rgba(255,255,255,0.3);
    }
    #toolbar button.primary:hover {
      background: rgba(255,255,255,0.4);
    }
    #frame-container {
      position: fixed;
      top: 56px;
      left: 0;
      right: 0;
      bottom: 0;
      background: white;
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
      color: #1a73e8;
      font-size: 16px;
      z-index: 50;
      background: rgba(255,255,255,0.95);
      padding: 16px 32px;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    }
    #status-bar {
      position: fixed;
      bottom: 0;
      left: 0;
      right: 0;
      z-index: 100;
      background: rgba(26, 115, 232, 0.95);
      padding: 4px 20px;
      color: white;
      font-size: 12px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      height: 28px;
    }
    #status-bar .url-display {
      opacity: 0.8;
      font-family: monospace;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      max-width: 70%;
    }
    #status-bar .status-text {
      opacity: 0.7;
      font-size: 11px;
    }
    .badge {
      background: rgba(255,255,255,0.15);
      padding: 2px 10px;
      border-radius: 12px;
      font-size: 10px;
      font-weight: 500;
    }
  </style>
</head>
<body>
  <div id="toolbar">
    <span class="logo">📚 Classroom</span>
    <input id="url-bar" type="text" placeholder="Search or enter URL (e.g., example.com)" spellcheck="false" autofocus>
    <button id="go-btn" class="primary">Go</button>
    <button id="cloak-btn">🛡️ Cloak</button>
    <button id="back-btn">←</button>
    <button id="forward-btn">→</button>
    <button id="refresh-btn">↻</button>
  </div>

  <div id="loading">Loading...</div>

  <div id="frame-container">
    <iframe id="content-frame" sandbox="allow-scripts allow-forms allow-same-origin allow-popups"></iframe>
  </div>

  <div id="status-bar">
    <span class="url-display" id="current-url">Ready</span>
    <span class="status-text"><span class="badge">🛡️ Secure</span> Proxy active</span>
  </div>

  <script>
    (function() {
      const frame = document.getElementById('content-frame');
      const urlBar = document.getElementById('url-bar');
      const goBtn = document.getElementById('go-btn');
      const cloakBtn = document.getElementById('cloak-btn');
      const backBtn = document.getElementById('back-btn');
      const forwardBtn = document.getElementById('forward-btn');
      const refreshBtn = document.getElementById('refresh-btn');
      const loading = document.getElementById('loading');
      const currentUrlDisplay = document.getElementById('current-url');

      let historyStack = [];
      let historyIndex = -1;
      let currentUrl = '';

      const proxyFetch = async (targetUrl) => {
        if (!targetUrl) return;
        
        loading.style.display = 'block';
        currentUrlDisplay.textContent = 'Loading: ' + targetUrl;
        
        try {
          const response = await fetch('/cloak?url=' + encodeURIComponent(targetUrl));
          if (!response.ok) throw new Error('Fetch failed: ' + response.status);
          const html = await response.text();
          frame.srcdoc = html;
          
          currentUrl = targetUrl;
          currentUrlDisplay.textContent = targetUrl;
          urlBar.value = targetUrl;
          
          // Update history
          if (historyIndex < historyStack.length - 1) {
            historyStack = historyStack.slice(0, historyIndex + 1);
          }
          historyStack.push(targetUrl);
          historyIndex = historyStack.length - 1;
          
        } catch (err) {
          frame.srcdoc = '<h1 style="color:red;padding:40px;font-family:system-ui;">Error: ' + err.message + '</h1>';
          currentUrlDisplay.textContent = 'Error: ' + err.message;
        } finally {
          loading.style.display = 'none';
        }
      };

      const normalizeUrl = (input) => {
        let url = input.trim();
        if (!url) return null;
        
        // If it looks like a search query (contains spaces or no dot), treat as Google search
        if (url.includes(' ') || (!url.includes('.') && !url.includes('/'))) {
          return 'https://www.google.com/search?q=' + encodeURIComponent(url);
        }
        
        // Auto-add https:// if no protocol
        if (!url.match(/^https?:\/\//i)) {
          url = 'https://' + url;
        }
        return url;
      };

      const loadUrl = () => {
        const normalized = normalizeUrl(urlBar.value);
        if (normalized) {
          proxyFetch(normalized);
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
          <head><title>Google Classroom</title></head>
          <body style="margin:0;overflow:hidden;">
            <iframe src="\${window.location.origin}/?cloak=launch&url=\${encodeURIComponent(normalized)}" 
                    style="width:100%;height:100%;border:none;">
            </iframe>
          </body>
          </html>
        \`);
        w.document.close();
      };

      // Handle Enter key in URL bar
      urlBar.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') loadUrl();
      });

      // Click handlers
      goBtn.addEventListener('click', loadUrl);
      cloakBtn.addEventListener('click', openCloaked);
      backBtn.addEventListener('click', goBack);
      forwardBtn.addEventListener('click', goForward);
      refreshBtn.addEventListener('click', refresh);

      // Listen for clicks inside iframe that need to update the URL bar
      window.addEventListener('message', (e) => {
        if (e.data && e.data.type === 'navigate') {
          const normalized = normalizeUrl(e.data.url);
          if (normalized) {
            urlBar.value = normalized;
            proxyFetch(normalized);
          }
        }
      });

      // Load default page
      urlBar.value = 'example.com';
      setTimeout(loadUrl, 300);
    })();
  </script>
</body>
</html>`;
}