const fs = require("fs/promises");
const fsSync = require("fs");
const path = require("path");
const os = require("os");
const archiver = require("archiver");
const { nanoid } = require("nanoid");
const { buildDir } = require("../config");
const { sanitizeFiles } = require("./sanitizer");

async function ensureBuildDir() {
  await fs.mkdir(buildDir, { recursive: true });
}

async function writeFilesToDir(rootDir, files) {
  for (const [fileName, content] of Object.entries(files)) {
    const filePath = path.join(rootDir, fileName);
    const parent = path.dirname(filePath);
    await fs.mkdir(parent, { recursive: true });
    await fs.writeFile(filePath, String(content), "utf-8");
  }
}

function createZipFromDir(sourceDir, outPath) {
  return new Promise((resolve, reject) => {
    const output = fsSync.createWriteStream(outPath);
    const archive = archiver("zip", { zlib: { level: 9 } });

    output.on("close", () => resolve(outPath));
    archive.on("error", (err) => reject(err));

    archive.pipe(output);
    archive.directory(sourceDir, false);
    archive.finalize();
  });
}

function validateManifestJson(rawManifest) {
  const manifest = JSON.parse(rawManifest);
  if (manifest.manifest_version !== 3) {
    throw new Error("Generated manifest.json must use manifest_version 3");
  }
}

async function packageExtension(files) {
  await ensureBuildDir();
  const sanitized = sanitizeFiles(files);
  validateManifestJson(sanitized["manifest.json"]);

  const buildId = nanoid();
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "extensio-"));
  const zipPath = path.join(buildDir, `${buildId}.zip`);

  await writeFilesToDir(tempDir, sanitized);
  await createZipFromDir(tempDir, zipPath);

  return { buildId, zipPath, files: sanitized };
}

module.exports = {
  packageExtension
};
