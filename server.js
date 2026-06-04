import express from "express";
import Anthropic from "@anthropic-ai/sdk";
import fs from "fs";
import { fileURLToPath } from "url";
import path from "path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(express.json({ limit: "2mb" }));

const mySecret = process.env["ANTHROPIC_API_KEY_1"];
const client = new Anthropic({ apiKey: mySecret });

const requestCounts = new Map();

function rateLimit(req, res, next) {
  const ip = req.ip;
  const now = Date.now();
  const windowMs = 60 * 60 * 1000;
  const maxRequests = 5;
  const entry = requestCounts.get(ip) || { count: 0, start: now };
  if (now - entry.start > windowMs) {
    entry.count = 0;
    entry.start = now;
  }
  entry.count++;
  requestCounts.set(ip, entry);
  if (entry.count > maxRequests) {
    return res.status(429).json({ error: "Too many requests. Try again in an hour." });
  }
  next();
}

app.use("/analyze", rateLimit);

const SYSTEM_PROMPT = `You are a structural analyst of personal text. The user will paste a passage of introspective writing — a journal entry, a therapy transcript, a long voice-memo transcription, a piece of self-reflection. Your task is to look beneath the surface content and surface the underlying cognitive structure: how this person thinks, how they reason, how they discover, how they learn.

You are not a therapist. You are not diagnosing. You are not giving advice. You are doing structural analysis — the same move a careful linguist or a cognitive analyst would do on a corpus.

Method:
- Read the passage carefully for FORM, not just content. Notice recurring linguistic moves, self-correction patterns, the shape of how thoughts unfold, what gets hedged, what gets asserted, where the person digs vs. where they skim, how they handle uncertainty, how they reference past cases, how they relate to their own observations.
- Find the SMALLEST NUMBER of structural patterns that actually carry weight. Two strong structures beat six weak ones.
- Quote sparingly and only when the exact words demonstrate a structure that paraphrase would lose. Keep every quote under 15 words.
- Where you can, point to a SIGNATURE — a specific linguistic marker or move whose presence/frequency reveals the structure.
- If the passage is too short to support real claims, say so plainly. Do not over-interpret short input.

Output format:
Produce four short sections, each titled exactly:

## How you may think
## How you may reason
## How you may discover
## How you may learn

Each section: 2–4 short paragraphs of plain prose. No bullet lists. No headers inside sections. Be specific, be structural, be honest. If two sections would say the same thing, collapse them and note the convergence.

End with a single short closing paragraph titled "## Substrate" — one observation about the deeper architecture under all four, IF you see one. If you don't, skip it.

Tone: precise, observational, warm but not flattering. Address the writer directly in second person ("you") throughout the analysis. The reader is being shown their own cognitive form. Treat it as something worth seeing clearly.`;

app.post("/analyze", async (req, res) => {
  try {
    const { text } = req.body;
    if (!text || text.trim().length < 100) {
      return res.status(400).json({ error: "Please paste at least 100 characters of text." });
    }
    const response = await client.messages.create({
      model: "claude-opus-4-5",
      max_tokens: 4000,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: text }],
    });
    const output = response.content.map((b) => b.text || "").join("\n");
    res.json({ output });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || "Something went wrong." });
  }
});

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "html_file.html"));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, "0.0.0.0", () => console.log(`Running on port ${PORT}`));
