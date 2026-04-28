const API = "https://aviator-9raf.onrender.com/api";
const SOCKET_URL = "https://aviator-9raf.onrender.com";

let socket = null;
let token = localStorage.getItem("av_token");

let gameState = "WAITING"; // WAITING | FLYING | CRASHED
let hasBet = false;
let currentMult = 1;

const el = (id) => document.getElementById(id);

// ================= INIT =================
document.addEventListener("DOMContentLoaded", () => {

  if (token) {
    initLoggedIn();
  }

});

// ================= INIT LOGGED IN =================
function initLoggedIn() {
  connectSocket();
  fetchWallet();
  showLoggedInUI();
}

// ================= SOCKET =================
function connectSocket() {

  socket = io(SOCKET_URL, {
    auth: { token }
  });

  socket.on("connect", () => {
    console.log("✅ Connected");
  });

  // ===== WAITING (BETTING WINDOW) =====
  socket.on("round_waiting", (d) => {
    gameState = "WAITING";

    el("phase-el").innerText = "Next round in " + d.countdown + "s";

    enableBet();
    disableCashout();
  });

  // ===== ROUND START =====
  socket.on("round_start", () => {
    gameState = "FLYING";

    hasBet = false;
    currentMult = 1;

    hideCrash();
    updateMultiplier(1);

    disableBet();
    disableCashout();
  });

  // ===== GAME TICK =====
  socket.on("game_tick", (d) => {
    currentMult = d.multiplier;

    updateMultiplier(currentMult);
    animatePlane(currentMult);
  });

  // ===== CRASH =====
  socket.on("round_crash", (d) => {
    gameState = "CRASHED";

    showCrash(d.crashPoint);

    disableCashout();
    disableBet();
  });

  // ===== BET CONFIRMED =====
  socket.on("bet_placed", (d) => {
    hasBet = true;

    toast("Bet placed KES " + d.amount);

    disableBet();
    enableCashout();
  });

  // ===== CASHOUT =====
  socket.on("cashout_success", (d) => {
    hasBet = false;

    toast("Won KES " + d.payout);

    fetchWallet();

    disableCashout();
  });

  // ===== ERROR =====
  socket.on("error_msg", (m) => toast(m));
}

// ================= GAME ACTIONS =================
function startGame() {

  if (!token) {
    return openModal("login-modal");
  }

  if (gameState !== "WAITING") {
    return toast("Wait for next round");
  }

  const amount = Number(el("bet-input").value);
  const auto = Number(el("auto-input").value);

  socket.emit("place_bet", {
    amount,
    autoCashout: auto
  });
}

function cashOut() {
  if (!hasBet) return;

  if (gameState !== "FLYING") {
    return toast("Too late!");
  }

  socket.emit("cashout");
}

// ================= WALLET =================
async function fetchWallet() {
  if (!token) return;

  try {
    const res = await fetch(API + "/wallet/me", {
      headers: { Authorization: "Bearer " + token }
    });

    if (res.status === 401) return logout();

    const data = await res.json();

    el("wallet-bal").innerText = "KES " + data.walletBalance;
    el("top-bal-val").innerText = "KES " + data.walletBalance;

  } catch (err) {
    console.log(err);
  }
}

// ================= DEPOSIT =================
async function doDeposit() {

  try {
    const phone = formatPhone(el("dep-phone").value);
    const amount = Number(el("dep-amount").value);

    if (amount < 100) {
      return toast("Minimum is 100");
    }

    const res = await fetch(API + "/payment/stk-push", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + token
      },
      body: JSON.stringify({ phone, amount })
    });

    const data = await res.json();

    if (!res.ok) throw new Error(data.message);

    toast("Check your phone 📲");

  } catch (err) {
    toast(err.message);
  }
}

// ================= WITHDRAW =================
async function confirmWithdraw() {

  try {
    const amount = Number(el("wth-amount").value);

    const res = await fetch(API + "/wallet/withdraw", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + token
      },
      body: JSON.stringify({ amount })
    });

    const data = await res.json();

    if (!res.ok) throw new Error(data.message);

    toast("Withdraw successful");
    fetchWallet();

  } catch (err) {
    toast(err.message);
  }
}

// ================= AUTH =================
function formatPhone(input) {
  let phone = input.replace(/\D/g, "");

  if (phone.startsWith("0")) {
    phone = "254" + phone.slice(1);
  }

  return "+" + phone;
}

async function sendOtp(phone) {
  const res = await fetch(API + "/auth/send-otp", {
    method: "POST",
    headers: {"Content-Type":"application/json"},
    body: JSON.stringify({ phone })
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.message);
}

async function verifyOtp(phone, otp, name="") {
  const res = await fetch(API + "/auth/verify-otp", {
    method: "POST",
    headers: {"Content-Type":"application/json"},
    body: JSON.stringify({ phone, code: otp, name })
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.message);

  return data;
}

// LOGIN
async function startPhoneLogin() {
  const phone = formatPhone(el("login-phone").value);
  await sendOtp(phone);

  el("login-otp").style.display = "block";
  toast("OTP sent");
}

async function verifyPhoneLogin() {
  try {
    const phone = formatPhone(el("login-phone").value);
    const otp = el("login-code").value;

    const data = await verifyOtp(phone, otp);

    token = data.token;
    localStorage.setItem("av_token", token);

    initLoggedIn();

    closeModal("login-modal");
    toast("Welcome back");

  } catch {
    toast("Invalid OTP");
  }
}

// REGISTER
async function startPhoneAuth() {
  const phone = formatPhone(el("reg-phone").value);
  await sendOtp(phone);

  el("otp-section").style.display = "block";
}

async function completeAuth() {
  try {
    const phone = formatPhone(el("reg-phone").value);
    const otp = el("otp-code").value;
    const name = el("reg-name").value;

    const data = await verifyOtp(phone, otp, name);

    token = data.token;
    localStorage.setItem("av_token", token);

    initLoggedIn();

    closeModal("register-modal");
    toast("Account created");

  } catch {
    toast("Signup failed");
  }
}

// ================= UI =================
function updateMultiplier(v) {
  el("mult-el").innerText = v.toFixed(2) + "x";
}

function showCrash(p) {
  el("crash-overlay").style.display = "flex";
  el("crash-cs").innerText = "at " + p + "x";
}

function hideCrash() {
  el("crash-overlay").style.display = "none";
}

function animatePlane(m) {
  const p = el("plane-el");

  const progress = Math.min(m / 10, 1);

  p.style.left = (10 + progress * 80) + "%";
  p.style.bottom = (20 + progress * 150) + "px";
}

function enableBet() { el("btn-bet").disabled = false; }
function disableBet() { el("btn-bet").disabled = true; }

function enableCashout() { el("btn-cash").disabled = false; }
function disableCashout() { el("btn-cash").disabled = true; }

function showLoggedInUI() {
  el("btn-logout").style.display = "block";
  el("top-balance").style.display = "block";
}

function logout() {
  localStorage.removeItem("av_token");
  location.reload();
}

function openModal(id) { el(id).classList.add("open"); }
function closeModal(id) { el(id).classList.remove("open"); }

function toast(m) {
  const t = el("toast");
  t.innerText = m;
  t.className = "show";
  setTimeout(() => t.className = "", 2500);
}

// ================= EXPORT =================
window.startGame = startGame;
window.cashOut = cashOut;
window.startPhoneLogin = startPhoneLogin;
window.verifyPhoneLogin = verifyPhoneLogin;
window.startPhoneAuth = startPhoneAuth;
window.completeAuth = completeAuth;
window.doDeposit = doDeposit;
window.confirmWithdraw = confirmWithdraw;
window.logout = logout;
window.openModal = openModal;
window.closeModal = closeModal;