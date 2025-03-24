/*import { NextApiRequest, NextApiResponse } from "next";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const apiKey = process.env.GROQ_API_KEY;

  if (!apiKey) {
    return res.status(500).json({ error: "API key not configured" });
  }

  const { prompt } = req.body;

  try {
    const response = await fetch("https://api.llama-groq.com/generate-questions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ prompt }),
    });

    if (!response.ok) {
      throw new Error("Failed to generate questions");
    }

    const data = await response.json();
    res.status(200).json(data);
  } catch (error) {
    console.error("Error generating questions:", error);
    res.status(500).json({ error: "Failed to generate questions" });
  }
}*/



import { NextApiRequest, NextApiResponse } from "next";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    try {
        // 🔍 Step 1: Validate API key
        if (!process.env.GROQ_API_KEY) {
            console.error("❌ GROQ_API_KEY is missing in .env.local");
            return res.status(500).json({ error: "Server misconfiguration: Missing API key" });
        }

        // 🔍 Step 2: Validate request method
        if (req.method !== "POST") {
            return res.status(405).json({ error: "Method Not Allowed" });
        }

        // 🔍 Step 3: Validate request body
        const { prompt } = req.body;
        if (!prompt || typeof prompt !== "string") {
            return res.status(400).json({ error: "Invalid request: 'prompt' is required" });
        }

        // 🔍 Step 4: Call the Llama API with the correct model and endpoint
        const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${process.env.GROQ_API_KEY}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                model: "llama3-70b-8192",  // ✅ Correct model name
                messages: [{ role: "user", content: prompt }],
            }),
        });

        // 🔍 Step 5: Handle API response errors
        if (!response.ok) {
            const errorText = await response.text();
            console.error("❌ Llama API Request Failed:", errorText);
            return res.status(response.status).json({ error: "Llama API request failed", details: errorText });
        }

        // ✅ Step 6: Return successful response
        const data = await response.json();
        return res.status(200).json({ questions: data.choices?.[0]?.message?.content || [] });

    } catch (error) {
        console.error("❌ Unexpected Error in API:", error);
        return res.status(500).json({ error: "Internal Server Error", details: String(error) });
    }
}
