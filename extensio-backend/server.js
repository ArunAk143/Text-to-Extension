const cors = require("cors");
require("dotenv").config();
const OpenAI = require("openai");

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

const express = require("express");
const fs = require("fs-extra");
const archiver = require("archiver");
const { v4: uuidv4 } = require("uuid");
const path = require("path");

const app = express();
app.use(cors());
app.use(express.json());


// 🔹 Home
app.get("/", (req, res) => {
  res.send("Extensio.ai API running 🚀");
});


// 🔥 TEST ROUTE (manual fallback)
app.get("/generate", async (req, res) => {
  try {
    const projectId = uuidv4();
    const dirPath = path.join(__dirname, "tmp", projectId);

    await fs.ensureDir(dirPath);

    await fs.writeFile(
      path.join(dirPath, "manifest.json"),
      JSON.stringify({
        manifest_version: 3,
        name: "Demo Extension",
        version: "1.0",
        content_scripts: [
          {
            matches: ["<all_urls>"],
            js: ["content.js"]
          }
        ]
      }, null, 2)
    );

    await fs.writeFile(
      path.join(dirPath, "content.js"),
      `document.body.style.background='red';`
    );

    sendZip(dirPath, projectId, res);

  } catch (err) {
    res.status(500).send(err.message);
  }
});


// 🔥 AI ROUTE (FINAL IMPROVED)
app.post("/generate", async (req, res) => {
  try {
    const { prompt } = req.body;

    if (!prompt) {
      return res.status(400).send("Prompt is required");
    }

    console.log("PROMPT:", prompt);

    let files;

    try {
      const completion = await openai.chat.completions.create({
        model: "gpt-5",
        messages: [
          {
            role: "system",
            content: `
You are an expert Chrome Extension Developer.

Return ONLY JSON:
{
  "manifest.json": "...",
  "content.js": "...",
  "popup.html": "...",
  "popup.js": "...",
  "popup.css": "..."
}

Rules:
- No explanation
- No markdown
- Only valid JSON
- Use Manifest V3
- Include popup ONLY if needed
- content.js must perform correct logic

IMPORTANT:
- NEVER use "*" selector
- ONLY target text elements:
  p, span, h1, h2, h3, h4, h5, h6, a, li

- When changing text color, use:
  el.style.setProperty("color", "green", "important");

Example:

document.querySelectorAll("p, span, h1, h2, h3, h4, h5, h6, a, li")
.forEach(el => {
  el.style.setProperty("color", "green", "important");
});
`
          },
          {
            role: "user",
            content: prompt
          }
        ]
      });

      let aiOutput = completion.choices[0].message.content;
      console.log("RAW AI:", aiOutput);

      // 🔧 CLEAN JSON
      aiOutput = aiOutput.replace(/```json|```/g, "").trim();

      const start = aiOutput.indexOf("{");
      const end = aiOutput.lastIndexOf("}") + 1;

      const jsonString = aiOutput.substring(start, end);

      files = JSON.parse(jsonString);

    } catch (err) {
      console.log("⚠️ Using fallback");

      files = {
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

        "content.js": `
document.querySelectorAll("p, span, h1, h2, h3, h4, h5, h6, a, li")
.forEach(el => {
  el.style.setProperty("color", "green", "important");
});
`
      };
    }

    if (!files["manifest.json"]) {
      throw new Error("manifest.json missing");
    }

    const projectId = uuidv4();
    const dirPath = path.join(__dirname, "tmp", projectId);

    await fs.ensureDir(dirPath);

    // 🔥 WRITE FILES
    for (const filename in files) {
      let content = files[filename];

      if (filename === "manifest.json" && typeof content === "string") {
        content = JSON.stringify(JSON.parse(content), null, 2);
      }

      await fs.writeFile(path.join(dirPath, filename), content);
    }

    sendZip(dirPath, projectId, res);

  } catch (err) {
    console.error(err);
    res.status(500).send("Error: " + err.message);
  }
});


// 🔥 ZIP FUNCTION
function sendZip(dirPath, projectId, res) {
  const zipPath = path.join(__dirname, "tmp", `${projectId}.zip`);

  const output = fs.createWriteStream(zipPath);
  const archive = archiver("zip", {
    zlib: { level: 9 }
  });

  archive.pipe(output);
  archive.directory(dirPath, false);

  archive.on("error", (err) => {
    console.error("Archive error:", err);
    res.status(500).send("ZIP error");
  });

  output.on("close", () => {
    console.log("ZIP COMPLETE:", zipPath);

    res.setHeader("Content-Type", "application/zip");
    res.setHeader("Content-Disposition", "attachment; filename=extension.zip");

    fs.createReadStream(zipPath).pipe(res);
  });

  archive.finalize();
}

app.listen(3000, () => console.log("Server running on port 3000"));