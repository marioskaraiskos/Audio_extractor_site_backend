import express from "express";
import cors from "cors";
import { execFile } from "child_process";
import fs from "fs/promises"; 
import { existsSync } from "fs";
import path from "path";

const app = express();
const PORT = 5000;

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.send("Server is running 🚀");
});

app.post("/extract", (req, res) => {
  const { url } = req.body;

  if (!url) {
    return res.status(400).json({ error: "URL is required" });
  }

  // Senior Tip: We also strip out any characters that could mess with HTTP headers or shell paths
  const sanitizeTitle = (title) =>
    title.replace(/[\\/:*?"<>|\n\r\t]/g, "").trim() || "audio";

  execFile("yt-dlp", ["--get-title", "--no-warnings", url], async (err, stdout) => {
    if (err) {
      console.error("Title fetch error:", err);
      return res.status(500).json({ error: "Failed to get title" });
    }

    const title = sanitizeTitle(stdout);
    const finalName = `${title}.mp3`;
    const tempFile = `temp-${Date.now()}.mp3`;
    
    const tempPath = path.resolve(`./${tempFile}`);
    const finalPath = path.resolve(`./${finalName}`);

    const downloadArgs = [
      "-x",
      "--audio-format",
      "mp3",
      "--no-playlist",
      "--extractor-args",
      "youtube:player_client=default,-android_sdkless",
      "-o",
      tempPath,
      url
    ];

    execFile("yt-dlp", downloadArgs, async (error) => {
      if (error) {
        console.error("Download execution error:", error);
        return res.status(500).json({ error: "Download failed" });
      }

      try {
        await fs.rename(tempPath, finalPath);

        res.setHeader("Access-Control-Expose-Headers", "Content-Disposition");
        
        res.download(finalPath, finalName, async (downloadErr) => {
          if (downloadErr) console.error("Stream error:", downloadErr);

          try {
            if (existsSync(finalPath)) {
              await fs.unlink(finalPath);
            }
          } catch (unlinkErr) {
            console.error("Cleanup error:", unlinkErr);
          }
        });

      } catch (renameErr) {
        console.error("File processing failed:", renameErr);
        return res.status(500).json({ error: "File processing error" });
      }
    });
  });
});

// ==========================================
// FIX: This block keeps your server alive!
// ==========================================
app.listen(PORT, () => {
  console.log(`🚀 Backend running on http://localhost:${PORT}`);
});