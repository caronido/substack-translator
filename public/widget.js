/**
 * Nest Translator Widget — Embeddable English/Español toggle for Substack
 * Self-contained IIFE. Reads window.NEST_TRANSLATOR_API or infers from script src.
 */
(function () {
  "use strict";

  // --- Resolve API base URL ---
  function getApiBase() {
    if (window.NEST_TRANSLATOR_API) {
      return window.NEST_TRANSLATOR_API.replace(/\/+$/, "");
    }
    // Infer from the script tag's src attribute
    const scripts = document.querySelectorAll("script[src]");
    for (const s of scripts) {
      if (s.src.includes("widget.js")) {
        const url = new URL(s.src);
        return url.origin;
      }
    }
    return "";
  }

  const API_BASE = getApiBase();

  // --- Session-level cache ---
  const sessionCache = {};

  // --- Find the widget mount point ---
  const mount = document.getElementById("nest-translator");
  if (!mount) return; // nothing to do

  const postId = mount.getAttribute("data-post-id") || window.location.pathname;

  // --- Capture original English content ---
  const titleEl = document.querySelector("h1.post-title") || document.querySelector("h1");
  const subtitleEl = document.querySelector("h3.subtitle") || document.querySelector("h3");
  const contentEl = document.querySelector(".body.markup") || document.querySelector("article") || document.querySelector(".post-content");

  const original = {
    title: titleEl ? titleEl.innerHTML : "",
    subtitle: subtitleEl ? subtitleEl.innerHTML : "",
    content: contentEl ? contentEl.innerHTML : "",
  };

  let currentLang = "en";

  // --- Load CSS if not already present ---
  if (!document.querySelector('link[href*="widget.css"]')) {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = API_BASE + "/widget.css";
    document.head.appendChild(link);
  }

  // --- Build toggle UI ---
  const toggle = document.createElement("div");
  toggle.className = "nest-translator-toggle";
  toggle.innerHTML = `
    <button class="nest-lang-btn active" data-lang="en">English</button>
    <div class="nest-translator-spinner"></div>
    <button class="nest-lang-btn" data-lang="es">Espa\u00f1ol</button>
  `;
  mount.appendChild(toggle);

  const btnEn = toggle.querySelector('[data-lang="en"]');
  const btnEs = toggle.querySelector('[data-lang="es"]');

  // --- Add fade classes to content elements ---
  [titleEl, subtitleEl, contentEl].forEach((el) => {
    if (el) el.classList.add("nest-translate-fade");
  });

  // --- Swap content with fade ---
  function swapContent(data) {
    const els = [titleEl, subtitleEl, contentEl].filter(Boolean);

    // Fade out
    els.forEach((el) => el.classList.add("fading"));

    setTimeout(() => {
      if (titleEl && data.title) titleEl.innerHTML = data.title;
      if (subtitleEl && data.subtitle) subtitleEl.innerHTML = data.subtitle;
      if (contentEl && data.content) contentEl.innerHTML = data.content;

      // Fade in
      els.forEach((el) => el.classList.remove("fading"));
    }, 300);
  }

  // --- Fetch translation ---
  async function fetchTranslation() {
    if (sessionCache[postId]) {
      return sessionCache[postId];
    }

    const payload = {
      postId: postId,
      title: original.title.replace(/<[^>]*>/g, ""), // strip HTML for API
      subtitle: original.subtitle.replace(/<[^>]*>/g, ""),
      content: contentEl ? contentEl.innerText || contentEl.textContent : "",
    };

    const res = await fetch(API_BASE + "/api/translate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) throw new Error("Translation request failed");

    const data = await res.json();
    sessionCache[postId] = data;
    return data;
  }

  // --- Handle toggle clicks ---
  async function switchLang(lang) {
    if (lang === currentLang) return;
    currentLang = lang;

    // Update button states
    btnEn.classList.toggle("active", lang === "en");
    btnEs.classList.toggle("active", lang === "es");

    if (lang === "en") {
      swapContent(original);
      return;
    }

    // Spanish — fetch translation
    toggle.classList.add("loading");

    try {
      const data = await fetchTranslation();
      // Wrap translated text back in the original HTML structure hints
      swapContent({
        title: data.title,
        subtitle: data.subtitle,
        content: formatTranslatedContent(data.content),
      });
    } catch (err) {
      console.error("[NestTranslator]", err);
      // Revert to English on error
      currentLang = "en";
      btnEn.classList.add("active");
      btnEs.classList.remove("active");
    } finally {
      toggle.classList.remove("loading");
    }
  }

  /**
   * Convert markdown-ish translated content back into HTML paragraphs.
   * Handles: **, ##, links, line breaks.
   */
  function formatTranslatedContent(text) {
    if (!text) return "";

    // If the content already looks like HTML, return as-is
    if (text.includes("<p>") || text.includes("<div>")) return text;

    return text
      .split(/\n\n+/)
      .map((para) => {
        let html = para.trim();
        if (!html) return "";

        // Headings
        if (html.startsWith("## ")) {
          return "<h2>" + processInline(html.slice(3)) + "</h2>";
        }

        // Wrap in <p>
        return "<p>" + processInline(html).replace(/\n/g, "<br>") + "</p>";
      })
      .join("\n");
  }

  function processInline(text) {
    // Bold
    text = text.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
    // Italic
    text = text.replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, "<em>$1</em>");
    // Links
    text = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
    return text;
  }

  btnEn.addEventListener("click", () => switchLang("en"));
  btnEs.addEventListener("click", () => switchLang("es"));
})();
