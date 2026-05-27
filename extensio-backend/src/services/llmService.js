const OpenAI = require("openai");
const { openAiApiKey, openAiModel } = require("../config");
const { SYSTEM_PROMPT } = require("../prompts/systemPrompt");
const { keywordBasedFallbackExtension } = require("../templates/fallbackTemplates");

const openai = openAiApiKey ? new OpenAI({ apiKey: openAiApiKey }) : null;

function parseJsonSafely(rawText) {
  try {
    return JSON.parse(rawText);
  } catch {
    const start = rawText.indexOf("{");
    const end = rawText.lastIndexOf("}");
    if (start >= 0 && end > start) {
      const sliced = rawText.slice(start, end + 1);
      return JSON.parse(sliced);
    }
    throw new Error("AI output is not valid JSON");
  }
}

function validateOutputShape(parsed) {
  if (!parsed || typeof parsed !== "object") throw new Error("Invalid output object");
  if (!parsed.files || typeof parsed.files !== "object") throw new Error("Output must include files object");
  if (!parsed.files["manifest.json"]) throw new Error("Output must include manifest.json");
}

function fallbackGenerate(userPrompt) {
  return keywordBasedFallbackExtension(userPrompt);
}

async function generateExtensionFiles({ userPrompt, previousFiles }) {
  if (!openai) {
    return fallbackGenerate(userPrompt);
  }

  const userContent = previousFiles
    ? `User request: ${userPrompt}\n\nCurrent files JSON:\n${JSON.stringify(previousFiles)}`
    : `User request: ${userPrompt}`;

  const response = await openai.responses.create({
    model: openAiModel,
    input: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: userContent }
    ],
    temperature: 0.2
  });

  const text = response.output_text || "";
  const parsed = parseJsonSafely(text);
  validateOutputShape(parsed);
  return parsed;
}

module.exports = {
  generateExtensionFiles
};

