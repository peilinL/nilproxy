// worker.js - Cloudflare Worker with ES Module format

const HTML_TEMPLATE = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Unblocked Browser</title>
<style>
* { margin:0; padding:0; box-sizing:border-box; }
body { font-family: system-ui, sans-serif; background:#0a0a0f; color:#e0e0e0; height:100vh; display:flex; flex-direction:column; }
#toolbar { background:#1a1a2e; padding:12px 20px; display:flex; gap:12px; align-items:center; border-bottom:1px solid #333; flex-shrink:0; flex-wrap:wrap; }
#url-input { flex:1; min-width:200px; padding:10px 16px; background:#2a2a40; border:1px solid #444; border-radius:8px; color:#fff; font-size:16px; outline:none; }
#url-input:focus { border-color:#6c63ff; }
#go-btn, #shorten-btn { padding:10px 20px; border:none; border-radius:8px; color:#fff; font-weight:600; cursor:pointer; font-size:16px; }
#go-btn { background:#6c63ff; }
#go-btn:hover { background:#7b73ff; }
#shorten-btn { background:#2a2a4a; }
#shorten-btn:hover { background:#3a3a5a; }
#frame-container { flex:1; position:relative; background:#111; }
#content-frame { width:100%; height:100%; border:none; background:#fff; }
#loading { display:none; position:absolute; top:50%; left:50%; transform:translate(-50%,-50%); color:#6c63ff; font-size:18px; }
#shortened-display { display:none; margin-top:8px; padding:8px 14px; background:#1a1a2e; border-radius:6px; border:1px solid #444; width:100%; word-break:break-all; }
#shortened-display a { color:#6c63ff; text-decoration:none; }
#shortened-display a:hover { text-decoration:underline; }
</style>
</head>
<body>
<div id="toolbar">
<input id="url-input" type="text" placeholder="Enter URL" spellcheck="false">
<button id="go-btn">Go</button>
<button id="shorten-btn">Shorten</button>
<div id="shortened-display"></div>
</div>
<div id="frame-container">
<iframe id="content-frame" sandbox="allow-scripts allow-forms allow-same-origin"></iframe>
<div id="loading">Loading...</div>
</div>
<script>
(function() {
  const frame = document.getElementById('content-frame');
  const input = document.getElementById('url-input');
  const goBtn = document.getElementById('go-btn');
  const shortenBtn = document.getElementById('shorten-btn');
  const loading = document.getElementById('loading');
  const display = document.getElementById('shortened-display');

  const proxyFetch = async (targetUrl) => {
    loading.style.display = 'block';
    try {
      const response = await fetch('/proxy?url=' + encodeURIComponent(targetUrl));
      const html = await response.text();
      const rewritten = html.replace(
        /(href|src|action)=["']([^"']*)["']/gi,
        (match, attr, value) => {
          if (value.startsWith('http') || value.startsWith('//')) {
            const full = value.startsWith('//') ? 'https:' + value : value;
            return attr + '="/proxy?url=' + encodeURIComponent(full) + '"';
          } else if (value.startsWith('/')) {
            const base = new URL(targetUrl).origin;
            return attr + '="/proxy?url=' + encodeURIComponent(base + value) + '"';
          } else if (!value.startsWith('javascript:') && !value.startsWith('data:')) {
            const base = new URL(targetUrl).origin;
            const fixed = value.startsWith('./') ? value.slice(1) : value;
            return attr + '="/proxy?url=' + encodeURIComponent(base + '/' + fixed) + '"';
          }
          return match;
        }
      );
      frame.srcdoc = rewritten;
    } catch (err) {
      frame.srcdoc = '<h1 style="color:red;padding:40px;">Error: ' + err.message + '</h1>';
    } finally {
      loading.style.display = 'none';
    }
  };

  const shortenUrl = async (longUrl) => {
    try {
      const response = await fetch('/shorten', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: longUrl })
      });
      const data = await response.json();
      if (data.short) {
        const full = window.location.origin + '/' + data.short;
        display.innerHTML = 'Shortened: <a href="' + full + '" target="_blank">' + full + '</a>';
        display.style.display = 'block';
      } else {
        display.innerHTML = 'Error: ' + (data.error || 'unknown');
        display.style.display = 'block';
      }
    } catch (err) {
      display.innerHTML = 'Error: ' + err.message;
      display.style.display = 'block';
    }
  };

  goBtn.addEventListener('click', () => {
    let url = input.value.trim();
    if (!url) return;
    if (!url.startsWith('http://') && !url.startsWith('https://')) url = 'https://' + url;
    proxyFetch(url);
    display.style.display = 'none';
  });

  shortenBtn.addEventListener('click', () => {
    let url = input.value.trim();
    if (!url) return;
    if (!url.startsWith('http://') && !url.startsWith('https://')) url = 'https://' + url;
    shortenUrl(url);
  });

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') goBtn.click();
  });

  if (window.location.pathname.length > 1 && window.location.pathname !== '/') {
    const slug = window.location.pathname.slice(1);
    fetch('/resolve/' + slug)
      .then(res => res.json())
      .then(data => {
        if (data.url) {
          input.value = data.url;
          proxyFetch(data.url);
          history.replaceState(null, '', '/');
        }
      })
      .catch(() => {});
  }

  input.value = 'https://example.com';
  setTimeout(() => goBtn.click(), 300);
})();
</script>
</body>
</html>`;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    if (path === '/' || path === '/index.html') {
      return new Response(HTML_TEMPLATE, {
        headers: { 
          'Content-Type': 'text/html', 
          'Cache-Control': 'public, max-age=86400' 
        }
      });
    }

    if (path === '/proxy') {
      const target = url.searchParams.get('url');
      if (!target) {
        return new Response('Missing url parameter', { status: 400 });
      }

      try {
        const targetUrl = new URL(target);
        const response = await fetch(target, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5',
            'Accept-Encoding': 'gzip, deflate, br',
            'Referer': targetUrl.origin
          }
        });

        const contentType = response.headers.get('content-type') || 'text/html';
        
        if (contentType.includes('text/html')) {
          const html = await response.text();
          const rewritten = html.replace(
            /(href|src|action)=["']([^"']*)["']/gi,
            (match, attr, value) => {
              if (value.startsWith('http') || value.startsWith('//')) {
                const full = value.startsWith('//') ? 'https:' + value : value;
                return attr + '="/proxy?url=' + encodeURIComponent(full) + '"';
              } else if (value.startsWith('/')) {
                return attr + '="/proxy?url=' + encodeURIComponent(targetUrl.origin + value) + '"';
              } else if (!value.startsWith('javascript:') && !value.startsWith('data:')) {
                const fixed = value.startsWith('./') ? value.slice(1) : value;
                return attr + '="/proxy?url=' + encodeURIComponent(targetUrl.origin + '/' + fixed) + '"';
              }
              return match;
            }
          );
          return new Response(rewritten, {
            headers: { 
              'Content-Type': 'text/html', 
              'Cache-Control': 'no-cache' 
            }
          });
        }

        const buffer = await response.arrayBuffer();
        return new Response(buffer, {
          headers: { 'Content-Type': contentType }
        });
      } catch (error) {
        return new Response('Proxy error: ' + error.message, { status: 500 });
      }
    }

    if (path === '/shorten' && request.method === 'POST') {
      try {
        const body = await request.json();
        const longUrl = body.url;
        if (!longUrl) {
          return new Response(JSON.stringify({ error: 'Missing url' }), { 
            status: 400,
            headers: { 'Content-Type': 'application/json' }
          });
        }

        const slug = Math.random().toString(36).substring(2, 8);
        await env.KV.put(slug, longUrl);
        return new Response(JSON.stringify({ short: slug }), {
          headers: { 'Content-Type': 'application/json' }
        });
      } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }

    if (path.startsWith('/resolve/')) {
      const slug = path.slice(9);
      const longUrl = await env.KV.get(slug);
      if (longUrl) {
        return new Response(JSON.stringify({ url: longUrl }), {
          headers: { 'Content-Type': 'application/json' }
        });
      }
      return new Response(JSON.stringify({ error: 'Not found' }), { status: 404 });
    }

    const slug = path.slice(1);
    if (slug && slug.length > 0 && slug.length < 20) {
      const longUrl = await env.KV.get(slug);
      if (longUrl) {
        return new Response(HTML_TEMPLATE, {
          headers: { 'Content-Type': 'text/html' }
        });
      }
    }

    return new Response('Not found', { status: 404 });
  }
};