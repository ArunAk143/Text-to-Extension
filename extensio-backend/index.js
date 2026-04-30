require("dotenv").config();
const path = require("path");
const fs = require("fs/promises");
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const Razorpay = require("razorpay");

const {
  port,
  jwtSecret,
  allowedOrigin,
  buildDir,
  razorpayKeyId,
  razorpayKeySecret,
  premiumPlanAmountInr
} = require("./config");
const { requireAuth, requireAdvancedPlan } = require("./middleware/auth");
const {
  createUser,
  getUserByEmail,
  setUserPlan,
  createProject,
  listProjectsByUser,
  getProjectById,
  appendProjectVersion
} = require("./services/projectStore");
const { generateExtensionFiles } = require("./services/llmService");
const { packageExtension } = require("./services/extensionService");

const app = express();
const hasRazorpayConfig =
  Boolean(razorpayKeyId) &&
  Boolean(razorpayKeySecret) &&
  !/your_key_id/i.test(razorpayKeyId) &&
  !/your_test_key_secret/i.test(razorpayKeySecret);
const razorpay = hasRazorpayConfig
  ? new Razorpay({
      key_id: razorpayKeyId,
      key_secret: razorpayKeySecret
    })
  : null;

const allowedOrigins = (allowedOrigin || "*")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "https://checkout.razorpay.com"],
        styleSrc: ["'self'", "https:", "'unsafe-inline'"],
        frameSrc: ["'self'", "https://checkout.razorpay.com", "https://api.razorpay.com"],
        connectSrc: ["'self'", "https://api.razorpay.com"],
        imgSrc: ["'self'", "data:", "https:"],
        fontSrc: ["'self'", "https:", "data:"]
      }
    }
  })
);
app.use(
  cors({
    origin(origin, callback) {
      if (!origin || origin === "null") return callback(null, true);
      if (allowedOrigins.includes("*")) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      return callback(new Error(`CORS blocked for origin: ${origin}`));
    }
  })
);
app.use(express.json({ limit: "2mb" }));
app.use(morgan("dev"));
app.use(express.static(path.resolve(__dirname, "../../frontend")));

app.get("/health", (_, res) => {
  res.json({ ok: true, product: "Extensio.ai" });
});

app.post("/api/auth/register", async (req, res) => {
  try {
    const { firstName, lastName, email, mobile, password } = req.body;
    if (!firstName || !lastName || !email || !mobile || !password) {
      return res.status(400).json({ error: "firstName, lastName, email, mobile and password are required" });
    }
    if (!/^[a-zA-Z0-9._%+-]+@gmail\.com$/i.test(email)) {
      return res.status(400).json({ error: "Email must be a valid @gmail.com address" });
    }
    if (!/^\d{10}$/.test(String(mobile))) {
      return res.status(400).json({ error: "Mobile number must be exactly 10 digits" });
    }
    if (password.length < 8) {
      return res.status(400).json({ error: "Password must be at least 8 characters" });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await createUser({ firstName, lastName, email, mobile, passwordHash });
    const token = jwt.sign({ userId: user.id }, jwtSecret, { expiresIn: "7d" });
    res.status(201).json({
      token,
      user: {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        mobile: user.mobile,
        plan: user.plan
      }
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.post("/api/auth/login", async (req, res) => {
  const { email, password } = req.body;
  const user = await getUserByEmail(email || "");
  if (!user) return res.status(401).json({ error: "Not registered, please register first." });

  const ok = await bcrypt.compare(password || "", user.passwordHash);
  if (!ok) return res.status(401).json({ error: "Invalid credentials" });

  const token = jwt.sign({ userId: user.id }, jwtSecret, { expiresIn: "7d" });
  res.json({
    token,
    user: {
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      mobile: user.mobile,
      plan: user.plan
    }
  });
});

app.get("/api/projects", requireAuth, async (req, res) => {
  const projects = await listProjectsByUser(req.user.id);
  res.json({ projects });
});

app.get("/api/projects/:projectId", requireAuth, async (req, res) => {
  const project = await getProjectById(req.params.projectId);
  if (!project || project.userId !== req.user.id) return res.status(404).json({ error: "Project not found" });
  res.json({ project });
});

app.post("/api/projects/generate", requireAuth, requireAdvancedPlan, async (req, res) => {
  try {
    const { prompt } = req.body;
    if (!prompt) return res.status(400).json({ error: "prompt is required" });

    const llmOutput = await generateExtensionFiles({ userPrompt: prompt });
    const packaged = await packageExtension(llmOutput.files);

    const project = await createProject({
      userId: req.user.id,
      title: llmOutput.projectTitle || "Untitled Extension",
      description: llmOutput.description || "",
      originalPrompt: prompt,
      files: packaged.files,
      buildId: packaged.buildId
    });

    return res.status(201).json({
      project,
      downloadUrl: `/api/builds/${packaged.buildId}/download`
    });
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
});

app.post("/api/projects/:projectId/iterate", requireAuth, requireAdvancedPlan, async (req, res) => {
  try {
    const { prompt } = req.body;
    const project = await getProjectById(req.params.projectId);
    if (!project || project.userId !== req.user.id) return res.status(404).json({ error: "Project not found" });
    if (!prompt) return res.status(400).json({ error: "prompt is required" });

    const previousFiles = project.versions[project.versions.length - 1]?.files || {};
    const llmOutput = await generateExtensionFiles({ userPrompt: prompt, previousFiles });
    const packaged = await packageExtension(llmOutput.files);

    const updated = await appendProjectVersion({
      projectId: project.id,
      prompt,
      files: packaged.files,
      buildId: packaged.buildId,
      title: llmOutput.projectTitle,
      description: llmOutput.description
    });

    return res.status(201).json({
      project: updated,
      downloadUrl: `/api/builds/${packaged.buildId}/download`
    });
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
});

app.post("/api/payments/order", requireAuth, async (req, res) => {
  if (!razorpay) {
    return res.status(500).json({
      error: "Razorpay is not configured on server. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in backend/.env and restart server."
    });
  }
  try {
    const requestedAmount = Number(req.body.amountInr);
    const amount = Number.isFinite(requestedAmount) && requestedAmount > 0 ? requestedAmount : Number(premiumPlanAmountInr);
    const safeAmount = Math.max(1, Math.round(amount));
    const items = Array.isArray(req.body.items) ? req.body.items.slice(0, 20) : [];
    const order = await razorpay.orders.create({
      amount: safeAmount * 100,
      currency: "INR",
      receipt: `pro_${req.user.id}_${Date.now()}`,
      notes: {
        userId: req.user.id,
        plan: "pro",
        items: items
          .map((item) => String(item?.name || "").trim())
          .filter(Boolean)
          .join(", ")
          .slice(0, 255)
      }
    });
    return res.json({
      keyId: razorpayKeyId,
      order,
      amountInr: safeAmount
    });
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
});

app.post("/api/payments/verify", requireAuth, async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({ error: "Missing Razorpay verification fields" });
    }
    const generatedSignature = crypto
      .createHmac("sha256", razorpayKeySecret)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest("hex");
    if (generatedSignature !== razorpay_signature) {
      return res.status(400).json({ error: "Invalid payment signature" });
    }
    const user = await setUserPlan(req.user.id, "pro");
    return res.json({
      message: "Payment verified and plan upgraded to Pro",
      user: { id: user.id, email: user.email, plan: user.plan }
    });
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
});

app.get("/api/builds/:buildId/download", requireAuth, async (req, res) => {
  const zipPath = path.join(buildDir, `${req.params.buildId}.zip`);
  try {
    await fs.access(zipPath);
    return res.download(zipPath, `extensio-${req.params.buildId}.zip`);
  } catch {
    return res.status(404).json({ error: "Build not found" });
  }
});

app.listen(port, () => {
  console.log(`Extensio.ai API running on http://localhost:${port}`);
});
