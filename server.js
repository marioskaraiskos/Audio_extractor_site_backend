import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import ytDlp from 'yt-dlp-exec';
import ffmpeg from 'fluent-ffmpeg';
import rateLimit from 'express-rate-limit';

const app = express();
const PORT = process.env.PORT || 5000; 

// --- FIXED: Trust Render's upstream load balancers and reverse proxies ---
app.set('trust proxy', 1);

app.use(cors({
  origin: process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : '*',
  optionsSuccessStatus: 200
}));
app.use(express.json());

// --- FIXED: Removed the local static file build paths since the frontend is hosted elsewhere! ---

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, 
  max: 30, 
  message: { error: "Too many extraction requests from this IP, please try again later." },
  standardHeaders: true,
  legacyHeaders: false,
});

const sanitizeTitle = (title) => {
  return title
    .replace(/[\\/:*?"<>|]/g, "")
    .replace(/\s+/g, "_")
    .trim() || "audio";
};

app.get("/status", (req, res) => {
  res.status(200).json({ status: "healthy", timestamp: new Date() });
});

app.post("/extract", apiLimiter, async (req, res) => {
  const { url } = req.body;

  if (!url) {
    return res.status(400).json({ error: "URL parameter is missing." });
  }

  try {
    // 1. FIXED: Changed client profile extractor args to 'web_creator' or 'ios' or 'tv'
    // This makes yt-dlp emulate common app devices, which bypasses the data center bot wall.
    const meta = await ytDlp(url, {
      dumpJson: true,
      noPlaylist: true,
      extractorArgs: 'youtube:player_client=ios,web_creator' 
    });

    const title = sanitizeTitle(meta.title || "audio");
    const filename = `${title}.mp3`;

    res.setHeader("Content-Type", "audio/mpeg");
    res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(filename)}"`);
    res.setHeader("Access-Control-Expose-Headers", "Content-Disposition");

    console.log(`[Production Link] Piping stream for: ${title}`);

    // 2. FIXED: Update the download client payload args here too!
    const ytdlpProcess = ytDlp.exec(url, {
      output: '-', 
      format: 'bestaudio',
      noPlaylist: true,
      extractorArgs: 'youtube:player_client=ios,web_creator'
    });

    ffmpeg(ytdlpProcess.stdout)
      .toFormat('mp3')
      .audioBitrate(192) 
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

    req.on('close', () => {
      ytdlpProcess.kill('SIGTERM');
    });

  } catch (error) {
    console.error("Metadata discovery failed:", error);
    return res.status(500).json({ error: "Could not retrieve video information. Device blocked by video provider." });
  }
});

// --- FIXED: Removed the old catch-all route completely ---

app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Production server bound and listening on port ${PORT}`);
});