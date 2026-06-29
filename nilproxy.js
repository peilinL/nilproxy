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
        const targetUrl = new URL(target);
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

          // HTMLRewriter transforms links to keep them inside the proxy
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

          // Strip Securly/Gaggle monitoring scripts
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
    /* Fixed toolbar - NEVER gets overwritten */
    #toolbar {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      z-index: 100;
      background: #1a73e8;
      padding: 12px 20px;
      display: flex;
      gap: 12px;
      align-items: center;
      box-shadow: 0 2px 8px rgba(0,0,0,0.2);
    }
    #toolbar input {
      flex: 1;
      padding: 10px 16px;
      border: none;
      border-radius: 24px;
      font-size: 14px;
      outline: none;
      background: rgba(255,255,255,0.9);
    }
    #toolbar input:focus {
      background: white;
    }
    #toolbar button {
      padding: 10px 24px;
      background: rgba(255,255,255,0.2);
      border: none;
      border-radius: 24px;
      color: white;
      font-weight: 500;
      cursor: pointer;
      font-size: 14px;
    }
    #toolbar button:hover {
      background: rgba(255,255,255,0.3);
    }
    /* iframe fills the rest */
    #frame-container {
      position: fixed;
      top: 64px;
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
      font-size: 18px;
      z-index: 50;
      background: rgba(255,255,255,0.9);
      padding: 20px 40px;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.1);
    }
    .decoy-label {
      color: rgba(255,255,255,0.7);
      font-size: 12px;
      margin-right: 8px;
    }
  </style>
</head>
<body>
  <!-- FIXED TOOLBAR - Never gets overwritten -->
  <div id="toolbar">
    <span class="decoy-label">📚 Classroom</span>
    <input id="url-input" type="text" placeholder="Enter URL (e.g., example.com)" spellcheck="false">
    <button id="go-btn">Go</button>
    <button id="cloak-btn" style="background:rgba(255,255,255,0.1);">🛡️ Cloak</button>
  </div>

  <!-- Loading indicator -->
  <div id="loading">Loading...</div>

  <!-- iframe where content loads -->
  <div id="frame-container">
    <iframe id="content-frame" sandbox="allow-scripts allow-forms allow-same-origin allow-popups"></iframe>
  </div>

  <script>
    (function() {
      const frame = document.getElementById('content-frame');
      const input = document.getElementById('url-input');
      const goBtn = document.getElementById('go-btn');
      const cloakBtn = document.getElementById('cloak-btn');
      const loading = document.getElementById('loading');

      const proxyFetch = async (targetUrl) => {
        loading.style.display = 'block';
        try {
          const response = await fetch('/cloak?url=' + encodeURIComponent(targetUrl));
          if (!response.ok) throw new Error('Fetch failed: ' + response.status);
          const html = await response.text();
          // This loads content INTO the iframe WITHOUT overwriting the parent UI
          frame.srcdoc = html;
        } catch (err) {
          frame.srcdoc = '<h1 style="color:red;padding:40px;">Error: ' + err.message + '</h1>';
        } finally {
          loading.style.display = 'none';
        }
      };

      const loadUrl = () => {
        let url = input.value.trim();
        if (!url) return;
        if (!url.startsWith('http://') && !url.startsWith('https://')) {
          url = 'https://' + url;
        }
        proxyFetch(url);
      };

      // Cloak: open in new about:blank window with decoy
      const openCloaked = () => {
        const url = input.value.trim();
        if (!url) return;
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
            <iframe src="\${window.location.origin}/?cloak=launch&url=\${encodeURIComponent(url)}" 
                    style="width:100%;height:100%;border:none;">
            </iframe>
          </body>
          </html>
        \`);
        w.document.close();
        // The parent tab stays on about:blank with no history entry
      };

      goBtn.addEventListener('click', loadUrl);
      cloakBtn.addEventListener('click', openCloaked);
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') loadUrl();
      });

      input.value = 'example.com';
      setTimeout(loadUrl, 300);
    })();
  </script>
</body>
</html>`;
}