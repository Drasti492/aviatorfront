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
    el("phase-el").innerText = "Next round in " + d.countdown + "s";

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
    animatePlane(currentMult);
  });

  socket.on("round_crash", (d) => {
    gameState = "CRASHED";

    showCrash(d.crashPoint);

    // 🔥 store last 5 crashes
    crashHistory.unshift(d.crashPoint);
    crashHistory = crashHistory.slice(0, 5);
    renderCrashHistory();

    hasBet = false;
    renderButtons();
  });

  socket.on("bet_placed", (d) => {
    hasBet = true;
    toast("Bet placed KES " + d.amount);

    renderButtons();
  });

  socket.on("cashout_success", (d) => {
    hasBet = false;

    toast("Won KES " + d.payout);
    fetchWallet();

    renderButtons();
  });

  socket.on("leaderboard", (data) => {
    renderLeaderboard(data);
  });

  socket.on("error_msg", (m) => toast(m));
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

// ================= BUTTON STATE (MASTER CONTROL) =================
function renderButtons() {
  const betBtn = el("btn-bet");
  const cashBtn = el("btn-cash");

  // RESET
  betBtn.disabled = true;
  cashBtn.disabled = true;

  betBtn.style.background = "#444";
  cashBtn.style.background = "#444";

  if (gameState === "WAITING") {
    betBtn.disabled = false;
    betBtn.style.background = "#22c55e"; // green
  }

  if (gameState === "FLYING") {
    if (hasBet) {
      cashBtn.disabled = false;
      cashBtn.style.background = "#f5a623"; // 🔥 ORANGE ACTIVE
    }
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
    const res = await fetch(API + "/game/history", {
      headers: { Authorization: "Bearer " + token }
    });

    const data = await res.json();

    renderHistory(data);
  } catch {}
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
  let bar = document.getElementById("crash-bar");

  if (!bar) {
    bar = document.createElement("div");
    bar.id = "crash-bar";
    bar.style.position = "absolute";
    bar.style.top = "10px";
    bar.style.left = "50%";
    bar.style.transform = "translateX(-50%)";
    bar.style.display = "flex";
    bar.style.gap = "6px";

    document.getElementById("sky").appendChild(bar);
  }

  bar.innerHTML = "";

  crashHistory.forEach(v => {
    const el = document.createElement("div");
    el.style.padding = "4px 8px";
    el.style.background = "#222";
    el.style.borderRadius = "6px";
    el.style.fontSize = "12px";
    el.innerText = v + "x";
    bar.appendChild(el);
  });
}

// ================= LEADERBOARD =================
function renderLeaderboard(data) {
  let box = document.getElementById("leaderboard");

  if (!box) {
    box = document.createElement("div");
    box.id = "leaderboard";
    box.className = "card";
    document.querySelector(".sidebar").appendChild(box);
  }

  box.innerHTML = `<div class="card-title">Top Players</div>`;

  data.slice(0, 5).forEach(p => {
    const row = document.createElement("div");
    row.style.fontSize = "13px";
    row.innerText = `${p.name} — KES ${p.amount}`;
    box.appendChild(row);
  });
}

// ================= DEPOSIT =================
function openDeposit() {
  if (!token) return openModal("login-modal");
  openModal("deposit-modal");
}

async function doDeposit() {
  try {
    const res = await fetch(API + "/payment/stk-push", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + token
      },
      body: JSON.stringify({
        phone: formatPhone(el("dep-phone").value),
        amount: Number(el("dep-amount").value)
      })
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.message);

    toast("Check your phone 📲");
    closeModal("deposit-modal");

  } catch (err) {
    toast(err.message);
  }
}

// ================= AUTH =================
function formatPhone(p) {
  p = p.replace(/\D/g, "");
  if (p.startsWith("0")) p = "254" + p.slice(1);
  return "+" + p;
}

// ================= UI =================
function updateMultiplier(v) {
  el("mult-el").innerText = v.toFixed(2) + "x";
}

function animatePlane(m) {
  const p = el("plane-el");
  const progress = Math.min(m / 10, 1);

  p.style.left = (10 + progress * 80) + "%";
  p.style.bottom = (20 + progress * 150) + "px";
}

function showCrash(p) {
  el("crash-overlay").style.display = "flex";
  el("crash-cs").innerText = "at " + p + "x";
}

function hideCrash() {
  el("crash-overlay").style.display = "none";
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
window.openDeposit = openDeposit;
window.doDeposit = doDeposit;
window.logout = logout;
window.openModal = openModal;
window.closeModal = closeModal;