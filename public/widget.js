/**
 * Nest Translator Widget — Embeddable English/Español toggle for Substack
 * Self-contained IIFE. Reads window.NEST_TRANSLATOR_API or infers from script src.
 * Waits for Substack's React app to render before initializing.
 */
(function () {
  "use strict";

  // --- Only run on post pages (Substack post URLs contain /p/) ---
  if (!window.location.pathname.includes("/p/")) return;

  // --- Resolve API base URL ---
  function getApiBase() {
    if (window.NEST_TRANSLATOR_API) {
      return window.NEST_TRANSLATOR_API.replace(/\/+$/, "");
    }
    var scripts = document.querySelectorAll("script[src]");
    for (var i = 0; i < scripts.length; i++) {
      if (scripts[i].src.includes("widget.js")) {
        var url = new URL(scripts[i].src);
        return url.origin;
      }
    }
    return "";
  }

  var API_BASE = getApiBase();

  // --- Load CSS early (doesn't need DOM content) ---
  if (!document.querySelector('link[href*="widget.css"]')) {
    var link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = API_BASE + "/widget.css";
    document.head.appendChild(link);
  }

  // --- Session-level cache ---
  var sessionCache = {};

  // --- Wait for Substack content to render, then initialize ---
  var attempts = 0;
  var maxAttempts = 50; // 50 * 200ms = 10 seconds max wait

  function waitForContent() {
    attempts++;
    var contentEl =
      document.querySelector(".body.markup") ||
      document.querySelector("article .available-content") ||
      document.querySelector("article");

    if (contentEl && contentEl.textContent.trim().length > 50) {
      init();
    } else if (attempts < maxAttempts) {
      setTimeout(waitForContent, 200);
    } else {
      console.warn("[NestTranslator] Timed out waiting for post content.");
    }
  }

  // Start waiting — use requestIdleCallback or setTimeout
  if (document.readyState === "complete" || document.readyState === "interactive") {
    setTimeout(waitForContent, 300);
  } else {
    document.addEventListener("DOMContentLoaded", function () {
      setTimeout(waitForContent, 300);
    });
  }

  function init() {
    // Prevent double-init
    if (document.getElementById("nest-translator")) return;

    // --- Find content elements ---
    var titleEl = document.querySelector("h1.post-title") || document.querySelector("h1");
    var subtitleEl = document.querySelector("h3.subtitle");
    var contentEl =
      document.querySelector(".body.markup") ||
      document.querySelector("article .available-content") ||
      document.querySelector("article") ||
      document.querySelector(".post-content");

    if (!contentEl) {
      console.warn("[NestTranslator] No content element found.");
      return;
    }

    // --- Create mount point ---
    var mount = document.createElement("div");
    mount.id = "nest-translator";

    // Insert before the post header or title
    var insertTarget =
      document.querySelector('[role="region"][aria-label="Post header"]') ||
      document.querySelector("h1.post-title") ||
      titleEl;

    if (insertTarget && insertTarget.parentNode) {
      insertTarget.parentNode.insertBefore(mount, insertTarget);
    } else {
      console.warn("[NestTranslator] No insert target found.");
      return;
    }

    var postId = window.location.pathname;

    // --- Capture original English content ---
    var original = {
      title: titleEl ? titleEl.innerHTML : "",
      subtitle: subtitleEl ? subtitleEl.innerHTML : "",
      content: contentEl ? contentEl.innerHTML : "",
    };

    var currentLang = "en";

    // --- Build toggle UI ---
    var toggle = document.createElement("div");
    toggle.className = "nest-translator-toggle";
    toggle.innerHTML =
      '<button class="nest-lang-btn active" data-lang="en">English</button>' +
      '<div class="nest-translator-spinner"></div>' +
      '<button class="nest-lang-btn" data-lang="es">Espa\u00f1ol</button>';
    mount.appendChild(toggle);

    var btnEn = toggle.querySelector('[data-lang="en"]');
    var btnEs = toggle.querySelector('[data-lang="es"]');

    // --- Add fade classes to content elements ---
    [titleEl, subtitleEl, contentEl].forEach(function (el) {
      if (el) el.classList.add("nest-translate-fade");
    });

    // --- Swap content with fade ---
    function swapContent(data) {
      var els = [titleEl, subtitleEl, contentEl].filter(Boolean);

      els.forEach(function (el) {
        el.classList.add("fading");
      });

      setTimeout(function () {
        if (titleEl && data.title) titleEl.innerHTML = data.title;
        if (subtitleEl && data.subtitle) subtitleEl.innerHTML = data.subtitle;
        if (contentEl && data.content) contentEl.innerHTML = data.content;

        els.forEach(function (el) {
          el.classList.remove("fading");
        });
      }, 300);
    }

    // --- Fetch translation ---
    function fetchTranslation() {
      if (sessionCache[postId]) {
        return Promise.resolve(sessionCache[postId]);
      }

      var payload = {
        postId: postId,
        title: original.title.replace(/<[^>]*>/g, ""),
        subtitle: original.subtitle.replace(/<[^>]*>/g, ""),
        content: contentEl ? contentEl.innerText || contentEl.textContent : "",
      };

      return fetch(API_BASE + "/api/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
        .then(function (res) {
          if (!res.ok) throw new Error("Translation request failed");
          return res.json();
        })
        .then(function (data) {
          sessionCache[postId] = data;
          return data;
        });
    }

    // --- Handle toggle clicks ---
    function switchLang(lang) {
      if (lang === currentLang) return;
      currentLang = lang;

      btnEn.classList.toggle("active", lang === "en");
      btnEs.classList.toggle("active", lang === "es");

      if (lang === "en") {
        swapContent(original);
        return;
      }

      toggle.classList.add("loading");

      fetchTranslation()
        .then(function (data) {
          swapContent({
            title: data.title,
            subtitle: data.subtitle,
            content: formatTranslatedContent(data.content),
          });
        })
        .catch(function (err) {
          console.error("[NestTranslator]", err);
          currentLang = "en";
          btnEn.classList.add("active");
          btnEs.classList.remove("active");
        })
        .finally(function () {
          toggle.classList.remove("loading");
        });
    }

    btnEn.addEventListener("click", function () {
      switchLang("en");
    });
    btnEs.addEventListener("click", function () {
      switchLang("es");
    });

    console.log("[NestTranslator] Initialized on", postId);
  }

  /**
   * Convert markdown-ish translated content back into HTML paragraphs.
   */
  function formatTranslatedContent(text) {
    if (!text) return "";
    if (text.includes("<p>") || text.includes("<div>")) return text;

    return text
      .split(/\n\n+/)
      .map(function (para) {
        var html = para.trim();
        if (!html) return "";

        if (html.startsWith("## ")) {
          return "<h2>" + processInline(html.slice(3)) + "</h2>";
        }

        return "<p>" + processInline(html).replace(/\n/g, "<br>") + "</p>";
      })
      .join("\n");
  }

  function processInline(text) {
    text = text.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
    text = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
    return text;
  }
})();
