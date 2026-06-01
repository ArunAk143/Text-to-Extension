const FORBIDDEN_PATTERNS = [
  /eval\s*\(/i,
  /new\s+Function\s*\(/i,
  /document\.write\s*\(/i,
  /innerHTML\s*=\s*.*<script/i
];

function sanitizeFileContent(content) {
  const normalized = String(content || "");
  for (const pattern of FORBIDDEN_PATTERNS) {
    if (pattern.test(normalized)) {
      throw new Error(`Generated content contains forbidden pattern: ${pattern}`);
    }
  }
  return normalized;
}

function assertSafeFileName(fileName) {
  if (fileName.includes("..") || fileName.startsWith("/") || fileName.startsWith("\\")) {
    throw new Error(`Unsafe file name: ${fileName}`);
  }
}

function sanitizeFiles(files) {
  const result = {};
  for (const [fileName, content] of Object.entries(files || {})) {
    assertSafeFileName(fileName);
    result[fileName] = sanitizeFileContent(content);
  }
  return result;
}

module.exports = {
  sanitizeFiles
};
