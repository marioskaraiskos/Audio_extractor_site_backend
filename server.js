import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import ytDlp from 'yt-dlp-exec';
import ffmpeg from 'fluent-ffmpeg';
import rateLimit from 'express-rate-limit';

const app = express();
const PORT = process.env.PORT || 5000; 

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Resolve the absolute path to your cookies file safely
const cookiesPath = path.resolve(__dirname, './youtube-cookies.txt');

app.set('trust proxy', 1);

app.use(cors({
  origin: process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : '*',
  optionsSuccessStatus: 200
}));
app.use(express.json());

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

  // Define shared robust configurations to bypass data-center blocks
  const ytDlpOptions = {
    binaryPath: '/usr/local/bin/yt-dlp',
    cookies: cookiesPath,
    noPlaylist: true,
    format: "bestaudio/best",
    noCheckCertificates: true,
    extractorArgs: "youtube:client=tv",
};

  let ytdlpProcess = null;

  try {
    // 1. Fetch metadata using the updated mobile spoof signatures
    const meta = await ytDlp(url, {
      ...ytDlpOptions,
      dumpSingleJson: true,
    });

    const title = sanitizeTitle(meta.title || "audio");
    const filename = `${title}.mp3`;

    res.setHeader("Content-Type", "audio/mpeg");
    res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(filename)}"`);
    res.setHeader("Access-Control-Expose-Headers", "Content-Disposition");

    console.log(`[Production Link] Piping stream for: ${title}`);

    // 2. Execute binary stream generation safely
    ytdlpProcess = ytDlp.exec(url, {
      ...ytDlpOptions,
      output: '-', 
      format: 'bestaudio',
    });

    // Ensure we capture internal runtime errors from the spawned process
    ytdlpProcess.catch((spawnErr) => {
      console.error('yt-dlp child process threw an execution error:', spawnErr.message);
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
      if (ytdlpProcess) {
        ytdlpProcess.kill('SIGTERM');
      }
    });

  } catch (error) {
    console.error("Metadata discovery failed:", error);
    
    // Clean up active subprocess if metadata phase worked but processing breaks
    if (ytdlpProcess) {
      ytdlpProcess.kill('SIGTERM');
    }

    return res.status(500).json({ 
      error: "Could not retrieve video information. Cloud instance rate-limited by target provider." 
    });
  }
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Production server bound and listening on port ${PORT}`);
});