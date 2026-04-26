const fs = require("fs-extra");
const path = require("path");

//since history.json is in backend/
const historyFile = path.join(__dirname, "../history.json");

// GET HISTORY
async function getHistory() {
  if (!(await fs.pathExists(historyFile))) {
    return [];
  }
  return await fs.readJson(historyFile);
}

// SAVE HISTORY
async function saveHistory(item) {
  let history = [];

  if (await fs.pathExists(historyFile)) {
    history = await fs.readJson(historyFile);
  }

  history.unshift(item);

  await fs.writeJson(historyFile, history, { spaces: 2 });
}

module.exports = { getHistory, saveHistory };