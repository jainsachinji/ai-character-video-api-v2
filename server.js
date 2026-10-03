const express = require("express");
const cors = require("cors");
const multer = require("multer");
const fs = require("fs");
const crypto = require("crypto");

const app = express();

const PORT = process.env.PORT || 3000;
const MAX_VIDEO_SECONDS = 30;
const GUEST_HISTORY_MS = 24 * 60 * 60 * 1000;

app.use(cors());
app.use(express.json({ limit: "2mb" }));

const uploadDir = "/tmp/ai-video-uploads";

fs.mkdirSync(uploadDir, { recursive: true });

const upload = multer({
  dest: uploadDir,
  limits: {
    fileSize: 200 * 1024 * 1024
  }
});

const jobs = new Map();

/* HOME */

app.get("/", (req, res) => {
  res.json({
    status: true,
    service: "AI Character Video API",
    message: "AI Video API is running successfully!",
    max_video_seconds: MAX_VIDEO_SECONDS
  });
});

/* UPLOAD REFERENCE VIDEO */

app.post(
  "/upload-reference",
  upload.single("referenceVideo"),
  (req, res) => {
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
      status: "uploaded",
      createdAt: Date.now()
    });

    res.json({
      status: true,
      referenceId: referenceId,
      message: "Reference video uploaded successfully.",
      max_duration_seconds: MAX_VIDEO_SECONDS
    });
  }
);

/* UPLOAD CHARACTER */

app.post(
  "/upload-character",
  upload.single("character"),
  (req, res) => {
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
      status: "uploaded",
      createdAt: Date.now()
    });

    res.json({
      status: true,
      characterId: characterId,
      message: "Character uploaded successfully."
    });
  }
);

/* CREATE VIDEO JOB */

app.post("/generate-video", (req, res) => {
  const {
    referenceId,
    characterId,
    prompt,
    userId,
    guest
  } = req.body || {};

  if (!referenceId || !characterId || !prompt || !prompt.trim()) {
    return res.status(400).json({
      status: false,
      message: "referenceId, characterId and prompt are required."
    });
  }

  if (!jobs.has(referenceId)) {
    return res.status(404).json({
      status: false,
      message: "Reference video not found."
    });
  }

  if (!jobs.has(characterId)) {
    return res.status(404).json({
      status: false,
      message: "Character not found."
    });
  }

  const jobId = crypto.randomUUID();

  jobs.set(jobId, {
    id: jobId,
    status: "queued",
    referenceId: referenceId,
    characterId: characterId,
    prompt: prompt.trim(),
    userId: userId || null,
    guest: guest !== false,
    duration: MAX_VIDEO_SECONDS,
    resultUrl: null,
    createdAt: Date.now()
  });

  res.json({
    status: true,
    jobId: jobId,
    state: "queued",
    message: "Video generation job created.",
    max_duration_seconds: MAX_VIDEO_SECONDS
  });
});

/* JOB STATUS */

app.get("/job-status/:jobId", (req, res) => {
  const job = jobs.get(req.params.jobId);

  if (!job) {
    return res.status(404).json({
      status: false,
      message: "Job not found."
    });
  }

  res.json({
    status: true,
    jobId: job.id,
    state: job.status,
    resultUrl: job.resultUrl,
    duration: job.duration || MAX_VIDEO_SECONDS
  });
});

/* DELETE HISTORY */

app.post("/history/delete", (req, res) => {
  const { jobId } = req.body || {};

  if (!jobId) {
    return res.status(400).json({
      status: false,
      message: "jobId is required."
    });
  }

  jobs.delete(jobId);

  res.json({
    status: true,
    message: "History deleted permanently."
  });
});

/* DELETE GUEST HISTORY AFTER 24 HOURS */

setInterval(() => {
  const cutoff = Date.now() - GUEST_HISTORY_MS;

  for (const [id, job] of jobs.entries()) {
    if (
      job.guest === true &&
      job.createdAt < cutoff
    ) {
      jobs.delete(id);
    }
  }
}, 60 * 60 * 1000);

/* START SERVER */

app.listen(PORT, () => {
  console.log(
    `AI Character Video API running on port ${PORT}`
  );
});
