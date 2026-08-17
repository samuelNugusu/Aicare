import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import { analyzeLabResult, getHealthAssistantResponse, diagnoseGeminiConnection } from "./aiService.js";

// Load environment variables
dotenv.config();

const app = express();

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// API Health & Diagnostics Check
app.get("/api/health", (req, res) => {
  const hasGemini = Boolean(process.env.GEMINI_API_KEY || process.env.API_KEY);
  const hasOpenAI = Boolean(process.env.OPENAI_API_KEY);
  res.json({ 
    status: "ok", 
    message: "AiCare API is running",
    geminiConfigured: hasGemini,
    openaiConfigured: hasOpenAI
  });
});

// Gemini Connection Diagnostics Endpoint
app.post("/api/ai/diagnose", async (req, res) => {
  try {
    const key = (req.headers['x-gemini-key'] as string) || req.body?.key || req.body?.apiKey;
    const report = await diagnoseGeminiConnection(key);
    res.json(report);
  } catch (error: any) {
    console.error("Diagnostic Run Error:", error);
    res.status(500).json({ 
      error: error?.message || "Failed to execute diagnostics",
      details: error
    });
  }
});

// AI Analysis Route
app.post("/api/ai/analyze", async (req, res) => {
  try {
    const { input, provider } = req.body;
    const key = (req.headers['x-gemini-key'] as string) || req.body?.key || req.body?.apiKey;
    const result = await analyzeLabResult(input, provider, key);
    res.json(result);
  } catch (error: any) {
    console.error("AI Analysis Error:", error);
    res.status(500).json({ error: error.message });
  }
});

// AI Chat Route
app.post("/api/ai/chat", async (req, res) => {
  try {
    const { history, message, base64Image, provider } = req.body;
    const key = (req.headers['x-gemini-key'] as string) || req.body?.key || req.body?.apiKey;
    const result = await getHealthAssistantResponse(history, message, base64Image, provider, key);
    res.json({ result });
  } catch (error: any) {
    console.error("AI Chat Error:", error);
    res.status(500).json({ error: error.message });
  }
});

async function startServer() {
  const PORT = 3000;

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("Failed to start server:", err);
});

export default app;
