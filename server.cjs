// server.cjs — OpenAI chat + ElevenLabs voice + reservation email + support email + Stripe
require("dotenv").config();
const express = require("express");
const cors = require("cors");
const fetch = require("node-fetch");
const nodemailer = require("nodemailer");
const Stripe = require("stripe");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const app = express();

/* ---------- Rate limiting ---------- */
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: "Too many requests, please try again later.",
});

const aiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  message: "Too many AI requests. Please slow down.",
});

/* ---------- Config ---------- */
const PORT = process.env.PORT || 8787;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "";
const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY || "";
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:5173";

/* ---------- Email ---------- */
const SMTP_HOST = process.env.SMTP_HOST || "";
const SMTP_PORT = Number(process.env.SMTP_PORT || 0);
const SMTP_USER = process.env.SMTP_USER || "";
const SMTP_PASS = process.env.SMTP_PASS || "";
const SUPPORT_EMAIL = process.env.SUPPORT_EMAIL || "";
const FROM_EMAIL = process.env.FROM_EMAIL || SMTP_USER || "";

/* ---------- Stripe ---------- */
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || "";
const stripe = STRIPE_SECRET_KEY ? new Stripe(STRIPE_SECRET_KEY) : null;

/* ---------- Stripe Payment Links ---------- */
const motel_LINK = "https://buy.stripe.com/test_7sY3cx3Fc3YP3HH6hF7Vm02";
const Storage_LINK = "https://buy.stripe.com/test_bJefZj3Fc52Tgut7lJ7Vm01";
const DELIVERY_LINK = "https://buy.stripe.com/test_bJe7sN0t0eDt0vv35t7Vm00";

/* ---------- Middleware ---------- */
app.use(helmet());
app.use(limiter);

app.use(cors({
  origin: FRONTEND_URL,
  methods: ["GET", "POST"],
  allowedHeaders: ["Content-Type", "x-api-key"],
}));

app.use(express.json({ limit: "2mb" }));

/* ---------- Internal API key protection ---------- */
function verifyInternalKey(req, res, next) {
  const apiKey = req.headers["x-api-key"];

  if (!apiKey) {
    console.warn(
      `[SECURITY] Missing API key | IP: ${req.ip} | ${req.method} ${req.originalUrl}`
    );
    return res.status(403).json({ error: "Forbidden" });
  }

  if (apiKey !== process.env.INTERNAL_API_KEY) {
    console.warn(
      `[SECURITY] Invalid API key | IP: ${req.ip} | ${req.method} ${req.originalUrl}`
    );
    return res.status(403).json({ error: "Forbidden" });
  }

  next();
}

/* ---------- Request validation ---------- */

function validateChatBody(req, res, next) {
  const messages = req.body?.messages;

  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: "messages must be a non-empty array" });
  }

  for (const msg of messages) {
    if (
      !msg ||
      typeof msg !== "object" ||
      typeof msg.role !== "string" ||
      typeof msg.content !== "string"
    ) {
      return res.status(400).json({ error: "each message must have role and content strings" });
    }
  }

  next();
}

function validateVoiceBody(req, res, next) {
  const text = req.body?.text;

  if (typeof text !== "string" || !text.trim()) {
    return res.status(400).json({ error: "text is required" });
  }

  next();
}

function validateSupportBody(req, res, next) {
  const email = req.body?.email;
  const message = req.body?.message;

  if (typeof email !== "string" || !email.trim()) {
    return res.status(400).json({ error: "Valid email is required" });
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email.trim())) {
    return res.status(400).json({ error: "Invalid email format" });
  }

  if (typeof message !== "string" || !message.trim()) {
    return res.status(400).json({ error: "Message is required" });
  }

  if (message.length > 2000) {
    return res.status(400).json({ error: "Message too long" });
  }

  if (
    email.includes("\n") ||
    email.includes("\r") ||
    message.includes("\nBCC:") ||
    message.includes("\rBCC:")
  ) {
    return res.status(400).json({ error: "Invalid characters detected" });
  }

  next();
}

function validateReservationBody(req, res, next) {
  const p = req.body || {};

  if (typeof p.customerEmail !== "string" || !p.customerEmail.trim()) {
    return res.status(400).json({ error: "Valid customer email required" });
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(p.customerEmail.trim())) {
    return res.status(400).json({ error: "Invalid email format" });
  }

  if (typeof p.modelName !== "string" || p.modelName.length > 100) {
    return res.status(400).json({ error: "Invalid model name" });
  }

  const allowedPickup = ["Motel", "Storage", "Delivery"];
  if (!allowedPickup.includes(p.pickup)) {
    return res.status(400).json({ error: "Invalid pickup type" });
  }

  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(p.date)) {
    return res.status(400).json({ error: "Invalid date format" });
  }

  const timeRegex = /^\d{2}:\d{2}$/;
  if (!timeRegex.test(p.time)) {
    return res.status(400).json({ error: "Invalid time format" });
  }

  const zipRegex = /^\d{5}$/;
  if (!zipRegex.test(p.zip)) {
    return res.status(400).json({ error: "Invalid ZIP code" });
  }

  const numericFields = ["basePrice", "deliveryFee", "refundableDeposit", "totalDueNow"];
  for (const field of numericFields) {
    if (typeof p[field] !== "number" || p[field] < 0 || !Number.isFinite(p[field])) {
      return res.status(400).json({ error: `Invalid ${field}` });
    }
  }

  if (typeof p.confirmationNumber !== "string" || p.confirmationNumber.length > 50) {
    return res.status(400).json({ error: "Invalid confirmation number" });
  }

  if (p.personaSummary) {
    if (typeof p.personaSummary !== "string" || p.personaSummary.length > 2000) {
      return res.status(400).json({ error: "Invalid persona summary" });
    }
  }

  next();
}

/* ---------- Health check ---------- */
app.get("/api/ok", verifyInternalKey, (_req, res) => res.json({ ok: true }));

/* ---------- ElevenLabs Voice ---------- */
app.post("/api/voice", verifyInternalKey, aiLimiter, validateVoiceBody, async (req, res) => {
  try {
    if (!ELEVENLABS_API_KEY) {
      return res.status(500).json({ error: "ElevenLabs not configured" });
    }

    const voiceId = "ooTFtk9mJ1k2r1qT4bLQ";
    const { text } = req.body;

    const r = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
      {
        method: "POST",
        headers: {
          "xi-api-key": ELEVENLABS_API_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text,
          model_id: "eleven_multilingual_v2",
        }),
      }
    );

    if (!r.ok) {
      const errText = await r.text().catch(() => "");
      console.error("ElevenLabs upstream error:", r.status, errText);
      return res.status(502).json({ error: "Voice provider failed" });
    }

    const audio = Buffer.from(await r.arrayBuffer());

    res.set({
      "Content-Type": "audio/mpeg",
      "Content-Length": audio.length,
    });

    res.send(audio);
  } catch (err) {
    console.error("Voice error:", err);
    res.status(500).json({ error: "Voice failed" });
  }
});

/* ---------- OpenAI Chat ---------- */
app.post("/api/chat", verifyInternalKey, aiLimiter, validateChatBody, async (req, res) => {
  try {
    const { messages } = req.body;

    if (!OPENAI_API_KEY) {
      return res.status(500).json({ error: "OpenAI not configured" });
    }

    const r = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages,
        temperature: 0.7,
      }),
    });

    const data = await r.json().catch(() => ({}));

    if (!r.ok) {
      console.error("OpenAI upstream error:", r.status, data);
      return res.status(502).json({ error: "Chat provider failed" });
    }

    const reply = data?.choices?.[0]?.message?.content || "";
    res.json({ reply });
  } catch (err) {
    console.error("Chat error:", err);
    res.status(500).json({ error: "Chat failed" });
  }
});

/* ---------- SMTP Helpers ---------- */
function smtpIsConfigured() {
  return (
    SMTP_HOST &&
    SMTP_PORT &&
    SMTP_USER &&
    SMTP_PASS &&
    FROM_EMAIL &&
    SUPPORT_EMAIL
  );
}

function createTransporter() {
  return nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_PORT === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });
}

/* ---------- Reservation ---------- */
app.post("/api/reservation", verifyInternalKey, async (req, res) => {
  try {
    const p = req.body || {};

    

    if (!smtpIsConfigured()) {
      return res.status(500).json({ error: "SMTP not configured" });
    }

    const transporter = createTransporter();

    let paymentLink = "";
    if (p.pickup === "Motel") paymentLink = motel_LINK;
    else if (p.pickup === "Storage") paymentLink = Storage_LINK;
    else if (p.pickup === "Delivery") paymentLink = DELIVERY_LINK;

    const html = `
<div style="font-family: Arial, Helvetica, sans-serif; max-width:600px; margin:auto;">
  <h2>Thanks for your reservation!</h2>
<table cellpadding="8" cellspacing="0" style="border-collapse:collapse; width:100%;">
  <tr><td><strong>Confirmation #</strong></td><td>${p.confirmationNumber}</td></tr>
  <tr><td><strong>Model</strong></td><td>${p.modelName}</td></tr>
  <tr><td><strong>Pickup</strong></td><td>${p.pickup === "Delivery" ? "Van Date" : p.pickup}</td></tr>
  <tr><td><strong>Date</strong></td><td>${p.date}</td></tr>
  <tr><td><strong>Time</strong></td><td>${p.time}</td></tr>
  <tr><td><strong>ZIP</strong></td><td>${p.zip}</td></tr>

  ${p.personaSummary ? `
  <tr>
    <td><strong>Selected Personality</strong></td>
    <td style="line-height:1.6;">
  ${p.personaSummary.replaceAll(" | ", "<br/>")}
</td>
  </tr>
  ` : ""}
</table>

<hr/>

  <h3>Pricing Summary</h3>

  <table cellpadding="8" cellspacing="0" style="border-collapse:collapse; width:100%;">
    <tr>
      <td>Base Price (1 hour)</td>
      <td style="text-align:right;">$${p.basePrice}</td>
    </tr>

    ${p.deliveryFee > 0 ? `
    <tr>
      <td>Van Date Fee</td>
      <td style="text-align:right;">$${p.deliveryFee}</td>
    </tr>` : ""}

    ${p.refundableDeposit > 0 ? `
    <tr>
      <td>Refundable Deposit</td>
      <td style="text-align:right;">$${p.refundableDeposit}</td>
    </tr>` : ""}

    <tr>
      <td><strong>Total Due Now</strong></td>
      <td style="text-align:right;"><strong>$${p.totalDueNow}</strong></td>
    </tr>
  </table>

  <hr/>

  <h3>Complete Your Reservation</h3>
  <p>Please finalize your booking using the secure payment link below:</p>

  <p style="text-align:center; margin:20px 0;">
    <a href="${paymentLink}"
       style="background:#000; color:#fff; padding:12px 20px; text-decoration:none; border-radius:4px;">
       Complete Payment – $${p.totalDueNow}
    </a>
  </p>

  <p style="font-size:12px; color:#666;">
    Deposits (if applicable) are fully refundable after successful return inspection.
  </p>
</div>
`;

    const text = `
Reservation Confirmation

Confirmation #: ${p.confirmationNumber}
Model: ${p.modelName}
Encounter: ${p.pickup === "Delivery" ? "Van Date" : p.pickup}
Date: ${p.date}
Time: ${p.time}
ZIP: ${p.zip}

Base Price: $${p.basePrice}
${p.deliveryFee > 0 ? `Van Date Fee: $${p.deliveryFee}\n` : ""}
${p.refundableDeposit > 0 ? `Refundable Deposit: $${p.refundableDeposit}\n` : ""}
Total Due Now: $${p.totalDueNow}

${p.personaSummary ? `
Selected Personality:
${p.personaSummary}
` : ""}

Complete Your Reservation:
${paymentLink}

Deposits (if applicable) are fully refundable after successful return inspection.
`;

    await transporter.sendMail({
      from: FROM_EMAIL,
      to: SUPPORT_EMAIL,
      subject: "Reservation " + p.confirmationNumber,
      text,
      html,
      replyTo: p.customerEmail,
    });

    await transporter.sendMail({
      from: FROM_EMAIL,
      to: p.customerEmail,
      subject: "Complete Your Reservation",
      text,
      html,
      replyTo: SUPPORT_EMAIL,
    });

    res.json({ ok: true });
  } catch (err) {
    console.error("Reservation error:", err);
    res.status(500).json({ error: "Reservation failed" });
  }
});

/* ---------- Support Email ---------- */
app.post("/api/support-email", verifyInternalKey, validateSupportBody, async (req, res) => {
  try {
    if (!smtpIsConfigured()) {
      return res.status(500).json({ error: "SMTP not configured" });
    }

    const transporter = createTransporter();

    const info = await transporter.sendMail({
      from: FROM_EMAIL,
      to: SUPPORT_EMAIL,
      subject: "Support message",
      text: req.body.message,
      replyTo: req.body.email,
    });

    res.json({ ok: true, messageId: info.messageId });
  } catch (err) {
    console.error("Support error:", err);
    res.status(500).json({ error: "Support failed" });
  }
});

/* ---------- Start ---------- */
app.listen(PORT, () => {
  console.log("API running on http://localhost:" + PORT);
});