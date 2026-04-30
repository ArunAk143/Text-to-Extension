const API_BASE = window.location.origin.includes("localhost:4000") ? window.location.origin : "http://localhost:4000";
let authToken = localStorage.getItem("extensio_token") || "";
let hasActiveLoginSession = sessionStorage.getItem("extensio_logged_in") === "1";
let authUser = null;
try {
  authUser = JSON.parse(localStorage.getItem("extensio_user") || "null");
} catch {
  authUser = null;
}
if (!hasActiveLoginSession) {
  authToken = "";
  localStorage.removeItem("extensio_token");
  localStorage.removeItem("extensio_user");
}

const authStatus = document.getElementById("authStatus");
const registerStatus = document.getElementById("registerStatus");
const projectsList = document.getElementById("projectsList");
const registerBtn = document.getElementById("registerBtn");
const loginBtn = document.getElementById("loginBtn");
const logoutBtn = document.getElementById("logoutBtn");
const submitRegisterBtn = document.getElementById("submitRegisterBtn");
const registerModal = document.getElementById("registerModal");
const closeRegisterModalBtn = document.getElementById("closeRegisterModalBtn");
const refreshCaptchaBtn = document.getElementById("refreshCaptchaBtn");
const registerCaptchaQuestion = document.getElementById("registerCaptchaQuestion");
const registerMobileInput = document.getElementById("registerMobile");
const listProjectsBtn = document.getElementById("listProjectsBtn");
const generateBtn = document.getElementById("generateBtn");
const promptInput = document.getElementById("prompt");
const premiumPlanCheckbox = document.getElementById("premiumPlanCheckbox");
const generateSection = document.getElementById("generateSection");
let currentCaptchaAnswer = null;
let popupTimerId = null;

function isLoggedIn() {
  return Boolean(authToken) && hasActiveLoginSession;
}

function updateGenerateAccess() {
  const allowGenerate = isLoggedIn();
  generateBtn.disabled = !allowGenerate;
  promptInput.disabled = !allowGenerate;
  premiumPlanCheckbox.disabled = !allowGenerate;
  generateSection.classList.toggle("hidden", !allowGenerate);
  generateBtn.title = allowGenerate ? "" : "First login then generate";
  promptInput.title = allowGenerate ? "" : "First login then generate";
  premiumPlanCheckbox.title = allowGenerate ? "" : "First login then generate";

  registerBtn.classList.toggle("hidden", allowGenerate);
  loginBtn.classList.toggle("hidden", allowGenerate);
  logoutBtn.classList.toggle("hidden", !allowGenerate);
}

function setStatus(message, type = "success") {
  authStatus.textContent = message;
  authStatus.classList.remove("status-success", "status-error", "status-neutral");
  authStatus.classList.add(`status-${type}`);
}

function setRegisterStatus(message, type = "success") {
  registerStatus.textContent = message;
  registerStatus.classList.remove("status-success", "status-error", "status-neutral");
  registerStatus.classList.add(`status-${type}`);
}

function showPopupNotification(message, type = "neutral") {
  let popup = document.getElementById("toastPopup");
  if (!popup) {
    popup = document.createElement("div");
    popup.id = "toastPopup";
    popup.className = "toast-popup";
    document.body.appendChild(popup);
  }

  popup.textContent = message;
  popup.classList.remove("toast-success", "toast-error", "toast-neutral", "hidden");
  popup.classList.add(`toast-${type}`);

  if (popupTimerId) {
    clearTimeout(popupTimerId);
  }
  popupTimerId = setTimeout(() => {
    popup.classList.add("hidden");
  }, 2600);
}

function setProjectsMessage(message) {
  projectsList.innerHTML = `<p class='empty-state'>${message}</p>`;
}

function resetProjectsViewForCurrentUser() {
  setProjectsMessage("Click Generate Project to see new project, or click Lists to view your previous projects.");
}

function validateLoginCreds(email, password) {
  if (!email || !password) {
    throw new Error("Email and password are required");
  }
  if (!email.includes("@")) {
    throw new Error("Please enter a valid email");
  }
}

function validateStrongPassword(password) {
  if (!password) {
    throw new Error("Password is required");
  }
  if (password.length < 8) {
    throw new Error("Password must be at least 8 characters");
  }
}

function setAuthButtonsLoading(isLoading, target = "auth") {
  if (target === "register") {
    submitRegisterBtn.disabled = isLoading;
    submitRegisterBtn.textContent = isLoading ? "Submitting..." : "Submit Registration";
    return;
  }
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
  const firstName = document.getElementById("registerFirstName").value.trim();
  const lastName = document.getElementById("registerLastName").value.trim();
  const email = document.getElementById("registerEmail").value.trim();
  const mobile = document.getElementById("registerMobile").value.trim();
  const password = document.getElementById("registerPassword").value.trim();
  const captchaInput = document.getElementById("registerCaptchaInput").value.trim();
  const acceptedTerms = document.getElementById("registerTerms").checked;

  if (!firstName || !lastName || !email || !mobile || !password || !captchaInput) {
    throw new Error("All registration fields are required");
  }
  if (!/^[a-zA-Z0-9._%+-]+@gmail\.com$/i.test(email)) {
    throw new Error("Email must be a valid @gmail.com address");
  }
  if (!/^\d{10}$/.test(mobile)) {
    throw new Error("Mobile number must be exactly 10 digits");
  }
  validateStrongPassword(password);
  if (Number(captchaInput) !== currentCaptchaAnswer) {
    refreshCaptcha();
    throw new Error("Captcha is incorrect. Try again.");
  }
  if (!acceptedTerms) {
    throw new Error("Please accept terms and privacy policy");
  }

  setAuthButtonsLoading(true, "register");
  setRegisterStatus("Creating account...", "neutral");
  const data = await api("/api/auth/register", {
    method: "POST",
    body: JSON.stringify({ firstName, lastName, email, mobile, password })
  });
  authToken = "";
  setStatus(`Registered: ${data.user.email}. Please login now.`, "success");
  setRegisterStatus("Registration successful", "success");
  closeRegisterModal();
  document.getElementById("email").value = email;
  document.getElementById("password").value = "";
  updateGenerateAccess();
  setProjectsMessage("No project yet. Click Generate Project to create one, or click Lists to view previous projects.");
  setAuthButtonsLoading(false, "register");
}

async function login() {
  const { email, password } = getCreds();
  validateLoginCreds(email, password);
  setAuthButtonsLoading(true);
  setStatus("Signing in...", "neutral");
  const data = await api("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password })
  });
  authToken = data.token;
  hasActiveLoginSession = true;
  authUser = data.user || null;
  localStorage.setItem("extensio_token", authToken);
  localStorage.setItem("extensio_user", JSON.stringify(authUser));
  sessionStorage.setItem("extensio_logged_in", "1");
  setStatus(`Logged in: ${data.user.email}`, "success");
  // On every new login, clear project UI so users do not see stale data.
  projectsList.innerHTML = "";
  updateGenerateAccess();
  resetProjectsViewForCurrentUser();
  setAuthButtonsLoading(false);
}

function logout() {
  authToken = "";
  hasActiveLoginSession = false;
  authUser = null;
  localStorage.removeItem("extensio_token");
  localStorage.removeItem("extensio_user");
  sessionStorage.removeItem("extensio_logged_in");
  document.getElementById("email").value = "";
  document.getElementById("password").value = "";
  setProjectsMessage("Login first to view the projects.");
  setStatus("Logged out successfully", "neutral");
  updateGenerateAccess();
}

function refreshCaptcha() {
  const first = Math.floor(Math.random() * 8) + 2;
  const second = Math.floor(Math.random() * 8) + 2;
  currentCaptchaAnswer = first + second;
  registerCaptchaQuestion.textContent = `${first} + ${second} = ?`;
}

function openRegisterModal() {
  registerModal.classList.remove("hidden");
  setRegisterStatus("Fill the form to register", "neutral");
  refreshCaptcha();
}

function closeRegisterModal() {
  registerModal.classList.add("hidden");
}

async function generateProject() {
  if (!isLoggedIn()) {
    setStatus("First login then generate", "error");
    return;
  }

  const prompt = document.getElementById("prompt").value.trim();
  if (!prompt) return alert("Enter prompt first");
  const requiresPremium = premiumPlanCheckbox.checked;

  const data = await api("/api/projects/generate", {
    method: "POST",
    body: JSON.stringify({ prompt, requiresAdvancedFeature: requiresPremium })
  });
  alert(`Project generated: ${data.project.title}`);
  projectsList.innerHTML = projectHtml(data.project);
}

async function iterateProject(projectId) {
  const userPrompt = window.prompt("Edit request (example: make button blue instead of red)");
  if (!userPrompt) return;

  await api(`/api/projects/${projectId}/iterate`, {
    method: "POST",
    body: JSON.stringify({ prompt: userPrompt })
  });
  const data = await api("/api/projects");
  const project = data.projects.find((item) => item.id === projectId);
  if (project) {
    projectsList.innerHTML = projectHtml(project);
    return;
  }
  setProjectsMessage("Updated project not found in list. Click Lists to refresh all projects.");
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
  if (!isLoggedIn()) {
    setProjectsMessage("Login first to view the projects.");
    setStatus("Login first to view the projects.", "error");
    showPopupNotification("Login first to view the projects.", "error");
    return;
  }
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
  openRegisterModal();
});
submitRegisterBtn.addEventListener("click", () => {
  register().catch((err) => {
    setAuthButtonsLoading(false, "register");
    setRegisterStatus(err.message, "error");
  });
});
loginBtn.addEventListener("click", () => {
  login().catch((err) => {
    setAuthButtonsLoading(false);
    setStatus(err.message, "error");
  });
});
logoutBtn.addEventListener("click", () => {
  logout();
});
generateBtn.addEventListener("click", () => {
  generateProject().catch((err) => {
    if (premiumPlanCheckbox.checked && /require pro plan/i.test(err.message)) {
      window.location.href = "./payment.html";
      return;
    }
    setStatus(err.message, "error");
  });
});
listProjectsBtn.addEventListener("click", () => {
  if (!isLoggedIn()) {
    setProjectsMessage("Login first to view the projects.");
    setStatus("Login first to view the projects.", "error");
    showPopupNotification("Login first to view the projects.", "error");
    return;
  }
  loadProjects().catch((err) => alert(err.message));
});
closeRegisterModalBtn.addEventListener("click", () => {
  closeRegisterModal();
});
refreshCaptchaBtn.addEventListener("click", () => {
  refreshCaptcha();
});
registerMobileInput.addEventListener("input", () => {
  registerMobileInput.value = registerMobileInput.value.replace(/\D/g, "").slice(0, 10);
});
registerModal.addEventListener("click", (event) => {
  if (event.target === registerModal) {
    closeRegisterModal();
  }
});

setStatus("First login then generate", "neutral");
setRegisterStatus("", "neutral");
setProjectsMessage("Login first to view the projects.");

updateGenerateAccess();
