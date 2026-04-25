const fs = require("fs-extra");
const path = require("path");
const archiver = require("archiver");

async function createZipFromJSON(filesJSON) {

    const tempDir = path.join(__dirname, "../temp");

    // 1. Clear and recreate temp folder
    await fs.emptyDir(tempDir);

    // 2. Write files properly
    for (let filename in filesJSON) {
        const filePath = path.join(tempDir, filename);

        await fs.outputFile(filePath, filesJSON[filename]);
    }

    // 3. Create ZIP
    const zipPath = path.join(__dirname, "../extension.zip");

    return new Promise((resolve, reject) => {

        const output = fs.createWriteStream(zipPath);
        const archive = archiver("zip", { zlib: { level: 9 } });

        output.on("close", () => {
            console.log("ZIP created:", archive.pointer(), "bytes");
            resolve(zipPath);
        });

        archive.on("error", (err) => {
            reject(err);
        });

        archive.pipe(output);

        // IMPORTANT: include folder content
        archive.directory(tempDir, false);

        archive.finalize();
    });
}

module.exports = createZipFromJSON;