import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import ytDlp from 'yt-dlp-exec';
import ffmpeg from 'fluent-ffmpeg';
import rateLimit from 'express-rate-limit';

const app = express();
// Production standard: rely on the environment's port completely
const PORT = process.env.PORT || 5000; 

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- Production Security & Optimization ---
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : '*',
  optionsSuccessStatus: 200
}));
app.use(express.json());

// Serve static assets from the production UI build
app.use(express.static(path.join(__dirname, "../frontend/build")));

// Prevent API scraping and resource starvation
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30, // Limit each IP to 30 requests per window
  message: { error: "Too many extraction requests from this IP, please try again later." },
  standardHeaders: true,
  legacyHeaders: false,
});

const sanitizeTitle = (title) => {
  // Production-grade filename sanitizer stripping dangerous chars and non-ascii gaps
  return title
    .replace(/[\\/:*?"<>|]/g, "")
    .replace(/\s+/g, "_")
    .trim() || "audio";
};

// --- API Endpoints ---
app.get("/status", (req, res) => {
  res.status(200).json({ status: "healthy", timestamp: new Date() });
});

app.post("/extract", apiLimiter, async (req, res) => {
  const { url } = req.body;

  if (!url) {
    return res.status(400).json({ error: "URL parameter is missing." });
  }

  try {
    // 1. Resolve video metadata cleanly without downloading anything yet
    const meta = await ytDlp(url, {
      dumpJson: true,
      noPlaylist: true,
      extractorArgs: 'youtube:player_client=default,-android_sdkless'
    });

    const title = sanitizeTitle(meta.title);
    const filename = `${title}.mp3`;

    // 2. Set headers safely for file streaming attachments
    res.setHeader("Content-Type", "audio/mpeg");
    res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(filename)}"`);
    res.setHeader("Access-Control-Expose-Headers", "Content-Disposition");

    console.log(`[Production Link] Piping stream for: ${title}`);

    // 3. Spawn yt-dlp to stream the raw data directly to stdout
    const ytdlpProcess = ytDlp.exec(url, {
      output: '-', // Pipe directly to stdout
      format: 'bestaudio',
      noPlaylist: true,
      extractorArgs: 'youtube:player_client=default,-android_sdkless'
    });

    // 4. Pipe stdout directly into FFmpeg to convert to mp3 on-the-fly and send to response
    ffmpeg(ytdlpProcess.stdout)
      .toFormat('mp3')
      .audioBitrate(192) // Production balanced standard for bandwidth and quality
      .on('error', (err) => {
        console.error('FFmpeg conversion piping crashed:', err.message);
        if (!res.headersSent) {
          res.status(500).json({ error: "Audio processing pipeline failed." });
        }
      })
      .on('end', () => {
        console.log(`[Production Link] Stream successfully completed for: ${filename}`);
      })
      .pipe(res, { end: true });

    // Handle abrupt user cancellations mid-stream safely
    req.on('close', () => {
      ytdlpProcess.kill('SIGTERM');
    });

  } catch (error) {
    console.error("Metadata discovery failed:", error);
    return res.status(500).json({ error: "Could not retrieve video information. Check the URL structure." });
  }
});

// React routing catch-all fallback
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, "../frontend/build/index.html"));
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Production server bound and listening on port ${PORT}`);
});