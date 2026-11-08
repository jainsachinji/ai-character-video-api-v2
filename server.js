import express from "express";
import cors from "cors";
import multer from "multer";
import { Client } from "@gradio/client";
import fs from "fs";

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Temp upload folder setup
const upload = multer({ dest: "uploads/" });

// Health Check Route
app.get("/", (req, res) => {
  res.send("AI Face Swap & Motion Backend is running live!");
});

// Photo Swap Free Route (Hugging Face Space)
app.post("/photo-swap", upload.fields([{ name: "targetImage" }, { name: "swapFace" }]), async (req, res) => {
  try {
    const targetFile = req.files["targetImage"] ? req.files["targetImage"][0] : null;
    const sourceFaceFile = req.files["swapFace"] ? req.files["swapFace"][0] : null;

    if (!targetFile || !sourceFaceFile) {
      return res.status(400).json({ status: false, message: "Dono photos upload karein." });
    }

    // Hugging Face ke free Face Swap Space se connect
    const client = await Client.connect("tonyassi/face-swap");

    const targetBlob = new Blob([fs.readFileSync(targetFile.path)]);
    const sourceBlob = new Blob([fs.readFileSync(sourceFaceFile.path)]);

    // AI Prediction call (No Token / Free)
    const result = await client.predict("/predict", {
      target: targetBlob,
      source: sourceBlob,
    });

    // Temp local files delete karein
    try {
      fs.unlinkSync(targetFile.path);
      fs.unlinkSync(sourceFaceFile.path);
    } catch (e) {}

    // Output URL return
    if (result && result.data && result.data[0]) {
      const outputUrl = result.data[0].url || result.data[0];
      return res.json({ status: true, outputUrl: outputUrl });
    } else {
      throw new Error("AI output URL generate nahi ho payi.");
    }

  } catch (error) {
    console.error("Swap Error:", error);
    return res.status(500).json({ status: false, message: error.message || "Face swap failed" });
  }
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
