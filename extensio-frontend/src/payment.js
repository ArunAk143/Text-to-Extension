const API_BASE = window.location.origin.includes("localhost:4000") ? window.location.origin : "http://localhost:4000";
const authToken = localStorage.getItem("extensio_token") || "";
const hasActiveLoginSession = sessionStorage.getItem("extensio_logged_in") === "1";
let authUser = null;
try {
  authUser = JSON.parse(localStorage.getItem("extensio_user") || "null");
} catch {
  authUser = null;
}
const payNowBtn = document.getElementById("payNowBtn");
const paymentStatus = document.getElementById("paymentStatus");
const totalAmount = document.getElementById("totalAmount");
const fixedPlanAmount = 499;

function setPaymentStatus(message, type = "neutral") {
  paymentStatus.textContent = message;
  paymentStatus.classList.remove("status-success", "status-error", "status-neutral");
  paymentStatus.classList.add(`status-${type}`);
}

async function api(path, options = {}) {
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {})
  };
  if (authToken) headers.Authorization = `Bearer ${authToken}`;

  const response = await fetch(`${API_BASE}${path}`, { ...options, headers });
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error((data && data.error) || "Request failed");
  }
  return data;
}

function setPlanAmount(amount) {
  totalAmount.textContent = `INR ${amount}`;
  payNowBtn.textContent = `Pay INR ${amount} with Razorpay`;
}

function getPrefill() {
  return {
    name: [authUser?.firstName, authUser?.lastName].filter(Boolean).join(" ").trim() || authUser?.email || "",
    email: authUser?.email || "",
    contact: authUser?.mobile || ""
  };
}

async function startPayment() {
  if (window.location.protocol === "file:") {
    setPaymentStatus("Open payment via http://localhost:4000/payment.html (not file://).", "error");
    return;
  }
  if (!authToken || !hasActiveLoginSession) {
    setPaymentStatus("Please login first.", "error");
    setTimeout(() => {
      window.location.href = "./index.html";
    }, 900);
    return;
  }
  if (typeof window.Razorpay !== "function") {
    setPaymentStatus("Razorpay checkout script failed to load. Refresh and try again.", "error");
    return;
  }

  payNowBtn.disabled = true;
  payNowBtn.textContent = "Creating order...";
  setPaymentStatus("Preparing Razorpay checkout...", "neutral");

  try {
    const data = await api("/api/payments/order", {
      method: "POST",
      body: JSON.stringify({ amountInr: fixedPlanAmount })
    });
    setPlanAmount(data.amountInr);
    const options = {
      key: data.keyId,
      amount: data.order.amount,
      currency: data.order.currency,
      name: "Extensio.ai",
      description: "Premium Subscription Payment",
      image: "https://razorpay.com/assets/razorpay-glyph.svg",
      order_id: data.order.id,
      prefill: getPrefill(),
      notes: {
        plan: "pro",
        ...(data.order.notes || {})
      },
      handler: async function (response) {
        try {
          setPaymentStatus("Verifying payment...", "neutral");
          await api("/api/payments/verify", {
            method: "POST",
            body: JSON.stringify(response)
          });
          setPaymentStatus("Payment successful. Premium activated.", "success");
          setTimeout(() => {
            window.location.href = "./index.html";
          }, 1000);
        } catch (error) {
          setPaymentStatus(error.message, "error");
        } finally {
          payNowBtn.disabled = false;
          setPlanAmount(data.amountInr);
        }
      },
      modal: {
        ondismiss: function () {
          setPaymentStatus("Payment cancelled.", "error");
          payNowBtn.disabled = false;
          setPlanAmount(data.amountInr);
        }
      },
      theme: {
        color: "#2563eb"
      }
    };

    const razorpay = new window.Razorpay(options);
    razorpay.on("payment.failed", function (event) {
      setPaymentStatus(event.error.description || "Payment failed", "error");
      payNowBtn.disabled = false;
      setPlanAmount(data.amountInr);
    });
    razorpay.open();
  } catch (error) {
    setPaymentStatus(error.message, "error");
    payNowBtn.disabled = false;
    setPlanAmount(fixedPlanAmount);
  }
}

payNowBtn.addEventListener("click", () => {
  startPayment().catch((error) => {
    setPaymentStatus(error.message, "error");
    payNowBtn.disabled = false;
    setPlanAmount(fixedPlanAmount);
  });
});

setPlanAmount(fixedPlanAmount);

if (window.location.protocol === "file:") {
  setPaymentStatus("Use http://localhost:4000/payment.html for Razorpay checkout.", "error");
  payNowBtn.disabled = true;
}
