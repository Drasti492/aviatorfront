// ========== CONFIG ==========
const API = "https://wallback.onrender.com/api";
const SOCKET_URL = "https://wallback.onrender.com";

let socket;
let token = localStorage.getItem("av_token");

let currentMult = 1;
let flying = false;

// ========== INIT ==========
document.addEventListener("DOMContentLoaded", async () => {
  connectSocket();

  if (token) {
    await fetchWallet();
  }
});

// ========== SOCKET ==========
function connectSocket() {
  socket = io(SOCKET_URL, {
    auth: { token }
  });

  socket.on("connect", () => {
    console.log("Connected to game server");
  });

  // REAL-TIME MULTIPLIER
  socket.on("game_tick", (data) => {
    currentMult = data.multiplier;
    flying = true;

    updateMultiplier(currentMult);
  });

  // ROUND START
  socket.on("round_start", () => {
    flying = true;
    hideCrash();
  });

  // CRASH EVENT (FROM SERVER ONLY)
  socket.on("round_crash", (data) => {
    flying = false;

    showCrash(data.crashPoint);
  });

  // CASHOUT RESULT
  socket.on("cashout_success", (data) => {
    toast(`Cashed out at ${data.multiplier}x`, "success");
    fetchWallet();
  });

  socket.on("bet_placed", () => {
    toast("Bet placed", "success");
  });

  socket.on("error_msg", (msg) => {
    toast(msg, "error");
  });
}

// ========== BET ==========
function startGame() {
  if (!token) return openModal("login-modal");

  const amount = parseFloat(getBetInput());
  const auto = parseFloat(getAutoInput());

  socket.emit("place_bet", {
    amount,
    autoCashout: auto
  });
}

// ========== CASH OUT ==========
function cashOut() {
  socket.emit("cashout");
}

// ========== UI ==========
function updateMultiplier(mult) {
  document.getElementById("mult-el").textContent =
    mult.toFixed(2) + "x";
}

function showCrash(point) {
  document.getElementById("crash-overlay").style.display = "flex";
  document.getElementById("crash-cs").textContent =
    "at " + point.toFixed(2) + "x";
}

function hideCrash() {
  document.getElementById("crash-overlay").style.display = "none";
}

// ========== WALLET ==========
async function fetchWallet() {
  try {
    const r = await fetch(API + "/wallet/me", {
      headers: {
        Authorization: "Bearer " + token
      }
    });

    const data = await r.json();
    updateWalletDisplay(data.walletBalance);
  } catch (e) {
    console.log(e);
  }
}

function updateWalletDisplay(bal) {
  const fmt = "KES " + bal.toFixed(2);
  document.getElementById("wallet-bal").textContent = fmt;
  document.getElementById("top-bal-val").textContent = fmt;
}

// ========== HELPERS ==========
function getBetInput() {
  return document.getElementById("bet-input").value;
}

function getAutoInput() {
  return document.getElementById("auto-input").value;
}

function toast(msg, type = "") {
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.className = "show " + type;
  setTimeout(() => (t.className = ""), 3000);
}