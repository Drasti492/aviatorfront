const API = "https://aviator-9raf.onrender.com/api";
const SOCKET_URL = "https://aviator-9raf.onrender.com";

let socket = null;
let token = localStorage.getItem("av_token");

let gameState = "WAITING";
let hasBet = false;
let currentMult = 1;
let crashHistory = [];

const el = (id) => document.getElementById(id);

// ================= INIT =================
document.addEventListener("DOMContentLoaded", () => {
  if (token) initLoggedIn();
  else showLoggedOutUI();
});

// ================= AUTH UI =================
function showLoggedInUI() {
  el("btn-logout").style.display = "block";
  el("top-balance").style.display = "block";

  document.querySelectorAll(".btn-auth").forEach(b => b.style.display = "none");
  document.querySelectorAll(".w-btn").forEach(b => b.disabled = false);
}

function showLoggedOutUI() {
  el("btn-logout").style.display = "none";
  el("top-balance").style.display = "none";

  document.querySelectorAll(".btn-auth").forEach(b => b.style.display = "inline-block");
  document.querySelectorAll(".w-btn").forEach(b => b.disabled = true);
}

// ================= INIT =================
function initLoggedIn() {
  connectSocket();
  fetchWallet();
  fetchHistory();
  showLoggedInUI();
}

// ================= SOCKET =================
function connectSocket() {
  socket = io(SOCKET_URL, { auth: { token } });

  socket.on("round_waiting", (d) => {
    gameState = "WAITING";
    el("phase-el").innerText = `Next round in ${d.countdown}s`;
    renderButtons();
  });

  socket.on("round_start", () => {
    gameState = "FLYING";
    currentMult = 1;

    hideCrash();
    updateMultiplier(1);

    renderButtons();
  });

  socket.on("game_tick", (d) => {
    currentMult = d.multiplier;
    updateMultiplier(currentMult);
    animatePlaneCurve(currentMult);
  });

  socket.on("round_crash", (d) => {
    gameState = "CRASHED";

    showCrash(d.crashPoint);

    crashHistory.unshift(d.crashPoint);
    crashHistory = crashHistory.slice(0, 5);
    renderCrashHistory();

    hasBet = false;
    fetchHistory();

    renderButtons();
  });

  socket.on("bet_placed", (d) => {
    hasBet = true;
    toast("Bet placed KES " + d.amount);
    renderButtons();
  });

  socket.on("cashout_success", (d) => {
    hasBet = false;

    toast(`Won KES ${d.payout}`);
    fetchWallet();
    fetchHistory();

    renderButtons();
  });

  socket.on("leaderboard", renderLeaderboard);
  socket.on("error_msg", toast);
}

// ================= GAME =================
function startGame() {
  if (!token) return openModal("login-modal");

  if (gameState !== "WAITING") {
    return toast("Wait for next round");
  }

  socket.emit("place_bet", {
    amount: Number(el("bet-input").value),
    autoCashout: Number(el("auto-input").value)
  });
}

function cashOut() {
  if (!hasBet) return;
  if (gameState !== "FLYING") return toast("Too late!");

  socket.emit("cashout");
}

// ================= BUTTONS =================
function renderButtons() {
  const betBtn = el("btn-bet");
  const cashBtn = el("btn-cash");

  betBtn.disabled = true;
  cashBtn.disabled = true;

  if (gameState === "WAITING") {
    betBtn.disabled = false;
  }

  if (gameState === "FLYING" && hasBet) {
    cashBtn.disabled = false;
  }
}

// ================= WALLET =================
async function fetchWallet() {
  const res = await fetch(API + "/wallet/me", {
    headers: { Authorization: "Bearer " + token }
  });

  if (res.status === 401) return logout();

  const data = await res.json();

  el("wallet-bal").innerText = "KES " + data.walletBalance;
  el("top-bal-val").innerText = "KES " + data.walletBalance;
}

// ================= HISTORY =================
async function fetchHistory() {
  try {
    const res = await fetch(API + "/bets/my", {
      headers: { Authorization: "Bearer " + token }
    });

    const data = await res.json();
    renderHistory(data);

  } catch (e) {}
}

function renderHistory(list) {
  const wrap = el("history-list");
  wrap.innerHTML = "";

  list.slice(0, 10).forEach(item => {
    const div = document.createElement("div");
    div.className = "fi " + (item.result === "win" ? "win" : "loss");
    div.innerText = `${item.multiplier}x • KES ${item.amount}`;
    wrap.appendChild(div);
  });
}

// ================= CRASH HISTORY =================
function renderCrashHistory() {
  const bar = el("crash-bar");
  bar.innerHTML = "";

  crashHistory.forEach(v => {
    const item = document.createElement("div");
    item.className = "crash-item";
    item.innerText = v + "x";
    bar.appendChild(item);
  });
}

// ================= LEADERBOARD =================
function renderLeaderboard(data) {
  const box = el("leaderboard-list");
  box.innerHTML = "";

  data.slice(0, 5).forEach(p => {
    const row = document.createElement("div");
    row.className = "lb-row";
    row.innerText = `${p.name} — KES ${p.amount}`;
    box.appendChild(row);
  });
}

// ================= CURVED PLANE =================
function animatePlaneCurve(m) {
  const p = el("plane-el");

  const x = Math.min(m * 12, 90);
  const y = Math.pow(m, 1.5) * 5;

  p.style.left = x + "%";
  p.style.bottom = y + "px";
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

// ================= UTILS =================
function formatPhone(p) {
  p = p.replace(/\D/g, "");
  if (p.startsWith("0")) p = "254" + p.slice(1);
  return "+" + p;
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

// ================= GLOBAL =================
window.startGame = startGame;
window.cashOut = cashOut;
window.logout = logout;
window.openModal = openModal;
window.closeModal = closeModal;