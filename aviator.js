const API = "https://aviator-9raf.onrender.com/api";
const SOCKET_URL = "https://aviator-9raf.onrender.com";

let socket;
let token = localStorage.getItem("av_token");

let currentMult = 1;
let hasBet = false;

// ========== SAFE DOM ==========
const el = (id) => document.getElementById(id);

// ========== INIT ==========
document.addEventListener("DOMContentLoaded", () => {
  connectSocket();
  handleResponsive();

  if (token) fetchWallet();
});

// ========== SOCKET ==========
function connectSocket() {
  socket = io(SOCKET_URL, {
    auth: { token }
  });

  socket.on("connect", () => fetchWallet());

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

  socket.on("error_msg", (m) => toast(m));
}

// ========== GAME ==========
function startGame() {
  if (!token) return openModal("login-modal");

  socket.emit("place_bet", {
    amount: Number(el("bet-input")?.value || 0),
    autoCashout: Number(el("auto-input")?.value || 2)
  });
}

function cashOut() {
  if (!hasBet) return;
  socket.emit("cashout");
}

// ========== UI ==========
function updateMultiplier(v) {
  if (el("mult-el")) el("mult-el").innerText = v.toFixed(2) + "x";
}

function showCrash(p) {
  const o = el("crash-overlay");
  if (!o) return;

  o.style.display = "flex";
  if (el("crash-cs")) el("crash-cs").innerText = "at " + p + "x";
}

function hideCrash() {
  if (el("crash-overlay")) el("crash-overlay").style.display = "none";
}

function animatePlane(m) {
  const p = el("plane-el");
  if (!p) return;

  p.style.left = Math.min(700, m * 60) + "px";
  p.style.bottom = Math.min(200, m * 40) + "px";
}

// ========== BUTTON STATES ==========
const safe = (id, state) => el(id)?.setAttribute("disabled", state);

function enableBet() {
  safe("btn-bet", false);
  safe("m-btn-bet", false);
}

function disableBet() {
  safe("btn-bet", true);
  safe("m-btn-bet", true);
}

function enableCashout() {
  safe("btn-cash", false);
  safe("m-btn-cash", false);
}

function disableCashout() {
  safe("btn-cash", true);
  safe("m-btn-cash", true);
}

// ========== WALLET ==========
async function fetchWallet() {
  try {
    const r = await fetch(API + "/wallet/me", {
      headers: { Authorization: "Bearer " + token }
    });

    const d = await r.json();

    if (el("wallet-bal"))
      el("wallet-bal").innerText = "KES " + (d.walletBalance || 0);

    if (el("top-bal-val"))
      el("top-bal-val").innerText = "KES " + (d.walletBalance || 0);

  } catch (err) {
    console.log("wallet error", err);
  }
}

// ========== LOGIN ==========
function startPhoneLogin() {
  const phone = el("login-phone")?.value;

  if (!phone) return toast("Enter phone number");
  if (typeof sendOTP !== "function") return toast("Firebase not loaded");

  sendOTP(phone)
    .then(() => {
      el("login-otp").style.display = "block";
      toast("OTP sent");
    })
    .catch(() => toast("OTP failed"));
}

function verifyPhoneLogin() {
  const code = el("login-code")?.value;

  if (!code) return toast("Enter OTP");

  verifyOTP(code)
    .then(async (user) => {
      const idToken = await user.getIdToken();

      const res = await fetch(API + "/auth/phone-login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer " + idToken
        }
      });

      const data = await res.json();

      if (!res.ok) throw new Error(data.message);

      token = data.token;
      localStorage.setItem("av_token", token);

      closeModal("login-modal");
      fetchWallet();
      toast("Login successful");

    })
    .catch(err => {
      console.log(err);
      toast("Login failed");
    });
}

// ========== REGISTER ==========
function startPhoneAuth() {
  const phone = el("reg-phone")?.value;

  if (!phone) return toast("Enter phone");

  if (typeof sendOTP !== "function") return toast("Firebase not loaded");

  sendOTP(phone)
    .then(() => {
      el("otp-section").style.display = "block";
      toast("OTP sent");
    })
    .catch(() => toast("OTP failed"));
}

function completeAuth() {
  const code = el("otp-code")?.value;
  const name = el("reg-name")?.value;

  if (!code) return toast("Enter OTP");

  verifyOTP(code)
    .then(async (user) => {
      const idToken = await user.getIdToken();

      const res = await fetch(API + "/auth/phone-login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer " + idToken
        },
        body: JSON.stringify({ name })
      });

      const data = await res.json();

      if (!res.ok) throw new Error(data.message);

      token = data.token;
      localStorage.setItem("av_token", token);

      closeModal("register-modal");
      fetchWallet();
      toast("Account created");
    })
    .catch(err => {
      console.log(err);
      toast("Signup failed");
    });
}

// ========== MODALS ==========
function openModal(id) {
  el(id)?.classList.add("open");
}

function closeModal(id) {
  el(id)?.classList.remove("open");
}

// ========== RESPONSIVE ==========
function handleResponsive() {
  const m = el("mobile-controls");
  if (m) m.style.display = window.innerWidth < 900 ? "block" : "none";
}

// ========== TOAST ==========
function toast(m) {
  const t = el("toast");
  if (!t) return;

  t.innerText = m;
  t.className = "show";

  setTimeout(() => (t.className = ""), 2500);
}

// expose
window.startGame = startGame;
window.cashOut = cashOut;

window.openModal = openModal;
window.closeModal = closeModal;

window.startPhoneLogin = startPhoneLogin;
window.verifyPhoneLogin = verifyPhoneLogin;

window.startPhoneAuth = startPhoneAuth;
window.completeAuth = completeAuth;