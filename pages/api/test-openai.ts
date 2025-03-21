import { NextApiRequest, NextApiResponse } from "next";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.NEXT_PUBLIC_OPENAI_API_KEY, // Ensure your .env file has this key
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo", // You can change this to another available model
      messages: [{ role: "user", content: "Say 'Hello, OpenAI is working!'" }],
    });

    res.status(200).json({ result: completion.choices[0].message.content });
  } catch (error) {
    res.status(500).json({ result: `Error: ${(error as any).message}` });
  }
}
