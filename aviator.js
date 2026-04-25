const API = "https://aviator-9raf.onrender.com/api";
const SOCKET_URL = "https://aviator-9raf.onrender.com";

let socket = null;
let token = localStorage.getItem("av_token");

let currentMult = 1;
let hasBet = false;

const el = (id) => document.getElementById(id);

// ================= INIT =================
document.addEventListener("DOMContentLoaded", () => {
  handleResponsive();

  if (token) {
    connectSocket();
    fetchWallet();
    showLoggedInUI();
  }
});

// ================= SOCKET =================
function connectSocket() {
  if (socket) socket.disconnect();

  socket = io(SOCKET_URL, {
    auth: { token }
  });

  socket.on("connect", () => {
    console.log("✅ Socket connected");
    fetchWallet();
  });

  socket.on("round_start", () => {
    currentMult = 1;
    hasBet = false;
    hideCrash();
    updateMultiplier(1);
    enableBet();
    disableCashout();
  });

  socket.on("game_tick", (d) => {
    currentMult = d.multiplier;
    updateMultiplier(currentMult);
    animatePlane(currentMult);
  });

  socket.on("round_crash", (d) => {
    showCrash(d.crashPoint);
    enableBet();
    disableCashout();
  });

  socket.on("bet_placed", (d) => {
    hasBet = true;
    toast("Bet placed KES " + d.amount);
    disableBet();
    enableCashout();
  });

  socket.on("cashout_success", (d) => {
    hasBet = false;
    toast("Cashed " + d.multiplier + "x");
    fetchWallet();
  });

  socket.on("bet_feed", (data) => {
  addFeed(data);
});

  socket.on("error_msg", (m) => toast(m));
}

// ================= PHONE FORMAT =================
function formatPhone(input) {
  let phone = input.replace(/\D/g, "");

  if (phone.startsWith("0")) {
    phone = "254" + phone.slice(1);
  }

  if (!phone.startsWith("254")) {
    throw new Error("Use format 07XXXXXXXX");
  }

  return "+" + phone;
}

// ================= OTP =================
async function sendOtpRequest(phone) {
  const res = await fetch(API + "/auth/send-otp", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phone })
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.message);

  return true;
}

async function verifyOtpRequest(phone, otp, name = "") {
  const res = await fetch(API + "/auth/verify-otp", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phone, otp, name })
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.message);

  return data;
}

// ================= LOGIN =================
async function startPhoneLogin() {
  try {
    const raw = el("login-phone").value;
    const phone = formatPhone(raw);

    await sendOtpRequest(phone);

    el("login-otp").style.display = "block";
    toast("OTP sent");

  } catch (err) {
    console.error(err);
    toast(err.message);
  }
}

async function verifyPhoneLogin() {
  try {
    const rawPhone = el("login-phone").value;
    const phone = formatPhone(rawPhone);
    const otp = el("login-code").value;

    if (!otp) return toast("Enter OTP");

    const data = await verifyOtpRequest(phone, otp);

    token = data.token;
    localStorage.setItem("av_token", token);

    connectSocket();
    showLoggedInUI();
    fetchWallet();

    closeModal("login-modal");
    toast("Login successful");

  } catch (err) {
    console.error(err);
    toast("Invalid OTP");
  }
}

// ================= REGISTER =================
async function startPhoneAuth() {
  try {
    const raw = el("reg-phone").value;
    const phone = formatPhone(raw);

    await sendOtpRequest(phone);

    el("otp-section").style.display = "block";
    toast("OTP sent");

  } catch (err) {
    toast(err.message);
  }
}

async function completeAuth() {
  try {
    const raw = el("reg-phone").value;
    const phone = formatPhone(raw);
    const otp = el("otp-code").value;
    const name = el("reg-name").value;

    if (!otp) return toast("Enter OTP");

    const data = await verifyOtpRequest(phone, otp, name);

    token = data.token;
    localStorage.setItem("av_token", token);

    connectSocket();
    showLoggedInUI();
    fetchWallet();

    closeModal("register-modal");
    toast("Account created");

  } catch (err) {
    console.error(err);
    toast("Signup failed");
  }
}


function addFeed(d) {
  const feed = el("feed-list");

  const div = document.createElement("div");
  div.className = "feed-item";

  div.innerHTML = `
    <span>👤 ${d.name}</span>
    <span>BET KES ${d.bet}</span>
    <span>${d.cashout}x</span>
    <span>+KES ${d.win}</span>
  `;

  feed.prepend(div);

  if (feed.children.length > 6) {
    feed.removeChild(feed.lastChild);
  }
}

// ================= WALLET =================
async function fetchWallet() {
  if (!token) return;

  try {
    const r = await fetch(API + "/wallet/me", {
      headers: { Authorization: "Bearer " + token }
    });

    if (r.status === 401) {
      logout();
      return;
    }

    const d = await r.json();

    el("wallet-bal").innerText = "KES " + (d.walletBalance || 0);
    el("top-bal-val").innerText = "KES " + (d.walletBalance || 0);

  } catch (e) {
    console.log(e);
  }
}

// ================= PAYMENTS =================
function openDepositModal() {
  openModal("deposit-modal");
}

function openWithdrawModal() {
  openModal("withdraw-modal");
}

async function doDeposit() {
  try {
    openModal("stk-modal");

    const phone = formatPhone(el("dep-phone").value);
    const amount = Number(el("dep-amount").value);

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

    toast("STK sent");

    setTimeout(() => {
      closeModal("stk-modal");
    }, 5000);

  } catch (err) {
    closeModal("stk-modal");
    toast(err.message);
  }
}


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

// ================= GAME =================
function startGame() {
  if (!token) return openModal("login-modal");

  socket.emit("place_bet", {
    amount: Number(el("bet-input").value),
    autoCashout: Number(el("auto-input").value)
  });
}

function cashOut() {
  if (!hasBet) return;
  socket.emit("cashout");
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

  const x = Math.log(m + 1) * 120;
  const y = Math.pow(m, 1.2) * 20;

  p.style.transform = `translate(${x}px, -${y}px) rotate(${m * 2}deg)`;
}

// ================= HELPERS =================
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

function handleResponsive() {
  const m = el("mobile-controls");
  if (m) m.style.display = window.innerWidth < 900 ? "block" : "none";
}

function toast(m) {
  const t = el("toast");
  t.innerText = m;
  t.className = "show";
  setTimeout(() => (t.className = ""), 2500);
}

function setDeposit(amount) {
  el("dep-amount").value = amount;
}

window.setDeposit = setDeposit;

// ================= EXPORT =================
window.startGame = startGame;
window.cashOut = cashOut;
window.startPhoneLogin = startPhoneLogin;
window.verifyPhoneLogin = verifyPhoneLogin;
window.startPhoneAuth = startPhoneAuth;
window.completeAuth = completeAuth;
window.openModal = openModal;
window.closeModal = closeModal;
window.logout = logout;
window.openDepositModal = openDepositModal;
window.openWithdrawModal = openWithdrawModal;
window.doDeposit = doDeposit;
window.confirmWithdraw = confirmWithdraw;

