const API = "https://aviator-9raf.onrender.com/api";
const SOCKET_URL = "https://aviator-9raf.onrender.com";

let socket = null;
let token = localStorage.getItem("av_token");

let currentMult = 1;
let hasBet = false;

const el = (id) => document.getElementById(id);

// ========== INIT ==========
document.addEventListener("DOMContentLoaded", () => {
  handleResponsive();

  if (token) {
    connectSocket();
    fetchWallet();
    showLoggedInUI();
  }
});

// ========== SOCKET ==========
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

  socket.on("error_msg", (m) => toast(m));
}

// ========== PHONE FORMAT ==========
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

// ========== LOGIN ==========
function startPhoneLogin() {
  console.log("🔥 Login button clicked");

  try {
    const raw = el("login-phone")?.value;
    const phone = formatPhone(raw);

    if (typeof sendOTP !== "function") {
      return toast("Firebase not loaded");
    }

    sendOTP(phone)
      .then(() => {
        el("login-otp").style.display = "block";
        toast("OTP sent");
      })
      .catch(err => {
        console.error(err);
        toast(err.message);
      });

  } catch (e) {
    toast(e.message);
  }
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
          Authorization: "Bearer " + idToken
        }
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message);

      token = data.token;
      localStorage.setItem("av_token", token);

      connectSocket();
      showLoggedInUI();
      fetchWallet();

      closeModal("login-modal");
      toast("Login successful");
    })
    .catch(err => {
      console.error(err);
      toast("Login failed");
    });
}

// ========== REGISTER ==========
function startPhoneAuth() {
  try {
    const raw = el("reg-phone")?.value;
    const phone = formatPhone(raw);

    sendOTP(phone)
      .then(() => {
        el("otp-section").style.display = "block";
        toast("OTP sent");
      })
      .catch(err => toast(err.message));

  } catch (e) {
    toast(e.message);
  }
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
          Authorization: "Bearer " + idToken
        },
        body: JSON.stringify({ name })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message);

      token = data.token;
      localStorage.setItem("av_token", token);

      connectSocket();
      showLoggedInUI();
      fetchWallet();

      closeModal("register-modal");
      toast("Account created");
    })
    .catch(err => {
      console.error(err);
      toast("Signup failed");
    });
}

// ========== WALLET ==========
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

  } catch (err) {
    console.log(err);
  }
}

// ========== GAME ==========
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

// ========== UI ==========
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
  p.style.left = Math.min(700, m * 60) + "px";
  p.style.bottom = Math.min(200, m * 40) + "px";
}

// ========== HELPERS ==========
function enableBet() {
  el("btn-bet").disabled = false;
}

function disableBet() {
  el("btn-bet").disabled = true;
}

function enableCashout() {
  el("btn-cash").disabled = false;
}

function disableCashout() {
  el("btn-cash").disabled = true;
}

function showLoggedInUI() {
  el("btn-logout").style.display = "block";
  el("top-balance").style.display = "block";
}

function logout() {
  localStorage.removeItem("av_token");
  location.reload();
}

function openModal(id) {
  el(id).classList.add("open");
}

function closeModal(id) {
  el(id).classList.remove("open");
}

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

// EXPORT
window.startGame = startGame;
window.cashOut = cashOut;
window.startPhoneLogin = startPhoneLogin;
window.verifyPhoneLogin = verifyPhoneLogin;
window.startPhoneAuth = startPhoneAuth;
window.completeAuth = completeAuth;
window.openModal = openModal;
window.closeModal = closeModal;
window.logout = logout;