const fs = require("fs-extra");
const archiver = require("archiver");
const path = require("path");

async function writeFiles(dirPath, files) {
    await fs.ensureDir(dirPath);

    for (const filename in files) {
        let content = files[filename];

        if (filename === "manifest.json" && typeof content === "string") {
            content = JSON.stringify(JSON.parse(content), null, 2);
        }

        await fs.writeFile(path.join(dirPath, filename), content);
    }
}

function sendZip(dirPath, projectId, res) {
    const zipPath = path.join(__dirname, "..", "tmp", `${projectId}.zip`);

    const output = fs.createWriteStream(zipPath);
    const archive = archiver("zip", { zlib: { level: 9 } });

    archive.pipe(output);
    archive.directory(dirPath, false);

    archive.on("error", (err) => {
        console.error(err);
        res.status(500).send("ZIP error");
    });

    output.on("close", () => {
        res.setHeader("Content-Type", "application/zip");
        res.setHeader("Content-Disposition", "attachment; filename=extension.zip");
        fs.createReadStream(zipPath).pipe(res);
    });

    archive.finalize();
}

module.exports = { writeFiles, sendZip };