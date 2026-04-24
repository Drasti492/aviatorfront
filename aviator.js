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
    console.log(" Connected to game server");
    fetchWallet();
  });

  //  ROUND START
  socket.on("round_start", () => {
    flying = true;
    currentMult = 1;
    hasBet = false;

    hideCrash();
    updateMultiplier(1);

    enableBet();
    disableCashout();
  });

  //  REAL-TIME MULTIPLIER
  socket.on("game_tick", (data) => {
    currentMult = data.multiplier;
    flying = true;

    updateMultiplier(currentMult);
    animatePlane(currentMult);
  });

  //  CRASH (SERVER AUTHORITY)
  socket.on("round_crash", (data) => {
    flying = false;

    showCrash(data.crashPoint);

    disableCashout();
    enableBet();
  });

  //  BET CONFIRMED
  socket.on("bet_placed", (data) => {
    hasBet = true;

    toast(`Bet: KES ${data.amount}`, "success");

    disableBet();
    enableCashout();

    addFeed("You placed bet", "you");
  });

  // CASHOUT SUCCESS
  socket.on("cashout_success", (data) => {
    hasBet = false;

    toast(`💰 Cashed at ${data.multiplier}x`, "success");

    addFeed(`You won ${data.payout}`, "win");

    disableCashout();
    fetchWallet();
  });

  //  LIVE BET FEED 
  socket.on("live_bet", (data) => {
    addFeed(
      `${maskPhone(data.phone)} bet KES ${data.amount}`,
      "neutral"
    );
  });

  socket.on("error_msg", (msg) => {
    toast(msg, "error");
  });
}

//cashout and place bet functions
function startGame() {
  if (!token) return openModal("login-modal");

  const amount = parseFloat(getBetInput());
  const auto = parseFloat(getAutoInput());

  socket.emit("place_bet", {
    amount,
    autoCashout: auto
  });
}

function cashOut() {
  if (!hasBet) return;

  socket.emit("cashout");
}


// ========== UI HELPERS ==========
function enableBet() {
  document.getElementById("btn-bet").disabled = false;
}

function disableBet() {
  document.getElementById("btn-bet").disabled = true;
}

function enableCashout() {
  document.getElementById("btn-cash").disabled = false;
}

function disableCashout() {
  document.getElementById("btn-cash").disabled = true;
}
//animate plane
function animatePlane(mult) {
  const plane = document.getElementById("plane-el");

  const x = Math.min(700, mult * 60);
  const y = Math.min(200, mult * 40);

  plane.style.left = x + "px";
  plane.style.bottom = y + "px";
}

//show crash
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

//fetch wallet balance
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