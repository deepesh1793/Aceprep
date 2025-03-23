import { NextApiRequest, NextApiResponse } from "next";
import formidable from "formidable";
import fs from "fs";
import pdfParse from "pdf-parse";
import mammoth from "mammoth";
import OpenAI from "openai";

export const config = {
  api: {
    bodyParser: false, // Required for handling file uploads
  },
};

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function extractText(file: formidable.File): Promise<string> {
  const filePath = file.filepath;
  const fileExt = file.originalFilename?.split(".").pop()?.toLowerCase();

  try {
    if (fileExt === "pdf") {
      const data = await pdfParse(fs.readFileSync(filePath));
      return data.text || "No text found in PDF.";
    } else if (fileExt === "docx") {
      const { value } = await mammoth.extractRawText({ path: filePath });
      return value || "No text found in DOCX.";
    } else if (fileExt === "txt") {
      return fs.readFileSync(filePath, "utf8") || "No text found in TXT.";
    } else {
      return "Unsupported file format. Please upload PDF, DOCX, or TXT.";
    }
  } catch (error) {
    console.error("Error extracting text:", error);
    return "Error extracting text from the file.";
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === "POST") {
    const form = new formidable.IncomingForm();

    form.parse(req, async (err, fields, files) => {
      if (err) return res.status(500).json({ message: "File upload error" });

      const file = files.resume as formidable.File;
      const resumeText = await extractText(file);

      if (resumeText.startsWith("Unsupported") || resumeText.startsWith("Error")) {
        return res.status(400).json({ message: resumeText });
      }

      try {
        // Truncate to avoid exceeding token limit
        const truncatedText = resumeText.slice(0, 2000);

        const response = await openai.chat.completions.create({
          model: "gpt-4",
          messages: [
            { role: "system", content: "You are a professional resume reviewer. Provide feedback on clarity, conciseness, and impact." },
            { role: "user", content: `Here is a resume:\n\n${truncatedText}` },
          ],
          max_tokens: 500,
        });

        const feedback = response.choices[0]?.message?.content || "No feedback available.";

        return res.status(200).json({ feedback });
      } catch (error) {
        console.error("OpenAI API Error:", error);
        return res.status(500).json({ message: "Error generating feedback" });
      }
    });
  } else {
    res.status(405).json({ message: "Method Not Allowed" });
  }
}
