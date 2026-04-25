// ========== CONFIG ==========
const API = "https://wallback.onrender.com/api";
const SOCKET_URL = "https://wallback.onrender.com";

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
  const auto = parseFloat(getAutoInput());

  socket.emit("place_bet", { amount, autoCashout: auto });
}

function cashOut() {
  if (!hasBet) return;
  socket.emit("cashout");
}

// ========== INPUT HELPERS ==========
function getBetInput() {
  return window.innerWidth < 900
    ? document.getElementById("m-bet").value
    : document.getElementById("bet-input").value;
}

function getAutoInput() {
  return window.innerWidth < 900
    ? document.getElementById("m-auto").value
    : document.getElementById("auto-input").value;
}

// ========== UI ==========
function updateMultiplier(val) {
  document.getElementById("mult-el").innerText = val.toFixed(2) + "x";
}

function showCrash(point) {
  const el = document.getElementById("crash-overlay");
  el.style.display = "flex";

  document.getElementById("crash-cs").innerText = "at " + point + "x";
}

function hideCrash() {
  document.getElementById("crash-overlay").style.display = "none";
}

function animatePlane(mult) {
  const plane = document.getElementById("plane-el");

  const x = Math.min(700, mult * 60);
  const y = Math.min(200, mult * 40);

  plane.style.left = x + "px";
  plane.style.bottom = y + "px";
}

// ========== BUTTON STATES ==========
function enableBet() {
  document.getElementById("btn-bet").disabled = false;
  document.getElementById("m-btn-bet").disabled = false;
}

function disableBet() {
  document.getElementById("btn-bet").disabled = true;
  document.getElementById("m-btn-bet").disabled = true;
}

function enableCashout() {
  document.getElementById("btn-cash").disabled = false;
  document.getElementById("m-btn-cash").disabled = false;
}

function disableCashout() {
  document.getElementById("btn-cash").disabled = true;
  document.getElementById("m-btn-cash").disabled = true;
}

// ========== FEED ==========
function addFeed(text, type = "") {
  const feed = document.getElementById("feed-list");

  const div = document.createElement("div");
  div.className = "fi " + type;
  div.textContent = text;

  feed.prepend(div);

  if (feed.children.length > 10) {
    feed.removeChild(feed.lastChild);
  }
}

function maskPhone(phone) {
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
  document.getElementById("wallet-bal").innerText = "KES " + balance;
  document.getElementById("top-bal-val").innerText = "KES " + balance;
}

// ========== AUTH ==========
async function startPhoneLogin() {
  const phone = document.getElementById("login-phone").value;

  const res = await fetch(API + "/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phone })
  });

  const data = await res.json();

  if (!data.token) return toast("Login failed", "error");

  token = data.token;
  localStorage.setItem("av_token", token);

  closeModal("login-modal");
  unlockUI();
  fetchWallet();

  toast("Logged in", "success");
}

async function startPhoneAuth() {
  const name = document.getElementById("reg-name").value;
  const phone = document.getElementById("reg-phone").value;

  const res = await fetch(API + "/auth/register", {
    method: "POST",
    headers: {"Content-Type":"application/json"},
    body: JSON.stringify({ name, phone })
  });

  const data = await res.json();

  if (!data.token) return toast("Signup failed", "error");

  token = data.token;
  localStorage.setItem("av_token", token);

  closeModal("register-modal");
  unlockUI();
  fetchWallet();

  toast("Account created", "success");
}

function logout() {
  localStorage.removeItem("av_token");
  location.reload();
}

// ========== UI CONTROL ==========
function unlockUI() {
  document.getElementById("btn-login-top").style.display = "none";
  document.getElementById("btn-logout").style.display = "block";
  document.getElementById("top-balance").style.display = "flex";

  document.getElementById("btn-deposit").disabled = false;
  document.getElementById("btn-withdraw").disabled = false;

  document.getElementById("wallet-sub").innerText = "Ready to play";
}

// ========== MODALS ==========
function openModal(id) {
  document.getElementById(id).classList.add("open");
}

function closeModal(id) {
  document.getElementById(id).classList.remove("open");
}

// ========== RESPONSIVE ==========
function handleResponsive() {
  const mobile = window.innerWidth < 900;
  document.getElementById("mobile-controls").style.display = mobile ? "block" : "none";
}
window.addEventListener("resize", handleResponsive);

// ========== TOAST ==========
function toast(msg, type="") {
  const el = document.getElementById("toast");
  el.innerText = msg;
  el.className = "show " + type;

  setTimeout(() => el.className = "", 3000);
}

// ========== GLOBAL ==========
window.openModal = openModal;
window.closeModal = closeModal;
window.startGame = startGame;
window.cashOut = cashOut;
window.startPhoneLogin = startPhoneLogin;
window.startPhoneAuth = startPhoneAuth;
window.logout = logout;