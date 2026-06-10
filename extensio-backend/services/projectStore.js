const fs = require("fs/promises");
const path = require("path");
const { nanoid } = require("nanoid");
const { dataDir } = require("../config");

const DB_PATH = path.join(dataDir, "projects.json");

async function ensureDb() {
  await fs.mkdir(dataDir, { recursive: true });
  try {
    await fs.access(DB_PATH);
  } catch {
    await fs.writeFile(DB_PATH, JSON.stringify({ users: [], projects: [] }, null, 2), "utf-8");
  }
}

async function readDb() {
  await ensureDb();
  const raw = await fs.readFile(DB_PATH, "utf-8");
  return JSON.parse(raw);
}

async function writeDb(db) {
  await fs.writeFile(DB_PATH, JSON.stringify(db, null, 2), "utf-8");
}

async function createUser({ firstName, lastName, email, mobile, passwordHash }) {
  const db = await readDb();
  const exists = db.users.some((u) => u.email.toLowerCase() === email.toLowerCase());
  if (exists) throw new Error("User already exists");
  const user = {
    id: nanoid(),
    firstName,
    lastName,
    email,
    mobile,
    passwordHash,
    plan: "free",
    createdAt: new Date().toISOString()
  };
  db.users.push(user);
  await writeDb(db);
  return user;
}

async function getUserByEmail(email) {
  const db = await readDb();
  return db.users.find((u) => u.email.toLowerCase() === email.toLowerCase()) || null;
}

async function getUserById(id) {
  const db = await readDb();
  return db.users.find((u) => u.id === id) || null;
}

async function setUserPlan(userId, plan) {
  const db = await readDb();
  const user = db.users.find((u) => u.id === userId);
  if (!user) throw new Error("User not found");
  user.plan = plan;
  user.updatedAt = new Date().toISOString();
  await writeDb(db);
  return user;
}

async function createProject({ userId, title, description, originalPrompt, files, buildId }) {
  const db = await readDb();
  const project = {
    id: nanoid(),
    userId,
    title,
    description,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    versions: [
      {
        id: nanoid(),
        prompt: originalPrompt,
        files,
        buildId,
        createdAt: new Date().toISOString()
      }
    ]
  };
  db.projects.push(project);
  await writeDb(db);
  return project;
}

async function listProjectsByUser(userId) {
  const db = await readDb();
  return db.projects.filter((p) => p.userId === userId);
}

async function getProjectById(projectId) {
  const db = await readDb();
  return db.projects.find((p) => p.id === projectId) || null;
}

async function appendProjectVersion({ projectId, prompt, files, buildId, title, description }) {
  const db = await readDb();
  const project = db.projects.find((p) => p.id === projectId);
  if (!project) throw new Error("Project not found");
  if (title) project.title = title;
  if (description) project.description = description;
  project.updatedAt = new Date().toISOString();
  project.versions.push({
    id: nanoid(),
    prompt,
    files,
    buildId,
    createdAt: new Date().toISOString()
  });
  await writeDb(db);
  return project;
}

module.exports = {
  createUser,
  getUserByEmail,
  getUserById,
  setUserPlan,
  createProject,
  listProjectsByUser,
  getProjectById,
  appendProjectVersion
};
