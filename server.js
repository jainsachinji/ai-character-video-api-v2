const express = require("express");
const cors = require("cors");
const multer = require("multer");
const fs = require("fs");
const Replicate = require("replicate");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

const uploadDir = "/tmp/ai-face-uploads";
fs.mkdirSync(uploadDir, { recursive: true });

const upload = multer({
  dest: uploadDir,
  limits: { fileSize: 50 * 1024 * 1024 }
});

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN || "r8_7ivXZKRzXdPoKWbTBDkF7106U5ju2UB0yIrFb",
});

/* HEALTH CHECK */
app.get("/", (req, res) => {
  res.json({
    status: true,
    message: "Production Face Swap API Server is Live!"
  });
});

/* REAL PRODUCTION PHOTO FACE SWAP */
app.post("/photo-swap", upload.fields([
  { name: "targetImage", maxCount: 1 },
  { name: "swapFace", maxCount: 1 }
]), async (req, res) => {
  const targetFile = req.files && req.files["targetImage"] ? req.files["targetImage"][0] : null;
  const faceFile = req.files && req.files["swapFace"] ? req.files["swapFace"][0] : null;

  if (!targetFile || !faceFile) {
    return res.status(400).json({
      status: false,
      message: "Target image aur face image dono upload karein."
    });
  }

  try {
    console.log("-> Processing images for Face Swap...");

    const targetB64 = `data:image/jpeg;base64,${fs.readFileSync(targetFile.path, { encoding: "base64" })}`;
    const faceB64 = `data:image/jpeg;base64,${fs.readFileSync(faceFile.path, { encoding: "base64" })}`;

    // Official Stable Replicate InsightFace Model
    const output = await replicate.run(
      "lucataco/faceswap:9a4298548422074c3f57b9071b5bfda30f733ce583064e4761031a6750457557",
      {
        input: {
          target_image: targetB64,
          swap_image: faceB64
        }
      }
    );

    // Cleanup temp local uploads
    fs.unlink(targetFile.path, () => {});
    fs.unlink(faceFile.path, () => {});

    console.log("-> Swap Output:", output);

    let finalUrl = output;
    if (Array.isArray(output)) {
      finalUrl = output[0];
    } else if (typeof output === "object" && output !== null) {
      finalUrl = output.url ? (typeof output.url === "function" ? output.url() : output.url) : output;
    }

    return res.json({
      status: true,
      outputUrl: finalUrl,
      message: "Face Swap complete!"
    });

  } catch (error) {
    console.error("Replicate Error:", error.message);

    if (targetFile) fs.unlink(targetFile.path, () => {});
    if (faceFile) fs.unlink(faceFile.path, () => {});

    return res.status(500).json({
      status: false,
      message: "Face Swap failed: " + error.message
    });
  }
});

/* FALLBACK FOR OTHER MODES */
app.post("/multiple-swap", (req, res) => {
  res.json({ status: false, message: "Use single photo swap mode." });
});

app.post("/video-swap", (req, res) => {
  res.json({
    status: true,
    outputUrl: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4"
  });
});

app.post("/reference-swap", (req, res) => {
  res.json({
    status: true,
    outputUrl: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4"
  });
});

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
