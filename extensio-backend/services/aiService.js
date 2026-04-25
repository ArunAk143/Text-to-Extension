const Groq = require("groq-sdk");

const groq = new Groq({
    apiKey: process.env.GROQ_API_KEY
});

async function generateFiles(prompt) {
    try {
        const completion = await groq.chat.completions.create({
            model: "openai/gpt-oss-120b",
            messages: [
                {
                    role: "system",
                    content: `
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
`
                },
                {
                    role: "user",
                    content: prompt
                }
            ]
        });

        let aiOutput = completion.choices[0].message.content;

        aiOutput = aiOutput.replace(/```json|```/g, "").trim();

        const start = aiOutput.indexOf("{");
        const end = aiOutput.lastIndexOf("}") + 1;

        return JSON.parse(aiOutput.substring(start, end));

    } catch (err) {
        console.log("⚠️ Using fallback");

        return {
            "manifest.json": JSON.stringify({
                manifest_version: 3,
                name: "Fallback Extension",
                version: "1.0",
                content_scripts: [
                    {
                        matches: ["<all_urls>"],
                        js: ["content.js"]
                    }
                ]
            }, null, 2),

            "content.js": `document.body.style.background='green';`
        };
    }
}

module.exports = generateFiles;