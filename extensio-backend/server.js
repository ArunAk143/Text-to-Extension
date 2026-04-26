const express = require("express");
const cors = require("cors");
require("dotenv").config();
const path = require("path");
const { v4: uuidv4 } = require("uuid");

const generateFiles = require("./services/aiService");
const { writeFiles, sendZip } = require("./utils/fileHandler");
const { getHistory, saveHistory } = require("./utils/historyHandler");

const app = express();
app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
    res.send("Extensio.ai API running 🚀");
});

// AI ROUTE
app.post("/generate", async (req, res) => {
    try {
        const { prompt, editedFrom } = req.body;

        if (!prompt) {
            return res.status(400).send("Prompt is required");
        }

        const files = await generateFiles(prompt);

        if (!files["manifest.json"]) {
            throw new Error("manifest.json missing");
        }

        const projectId = uuidv4();
        const dirPath = path.join(__dirname, "tmp", projectId);

        await writeFiles(dirPath, files);

        const historyItem = {  
            prompt,  
            timestamp: new Date().toISOString(),  
            zipPath: `/download/${projectId}`  
        };

        await saveHistory(historyItem);

        sendZip(dirPath, projectId, res);

    } catch (err) {
        console.error(err);
        res.status(500).send(err.message);
    }
});

app.get("/history", async (req, res) => {
    try {
        const history = await getHistory();
        res.json(history);
    } catch (err) {
        res.status(500).send("Error fetching history");
    }
});

app.get("/download/:id", (req, res) => {
    const filePath = path.join(__dirname, "tmp", `${req.params.id}.zip`);
    res.download(filePath);
});

app.listen(3000, () => console.log("Server running on port 3000"));