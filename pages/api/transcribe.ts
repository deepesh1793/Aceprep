import OpenAI from "openai";
import { IncomingForm } from "formidable";
import fs from "fs";
import os from "os";
import path from "path";

export const config = {
  api: {
    bodyParser: false, // Disable body parser for file uploads
  },
};

export default async function handler(req: any, res: any) {
  try {
    // Initialize OpenAI instance
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    // Parse the incoming form data
    const fData = await new Promise<{ fields: any; files: any }>((resolve, reject) => {
      const form = new IncomingForm({
        multiples: false,
        uploadDir: os.tmpdir(), // Use system temp directory
        keepExtensions: true,
      });

      form.parse(req, (err, fields, files) => {
        if (err) {
          console.error("Form parsing error:", err);
          return reject(err);
        }
        resolve({ fields, files });
      });
    });

    const videoFile = fData.files.file;

    if (!videoFile) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const videoFilePath = videoFile.filepath || videoFile.path;

    console.log("Uploaded file path:", videoFilePath);

    // Ensure the file exists before processing
    if (!fs.existsSync(videoFilePath)) {
      console.error("File not found:", videoFilePath);
      return res.status(500).json({ error: "File not found. Please try again." });
    }

    // Wait until the file is fully available
    await new Promise((resolve, reject) => {
      fs.stat(videoFilePath, (err, stats) => {
        if (err) {
          console.error("File access error:", err);
          return reject(err);
        }
        resolve(stats);
      });
    });

    // Call OpenAI Whisper API for transcription
    const resp = await openai.audio.transcriptions.create({
      file: fs.createReadStream(videoFilePath),
      model: "whisper-1",
    });

    const transcript = resp.text;

    console.log("Transcript:", transcript);

    // Content moderation check
    const response = await openai.moderations.create({
      input: transcript,
    });

    if (response.results[0].flagged) {
      return res.status(200).json({ error: "Inappropriate content detected. Please try again." });
    }

    res.status(200).json({ transcript });
  } catch (error) {
    console.error("Server error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}
