function resolveApiBase() {
  if (window.location.protocol === "file:") return "http://localhost:4000";
  const { hostname, port, origin } = window.location;
  const local = hostname === "localhost" || hostname === "127.0.0.1";
  if (local && port === "4000") return origin;
  if (local) return `http://${hostname}:4000`;
  return origin;
}

const API_BASE = resolveApiBase();
const authToken = localStorage.getItem("extensio_token") || "";
const hasActiveLoginSession = sessionStorage.getItem("extensio_logged_in") === "1";
let authUser = null;
try {
  authUser = JSON.parse(localStorage.getItem("extensio_user") || "null");
} catch {
  authUser = null;
}

const paymentStatus = document.getElementById("paymentStatus");
const planGrid = document.getElementById("planGrid");

const PLAN_COPY = {
  free: { name: "Normal (Free)", amount: 0 },
  plus: { name: "Plus", amount: 299 },
  pro: { name: "Pro Plus", amount: 499 }
};

let selectedPlanId = "plus";

function setPaymentStatus(message, type = "neutral") {
  if (!paymentStatus) return;
  paymentStatus.textContent = message;
  paymentStatus.classList.remove("status-success", "status-error", "status-neutral", "hidden");
  paymentStatus.classList.add(`status-${type}`);
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
    throw new Error("Cannot connect to server. Open this app from http://localhost:4000 and ensure the backend is running.");
  }
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error((data && data.error) || "Request failed");
  return data;
}

function getPrefill() {
  return {
    name: [authUser?.firstName, authUser?.lastName].filter(Boolean).join(" ").trim() || authUser?.email || "",
    email: authUser?.email || "",
    contact: authUser?.mobile || ""
  };
}

function highlightSelectedPlan() {
  document.querySelectorAll(".plan-card").forEach((card) => {
    card.classList.toggle("plan-card-active", card.dataset.plan === selectedPlanId);
  });
}

function selectPlan(planId, userClicked = false) {
  if (!PLAN_COPY[planId]) return;
  selectedPlanId = planId;
  highlightSelectedPlan();
  
  if (userClicked) {
    if (planId === "free") {
      setPaymentStatus("Normal plan is free. Returning to dashboard...", "neutral");
      setTimeout(() => window.location.href = "./index.html", 1000);
    } else {
      startPayment(planId);
    }
  } else {
    if (planId === "free") {
      setPaymentStatus("Select a plan to upgrade.", "neutral");
    } else {
      setPaymentStatus(`You are on the ${PLAN_COPY[planId].name} plan.`, "success");
    }
  }
}

async function loadPlansFromApi() {
  try {
    const data = await api("/api/plans");
    data.plans.forEach((plan) => {
      if (plan.id === "plus") {
        PLAN_COPY.plus.amount = plan.amountInr;
        const pElem = document.getElementById("plusPrice");
        if(pElem) pElem.textContent = String(plan.amountInr);
      }
      if (plan.id === "pro") {
        PLAN_COPY.pro.amount = plan.amountInr;
        const pElem = document.getElementById("proPrice");
        if(pElem) pElem.textContent = String(plan.amountInr);
      }
    });
  } catch {
    // ignore
  }
}

async function startPayment(planId) {
  if (!authToken || !hasActiveLoginSession) {
    setPaymentStatus("Please login first.", "error");
    setTimeout(() => { window.location.href = "./login.html"; }, 900);
    return;
  }

  const plan = PLAN_COPY[planId];
  setPaymentStatus(`Opening secure payment for ${plan.name}...`, "neutral");
  
  const qrData = `upi://pay?pa=extensio@upi&pn=Extensio&am=${plan.amount}&cu=INR`;
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(qrData)}`;

  const modalHtml = `
    <div id="mockPaymentModal" class="mock-gw-overlay">
      <div class="mock-gw-card">
        <aside class="mock-gw-sidebar">
          <div class="mock-gw-brand">
            <div class="mock-gw-brand-icon">E</div>
            <h2>Extensio.ai</h2>
            <div class="mock-gw-trust"><span>✓</span> Razorpay Trusted Business</div>
          </div>
          <div class="mock-gw-total">
            <span>Total Amount</span>
            <strong>₹${plan.amount}</strong>
          </div>
          <div class="mock-gw-footer">SECURED BY RAZORPAY</div>
        </aside>
        
        <main class="mock-gw-main">
          <header class="mock-gw-header">
            <h3>Cards, UPI & More</h3>
            <button class="mock-gw-close" id="closeMockPay">&times;</button>
          </header>
          
          <div class="mock-gw-content" id="mockGwContent">
            
            <div id="methodSelectView" class="rzp-view active" style="padding: 0;">
              <ul class="rzp-methods">
                <li class="rzp-method" data-method="card">
                  <div class="rzp-method-icon">💳</div>
                  <div class="rzp-method-text"><strong>Card</strong><span>Visa, MasterCard, RuPay & More</span></div>
                </li>
                <li class="rzp-method active" data-method="upi">
                  <div class="rzp-method-icon">📱</div>
                  <div class="rzp-method-text"><strong>UPI / QR</strong><span>Google Pay, PhonePe & More</span></div>
                </li>
                <li class="rzp-method" data-method="netbanking">
                  <div class="rzp-method-icon">🏦</div>
                  <div class="rzp-method-text"><strong>Netbanking</strong><span>All Indian banks</span></div>
                </li>
                <li class="rzp-method" data-method="wallet">
                  <div class="rzp-method-icon">👝</div>
                  <div class="rzp-method-text"><strong>Wallet</strong><span>Amazon Pay, Mobikwik & More</span></div>
                </li>
                <li class="rzp-method" data-method="emi">
                  <div class="rzp-method-icon">🗓</div>
                  <div class="rzp-method-text"><strong>EMI</strong><span>EMI via Credit/Debit cards</span></div>
                </li>
              </ul>
            </div>
            
            <div id="upiView" class="rzp-view">
              <h4 style="margin-top:0; color:#555;">Scan QR with any UPI App</h4>
              <div class="qr-box">
                <img src="${qrUrl}" class="qr-img" alt="QR Code" />
              </div>
              <p style="font-size:12px; color:#888; margin-bottom: 20px;">Use Google Pay, PhonePe, Paytm, etc.</p>
              <button class="btn-secondary" id="backToMethods1">Back to Methods</button>
            </div>
            
            <div id="netbankingView" class="rzp-view">
              <h4 style="margin-top:0; color:#555;">Popular Banks</h4>
              <div class="nb-grid">
                <div class="nb-bank"><div class="nb-icon">🏦</div><div class="nb-name">SBI</div></div>
                <div class="nb-bank"><div class="nb-icon">🏛</div><div class="nb-name">HDFC</div></div>
                <div class="nb-bank"><div class="nb-icon">🏢</div><div class="nb-name">ICICI</div></div>
                <div class="nb-bank"><div class="nb-icon">🏫</div><div class="nb-name">Axis</div></div>
                <div class="nb-bank"><div class="nb-icon">🏦</div><div class="nb-name">Kotak</div></div>
                <div class="nb-bank"><div class="nb-icon">🏛</div><div class="nb-name">Yes</div></div>
              </div>
              <button class="btn-secondary" style="margin-top:24px;" id="backToMethods2">Back to Methods</button>
            </div>

            <div id="cardView" class="rzp-view">
              <h4 style="margin-top:0; color:#555;">Enter Card Details</h4>
              <p style="font-size:12px; color:#888;">For demo purposes, just click Pay Now.</p>
              <button class="btn-secondary" style="margin-top:24px;" id="backToMethods3">Back to Methods</button>
            </div>

            <div id="processingView" class="rzp-view">
              <div class="processing-spinner"></div>
              <p style="color: #333; font-weight: 500;">Processing payment...</p>
              <p style="color: #888; font-size: 13px;">Please do not refresh the page.</p>
            </div>
            
            <div id="successView" class="rzp-view">
              <div class="success-check">✓</div>
              <p style="color: #22c55e; font-weight: 700; font-size: 20px;">Payment Successful!</p>
              <p style="color: #888; font-size: 14px; margin-top: 8px;">Redirecting you to dashboard...</p>
            </div>

            <div id="failView" class="rzp-view">
              <div class="success-check" style="background: #ef4444;">&times;</div>
              <p style="color: #ef4444; font-weight: 700; font-size: 20px;">Payment Failed</p>
              <p style="color: #888; font-size: 14px; margin-top: 8px;">Please try again.</p>
            </div>

          </div>

          <footer class="mock-gw-bottom" id="mockBottomBar">
            <div class="bottom-amt">
              <span>Total Payable</span>
              <strong>₹${plan.amount}</strong>
            </div>
            <button class="rzp-btn" id="payNowBtnModal">Pay Now</button>
          </footer>

        </main>
      </div>
    </div>
  `;
  document.body.insertAdjacentHTML('beforeend', modalHtml);
  
  const modal = document.getElementById("mockPaymentModal");
  let isProcessing = false;
  
  const views = {
    methods: document.getElementById("methodSelectView"),
    upi: document.getElementById("upiView"),
    netbanking: document.getElementById("netbankingView"),
    card: document.getElementById("cardView"),
    processing: document.getElementById("processingView"),
    success: document.getElementById("successView"),
    fail: document.getElementById("failView")
  };
  const bottomBar = document.getElementById("mockBottomBar");

  function hideAllViews() {
    Object.values(views).forEach(v => {
      if (v) v.classList.remove("active");
    });
  }

  function showView(viewName) {
    hideAllViews();
    if (views[viewName]) views[viewName].classList.add("active");
  }
  
  function cleanup() {
    if (modal) modal.remove();
  }
  
  document.getElementById("closeMockPay").addEventListener("click", () => {
    if (isProcessing) return;
    cleanup();
    setPaymentStatus("Payment cancelled by user.", "error");
  });

  const goBack = () => showView("methods");
  document.getElementById("backToMethods1").addEventListener("click", goBack);
  document.getElementById("backToMethods2").addEventListener("click", goBack);
  document.getElementById("backToMethods3").addEventListener("click", goBack);

  // Interaction
  document.querySelectorAll(".rzp-method").forEach(methodBtn => {
    methodBtn.addEventListener("click", (e) => {
      if (isProcessing) return;
      document.querySelectorAll(".rzp-method").forEach(m => m.classList.remove("active"));
      const btn = e.currentTarget;
      btn.classList.add("active");
      
      const method = btn.dataset.method;
      if (method === "upi") showView("upi");
      else if (method === "netbanking") showView("netbanking");
      else showView("card");
    });
  });

  document.querySelectorAll(".nb-bank").forEach(bank => {
    bank.addEventListener("click", () => {
      if (isProcessing) return;
      document.querySelectorAll(".nb-bank").forEach(b => b.style.borderColor = "#e0e0e0");
      bank.style.borderColor = "#8b5cf6";
    });
  });

  async function executePayment() {
    if (isProcessing) return;
    isProcessing = true;
    
    showView("processing");
    bottomBar.style.display = "none";
    
    // Simulate network delay
    await new Promise(r => setTimeout(r, 1500));
    
    try {
      const verified = await api("/api/payments/dummy-checkout", {
        method: "POST",
        body: JSON.stringify({ planId })
      });
      if (verified.user) {
        localStorage.setItem("extensio_user", JSON.stringify({ ...authUser, ...verified.user }));
      }
      
      showView("success");
      setPaymentStatus(verified.message || "Payment successful.", "success");
      
      setTimeout(() => {
        cleanup();
        window.location.href = "./index.html";
      }, 2000);
      
    } catch (error) {
      showView("fail");
      isProcessing = false;
      setPaymentStatus(error.message, "error");
      setTimeout(() => {
        if (modal) {
            bottomBar.style.display = "flex";
            showView("methods");
        }
      }, 3000);
    }
  }

  document.getElementById("payNowBtnModal").addEventListener("click", () => {
    executePayment();
  });
}

if (planGrid) {
  planGrid.addEventListener("click", (event) => {
    const button = event.target.closest(".plan-select-btn");
    if (!button) return;
    const clickedPlanId = button.dataset.plan;
    const card = button.closest('.plan-card');
    
    // Animate button feedback
    const originalText = button.textContent;
    button.textContent = "Processing...";
    button.disabled = true;
    
    selectPlan(clickedPlanId, true);
    
    setTimeout(() => {
        button.textContent = originalText;
        button.disabled = false;
    }, 2000);
  });
}

if (window.location.protocol === "file:") {
  setPaymentStatus("Use http://localhost:4000/payment.html for Razorpay checkout.", "error");
}

if (!authToken || !hasActiveLoginSession) {
  setPaymentStatus("Please login first to subscribe.", "error");
  setTimeout(() => {
    window.location.href = "./login.html";
  }, 900);
} else {
  const currentPlan = String(authUser?.plan || "free").toLowerCase();
  selectPlan(currentPlan, false);
}

loadPlansFromApi();
