/**
 * Render the standalone translated post page.
 * Shows Spanish by default with a toggle to switch to English.
 */
function renderPage({ post, translated }) {
  const date = post.meta.datePublished
    ? new Date(post.meta.datePublished).toLocaleDateString("es-MX", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : "";

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escHtml(translated.title)} — ConteNIDO</title>
  <meta name="description" content="${escAttr(translated.subtitle || post.meta.description || "")}">
  <meta property="og:title" content="${escAttr(translated.title)}">
  <meta property="og:description" content="${escAttr(translated.subtitle || "")}">
  <meta property="og:type" content="article">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Newsreader:ital,opsz,wght@0,6..72,400;0,6..72,600;1,6..72,400&display=swap" rel="stylesheet">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Newsreader', Georgia, serif;
      background: #ffffff;
      color: #1a1a1a;
      line-height: 1.7;
      -webkit-font-smoothing: antialiased;
    }
    .container {
      max-width: 680px;
      margin: 0 auto;
      padding: 40px 20px 80px;
    }
    /* Header */
    .pub-header {
      text-align: center;
      padding: 30px 0 20px;
      border-bottom: 1px solid #e8e4df;
      margin-bottom: 32px;
    }
    .pub-header a {
      text-decoration: none;
      color: inherit;
    }
    .pub-name {
      font-size: 24px;
      font-weight: 600;
      color: #1a1a1a;
      letter-spacing: -0.01em;
    }
    .pub-tagline {
      font-size: 15px;
      color: #7a756f;
      margin-top: 4px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    }
    /* Toggle */
    .lang-toggle {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0;
      margin: 0 auto 1.5rem;
      width: fit-content;
      background: #f5f1ec;
      border-radius: 100px;
      padding: 4px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      font-size: 14px;
      user-select: none;
    }
    .lang-toggle button {
      border: none;
      background: transparent;
      padding: 8px 20px;
      border-radius: 100px;
      cursor: pointer;
      font-size: 14px;
      font-weight: 500;
      color: #6b6560;
      transition: all 0.25s ease;
      line-height: 1;
    }
    .lang-toggle button:hover { color: #3d3832; }
    .lang-toggle button.active {
      background: #c4956a;
      color: #ffffff;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    }
    /* Post */
    h1.post-title {
      font-size: 36px;
      font-weight: 600;
      line-height: 1.2;
      margin-bottom: 12px;
      letter-spacing: -0.02em;
    }
    h3.subtitle {
      font-size: 20px;
      font-weight: 400;
      color: #6b6560;
      line-height: 1.4;
      margin-bottom: 24px;
    }
    .post-meta {
      display: flex;
      align-items: center;
      gap: 12px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      font-size: 14px;
      color: #7a756f;
      margin-bottom: 32px;
      padding-bottom: 24px;
      border-bottom: 1px solid #e8e4df;
    }
    .post-meta .authors { font-weight: 600; color: #1a1a1a; }
    /* Body */
    .post-body p {
      font-size: 18px;
      margin-bottom: 1.4em;
    }
    .post-body h2, .post-body h3 {
      font-size: 26px;
      font-weight: 600;
      margin: 2em 0 0.6em;
      letter-spacing: -0.01em;
    }
    .post-body h3 { font-size: 22px; }
    .post-body strong { font-weight: 600; }
    .post-body a {
      color: #c4956a;
      text-decoration: underline;
      text-underline-offset: 2px;
    }
    .post-body a:hover { color: #a87a52; }
    .post-body ul, .post-body ol {
      margin-bottom: 1.4em;
      padding-left: 1.5em;
    }
    .post-body li {
      font-size: 18px;
      margin-bottom: 0.5em;
    }
    .post-body blockquote {
      border-left: 3px solid #c4956a;
      padding-left: 20px;
      margin: 1.5em 0;
      color: #5a5550;
      font-style: italic;
    }
    /* Fade */
    .fade-target {
      transition: opacity 0.3s ease;
    }
    .fade-target.fading { opacity: 0; }
    /* Footer */
    .post-footer {
      margin-top: 48px;
      padding-top: 24px;
      border-top: 1px solid #e8e4df;
      text-align: center;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      font-size: 13px;
      color: #999;
    }
    .post-footer a { color: #c4956a; }
    .original-link {
      display: inline-block;
      margin-top: 8px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      font-size: 13px;
      color: #c4956a;
      text-decoration: none;
    }
    .original-link:hover { text-decoration: underline; }
    @media (max-width: 600px) {
      h1.post-title { font-size: 28px; }
      .post-body p, .post-body li { font-size: 17px; }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="pub-header">
      <a href="${escAttr(post.originalUrl)}">
        <div class="pub-name">ConteNIDO</div>
        <div class="pub-tagline">VC, AI &amp; Tech in Latin America</div>
      </a>
    </div>

    <div class="lang-toggle">
      <button id="btn-en" data-lang="en">English</button>
      <button id="btn-es" data-lang="es" class="active">Espa\u00f1ol</button>
    </div>

    <h1 class="post-title fade-target" id="title">${escHtml(translated.title)}</h1>
    <h3 class="subtitle fade-target" id="subtitle">${escHtml(translated.subtitle)}</h3>

    <div class="post-meta">
      <div>
        <div class="authors">${escHtml(post.meta.authors || "ConteNIDO")}</div>
        <div>${date}</div>
      </div>
    </div>

    <div class="post-body fade-target" id="content">${translated.contentHtml}</div>

    <div class="post-footer">
      <a href="${escAttr(post.originalUrl)}">Leer el original en Substack &rarr;</a>
      <br>
      <span>Traducido por Nest Translator</span>
    </div>
  </div>

  <script>
    var en = {
      title: ${JSON.stringify(post.title)},
      subtitle: ${JSON.stringify(post.subtitle)},
      content: ${JSON.stringify(post.contentHtml)}
    };
    var es = {
      title: ${JSON.stringify(translated.title)},
      subtitle: ${JSON.stringify(translated.subtitle)},
      content: ${JSON.stringify(translated.contentHtml)}
    };
    var current = "es";
    var titleEl = document.getElementById("title");
    var subtitleEl = document.getElementById("subtitle");
    var contentEl = document.getElementById("content");
    var btnEn = document.getElementById("btn-en");
    var btnEs = document.getElementById("btn-es");

    function swap(lang) {
      if (lang === current) return;
      current = lang;
      btnEn.classList.toggle("active", lang === "en");
      btnEs.classList.toggle("active", lang === "es");
      var data = lang === "en" ? en : es;
      var els = [titleEl, subtitleEl, contentEl];
      els.forEach(function(el) { el.classList.add("fading"); });
      setTimeout(function() {
        titleEl.innerHTML = data.title;
        subtitleEl.innerHTML = data.subtitle;
        contentEl.innerHTML = data.content;
        els.forEach(function(el) { el.classList.remove("fading"); });
        document.documentElement.lang = lang === "es" ? "es" : "en";
      }, 300);
    }

    btnEn.addEventListener("click", function() { swap("en"); });
    btnEs.addEventListener("click", function() { swap("es"); });
  </script>
</body>
</html>`;
}

function escHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escAttr(str) {
  return escHtml(str);
}

module.exports = { renderPage };
