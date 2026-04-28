// ====================================================
// AVIATOR FRONTEND — Full Game Logic
// ====================================================

const API = "https://aviator-9raf.onrender.com/api";
const SOCKET_URL = "https://aviator-9raf.onrender.com";

let socket;
let token = localStorage.getItem("av_token");

// Game State
let gameState = "WAITING"; // WAITING | FLYING | CRASHED
let hasBet = false;
let betAmount = 0;
let currentMult = 1;
let crashHistory = [];
let pollTimer = null;
let stkReference = null;
let currentBetId = null;
let walletBalance = 0;

// Canvas trail
let trailPoints = [];
const MAX_TRAIL = 60;

// ================================================================
// DOM HELPERS
// ================================================================
const el = (id) => document.getElementById(id);

// ================================================================
// INIT
// ================================================================
document.addEventListener("DOMContentLoaded", () => {
  generateStars();
  initCanvas();

  if (token) {
    initLoggedIn();
  } else {
    showLoggedOutUI();
  }
});

// ================================================================
// STARS
// ================================================================
function generateStars() {
  const layer = el("stars-layer");
  if (!layer) return;
  for (let i = 0; i < 60; i++) {
    const star = document.createElement("div");
    star.className = "star";
    const size = Math.random() * 2 + 0.5;
    star.style.cssText = `
      width:${size}px; height:${size}px;
      top:${Math.random() * 100}%;
      left:${Math.random() * 100}%;
      --op:${0.3 + Math.random() * 0.5};
      --dur:${2 + Math.random() * 4}s;
      animation-delay:${Math.random() * 4}s;
    `;
    layer.appendChild(star);
  }
}

// ================================================================
// CANVAS TRAIL
// ================================================================
let canvas, ctx;

function initCanvas() {
  canvas = el("trail-cvs");
  if (!canvas) return;
  const sky = el("sky");
  canvas.width = sky.offsetWidth;
  canvas.height = sky.offsetHeight;
  ctx = canvas.getContext("2d");
}

function drawTrail() {
  if (!ctx) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (trailPoints.length < 2) return;

  ctx.beginPath();
  ctx.strokeStyle = "rgba(245, 166, 35, 0.4)";
  ctx.lineWidth = 2;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  ctx.moveTo(trailPoints[0].x, trailPoints[0].y);
  for (let i = 1; i < trailPoints.length; i++) {
    ctx.globalAlpha = i / trailPoints.length;
    ctx.lineTo(trailPoints[i].x, trailPoints[i].y);
  }
  ctx.stroke();
  ctx.globalAlpha = 1;
}

// ================================================================
// UI STATE
// ================================================================
function showLoggedInUI() {
  el("btn-logout").style.display = "inline-block";
  el("top-balance").style.display = "flex";
  document.querySelectorAll(".btn-auth").forEach(b => b.style.display = "none");
  el("btn-withdraw").disabled = false;
  el("wallet-sub").innerText = "Available balance";
}

function showLoggedOutUI() {
  el("btn-logout").style.display = "none";
  el("top-balance").style.display = "none";
  document.querySelectorAll(".btn-auth").forEach(b => b.style.display = "inline-flex");
  el("btn-deposit").disabled = true;
  el("btn-withdraw").disabled = true;
  el("wallet-sub").innerText = "Login to see balance";
  el("btn-bet").disabled = true;
}

// ================================================================
// INIT LOGGED IN
// ================================================================
function initLoggedIn() {
  showLoggedInUI();
  connectSocket();
  fetchWallet();
  fetchHistory();
}

// ================================================================
// SOCKET CONNECTION
// ================================================================
function connectSocket() {
  socket = io(SOCKET_URL, {
    auth: { token },
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 1500
  });

  socket.on("connect", () => {
    toast("🟢 Connected to server", "success");
  });

  socket.on("disconnect", () => {
    toast("🔴 Connection lost. Reconnecting...", "error");
  });

  // WAITING PHASE
  socket.on("round_waiting", (d) => {
    gameState = "WAITING";
    currentMult = 1;

    el("phase-el").innerText = `Next round in ${d.countdown}s`;
    el("mult-el").innerText = "1.00x";
    el("mult-el").classList.remove("danger");

    // Show countdown banner
    el("countdown-banner").style.display = "flex";
    el("cd-num").innerText = d.countdown;

    hideCrash();
    renderButtons();
  });

  // ROUND STARTS
  socket.on("round_start", () => {
    gameState = "FLYING";
    currentMult = 1;
    trailPoints = [];

    el("countdown-banner").style.display = "none";
    el("phase-el").innerText = "Flying...";
    el("mult-el").classList.remove("danger");

    // Reset plane position
    const plane = el("plane-el");
    plane.style.left = "8%";
    plane.style.bottom = "30px";

    hideCrash();
    renderButtons();
  });

  // TICK — multiplier update
  socket.on("game_tick", (d) => {
    currentMult = d.multiplier;
    updateMultiplier(currentMult);
    animatePlane(currentMult);
  });

  // CRASH
  socket.on("round_crash", (d) => {
    gameState = "CRASHED";
    hasBet = false;

    el("countdown-banner").style.display = "none";
    showCrash(d.crashPoint);

    // Add to crash history
    crashHistory.unshift(d.crashPoint);
    if (crashHistory.length > 5) crashHistory = crashHistory.slice(0, 5);
    renderCrashHistory();

    trailPoints = [];

    renderButtons();
    fetchWallet(); // Refresh balance after round
    fetchHistory();
  });

  // BET PLACED
  socket.on("bet_placed", (d) => {
    hasBet = true;
    betAmount = d.amount;
    toast(`✅ Bet placed — KES ${d.amount}`, "success");
    el("bet-status").innerText = `KES ${d.amount} staked`;
    el("bet-status").className = "bet-status active";
    renderButtons();
  });

  // CASHOUT SUCCESS
  socket.on("cashout_success", (d) => {
    hasBet = false;
    toast(`🎉 Won KES ${d.payout} at ${d.multiplier}x!`, "success");
    el("bet-status").innerText = `Won KES ${d.payout}`;
    el("bet-status").className = "bet-status active";
    fetchWallet();
    fetchHistory();
    renderButtons();
  });

  // BET LOST
  socket.on("bet_lost", () => {
    if (hasBet) {
      toast(`❌ Plane crashed! KES ${betAmount} lost`, "error");
      el("bet-status").innerText = `Lost KES ${betAmount}`;
      el("bet-status").className = "bet-status";
    }
    hasBet = false;
    betAmount = 0;
    renderButtons();
  });

  // ERROR
  socket.on("error_msg", (msg) => {
    toast("⚠️ " + msg, "error");
  });
}

// ================================================================
// MULTIPLIER & PLANE ANIMATION
// ================================================================
function updateMultiplier(v) {
  const display = el("mult-el");
  display.innerText = v.toFixed(2) + "x";

  // Color warning at high multipliers
  if (v >= 5) {
    display.classList.add("danger");
  } else {
    display.classList.remove("danger");
  }
}

function animatePlane(m) {
  const plane = el("plane-el");
  const sky = el("sky");

  const skyW = sky.offsetWidth;
  const skyH = sky.offsetHeight;

  // Smooth curve: x goes right, y goes up exponentially
  const xPct = Math.min(8 + (m - 1) * 6, 82);
  const yPx = Math.min(30 + Math.pow(m - 1, 1.4) * 12, skyH - 60);

  plane.style.left = xPct + "%";
  plane.style.bottom = yPx + "px";

  // Trail
  const planeRect = plane.getBoundingClientRect();
  const skyRect = sky.getBoundingClientRect();
  const px = planeRect.left - skyRect.left + planeRect.width / 2;
  const py = planeRect.top - skyRect.top + planeRect.height / 2;

  trailPoints.push({ x: px, y: py });
  if (trailPoints.length > MAX_TRAIL) trailPoints.shift();
  drawTrail();
}

// ================================================================
// CRASH OVERLAY
// ================================================================
function showCrash(p) {
  el("crash-overlay").style.display = "flex";
  el("crash-cs").innerText = `at ${Number(p).toFixed(2)}x`;

  // Move plane offscreen
  el("plane-el").style.left = "110%";
}

function hideCrash() {
  el("crash-overlay").style.display = "none";
}

// ================================================================
// CRASH HISTORY BAR (top)
// ================================================================
function renderCrashHistory() {
  const bar = el("crash-bar");
  if (!bar) return;
  bar.innerHTML = "";

  crashHistory.forEach(v => {
    const item = document.createElement("div");
    item.className = "crash-item";
    const val = Number(v);
    if (val < 2) item.classList.add("low");
    else if (val < 5) item.classList.add("mid");
    else item.classList.add("high");
    item.innerText = val.toFixed(2) + "x";
    bar.appendChild(item);
  });
}

// ================================================================
// BUTTONS — RENDER STATE MACHINE
// ================================================================
function renderButtons() {
  const bet = el("btn-bet");
  const cash = el("btn-cash");

  if (!token) {
    bet.disabled = true;
    cash.disabled = true;
    bet.innerText = "Sign in to bet";
    return;
  }

  if (gameState === "FLYING") {
    // Plane is flying
    if (hasBet) {
      // Has active bet — show cash out (enabled)
      bet.disabled = true;
      bet.innerText = "Bet placed ✓";
      bet.className = "btn-bet";

      cash.disabled = false;
      cash.className = "btn-cash active-bet";
      cash.innerText = "Cash Out";
    } else {
      // No bet this round — wait
      bet.disabled = true;
      bet.innerText = "Wait for next round";
      bet.className = "btn-bet waiting-mode";

      cash.disabled = true;
      cash.className = "btn-cash";
      cash.innerText = "Cash Out";
    }
  } else if (gameState === "WAITING") {
    // Can place bet
    bet.disabled = false;
    bet.innerText = hasBet ? "Bet placed ✓" : "Place Bet";
    bet.className = "btn-bet";
    bet.disabled = hasBet; // Only one bet per round

    cash.disabled = true;
    cash.className = "btn-cash";
    cash.innerText = "Cash Out";
  } else {
    // CRASHED
    bet.disabled = true;
    bet.innerText = "Round ended...";
    bet.className = "btn-bet";

    cash.disabled = true;
    cash.className = "btn-cash";
    cash.innerText = "Cash Out";
  }
}

// ================================================================
// GAME ACTIONS
// ================================================================
function startGame() {
  if (!token) return openModal("login-modal");
  if (gameState !== "WAITING") return toast("Wait for the next round!", "info");
  if (hasBet) return toast("You already placed a bet this round", "info");

  const amount = Number(el("bet-input").value);
  const autoCashout = Number(el("auto-input").value);

  if (!amount || amount < 30) {
    return toast("Minimum stake is KES 30", "error");
  }

  if (amount > walletBalance) {
    return toast("Insufficient balance. Please deposit.", "error");
  }

  socket.emit("place_bet", { amount, autoCashout });
}

function cashOut() {
  if (!hasBet || gameState !== "FLYING") return;
  socket.emit("cashout");
}

function setAmount(v) {
  el("bet-input").value = v;
}

// ================================================================
// WALLET
// ================================================================
async function fetchWallet() {
  if (!token) return;

  try {
    const res = await fetch(API + "/wallet/me", {
      headers: { Authorization: "Bearer " + token }
    });

    if (res.status === 401) return logout();

    const data = await res.json();
    walletBalance = data.walletBalance || 0;

    el("wallet-bal").innerText = "KES " + walletBalance.toLocaleString();
    el("top-bal-val").innerText = "KES " + walletBalance.toLocaleString();
  } catch (err) {
    console.error("Wallet fetch error:", err);
  }
}

// ================================================================
// BET HISTORY
// ================================================================
async function fetchHistory() {
  if (!token) return;

  try {
    const res = await fetch(API + "/bets/my", {
      headers: { Authorization: "Bearer " + token }
    });

    const data = await res.json();
    renderHistory(data);
  } catch {}
}

function renderHistory(list) {
  const wrap = el("history-list");

  if (!list || list.length === 0) {
    wrap.innerHTML = '<div class="fi-empty">No bets yet. Place your first bet!</div>';
    return;
  }

  wrap.innerHTML = "";

  list.slice(0, 10).forEach(item => {
    const div = document.createElement("div");
    const isWin = item.result === "win";
    div.className = "fi " + (isWin ? "win" : "loss");

    const icon = isWin ? "🏆" : "💥";
    const payout = isWin ? `+KES ${item.payout}` : `-KES ${item.amount}`;

    div.innerHTML = `
      <span>${icon} ${item.multiplier?.toFixed(2)}x</span>
      <span>KES ${item.amount}</span>
      <span>${payout}</span>
    `;
    wrap.appendChild(div);
  });
}

// ================================================================
// DEPOSIT
// ================================================================
function openDeposit() {
  if (!token) return openModal("login-modal");
  openModal("deposit-modal");

  // Pre-fill phone from session if available
  const savedPhone = localStorage.getItem("av_phone");
  if (savedPhone) el("dep-phone").value = savedPhone;
}

function setDepAmount(v) {
  el("dep-amount").value = v;
}

async function doDeposit() {
  const rawPhone = el("dep-phone").value.trim();
  const amount = Number(el("dep-amount").value);

  if (!rawPhone) return toast("Enter your M-Pesa phone number", "error");
  if (!amount || amount < 100) return toast("Minimum deposit is KES 100", "error");

  const phone = formatPhone(rawPhone);
  if (!phone) return toast("Invalid phone number format", "error");

  el("stk-phone-display").innerText = phone;
  el("stk-status").className = "status-pill pending";
  el("stk-status").innerHTML = '<span class="pulse-ring"></span> Sending STK push...';

  const btn = el("btn-dep-submit");
  btn.disabled = true;
  btn.innerText = "⏳ Sending...";

  try {
    const res = await fetch(API + "/payment/stk", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + token
      },
      body: JSON.stringify({ phone, amount })
    });

    const data = await res.json();

    if (!res.ok) {
      toast(data.message || "Deposit failed", "error");
      btn.disabled = false;
      btn.innerText = "💚 Pay via M-Pesa";
      return;
    }

    stkReference = data.reference;

    closeModal("deposit-modal");
    openModal("stk-modal");

    el("stk-status").innerHTML = '<span class="pulse-ring"></span> Waiting for M-Pesa payment...';

    // Start polling
    startStkPoll(stkReference);

  } catch (err) {
    toast("Network error. Try again.", "error");
  } finally {
    btn.disabled = false;
    btn.innerText = "💚 Pay via M-Pesa";
  }
}

// ================================================================
// STK POLL
// ================================================================
function startStkPoll(reference) {
  if (pollTimer) clearInterval(pollTimer);

  let attempts = 0;
  const MAX = 18; // 90 seconds total

  pollTimer = setInterval(async () => {
    attempts++;

    try {
      const res = await fetch(API + "/payment/status/" + reference, {
        headers: { Authorization: "Bearer " + token }
      });

      const data = await res.json();

      if (data.status === "success") {
        clearInterval(pollTimer);
        el("stk-status").className = "status-pill success";
        el("stk-status").innerText = "✅ Payment received!";
        toast("💰 Deposit successful!", "success");

        setTimeout(() => {
          closeModal("stk-modal");
          fetchWallet();
        }, 1500);

      } else if (data.status === "failed") {
        clearInterval(pollTimer);
        el("stk-status").className = "status-pill failed";
        el("stk-status").innerText = "❌ Payment failed or cancelled";
        toast("Deposit failed. Try again.", "error");

      } else if (attempts >= MAX) {
        clearInterval(pollTimer);
        el("stk-status").className = "status-pill pending";
        el("stk-status").innerText = "⏱ Timed out — check manually";
      }
    } catch {}
  }, 5000);
}

// ================================================================
// WITHDRAW
// ================================================================
function openWithdraw() {
  if (!token) return openModal("login-modal");
  openModal("withdraw-modal");
}

async function doWithdraw() {
  const rawPhone = el("wth-phone").value.trim();
  const amount = Number(el("wth-amount").value);

  if (!rawPhone) return toast("Enter your M-Pesa number", "error");
  if (!amount || amount < 500) return toast("Minimum withdrawal is KES 500", "error");
  if (amount > walletBalance) return toast("Insufficient balance", "error");

  const phone = formatPhone(rawPhone);
  if (!phone) return toast("Invalid phone number", "error");

  const btn = el("btn-wth-submit");
  btn.disabled = true;
  btn.innerText = "⏳ Processing...";

  try {
    const res = await fetch(API + "/wallet/withdraw", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + token
      },
      body: JSON.stringify({ amount, phone })
    });

    const data = await res.json();

    if (!res.ok) {
      toast(data.message || "Withdrawal failed", "error");
      return;
    }

    closeModal("withdraw-modal");
    openModal("wth-pending-modal");
    fetchWallet();

  } catch {
    toast("Network error. Try again.", "error");
  } finally {
    btn.disabled = false;
    btn.innerText = "Request Withdrawal";
  }
}

// ================================================================
// AUTH — LOGIN
// ================================================================
async function doLogin() {
  const rawPhone = el("login-phone").value.trim();
  const pin = el("login-pin").value.trim();

  if (!rawPhone || !pin) return toast("Fill in all fields", "error");
  if (pin.length !== 4) return toast("PIN must be 4 digits", "error");

  const phone = formatPhone(rawPhone);
  if (!phone) return toast("Invalid phone number", "error");

  const btn = el("btn-login-submit");
  btn.disabled = true;
  btn.innerText = "Signing in...";

  try {
    const res = await fetch(API + "/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone, pin })
    });

    const data = await res.json();

    if (!res.ok) {
      toast(data.message || "Login failed", "error");
      return;
    }

    token = data.token;
    localStorage.setItem("av_token", token);
    localStorage.setItem("av_phone", rawPhone);

    closeModal("login-modal");
    toast("Welcome back! ✈️", "success");
    initLoggedIn();

  } catch {
    toast("Network error", "error");
  } finally {
    btn.disabled = false;
    btn.innerText = "Sign In";
  }
}

// ================================================================
// AUTH — REGISTER
// ================================================================
let regOtpSent = false;

async function sendRegOtp() {
  const rawPhone = el("reg-phone").value.trim();
  if (!rawPhone) return toast("Enter your phone number first", "error");

  const phone = formatPhone(rawPhone);
  if (!phone) return toast("Invalid phone number", "error");

  const btn = el("btn-reg-otp");
  btn.disabled = true;
  btn.innerText = "Sending...";

  try {
    const res = await fetch(API + "/auth/send-otp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone })
    });

    const data = await res.json();

    if (!res.ok) {
      toast(data.message || "Failed to send OTP", "error");
      btn.disabled = false;
      btn.innerText = "Send OTP";
      return;
    }

    regOtpSent = true;
    el("reg-otp-field").style.display = "flex";
    toast("OTP sent to " + rawPhone, "success");

    // Countdown
    let secs = 60;
    btn.innerText = `Resend (${secs}s)`;
    const timer = setInterval(() => {
      secs--;
      btn.innerText = `Resend (${secs}s)`;
      if (secs <= 0) {
        clearInterval(timer);
        btn.disabled = false;
        btn.innerText = "Resend OTP";
      }
    }, 1000);

  } catch {
    toast("Network error", "error");
    btn.disabled = false;
    btn.innerText = "Send OTP";
  }
}

async function doRegister() {
  const name = el("reg-name").value.trim();
  const rawPhone = el("reg-phone").value.trim();
  const otp = el("reg-otp").value.trim();
  const pin = el("reg-pin").value.trim();
  const pin2 = el("reg-pin2").value.trim();

  if (!name) return toast("Enter your name", "error");
  if (!rawPhone) return toast("Enter your phone", "error");
  if (!otp) return toast("Enter the OTP", "error");
  if (!pin || pin.length !== 4) return toast("PIN must be 4 digits", "error");
  if (pin !== pin2) return toast("PINs do not match", "error");

  const phone = formatPhone(rawPhone);
  if (!phone) return toast("Invalid phone number", "error");

  const btn = el("btn-reg-submit");
  btn.disabled = true;
  btn.innerText = "Creating account...";

  try {
    const res = await fetch(API + "/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, phone, otp, pin })
    });

    const data = await res.json();

    if (!res.ok) {
      toast(data.message || "Registration failed", "error");
      return;
    }

    token = data.token;
    localStorage.setItem("av_token", token);
    localStorage.setItem("av_phone", rawPhone);

    closeModal("register-modal");
    toast("🎉 Welcome! KES 30 bonus added!", "success");
    initLoggedIn();

  } catch {
    toast("Network error", "error");
  } finally {
    btn.disabled = false;
    btn.innerText = "Create Account & Claim Bonus";
  }
}

// ================================================================
// AUTH — RESET PIN
// ================================================================
let resetOtpSent = false;

async function sendResetOtp() {
  const rawPhone = el("reset-phone").value.trim();
  if (!rawPhone) return toast("Enter your phone number", "error");

  const phone = formatPhone(rawPhone);
  if (!phone) return toast("Invalid phone number", "error");

  const btn = el("btn-reset-otp");
  btn.disabled = true;
  btn.innerText = "Sending...";

  try {
    const res = await fetch(API + "/auth/send-otp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone })
    });

    const data = await res.json();

    if (!res.ok) {
      toast(data.message || "Failed to send OTP", "error");
      btn.disabled = false;
      btn.innerText = "Send OTP";
      return;
    }

    resetOtpSent = true;
    el("reset-otp-field").style.display = "flex";
    el("reset-pin-field").style.display = "flex";
    el("btn-reset-submit").style.display = "block";
    toast("OTP sent to " + rawPhone, "success");

    let secs = 60;
    btn.innerText = `Resend (${secs}s)`;
    const timer = setInterval(() => {
      secs--;
      btn.innerText = `Resend (${secs}s)`;
      if (secs <= 0) {
        clearInterval(timer);
        btn.disabled = false;
        btn.innerText = "Resend OTP";
      }
    }, 1000);

  } catch {
    toast("Network error", "error");
    btn.disabled = false;
    btn.innerText = "Send OTP";
  }
}

async function doResetPin() {
  const rawPhone = el("reset-phone").value.trim();
  const otp = el("reset-otp").value.trim();
  const newPin = el("reset-pin").value.trim();

  if (!otp) return toast("Enter the OTP", "error");
  if (!newPin || newPin.length !== 4) return toast("New PIN must be 4 digits", "error");

  const phone = formatPhone(rawPhone);

  const btn = el("btn-reset-submit");
  btn.disabled = true;
  btn.innerText = "Resetting...";

  try {
    const res = await fetch(API + "/auth/reset-pin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone, otp, newPin })
    });

    const data = await res.json();

    if (!res.ok) {
      toast(data.message || "Reset failed", "error");
      return;
    }

    toast("✅ PIN reset! Please sign in.", "success");
    switchModal("reset-modal", "login-modal");

  } catch {
    toast("Network error", "error");
  } finally {
    btn.disabled = false;
    btn.innerText = "Reset PIN";
  }
}

// ================================================================
// UTILS
// ================================================================

// Format phone → 254XXXXXXXXX
function formatPhone(raw) {
  let p = raw.replace(/\s+/g, "").replace(/^0/, "254");
  if (p.startsWith("+")) p = p.slice(1);
  if (!/^254[17]\d{8}$/.test(p)) return null;
  return p;
}

function logout() {
  token = null;
  localStorage.removeItem("av_token");
  if (socket) socket.disconnect();
  if (pollTimer) clearInterval(pollTimer);
  location.reload();
}

let toastTimer = null;
function toast(msg, type = "info") {
  const t = el("toast");
  if (!t) return;

  if (toastTimer) {
    clearTimeout(toastTimer);
    t.classList.remove("show");
    setTimeout(() => showToast(t, msg, type), 200);
  } else {
    showToast(t, msg, type);
  }
}

function showToast(t, msg, type) {
  t.innerText = msg;
  t.className = type === "success" ? "success" : type === "error" ? "error" : "info";
  t.classList.add("show");
  toastTimer = setTimeout(() => {
    t.classList.remove("show");
    toastTimer = null;
  }, 3000);
}

function openModal(id) {
  const m = el(id);
  if (m) m.classList.add("open");
}

function closeModal(id) {
  const m = el(id);
  if (m) m.classList.remove("open");
}

function switchModal(from, to) {
  closeModal(from);
  setTimeout(() => openModal(to), 200);
}

// Close modal on backdrop click
document.addEventListener("click", (e) => {
  if (e.target.classList.contains("modal-bg")) {
    e.target.classList.remove("open");
  }
});

// ================================================================
// GLOBAL EXPORTS
// ================================================================
window.startGame = startGame;
window.cashOut = cashOut;
window.logout = logout;
window.openModal = openModal;
window.closeModal = closeModal;
window.switchModal = switchModal;
window.openDeposit = openDeposit;
window.openWithdraw = openWithdraw;
window.doDeposit = doDeposit;
window.doWithdraw = doWithdraw;
window.doLogin = doLogin;
window.doRegister = doRegister;
window.sendRegOtp = sendRegOtp;
window.sendResetOtp = sendResetOtp;
window.doResetPin = doResetPin;
window.setAmount = setAmount;
window.setDepAmount = setDepAmount;