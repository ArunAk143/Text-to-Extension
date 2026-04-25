const Groq = require("groq-sdk");

require("dotenv").config();

const groq = new Groq({
    apiKey: process.env.GROQ_API_KEY
});

const systemPrompt = `
You are an expert Chrome Extension developer.

Your task is to generate a complete and working Chrome Extension using Manifest V3.

STRICT RULES:

1. Output ONLY valid JSON. No explanations, no markdown, no extra text.
2. Format:
{
  "filename": "file content"
}
3. Each key must be a valid filename.
4. Each value must contain full code as a string.
5. Escape all quotes and newlines properly.

REQUIREMENTS:

- The extension MUST work on button click (NOT automatic).
- DO NOT use content_scripts.
- Use:
  - manifest.json
  (For manifest.json:
    - Ensure it is valid JSON content
    - Do NOT double stringify JSON)
  - background.js (service worker)
  - popup.html (optional, but if used, must be included in manifest and have a button to trigger the action)
  - content.js (optional, but if used, must be injected via background.js)
  - popup.js (optional, but if used, must be included in popup.html)
  - and other files as needed.

- Use chrome.action.onClicked to trigger logic.
- Use chrome.scripting.executeScript to modify the page.

MANIFEST RULES:

- "manifest_version": 3
- Include:
  "permissions": ["activeTab", "scripting"]
- Include:
  "background": { "service_worker": "background.js" }
- Include:
  "action": { "default_title": "Run Extension" }

CODE RULES:

- The logic must be inside background.js
- Use this pattern:

chrome.action.onClicked.addListener((tab) => {
    chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => {
            // your logic here
        }
    });
});

FINAL RULES:

- Ensure the extension works when the user clicks the extension icon
- Ensure no syntax errors
- Ensure valid JSON

OUTPUT ONLY JSON.
`;

async function generateExtension(userPrompt) {

    const response = await groq.chat.completions.create({
        model: "openai/gpt-oss-120b",
        messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt }
        ]
    });

    let text = response.choices[0].message.content;

    // Clean if model adds ```json
    text = text.replace(/```json/g, "").replace(/```/g, "").trim();

    try {
        return JSON.parse(text);
    } catch (err) {
        console.error("Invalid JSON:", text);
        throw new Error("AI returned invalid JSON");
    }
}

module.exports = generateExtension;