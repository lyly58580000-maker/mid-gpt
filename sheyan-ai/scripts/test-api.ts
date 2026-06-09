import { readFileSync } from "fs";
import { createOpenAI } from "@ai-sdk/openai";
import { streamText, generateText } from "ai";

for (const line of readFileSync(".env.local", "utf8").split("\n")) {
  const idx = line.indexOf("=");
  if (idx > 0 && !line.startsWith("#")) {
    const key = line.slice(0, idx).trim();
    let val = line.slice(idx + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    process.env[key] = val;
  }
}

const openai = createOpenAI({
  apiKey: process.env.TEXT_API_KEY,
  baseURL: process.env.TEXT_API_BASE_URL,
});

async function main() {
  try {
    const gen = await generateText({
      model: openai(process.env.TEXT_MODEL_NAME ?? "gpt-5.5"),
      prompt: "你是谁，用一句话中文回答",
    });
    console.log("generateText:", gen.text);
  } catch (e) {
    console.log("generateText ERR:", e instanceof Error ? e.message : e);
  }

  try {
    const result = streamText({
      model: openai(process.env.TEXT_MODEL_NAME ?? "gpt-5.5"),
      prompt: "你是谁",
    });
    let chunks = "";
    for await (const c of result.textStream) chunks += c;
    const text = await result.text;
    console.log("textStream chunks:", chunks.length, "await text:", text.length);
    console.log("text preview:", text.slice(0, 120));
  } catch (e) {
    console.log("streamText ERR:", e instanceof Error ? e.message : e);
  }
}

main();
