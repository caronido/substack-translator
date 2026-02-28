const express = require("express");
const cors = require("cors");
const path = require("path");
const { translatePost, isCached } = require("./translator");

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

app.use(express.json({ limit: "1mb" }));

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
