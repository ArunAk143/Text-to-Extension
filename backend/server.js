const express = require("express"); 
const cors = require("cors"); 
const app = express(); 
app.use(cors()); 
app.use(express.json()); 
const generateExtension = require("./services/aiService");
const createZipFromJSON = require("./utils/fileHandler");

app.get("/", (req, res) => {
    res.send("Backend is working");
});

app.post("/generate", async (req, res) => {

    try {
        const prompt = req.body.prompt;

        console.log("User Prompt:", prompt);

        // 1. Call  AI
        const aiResult = await generateExtension(prompt);

        // 2. Convert to ZIP
        const zipPath = await createZipFromJSON(aiResult);

        // 3. Send ZIP
        res.download(zipPath, "extension.zip");

    } catch (err) {
        console.error(err);
        res.status(500).send("Error generating extension");
    }

});

app.listen(5000, () => {
    console.log("Server running on port 5000");
});