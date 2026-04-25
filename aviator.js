// ========== CONFIG ==========
const API = "https://aviator-9raf.onrender.com/api";
const SOCKET_URL = "https://aviator-9raf.onrender.com";

let socket;
let token = localStorage.getItem("av_token");

let currentMult = 1;
let flying = false;
let hasBet = false;

// ========== INIT ==========
document.addEventListener("DOMContentLoaded", async () => {
  connectSocket();
  handleResponsive();

  if (token) {
    await fetchWallet();
    unlockUI();
  }
});

// ========== SOCKET ==========
function connectSocket() {
  socket = io(SOCKET_URL, {
    auth: { token }
  });

  socket.on("connect", () => {
    console.log("✅ Connected to game server");
    fetchWallet();
  });

  socket.on("round_start", () => {
    flying = true;
    currentMult = 1;
    hasBet = false;

    hideCrash();
    updateMultiplier(1);

    enableBet();
    disableCashout();
  });

  socket.on("game_tick", (data) => {
    currentMult = data.multiplier;
    flying = true;

    updateMultiplier(currentMult);
    animatePlane(currentMult);
  });

  socket.on("round_crash", (data) => {
    flying = false;

    showCrash(data.crashPoint);

    disableCashout();
    enableBet();
  });

  socket.on("bet_placed", (data) => {
    hasBet = true;

    toast(`Bet: KES ${data.amount}`, "success");

    disableBet();
    enableCashout();

    addFeed("You placed bet", "you");
  });

  socket.on("cashout_success", (data) => {
    hasBet = false;

    toast(`💰 Cashed at ${data.multiplier}x`, "success");

    addFeed(`You won ${data.payout}`, "win");

    disableCashout();
    fetchWallet();
  });

  socket.on("live_bet", (data) => {
    addFeed(`${maskPhone(data.phone)} bet KES ${data.amount}`);
  });

  socket.on("error_msg", (msg) => {
    toast(msg, "error");
  });
}

// ========== GAME ==========
function startGame() {
  if (!token) return openModal("login-modal");

  const amount = parseFloat(getBetInput());
  const autoCashout = parseFloat(getAutoInput());

  socket.emit("place_bet", {
    amount,
    autoCashout
  });
}

function cashOut() {
  if (!hasBet) return;
  socket.emit("cashout");
}

// ========== INPUT ==========
function getBetInput() {
  const el = document.getElementById("bet-input");
  return el ? el.value : 0;
}

function getAutoInput() {
  const el = document.getElementById("auto-input");
  return el ? el.value : 2;
}

// ========== UI SAFE FIX ==========
function updateMultiplier(val) {
  const el = document.getElementById("mult-el");
  if (el) el.innerText = val.toFixed(2) + "x";
}

function showCrash(point) {
  const el = document.getElementById("crash-overlay");
  if (!el) return;

  el.style.display = "flex";

  const cs = document.getElementById("crash-cs");
  if (cs) cs.innerText = "at " + point + "x";
}

function hideCrash() {
  const el = document.getElementById("crash-overlay");
  if (el) el.style.display = "none";
}

function animatePlane(mult) {
  const plane = document.getElementById("plane-el");
  if (!plane) return;

  const x = Math.min(700, mult * 60);
  const y = Math.min(200, mult * 40);

  plane.style.left = x + "px";
  plane.style.bottom = y + "px";
}

// ========== BUTTON SAFETY ==========
function enableBet() {
  const a = document.getElementById("btn-bet");
  const b = document.getElementById("m-btn-bet");

  if (a) a.disabled = false;
  if (b) b.disabled = false;
}

function disableBet() {
  const a = document.getElementById("btn-bet");
  const b = document.getElementById("m-btn-bet");

  if (a) a.disabled = true;
  if (b) b.disabled = true;
}

function enableCashout() {
  const a = document.getElementById("btn-cash");
  const b = document.getElementById("m-btn-cash");

  if (a) a.disabled = false;
  if (b) b.disabled = false;
}

function disableCashout() {
  const a = document.getElementById("btn-cash");
  const b = document.getElementById("m-btn-cash");

  if (a) a.disabled = true;
  if (b) b.disabled = true;
}

// ========== FEED ==========
function addFeed(text, type = "") {
  const feed = document.getElementById("feed-list");
  if (!feed) return;

  const div = document.createElement("div");
  div.className = "fi " + type;
  div.textContent = text;

  feed.prepend(div);

  if (feed.children.length > 10) {
    feed.removeChild(feed.lastChild);
  }
}

function maskPhone(phone) {
  if (!phone) return "****";
  return phone.slice(0, 4) + "****";
}

// ========== WALLET ==========
async function fetchWallet() {
  try {
    const r = await fetch(API + "/wallet/me", {
      headers: { Authorization: "Bearer " + token }
    });

    const data = await r.json();
    updateWalletDisplay(data.walletBalance || 0);
  } catch (e) {
    console.log(e);
  }
}

function updateWalletDisplay(balance) {
  const w = document.getElementById("wallet-bal");
  const t = document.getElementById("top-bal-val");

  if (w) w.innerText = "KES " + balance;
  if (t) t.innerText = "KES " + balance;
}

// ========== AUTH ==========
async function startPhoneLogin() {
  const phone = document.getElementById("login-phone").value;

  const res = await fetch(API + "/auth/phone-login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phone })
  });

  const data = await res.json();

  if (!res.ok || !data.token) {
    return toast("Login failed", "error");
  }

  token = data.token;
  localStorage.setItem("av_token", token);

  closeModal("login-modal");
  unlockUI();
  fetchWallet();

  toast("Logged in", "success");
}

// REGISTER (same endpoint fixed)
async function startPhoneAuth() {
  const name = document.getElementById("reg-name").value;
  const phone = document.getElementById("reg-phone").value;

  const res = await fetch(API + "/auth/phone-login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, phone })
  });

  const data = await res.json();

  if (!res.ok || !data.token) {
    return toast("Signup failed", "error");
  }

  token = data.token;
  localStorage.setItem("av_token", token);

  closeModal("register-modal");
  unlockUI();
  fetchWallet();

  toast("Account created", "success");
}

// ========== UI ==========
function unlockUI() {
  const loginBtn = document.getElementById("btn-login-top");
  const logoutBtn = document.getElementById("btn-logout");

  if (loginBtn) loginBtn.style.display = "none";
  if (logoutBtn) logoutBtn.style.display = "block";

  const bal = document.getElementById("top-balance");
  if (bal) bal.style.display = "flex";
}

function openModal(id) {
  const el = document.getElementById(id);
  if (el) el.classList.add("open");
}

function closeModal(id) {
  const el = document.getElementById(id);
  if (el) el.classList.remove("open");
}

function handleResponsive() {
  const mobile = window.innerWidth < 900;
  const el = document.getElementById("mobile-controls");
  if (el) el.style.display = mobile ? "block" : "none";
}

window.addEventListener("resize", handleResponsive);

// ========== TOAST ==========
function toast(msg, type = "") {
  const el = document.getElementById("toast");
  if (!el) return;

  el.innerText = msg;
  el.className = "show " + type;

  setTimeout(() => (el.className = ""), 3000);
}

// expose
window.startGame = startGame;
window.cashOut = cashOut;
window.startPhoneLogin = startPhoneLogin;
window.startPhoneAuth = startPhoneAuth;
window.logout = () => {
  localStorage.removeItem("av_token");
  location.reload();
};
window.openModal = openModal;
window.closeModal = closeModal;