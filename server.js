const express = require("express");
const cors = require("cors");
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const app = express();

const PORT = process.env.PORT || 3000;
const MAX_VIDEO_SECONDS = 30;
const GUEST_HISTORY_TIME = 24 * 60 * 60 * 1000;

app.use(cors());
app.use(express.json({ limit: "2mb" }));

// Temporary upload folder
const uploadDir = path.join("/tmp", "ai-video-uploads");

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Upload settings
const upload = multer({
  dest: uploadDir,
  limits: {
    fileSize: 200 * 1024 * 1024
  }
});

// Temporary jobs storage
const jobs = new Map();

/* =========================
   HOME / HEALTH CHECK
========================= */

app.get("/", (req, res) => {
  res.json({
    status: true,
    service: "AI Character Video API",
    message: "AI Video API is running successfully!",
    max_video_seconds: MAX_VIDEO_SECONDS
  });
});

/* =========================
   UPLOAD REFERENCE VIDEO
========================= */

app.post(
  "/upload-reference",
  upload.single("referenceVideo"),
  (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          status: false,
          message: "Reference video is required."
        });
      }

      const referenceId = crypto.randomUUID();

      jobs.set(referenceId, {
        id: referenceId,
        type: "reference",
        file: req.file,
        createdAt: Date.now(),
        status: "uploaded"
      });

      res.json({
        status: true,
        referenceId: referenceId,
        message: "Reference video uploaded successfully.",
        max_duration_seconds: MAX_VIDEO_SECONDS
      });
    } catch (error) {
      res.status(500).json({
        status: false,
        message: error.message
      });
    }
  }
);

/* =========================
   UPLOAD CHARACTER
========================= */

app.post(
  "/upload-character",
  upload.single("character"),
  (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          status: false,
          message: "Character image or video is required."
        });
      }

      const characterId = crypto.randomUUID();

      jobs.set(characterId, {
        id: characterId,
        type: "character",
        file: req.file,
        createdAt: Date.now(),
        status: "uploaded"
      });

      res.json({
        status: true,
        characterId: characterId,
        message: "Character uploaded successfully."
      });
    } catch (error) {
      res.status(500).json({
        status: false,
        message: error.message
      });
    }
  }
);

/* =========================
   CREATE VIDEO GENERATION JOB
========================= */

app.post("/generate-video", async (req, res) => {
  try {
    const {
      referenceId,
      characterId,
      prompt,
      userId,
      guest
    } = req.body;

    if (!referenceId) {
      return res.status(400).json({
        status: false,
        message: "Reference video is required."
      });
   
