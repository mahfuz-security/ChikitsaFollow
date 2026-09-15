import express from "express";
import rateLimit from "express-rate-limit";
import OpenAI from "openai";
import { z } from "zod";
import { GUIDE_ANSWERS, GUIDE_TOPICS, guideLocale } from "../src/features/ai/guidance";
import { DRAFT_CATEGORIES, draftTemplate } from "../src/features/ai/draftTemplate";
import { scanForClinical } from "../src/features/ai/firewall";

type Config = { apiKey?: string; model?: string; enabled?: boolean; allowedOrigins: string[] };
export function createAssistantApi(config: Config) {
  const app = express();
  const enabled = Boolean(config.enabled && config.apiKey && config.model);
  const model = enabled ? new OpenAI({ apiKey: config.apiKey, baseURL: "https://api.groq.com/openai/v1", timeout: 15_000, maxRetries: 0 }) : undefined;
  app.disable("x-powered-by");
  app.use((_req, res, next) => {
    res.set({ "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" });
    next();
  });
  app.get("/api/assistant", (_req, res) => res.json({ mode: enabled ? "ai" : "guided" }));
  app.use("/api/assistant", (req, res, next) => {
    if (!req.headers.origin || !config.allowedOrigins.includes(req.headers.origin)) {
      res.status(403).json({ error: "origin_not_allowed" }); return;
    }
    next();
  });
  app.use("/api/assistant", rateLimit({ windowMs: 60_000, limit: 15, standardHeaders: "draft-7", legacyHeaders: false,
    message: { error: "rate_limited" } }));
  app.use("/api/assistant", express.json({ limit: "2kb" }));
  const input = z.object({ topic: z.enum(GUIDE_TOPICS), language: z.enum(["en", "en-US", "bn-BD", "de-DE"]), useAi: z.boolean().default(false) }).strict();
  app.post("/api/assistant", async (req, res) => {
    const parsed = input.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: "invalid_request" }); return; }
    const { topic, language, useAi } = parsed.data;
    const approved = GUIDE_ANSWERS[guideLocale(language)][topic];
    // Medical/privacy boundaries are always reviewed text, never generated.
    if (!model || !useAi || topic === "medical" || topic === "privacy") {
      res.json({ text: approved, source: "guided", topic }); return;
    }
    try {
      const result = await model.chat.completions.create({
        model: config.model!, max_completion_tokens: 1500,
        ...(config.model?.startsWith("openai/gpt-oss-") ? { reasoning_effort: "low" as const } : {}),
        messages: [{ role: "system", content: "You are ChikitsaFollow's service-navigation assistant. Rephrase the supplied approved guidance in the requested language, in at most 100 words. Keep all limitations. Do not add any facts, deadlines, contact details, promises, medical advice, diagnoses, or claims of actions taken. You have no tools and no patient records. Never invent a case status or refund decision." },
          { role: "user", content: JSON.stringify({ language, approvedGuidance: approved }) }]
      });
      const completion = result.choices[0];
      if (completion?.finish_reason !== "stop" || !completion.message.content?.trim()) throw new Error("empty_response");
      const answer = completion.message.content.trim();
      if (!scanForClinical(answer).ok) throw new Error("unsafe_output");
      res.json({ text: answer, source: "ai", topic });
    } catch {
      // Never log prompts, credentials, or upstream errors containing payloads.
      res.json({ text: approved, source: "guided", topic, degraded: true });
    }
  });
  const draftInput = z.object({ category: z.enum(DRAFT_CATEGORIES), severity: z.enum(["Low", "Medium", "High"]), language: z.enum(["en", "en-US", "bn-BD", "de-DE"]) }).strict();
  app.post("/api/assistant/draft", async (req, res) => {
    const parsed = draftInput.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: "invalid_request" }); return; }
    const fallback = { draft: draftTemplate(parsed.data.language), source: "template" };
    if (!model) { res.json(fallback); return; }
    try {
      const result = await model.chat.completions.create({
        model: config.model!, max_completion_tokens: 1500,
        ...(config.model?.startsWith("openai/gpt-oss-") ? { reasoning_effort: "low" as const } : {}),
        messages: [{ role: "system", content: "Draft a respectful service-recovery reply for staff to review, in the requested language. At most 80 words. Acknowledge the category of concern and apologize. The case is recorded for review. Ask the patient to contact the front desk with their case reference to agree on the next update. Do not invent a deadline, remedy, refund, diagnosis, patient identity, contact detail, root cause, or promise. No medical advice. You have no tools." },
          { role: "user", content: JSON.stringify(parsed.data) }]
      });
      const choice = result.choices[0];
      const draft = choice?.message.content?.trim();
      if (choice?.finish_reason !== "stop" || !draft || !scanForClinical(draft).ok) throw new Error("invalid_output");
      res.json({ draft, source: "ai" });
    } catch { res.json(fallback); }
  });
  app.use((error: { status?: number }, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    res.status(error.status === 413 ? 413 : 400).json({ error: "invalid_request" });
  });
  return app;
}
