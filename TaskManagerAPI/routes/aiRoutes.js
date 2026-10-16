const express = require("express");
const router = express.Router();
const OpenAI = require("openai");

// In-memory rate limiting map: taskTitle -> timestamp
// Enforces max 1 AI request per task title per 60 seconds
const rateLimitMap = new Map();
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute

// Helper to determine suggested priority from task title
function inferPriority(title) {
    const lower = (title || "").toLowerCase();
    if (lower.includes("urgent") || lower.includes("crit") || lower.includes("bug") || lower.includes("fix") || lower.includes("deadline") || lower.includes("exam") || lower.includes("submit") || lower.includes("failure")) {
        return "High";
    }
    if (lower.includes("review") || lower.includes("test") || lower.includes("prepare") || lower.includes("plan") || lower.includes("draft") || lower.includes("integration") || lower.includes("slides")) {
        return "Medium";
    }
    return "Low";
}

// POST /api/ai/generate-description
// Accepts: { title: "...", forceFailure?: boolean }
// Returns: { description: "...", fallback: boolean, message: "...", suggestedPriority: "...", disclaimer: "..." }
router.post("/generate-description", async (req, res) => {
    const { title, forceFailure } = req.body;

    // Validate title presence
    if (!title || !title.trim()) {
        return res.status(400).json({
            error: "Task title is required to generate description",
            fallback: true
        });
    }

    const trimmedTitle = title.trim();
    const normalizedKey = trimmedTitle.toLowerCase();
    const now = Date.now();

    // Check if failure testing is forced (Step 6 testing)
    const isFailureTest = forceFailure === true || req.headers["x-force-failure"] === "true";

    // Rate Limiting Check (max 1 AI request per task per minute)
    if (!isFailureTest && rateLimitMap.has(normalizedKey)) {
        const lastRequest = rateLimitMap.get(normalizedKey);
        const elapsed = now - lastRequest;
        if (elapsed < RATE_LIMIT_WINDOW_MS) {
            const waitSeconds = Math.ceil((RATE_LIMIT_WINDOW_MS - elapsed) / 1000);
            return res.status(429).json({
                error: "Rate limit exceeded",
                rateLimited: true,
                message: `Please wait ${waitSeconds}s before requesting AI generation for "${trimmedTitle}" again.`,
                retryAfter: waitSeconds,
                fallback: true
            });
        }
    }

    // Update rate limit timestamp
    if (!isFailureTest) {
        rateLimitMap.set(normalizedKey, now);
    }

    // Check environment API keys
    const openAiKey = process.env.OPENAI_API_KEY;
    const geminiKey = process.env.GEMINI_API_KEY;

    try {
        if (isFailureTest) {
            throw new Error("401 Unauthorized: Invalid API key provided (simulated failure test as per Step 6)");
        }

        // Option A: OpenAI API Integration (as per PDF step 3)
        if (openAiKey && openAiKey !== "your_key_here" && openAiKey !== "your_openai_api_key_here") {
            const client = new OpenAI({ apiKey: openAiKey });
            const completion = await client.chat.completions.create({
                model: "gpt-4o-mini",
                messages: [
                    {
                        role: "system",
                        content: "You are a concise productivity assistant. Provide a single clear, actionable task description (1-2 sentences maximum, under 30 words) for the given task title. Do not include quotes or conversational preamble."
                    },
                    {
                        role: "user",
                        content: `Write a short task description for: ${trimmedTitle}`
                    }
                ],
                max_tokens: 100,
                temperature: 0.7
            });

            const description = completion.choices[0]?.message?.content?.trim() || "";
            return res.status(200).json({
                description,
                fallback: false,
                provider: "openai",
                model: "gpt-4o-mini",
                suggestedPriority: inferPriority(trimmedTitle),
                disclaimer: "AI-generated content. Please review and modify before saving."
            });
        }

        // Option B: Gemini API Integration (as per PDF notes)
        if (geminiKey && geminiKey !== "your_gemini_api_key_here") {
            const response = await fetch(
                `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`,
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        contents: [
                            {
                                parts: [
                                    {
                                        text: `Write a concise, actionable task description (1-2 sentences, max 30 words) for: ${trimmedTitle}. Do not include conversational filler.`
                                    }
                                ]
                            }
                        ]
                    })
                }
            );

            if (!response.ok) {
                throw new Error(`Gemini API error: ${response.status} ${response.statusText}`);
            }

            const data = await response.json();
            const description = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "";

            return res.status(200).json({
                description,
                fallback: false,
                provider: "gemini",
                model: "gemini-1.5-flash",
                suggestedPriority: inferPriority(trimmedTitle),
                disclaimer: "AI-generated content. Please review and modify before saving."
            });
        }

        // Option C: Simulation / Demo Mode (enabled via DEMO_MODE env or header)
        if (process.env.DEMO_MODE === "true" || req.headers["x-demo-mode"] === "true") {
            const contextDescriptions = {
                default: `Coordinate key activities, complete milestone deliverables, and verify requirements for "${trimmedTitle}".`,
                prepare: `Draft concise presentation slides outlining system architecture, API schemas, and experimental validation results for "${trimmedTitle}".`,
                fix: `Isolate root cause in test environment, implement bugfix with regression tests, and verify fix for "${trimmedTitle}".`,
                report: `Synthesize experimental benchmarks, address rubric evaluation criteria, and finalize formal documentation for "${trimmedTitle}".`
            };

            let matched = contextDescriptions.default;
            const lower = trimmedTitle.toLowerCase();
            if (lower.includes("prep") || lower.includes("slide") || lower.includes("pres")) matched = contextDescriptions.prepare;
            else if (lower.includes("fix") || lower.includes("bug") || lower.includes("error")) matched = contextDescriptions.fix;
            else if (lower.includes("report") || lower.includes("doc") || lower.includes("practical")) matched = contextDescriptions.report;

            return res.status(200).json({
                description: matched,
                fallback: false,
                provider: "demo-simulator",
                model: "gpt-4o-mini-simulated",
                suggestedPriority: inferPriority(trimmedTitle),
                disclaimer: "AI-generated content. Please review and modify before saving."
            });
        }

        // Option D: No active API key and not demo mode -> Trigger graceful failure path
        throw new Error("No active OpenAI or Gemini API key configured in backend .env");

    } catch (err) {
        console.warn(`[AI Service Graceful Fallback] Error occurred: ${err.message}`);
        // Graceful Degradation: return 200 with fallback: true so frontend continues smoothly
        return res.status(200).json({
            description: "",
            fallback: true,
            provider: "offline-fallback",
            suggestedPriority: inferPriority(trimmedTitle),
            message: "AI service currently unavailable or unconfigured. You can manually enter your task description.",
            errorDetails: err.message,
            disclaimer: "Manual mode active. System is operating under graceful degradation."
        });
    }
});

// GET /api/ai/status
// Diagnostic endpoint to check AI service readiness without exposing keys
router.get("/status", (req, res) => {
    const hasOpenAI = Boolean(process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY !== "your_openai_api_key_here" && process.env.OPENAI_API_KEY !== "your_key_here");
    const hasGemini = Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== "your_gemini_api_key_here");
    const isDemo = process.env.DEMO_MODE === "true";

    res.json({
        status: "ok",
        providers: {
            openai: hasOpenAI ? "configured" : "unconfigured",
            gemini: hasGemini ? "configured" : "unconfigured",
            demoMode: isDemo ? "active" : "disabled"
        },
        activeProvider: hasOpenAI ? "openai (gpt-4o-mini)" : hasGemini ? "gemini (gemini-1.5-flash)" : isDemo ? "demo-simulator" : "fallback-mode",
        rateLimitWindowSeconds: RATE_LIMIT_WINDOW_MS / 1000
    });
});

// POST /api/ai/reset-rate-limit (Utility for testing)
router.post("/reset-rate-limit", (req, res) => {
    rateLimitMap.clear();
    res.json({ message: "Rate limit cache cleared successfully" });
});

module.exports = router;
