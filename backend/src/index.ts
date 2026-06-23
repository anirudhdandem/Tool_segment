import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import cron from "node-cron";
import researchRoutes from "./routes/research.routes";
import newsRoutes from "./routes/news.routes";
import searchesRoutes from "./routes/searches.routes";
import settingsRoutes from "./routes/settings.routes";
import authRoutes from "./auth/routes";
import { requireAuth } from "./auth/middleware";
import { runNewsPoll } from "./news/poller";

// Load .env from the root of the project
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 4000;

// Auth is public; everything else requires a valid session token.
app.use("/api/auth", authRoutes);
app.use("/api/research", requireAuth, researchRoutes);
app.use("/api/news", requireAuth, newsRoutes);
app.use("/api/searches", requireAuth, searchesRoutes);
app.use("/api/settings", requireAuth, settingsRoutes);

app.listen(PORT, () => {
  console.log(`Backend server running on http://localhost:${PORT}`);
});

// ---- Industry-news watcher --------------------------------------------------
// Scrape fintech/banking news every 2 hours, classify + store, and email the
// important items (email stays dormant until RESEND_API_KEY is set). Disable by
// setting ENABLE_NEWS_WATCHER=false.
if (process.env.ENABLE_NEWS_WATCHER !== "false") {
  cron.schedule("0 */2 * * *", () => {
    runNewsPoll().catch((e) => console.error("[news] cron error:", e.message));
  });
  // Warm the feed shortly after boot so the UI isn't empty on first load.
  setTimeout(() => {
    runNewsPoll().catch((e) => console.error("[news] initial poll error:", e.message));
  }, 4000);
  console.log("[news] watcher armed — every 2h (+ initial run in 4s)");
}
