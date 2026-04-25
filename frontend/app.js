const API_BASE = "http://localhost:4000";
let authToken = "";

const authStatus = document.getElementById("authStatus");
const projectsList = document.getElementById("projectsList");
const registerBtn = document.getElementById("registerBtn");
const loginBtn = document.getElementById("loginBtn");
const generateBtn = document.getElementById("generateBtn");
const promptInput = document.getElementById("prompt");
const generateSection = document.getElementById("generateSection");

function isLoggedIn() {
  return Boolean(authToken);
}

function updateGenerateAccess() {
  const allowGenerate = isLoggedIn();
  generateBtn.disabled = !allowGenerate;
  promptInput.disabled = !allowGenerate;
  generateSection.classList.toggle("hidden", !allowGenerate);
  generateBtn.title = allowGenerate ? "" : "First login then generate";
  promptInput.title = allowGenerate ? "" : "First login then generate";
}

function setStatus(message, type = "success") {
  authStatus.textContent = message;
  authStatus.classList.remove("status-success", "status-error", "status-neutral");
  authStatus.classList.add(`status-${type}`);
}

function validateCreds(email, password) {
  if (!email || !password) {
    throw new Error("Email and password are required");
  }
  if (!email.includes("@")) {
    throw new Error("Please enter a valid email");
  }
  if (password.length < 6) {
    throw new Error("Password must be at least 6 characters");
  }
}

function setAuthButtonsLoading(isLoading) {
  registerBtn.disabled = isLoading;
  loginBtn.disabled = isLoading;
  registerBtn.textContent = isLoading ? "Please wait..." : "Register";
  loginBtn.textContent = isLoading ? "Please wait..." : "Login";
}

function getCreds() {
  return {
    email: document.getElementById("email").value.trim(),
    password: document.getElementById("password").value.trim()
  };
}

async function api(path, options = {}) {
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {})
  };
  if (authToken) headers.Authorization = `Bearer ${authToken}`;

  let response;
  try {
    response = await fetch(`${API_BASE}${path}`, { ...options, headers });
  } catch {
    throw new Error("Cannot connect to server. Start backend on http://localhost:4000");
  }

  let data = null;
  try {
    data = await response.json();
  } catch {
    data = null;
  }

  if (!response.ok) {
    throw new Error((data && data.error) || "Request failed");
  }
  return data;
}

async function register() {
  const { email, password } = getCreds();
  validateCreds(email, password);
  setAuthButtonsLoading(true);
  setStatus("Creating account...", "neutral");
  const data = await api("/api/auth/register", {
    method: "POST",
    body: JSON.stringify({ email, password })
  });
  authToken = data.token;
  setStatus(`Registered: ${data.user.email}`, "success");
  updateGenerateAccess();
  await loadProjects();
  setAuthButtonsLoading(false);
}

async function login() {
  const { email, password } = getCreds();
  validateCreds(email, password);
  setAuthButtonsLoading(true);
  setStatus("Signing in...", "neutral");
  const data = await api("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password })
  });
  authToken = data.token;
  setStatus(`Logged in: ${data.user.email}`, "success");
  updateGenerateAccess();
  await loadProjects();
  setAuthButtonsLoading(false);
}

async function generateProject() {
  if (!isLoggedIn()) {
    setStatus("First login then generate", "error");
    return;
  }

  const prompt = document.getElementById("prompt").value.trim();
  if (!prompt) return alert("Enter prompt first");

  const data = await api("/api/projects/generate", {
    method: "POST",
    body: JSON.stringify({ prompt })
  });
  alert(`Project generated: ${data.project.title}`);
  await loadProjects();
}

async function iterateProject(projectId) {
  const userPrompt = window.prompt("Edit request (example: make button blue instead of red)");
  if (!userPrompt) return;

  await api(`/api/projects/${projectId}/iterate`, {
    method: "POST",
    body: JSON.stringify({ prompt: userPrompt })
  });
  await loadProjects();
}

async function downloadBuild(buildId) {
  if (!authToken) {
    throw new Error("Please login first");
  }

  setStatus("Preparing ZIP download...", "neutral");
  const response = await fetch(`${API_BASE}/api/builds/${buildId}/download`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${authToken}`
    }
  });

  if (!response.ok) {
    let message = "Download failed";
    try {
      const errorData = await response.json();
      message = errorData.error || message;
    } catch {
      // ignore JSON parse errors and keep generic message
    }
    throw new Error(message);
  }

  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = `extensio-${buildId}.zip`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(objectUrl);
  setStatus("ZIP downloaded successfully", "success");
}

function projectHtml(project) {
  const latest = project.versions[project.versions.length - 1];
  const safeDescription = project.description || "No description provided yet.";
  return `
    <div class="project-item">
      <h3 class="project-title">${project.title}</h3>
      <div class="project-description">${safeDescription}</div>
      <div class="project-meta">
        <span class="meta-chip">Versions: ${project.versions.length}</span>
        <span class="meta-chip">Updated: ${new Date(project.updatedAt).toLocaleString()}</span>
      </div>
      <div class="project-actions">
        <button class="btn-secondary" data-action="iterate" data-id="${project.id}">Edit Request</button>
        <button class="btn-primary" data-action="download" data-build="${latest.buildId}">Download ZIP</button>
      </div>
    </div>
  `;
}

async function loadProjects() {
  const data = await api("/api/projects");
  projectsList.innerHTML = data.projects.map(projectHtml).join("") || "<p class='empty-state'>No projects yet. Generate your first extension above.</p>";
}

projectsList.addEventListener("click", async (event) => {
  const target = event.target;
  if (!(target instanceof HTMLButtonElement)) return;

  const action = target.dataset.action;
  if (action === "iterate") {
    await iterateProject(target.dataset.id);
  }
  if (action === "download") {
    const buildId = target.dataset.build;
    downloadBuild(buildId).catch((err) => {
      setStatus(err.message, "error");
    });
  }
});

registerBtn.addEventListener("click", () => {
  register().catch((err) => {
    setAuthButtonsLoading(false);
    setStatus(err.message, "error");
  });
});
loginBtn.addEventListener("click", () => {
  login().catch((err) => {
    setAuthButtonsLoading(false);
    setStatus(err.message, "error");
  });
});
generateBtn.addEventListener("click", () => {
  generateProject().catch((err) => {
    setStatus(err.message, "error");
  });
});
document.getElementById("refreshProjectsBtn").addEventListener("click", () => {
  loadProjects().catch((err) => alert(err.message));
});

localStorage.removeItem("extensio_token");
setStatus("First login then generate", "neutral");

updateGenerateAccess();
