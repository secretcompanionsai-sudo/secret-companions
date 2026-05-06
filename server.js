// server.js — tiny proxy for OpenAI text chat (CommonJS)
require("dotenv").config();
const express = require("express");
const cors = require("cors");
const fetch = require("node-fetch"); // v2.x

const app = express();

/* ---------- Config ---------- */
const PORT = process.env.PORT || 8787;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_ORG_ID = process.env.OPENAI_ORG_ID || "";       // optional
const OPENAI_PROJECT_ID = process.env.OPENAI_PROJECT_ID || ""; // optional

/* ---------- Middleware ---------- */
app.use(cors({
  origin: [
    "http://localhost:5173",
    "http://localhost:5174",
    "http://localhost:5175",
    "http://localhost:5176",
    "http://127.0.0.1:5173",
  ],
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
}));
app.use(express.json({ limit: "1mb" }));

/* ---------- Health check ---------- */
app.get("/api/ok", (_req, res) => {
  res.json({ ok: true, port: PORT });
});

/* ---------- Helpers ---------- */
function buildOpenAIHeaders() {
  if (!OPENAI_API_KEY) {
    throw new Error("Missing OPENAI_API_KEY");
  }
  const h = {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${OPENAI_API_KEY}`,
  };
  if (OPENAI_ORG_ID) h["OpenAI-Organization"] = OPENAI_ORG_ID;
  if (OPENAI_PROJECT_ID) h["OpenAI-Project"] = OPENAI_PROJECT_ID;
  return h;
}

/* ---------- Chat endpoint ---------- */
app.post("/api/chat", async (req, res) => {
  try {
    const headers = buildOpenAIHeaders();
    const messages = Array.isArray(req.body?.messages) && req.body.messages.length
      ? req.body.messages
      : [{ role: "user", content: "Say hello as a friendly assistant." }];

    // Basic input guard
    const safeMessages = messages.map(m => ({
      role: typeof m.role === "string" ? m.role : "user",
      content: typeof m.content === "string" ? m.content : String(m.content ?? ""),
    }));

    const payload = {
      model: "gpt-4o-mini",
      messages: safeMessages,
      temperature: 0.7,
    };

    console.log("[/api/chat] → OpenAI", {
      count: safeMessages.length,
      first: safeMessages[0]?.role,
      last: safeMessages[safeMessages.length - 1]?.role,
      model: payload.model,
    });

    const r = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    });

    const raw = await r.text(); // always read the body once
    if (!r.ok) {
      console.error("[/api/chat] OpenAI error:", r.status, raw);
      return res.status(500).json({
        error: "OpenAI error",
        status: r.status,
        detail: raw, // front-end shows this in DevTools if needed
      });
    }

    let data;
    try {
      data = JSON.parse(raw);
    } catch (e) {
      console.error("[/api/chat] JSON parse fail:", e, raw);
      return res.status(500).json({
        error: "OpenAI JSON parse error",
        detail: raw,
      });
    }

    const reply = data?.choices?.[0]?.message?.content ?? "";
    console.log("[/api/chat] ✓ reply length:", reply.length);
    return res.json({ reply });
  } catch (err) {
    console.error("[/api/chat] Server error:", err);
    return res.status(500).json({
      error: "Server error",
      detail: String(err && err.message ? err.message : err),
    });
  }
});

/* ---------- Start server ---------- */
app.listen(PORT, () => {
  console.log(`API proxy running on http://localhost:${PORT}`);
  if (!OPENAI_API_KEY) {
    console.warn("⚠️  OPENAI_API_KEY is not set. Set it in your .env file.");
  }
  if (OPENAI_ORG_ID) console.log("Using OpenAI org:", OPENAI_ORG_ID);
  if (OPENAI_PROJECT_ID) console.log("Using OpenAI project:", OPENAI_PROJECT_ID);
});
