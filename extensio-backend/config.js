const path = require("path");

module.exports = {
  port: process.env.PORT || 4000,
  jwtSecret: process.env.JWT_SECRET || "dev-secret",
  openAiApiKey: process.env.OPENAI_API_KEY || "",
  openAiModel: process.env.OPENAI_MODEL || "gpt-4o-mini",
  allowedOrigin: process.env.ALLOWED_ORIGIN || "*",
  razorpayKeyId: process.env.RAZORPAY_KEY_ID || process.env.KEY_ID || "",
  razorpayKeySecret: process.env.RAZORPAY_KEY_SECRET || process.env.KEY_SECRET || "",
  premiumPlanAmountInr: Number(process.env.PREMIUM_PLAN_AMOUNT_INR || 499),
  dataDir: path.resolve(__dirname, "../data"),
  buildDir: path.resolve(__dirname, "../builds")
};
