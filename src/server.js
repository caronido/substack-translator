const express = require("express");
const crypto = require("crypto");
const cors = require("cors");
const path = require("path");
const { translatePost, isCached } = require("./translator");
const { fetchPost } = require("./reader");
const { renderPage } = require("./template");

const app = express();
const PORT = process.env.PORT || 3000;

// --- CORS ---
const allowedOrigins = (() => {
  const extra = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(",").map((o) => o.trim())
    : [];
  return extra;
})();

app.use(
  cors({
    origin(origin, callback) {
      // Allow requests with no origin (curl, server-to-server)
      if (!origin) return callback(null, true);

      // Allow any *.substack.com subdomain
      if (/^https?:\/\/([a-z0-9-]+\.)?substack\.com$/i.test(origin)) {
        return callback(null, true);
      }

      // Allow explicitly listed origins
      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      // In development, allow localhost
      if (/^https?:\/\/localhost(:\d+)?$/.test(origin)) {
        return callback(null, true);
      }

      callback(new Error("Not allowed by CORS"));
    },
  })
);

// Capture raw body for Slack signature verification, then parse
app.use(
  express.json({
    limit: "1mb",
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  })
);
app.use(
  express.urlencoded({
    extended: true,
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  })
);

// --- Static files ---
app.use(express.static(path.join(__dirname, "..", "public")));

// --- Health check ---
app.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// --- Translate endpoint ---
app.post("/api/translate", async (req, res) => {
  try {
    const { postId, title, subtitle, content } = req.body;

    if (!postId) {
      return res.status(400).json({ error: "postId is required" });
    }
    if (!content && !title) {
      return res
        .status(400)
        .json({ error: "At least title or content is required" });
    }

    const result = await translatePost({ postId, title, subtitle, content });
    res.json({ postId, cached: isCached(postId), ...result });
  } catch (err) {
    console.error("Translation error:", err.message);
    res.status(500).json({ error: "Translation failed", detail: err.message });
  }
});

// --- Pre-translate endpoint ---
app.post("/api/pre-translate", async (req, res) => {
  try {
    const { postId, title, subtitle, content } = req.body;

    if (!postId) {
      return res.status(400).json({ error: "postId is required" });
    }

    if (isCached(postId)) {
      return res.json({ postId, status: "already_cached" });
    }

    // Fire off translation (await so caller knows when it's done)
    await translatePost({ postId, title, subtitle, content });
    res.json({ postId, status: "cached" });
  } catch (err) {
    console.error("Pre-translate error:", err.message);
    res
      .status(500)
      .json({ error: "Pre-translation failed", detail: err.message });
  }
});

// --- Standalone translated post page ---
app.get("/read/:slug", async (req, res) => {
  try {
    const { slug } = req.params;
    const postId = `/p/${slug}`;

    // Fetch the original post from Substack
    const post = await fetchPost(slug);

    if (!post.contentText) {
      return res.status(404).send("Post not found or has no content.");
    }

    // Translate (uses cache if available)
    const translated = await translatePost({
      postId,
      title: post.title,
      subtitle: post.subtitle,
      content: post.contentText,
    });

    // Convert translated markdown-ish content to HTML
    translated.contentHtml = formatContentToHtml(translated.content);

    res.send(renderPage({ post, translated }));
  } catch (err) {
    console.error("Reader error:", err.message);
    res.status(500).send("Failed to load translated post. Please try again.");
  }
});

/**
 * Convert translated plain text / markdown to HTML paragraphs.
 */
function formatContentToHtml(text) {
  if (!text) return "";
  if (text.includes("<p>") || text.includes("<div>")) return text;

  return text
    .split(/\n\n+/)
    .map((para) => {
      let html = para.trim();
      if (!html) return "";
      if (html.startsWith("### "))
        return "<h3>" + inlineFormat(html.slice(4)) + "</h3>";
      if (html.startsWith("## "))
        return "<h2>" + inlineFormat(html.slice(3)) + "</h2>";
      return "<p>" + inlineFormat(html).replace(/\n/g, "<br>") + "</p>";
    })
    .join("\n");
}

function inlineFormat(text) {
  text = text.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  text = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
  return text;
}

// --- Slack slash command ---
const SLACK_SIGNING_SECRET = process.env.SLACK_SIGNING_SECRET || "";
const APP_URL = process.env.APP_URL || "";

function verifySlackRequest(req) {
  if (!SLACK_SIGNING_SECRET) return false;
  const timestamp = req.headers["x-slack-request-timestamp"];
  if (!timestamp) return false;
  // Reject requests older than 5 minutes
  if (Math.abs(Date.now() / 1000 - Number(timestamp)) > 300) return false;

  const sigBase = `v0:${timestamp}:${req.rawBody}`;
  const mySignature =
    "v0=" +
    crypto
      .createHmac("sha256", SLACK_SIGNING_SECRET)
      .update(sigBase)
      .digest("hex");
  const slackSignature = req.headers["x-slack-signature"] || "";
  return crypto.timingSafeEqual(
    Buffer.from(mySignature),
    Buffer.from(slackSignature)
  );
}

function extractSlugAndUrl(text) {
  // Check for a full URL (could be a draft share link with ?token=...)
  const urlMatch = text.match(/(https?:\/\/[^\s]+substack\.com\/p\/[^\s]+)/i);
  if (urlMatch) {
    const fullUrl = urlMatch[1];
    const slugMatch = fullUrl.match(/\/p\/([a-z0-9-]+)/i);
    return { slug: slugMatch ? slugMatch[1] : null, fullUrl };
  }
  // If they just pasted a slug directly
  const slugOnly = text.trim().replace(/^\//, "");
  if (/^[a-z0-9-]+$/i.test(slugOnly)) return { slug: slugOnly, fullUrl: null };
  return { slug: null, fullUrl: null };
}

app.post("/api/slack/translate", async (req, res) => {
  // Verify Slack signature
  if (!verifySlackRequest(req)) {
    return res.status(401).json({ error: "Invalid signature" });
  }

  const text = (req.body.text || "").trim();
  const responseUrl = req.body.response_url;

  const { slug, fullUrl } = extractSlugAndUrl(text);
  if (!slug) {
    return res.json({
      response_type: "ephemeral",
      text: "Please provide a Substack URL or slug.\nExample: `/translate https://elcontenido.substack.com/p/product-truth`\nDraft share links with tokens also work!",
    });
  }

  const postId = `/p/${slug}`;

  // Check cache
  if (isCached(postId)) {
    const readUrl = APP_URL ? `${APP_URL}/read/${slug}` : `/read/${slug}`;
    return res.json({
      response_type: "ephemeral",
      text: `Already cached! ${readUrl}`,
    });
  }

  // Acknowledge immediately (Slack 3-second timeout)
  res.json({
    response_type: "ephemeral",
    text: `Translating *${slug}*... I'll let you know when it's ready.`,
  });

  // Background: fetch, translate, notify
  (async () => {
    try {
      // Use full URL if available (supports draft share links with tokens)
      const post = await fetchPost(fullUrl || slug);
      if (!post.contentText) {
        throw new Error("Post not found or has no content");
      }

      await translatePost({
        postId,
        title: post.title,
        subtitle: post.subtitle,
        content: post.contentText,
      });

      const readUrl = APP_URL ? `${APP_URL}/read/${slug}` : `/read/${slug}`;
      const message = {
        response_type: "ephemeral",
        text: `Translation cached for *${post.title}*\n${readUrl}`,
      };

      if (responseUrl) {
        await fetch(responseUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(message),
        });
      }
    } catch (err) {
      console.error("Slack translate error:", err.message);
      if (responseUrl) {
        await fetch(responseUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            response_type: "ephemeral",
            text: `Translation failed: ${err.message}`,
          }),
        });
      }
    }
  })();
});

// --- Serve demo page at /demo ---
app.get("/demo", (_req, res) => {
  res.sendFile(path.join(__dirname, "..", "public", "demo.html"));
});

// --- Start ---
app.listen(PORT, () => {
  console.log(`🪺 Substack Translator running on http://localhost:${PORT}`);
  console.log(`   Demo: http://localhost:${PORT}/demo`);
  console.log(`   Health: http://localhost:${PORT}/health`);
});
