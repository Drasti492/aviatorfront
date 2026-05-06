// ====================================================
// AVIATOR — Game Logic (No OTP / No Firebase)
// Phone confirmed by double-entry on register only
// ====================================================

const API        = "https://aviator-9raf.onrender.com/api";
const SOCKET_URL = "https://aviator-9raf.onrender.com";

// Game state
let socket;
let token         = localStorage.getItem("av_token");
let gameState     = "WAITING";
let hasBet        = false;
let betAmount     = 0;
let currentMult   = 1;
let crashHistory  = [];
let pollTimer     = null;
let stkReference  = null;
let walletBalance = 0;
let bonusBalance  = 0;
let autoCashoutEnabled = false;

let trailPoints = [];
const MAX_TRAIL = 60;
let canvas, ctx;

const el = (id) => document.getElementById(id);

// ================================================================
// INIT
// ================================================================
document.addEventListener("DOMContentLoaded", () => {
  generateStars();
  initCanvas();
  renderCrashHistory();

  if (token) {
    initLoggedIn();
  } else {
    showLoggedOutUI();
    connectSocketGuest();
  }
});

// ================================================================
// PHONE VALIDATION — mirrors server-side logic
// ================================================================
function formatPhone(raw) {
  let p = raw.replace(/\s+/g, "").replace(/^0/, "254");
  if (p.startsWith("+")) p = p.slice(1);
  if (!/^254(7\d{8}|1\d{8})$/.test(p)) return null;
  return p;
}

function validatePhone(phone) {
  // phone is already in 254XXXXXXXXX format here
  if (!phone) return false;
  const digits = phone.slice(3); // 9 digits after 254

  // all same digit
  if (/^(\d)\1{8}$/.test(digits)) return false;

  // sequential ascending or descending
  let asc = true, desc = true;
  for (let i = 1; i < digits.length; i++) {
    if (Number(digits[i]) !== Number(digits[i-1]) + 1) asc  = false;
    if (Number(digits[i]) !== Number(digits[i-1]) - 1) desc = false;
  }
  if (asc || desc) return false;

  // known spammy patterns
  const known = [
    "700000000","700000001","711111111","722222222","733333333",
    "744444444","755555555","766666666","777777777","788888888",
    "799999999","712345678","723456789","798765432","787654321",
    "710000000","720000000","730000000","740000000","750000000",
    "760000000","770000000","780000000","790000000","100000000",
    "110000000","700123456","712300000","700111222"
  ];
  if (known.includes(digits)) return false;

  // 6+ consecutive same digits
  if (/(\d)\1{5,}/.test(digits)) return false;

  // first 5 same
  if (/^(\d)\1{4}/.test(digits)) return false;

  return true;
}

function validatePin(pin) {
  if (!/^\d{4}$/.test(pin)) return "PIN must be exactly 4 digits";
  if (/^(\d)\1{3}$/.test(pin)) return "Avoid repeated digits like 1111";
  const d = pin.split("").map(Number);
  let asc = true, desc = true;
  for (let i = 1; i < 4; i++) {
    if (d[i] !== d[i-1]+1) asc  = false;
    if (d[i] !== d[i-1]-1) desc = false;
  }
  if (asc || desc) return "Avoid sequences like 1234 or 9876";
  return null; // valid
}

// ================================================================
// AUTO CASHOUT TOGGLE
// ================================================================
function toggleAutoCashout(enabled) {
  autoCashoutEnabled = enabled;
  const field = el("auto-field");
  const hint  = el("autocash-hint");
  if (enabled) {
    field.style.display = "flex";
    hint.innerText      = "Auto — cashes out at your target multiplier";
    hint.style.color    = "var(--green)";
  } else {
    field.style.display = "none";
    hint.innerText      = "Manual — click Cash Out yourself";
    hint.style.color    = "var(--muted)";
  }
}

// ================================================================
// STARS
// ================================================================
function generateStars() {
  const layer = el("stars-layer");
  if (!layer) return;
  for (let i = 0; i < 60; i++) {
    const s = document.createElement("div");
    s.className = "star";
    const size = Math.random() * 2 + 0.5;
    s.style.cssText = `
      width:${size}px;height:${size}px;
      top:${Math.random()*100}%;left:${Math.random()*100}%;
      --op:${0.3+Math.random()*0.5};--dur:${2+Math.random()*4}s;
      animation-delay:${Math.random()*4}s;
    `;
    layer.appendChild(s);
  }
}

// ================================================================
// CANVAS TRAIL
// ================================================================
function initCanvas() {
  canvas = el("trail-cvs");
  if (!canvas) return;
  const sky = el("sky");
  canvas.width  = sky.offsetWidth;
  canvas.height = sky.offsetHeight;
  ctx = canvas.getContext("2d");
}

function drawTrail() {
  if (!ctx || trailPoints.length < 2) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.beginPath();
  ctx.strokeStyle = "rgba(245,166,35,0.45)";
  ctx.lineWidth   = 2;
  ctx.lineCap     = "round";
  ctx.lineJoin    = "round";
  ctx.moveTo(trailPoints[0].x, trailPoints[0].y);
  for (let i = 1; i < trailPoints.length; i++) {
    ctx.globalAlpha = i / trailPoints.length;
    ctx.lineTo(trailPoints[i].x, trailPoints[i].y);
  }
  ctx.stroke();
  ctx.globalAlpha = 1;
}

// ================================================================
// CRASH HISTORY
// ================================================================
function renderCrashHistory() {
  const bar = el("crash-bar-pills");
  if (!bar) return;
  bar.innerHTML = "";
  for (let i = 0; i < 5; i++) {
    const pill = document.createElement("div");
    pill.className = "crash-pill";
    if (i < crashHistory.length) {
      const val = Number(crashHistory[i]);
      pill.classList.add(val < 2 ? "low" : val < 5 ? "mid" : "high");
      pill.innerText = val.toFixed(2) + "x";
    } else {
      pill.classList.add("empty-slot");
      pill.innerText = "—";
    }
    bar.appendChild(pill);
  }
}

// ================================================================
// UI STATE
// ================================================================
function showLoggedInUI() {
  el("btn-logout").style.display  = "inline-block";
  el("top-balance").style.display = "flex";
  el("btn-signin").style.display  = "none";
  el("btn-signup").style.display  = "none";
  el("btn-deposit").disabled  = false;
  el("btn-withdraw").disabled = false;
  el("wallet-sub").innerText  = "Available balance";
}

function showLoggedOutUI() {
  el("btn-logout").style.display  = "none";
  el("top-balance").style.display = "none";
  el("btn-signin").style.display  = "inline-flex";
  el("btn-signup").style.display  = "inline-flex";
  el("btn-deposit").disabled  = true;
  el("btn-withdraw").disabled = true;
  el("btn-bet").disabled  = true;
  el("btn-cash").disabled = true;
  el("wallet-sub").innerText = "Login to see balance";
  el("wallet-bal").innerText = "KES 0";
}

function initLoggedIn() {
  showLoggedInUI();
  connectSocket();
  fetchWallet();
  fetchHistory();
  fetchLeaderboard();
}

// ================================================================
// GUEST SOCKET
// ================================================================
function connectSocketGuest() {
  socket = io(SOCKET_URL, { reconnection: true, reconnectionDelay: 2000 });

  socket.on("crash_history", (d) => {
    if (d && Array.isArray(d.history)) { crashHistory = d.history; renderCrashHistory(); }
  });
  socket.on("round_crash", (d) => {
    crashHistory = d.history && Array.isArray(d.history) ? d.history : [d.crashPoint, ...crashHistory].slice(0, 5);
    renderCrashHistory();
    showCrash(d.crashPoint);
    setTimeout(() => hideCrash(), 4500);
  });
  socket.on("game_tick",   (d) => { updateMultiplier(d.multiplier); animatePlane(d.multiplier); });
  socket.on("round_start", () => {
    hideCrash(); trailPoints = [];
    el("plane-el").style.left   = "8%";
    el("plane-el").style.bottom = "30px";
    el("mult-el").innerText     = "1.00x";
    el("mult-el").classList.remove("danger");
    el("phase-el").innerText    = "Flying...";
    el("countdown-banner").style.display = "none";
  });
  socket.on("round_waiting", (d) => {
    el("countdown-banner").style.display = "flex";
    el("cd-num").innerText   = d.countdown;
    el("phase-el").innerText = `Next round in ${d.countdown}s`;
    el("mult-el").innerText  = "1.00x";
    hideCrash();
  });
}

// ================================================================
// AUTHENTICATED SOCKET
// ================================================================
function connectSocket() {
  if (socket) { socket.disconnect(); socket = null; }

  socket = io(SOCKET_URL, {
    auth: { token },
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 1500
  });

  socket.on("connect",    () => toast("🟢 Connected", "success"));
  socket.on("disconnect", () => toast("🔴 Reconnecting...", "error"));

  socket.on("crash_history", (d) => {
    if (d && Array.isArray(d.history)) { crashHistory = d.history; renderCrashHistory(); }
  });

  socket.on("round_waiting", (d) => {
    gameState = "WAITING"; currentMult = 1;
    el("phase-el").innerText  = `Next round in ${d.countdown}s`;
    el("mult-el").innerText   = "1.00x";
    el("mult-el").classList.remove("danger");
    el("countdown-banner").style.display = "flex";
    el("cd-num").innerText = d.countdown;
    hideCrash(); renderButtons();
  });

  socket.on("round_start", () => {
    gameState = "FLYING"; currentMult = 1; trailPoints = [];
    el("countdown-banner").style.display = "none";
    el("phase-el").innerText    = "Flying...";
    el("mult-el").classList.remove("danger");
    el("plane-el").style.left   = "8%";
    el("plane-el").style.bottom = "30px";
    hideCrash(); renderButtons();
  });

  socket.on("game_tick", (d) => {
    currentMult = d.multiplier;
    updateMultiplier(currentMult);
    animatePlane(currentMult);
  });

  socket.on("round_crash", (d) => {
    gameState = "CRASHED"; hasBet = false;
    el("countdown-banner").style.display = "none";
    showCrash(d.crashPoint);
    crashHistory = d.history && Array.isArray(d.history) ? d.history : [d.crashPoint, ...crashHistory].slice(0, 5);
    renderCrashHistory();
    trailPoints = [];
    renderButtons(); fetchWallet(); fetchHistory();
  });

  socket.on("bet_placed", (d) => {
    hasBet = true; betAmount = d.amount;
    const mode = autoCashoutEnabled ? `Auto at ${el("auto-input").value}x` : "Manual";
    toast(`✅ Bet placed — KES ${d.amount}`, "success");
    el("bet-status").innerText = `KES ${d.amount} staked · ${mode}`;
    el("bet-status").className = "bet-status active";
    renderButtons();
  });

  socket.on("bet_cancelled", (d) => {
    hasBet = false; betAmount = 0;
    toast(`↩️ Cancelled — KES ${d.amount} refunded`, "info");
    el("bet-status").innerText = "";
    el("bet-status").className = "bet-status";
    fetchWallet(); renderButtons();
  });

  socket.on("cashout_success", (d) => {
    hasBet = false;
    toast(`🎉 Won KES ${d.payout} at ${d.multiplier}x!`, "success");
    el("bet-status").innerText = `✈️ Won KES ${d.payout} at ${d.multiplier}x`;
    el("bet-status").className = "bet-status active";
    fetchWallet(); fetchHistory(); renderButtons();
  });

  socket.on("bet_lost", () => {
    if (hasBet) toast(`💥 Crashed! Lost KES ${betAmount}`, "error");
    el("bet-status").innerText = hasBet ? `Lost KES ${betAmount}` : "";
    el("bet-status").className = "bet-status";
    hasBet = false; betAmount = 0; renderButtons();
  });

  socket.on("error_msg", (msg) => toast("⚠️ " + msg, "error"));
}

// ================================================================
// PLANE & MULTIPLIER
// ================================================================
function updateMultiplier(v) {
  el("mult-el").innerText = v.toFixed(2) + "x";
  if (v >= 5) el("mult-el").classList.add("danger");
  else        el("mult-el").classList.remove("danger");
}

function animatePlane(m) {
  const plane = el("plane-el"), sky = el("sky");
  const skyH  = sky.offsetHeight;
  const xPct  = Math.min(8 + (m - 1) * 6, 82);
  const yPx   = Math.min(30 + Math.pow(m - 1, 1.4) * 12, skyH - 60);
  plane.style.left   = xPct + "%";
  plane.style.bottom = yPx + "px";
  const pr = plane.getBoundingClientRect(), sr = sky.getBoundingClientRect();
  trailPoints.push({ x: pr.left - sr.left + pr.width / 2, y: pr.top - sr.top + pr.height / 2 });
  if (trailPoints.length > MAX_TRAIL) trailPoints.shift();
  drawTrail();
}

function showCrash(p) {
  el("crash-overlay").style.display = "flex";
  el("crash-cs").innerText = `at ${Number(p).toFixed(2)}x`;
  el("plane-el").style.left = "110%";
}
function hideCrash() { el("crash-overlay").style.display = "none"; }

// ================================================================
// BUTTONS
// ================================================================
function renderButtons() {
  const bet  = el("btn-bet");
  const cash = el("btn-cash");

  if (!token) {
    bet.disabled  = true; cash.disabled = true;
    bet.innerText = "Sign in to bet"; bet.className = "btn-bet";
    return;
  }

  if (gameState === "FLYING") {
    if (hasBet) {
      bet.disabled  = true; bet.innerText = "✓ Bet Active"; bet.className = "btn-bet";
      if (autoCashoutEnabled) {
        cash.disabled = true; cash.innerText = "⚡ Auto Cashing..."; cash.className = "btn-cash active-bet";
      } else {
        cash.disabled = false; cash.innerText = "💰 Cash Out"; cash.className = "btn-cash active-bet";
      }
    } else {
      bet.disabled  = true; bet.innerText = "⏳ Next Round"; bet.className = "btn-bet waiting-mode";
      cash.disabled = true; cash.innerText = "Cash Out";    cash.className = "btn-cash";
    }
  } else if (gameState === "WAITING") {
    if (hasBet) {
      bet.disabled = false; bet.innerText = "✕ Cancel Bet"; bet.className = "btn-bet cancel-mode";
      bet.onclick  = cancelBet;
      cash.disabled = true; cash.innerText = "Cash Out"; cash.className = "btn-cash";
    } else {
      bet.disabled = false; bet.innerText = "Place Bet"; bet.className = "btn-bet";
      bet.onclick  = startGame;
      cash.disabled = true; cash.innerText = "Cash Out"; cash.className = "btn-cash";
    }
  } else {
    bet.disabled  = true; bet.innerText = "Round ended..."; bet.className = "btn-bet";
    bet.onclick   = startGame;
    cash.disabled = true; cash.innerText = "Cash Out"; cash.className = "btn-cash";
  }
}

// ================================================================
// GAME ACTIONS
// ================================================================
function startGame() {
  if (!token)                  return openModal("login-modal");
  if (gameState !== "WAITING") return toast("Wait for the next round!", "info");
  if (hasBet)                  return toast("You already have a bet this round", "info");

  const amount      = Number(el("bet-input").value);
  const autoCashout = autoCashoutEnabled ? Number(el("auto-input").value) : 0;

  if (!amount || amount < 30)  return toast("Minimum stake is KES 30", "error");
  if (amount > walletBalance)  return toast("Insufficient balance — please deposit", "error");

  socket.emit("place_bet", { amount, autoCashout });
}

function cancelBet() {
  if (!hasBet || gameState !== "WAITING") return;
  socket.emit("cancel_bet");
}

function cashOut() {
  if (!hasBet || gameState !== "FLYING") return;
  if (autoCashoutEnabled) return toast("Auto cashout is ON — it will cash out automatically", "info");
  socket.emit("cashout");
}

function setAmount(v) { el("bet-input").value = v; }

// ================================================================
// WALLET
// ================================================================
async function fetchWallet() {
  if (!token) return;
  try {
    const res  = await fetch(API + "/wallet/me", { headers: { Authorization: "Bearer " + token } });
    if (res.status === 401) return logout();
    const data = await res.json();
    walletBalance = data.walletBalance || 0;
    bonusBalance  = data.bonusBalance  || 0;
    el("wallet-bal").innerText  = "KES " + walletBalance.toLocaleString();
    el("top-bal-val").innerText = "KES " + walletBalance.toLocaleString();
  } catch (e) { console.error("Wallet:", e); }
}

// ================================================================
// HISTORY
// ================================================================
async function fetchHistory() {
  if (!token) return;
  try {
    const res  = await fetch(API + "/bets/my", { headers: { Authorization: "Bearer " + token } });
    const data = await res.json();
    renderHistory(data);
  } catch {}
}

function renderHistory(list) {
  const wrap = el("history-list");
  if (!list || list.length === 0) {
    wrap.innerHTML = '<div class="fi-empty">No bets yet. Place your first bet!</div>'; return;
  }
  wrap.innerHTML = "";
  list.slice(0, 10).forEach(item => {
    const div   = document.createElement("div");
    const isWin = item.result === "win";
    div.className = "fi " + (isWin ? "win" : "loss");
    div.innerHTML = `
      <span class="fi-icon">${isWin ? "🏆" : "💥"}</span>
      <span class="fi-mult">${Number(item.multiplier).toFixed(2)}x</span>
      <span class="fi-stake">KES ${item.amount}</span>
      <span class="fi-result">${isWin ? "+" : "-"}KES ${isWin ? item.payout : item.amount}</span>
    `;
    wrap.appendChild(div);
  });
}

// ================================================================
// LEADERBOARD
// ================================================================
async function fetchLeaderboard() {
  try {
    const res  = await fetch(API + "/stats/leaderboard");
    const data = await res.json();
    const wrap = el("leaderboard-list");
    if (!data || data.length === 0) { wrap.innerHTML = '<div class="fi-empty">No players yet</div>'; return; }
    wrap.innerHTML = "";
    ["🥇","🥈","🥉",4,5,6,7,8,9,10].forEach((medal, i) => {
      if (!data[i]) return;
      const div = document.createElement("div");
      div.className = "lb-row";
      div.innerHTML = `<span class="lb-rank">${medal}</span><span class="lb-name">${data[i].name || "Player"}</span><span class="lb-bal">KES ${Number(data[i].walletBalance).toLocaleString()}</span>`;
      wrap.appendChild(div);
    });
  } catch {}
}

// ================================================================
// DEPOSIT
// ================================================================
function openDeposit() {
  if (!token) return openModal("login-modal");
  const saved = localStorage.getItem("av_phone");
  if (saved && el("dep-phone")) el("dep-phone").value = saved;
  openModal("deposit-modal");
}

function setDepAmount(v) { el("dep-amount").value = v; }

async function doDeposit() {
  const rawPhone = el("dep-phone").value.trim();
  const amount   = Number(el("dep-amount").value);
  if (!rawPhone)              return toast("Enter your M-Pesa phone number", "error");
  if (!amount || amount < 100) return toast("Minimum deposit is KES 100", "error");
  const phone = formatPhone(rawPhone);
  if (!phone) return toast("Invalid phone number format", "error");

  el("stk-phone-display").innerText = phone;
  el("stk-status").className        = "status-pill pending";
  el("stk-status").innerHTML        = '<span class="pulse-ring"></span> Sending STK push...';

  const btn = el("btn-dep-submit");
  btn.disabled = true; btn.innerText = "⏳ Sending...";

  try {
    const res  = await fetch(API + "/payment/stk", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
      body: JSON.stringify({ phone, amount })
    });
    const data = await res.json();
    if (!res.ok) { toast(data.message || "Deposit failed", "error"); return; }
    stkReference = data.reference;
    closeModal("deposit-modal");
    openModal("stk-modal");
    el("stk-status").innerHTML = '<span class="pulse-ring"></span> Waiting for M-Pesa payment...';
    startStkPoll(stkReference);
  } catch { toast("Network error. Try again.", "error"); }
  finally { btn.disabled = false; btn.innerText = "💚 Pay via M-Pesa"; }
}

// ================================================================
// STK POLL
// ================================================================
function startStkPoll(reference) {
  if (pollTimer) clearInterval(pollTimer);
  let attempts = 0;
  pollTimer = setInterval(async () => {
    attempts++;
    try {
      const res  = await fetch(API + "/payment/status/" + reference, { headers: { Authorization: "Bearer " + token } });
      const data = await res.json();
      if (data.status === "success") {
        clearInterval(pollTimer);
        el("stk-status").className = "status-pill success";
        el("stk-status").innerText = "✅ Payment received!";
        toast("💰 Deposit successful!", "success");
        setTimeout(() => { closeModal("stk-modal"); fetchWallet(); }, 1500);
      } else if (data.status === "failed") {
        clearInterval(pollTimer);
        el("stk-status").className = "status-pill failed";
        el("stk-status").innerText = "❌ Payment failed or cancelled";
        toast("Deposit failed. Try again.", "error");
      } else if (attempts >= 18) {
        clearInterval(pollTimer);
        el("stk-status").innerText = "⏱ Timed out — check manually";
      }
    } catch {}
  }, 5000);
}

// ================================================================
// WITHDRAW
// ================================================================
function openWithdraw() {
  if (!token) return openModal("login-modal");
  const saved = localStorage.getItem("av_phone");
  if (saved && el("wth-phone")) el("wth-phone").value = saved;
  const realMoney   = Math.max(0, walletBalance - bonusBalance);
  const minWithdraw = realMoney > 0 ? 200 : 400;
  el("wi-balance").innerText = "KES " + walletBalance.toLocaleString();
  el("wi-bonus").innerText   = "KES " + bonusBalance.toLocaleString();
  el("wi-min").innerText     = "KES " + minWithdraw;
  el("wth-warning").innerText = realMoney > 0
    ? "⚠️ Min withdrawal is KES 200 (you have real deposited money)."
    : "⚠️ Min withdrawal is KES 400 when using bonus balance only.";
  el("wth-amount").dataset.min = minWithdraw;
  openModal("withdraw-modal");
}

async function doWithdraw() {
  const rawPhone    = el("wth-phone").value.trim();
  const amount      = Number(el("wth-amount").value);
  const minWithdraw = Number(el("wth-amount").dataset.min || 500);
  if (!rawPhone)                   return toast("Enter your M-Pesa number", "error");
  if (!amount || amount < minWithdraw) return toast(`Minimum withdrawal is KES ${minWithdraw}`, "error");
  if (amount > walletBalance)      return toast("Insufficient balance", "error");
  const phone = formatPhone(rawPhone);
  if (!phone) return toast("Invalid phone number", "error");

  const btn = el("btn-wth-submit");
  btn.disabled = true; btn.innerText = "⏳ Processing...";
  try {
    const res  = await fetch(API + "/wallet/withdraw", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
      body: JSON.stringify({ amount, phone })
    });
    const data = await res.json();
    if (!res.ok) { toast(data.message || "Withdrawal failed", "error"); return; }
    el("wth-pending-amount").innerText = "KES " + amount.toLocaleString();
    closeModal("withdraw-modal");
    openModal("wth-pending-modal");
    fetchWallet();
  } catch { toast("Network error. Try again.", "error"); }
  finally { btn.disabled = false; btn.innerText = "Request Withdrawal"; }
}

// ================================================================
// AUTH — REGISTER (no OTP — double phone entry + PIN)
// ================================================================
async function doRegister() {
  const name    = el("reg-name").value.trim();
  const rawPhone = el("reg-phone").value.trim();
  const rawPhone2 = el("reg-phone2").value.trim();
  const pin     = el("reg-pin").value.trim();
  const pin2    = el("reg-pin2").value.trim();

  if (!name || name.length < 2) return toast("Enter your full name", "error");
  if (!rawPhone)  return toast("Enter your phone number", "error");
  if (!rawPhone2) return toast("Please confirm your phone number", "error");

  // Strip and compare raw inputs (before formatting) to catch obvious mismatches
  const clean1 = rawPhone.replace(/\s+/g, "");
  const clean2 = rawPhone2.replace(/\s+/g, "");
  if (clean1 !== clean2) return toast("Phone numbers do not match", "error");

  const phone = formatPhone(rawPhone);
  if (!phone) return toast("Enter a valid Kenyan number (07XX or 01XX)", "error");

  if (!validatePhone(phone)) {
    return toast("This number looks invalid. Use your real Safaricom or Airtel number.", "error");
  }

  if (!pin || !pin2) return toast("Enter and confirm your PIN", "error");
  if (pin !== pin2)  return toast("PINs do not match", "error");

  const pinErr = validatePin(pin);
  if (pinErr) return toast(pinErr, "error");

  const btn = el("btn-reg-submit");
  btn.disabled = true; btn.innerText = "Creating account...";

  try {
    const res  = await fetch(API + "/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone, name, pin })
    });
    const data = await res.json();
    if (!res.ok) { toast(data.message || "Registration failed", "error"); return; }

    token = data.token;
    localStorage.setItem("av_token", token);
    localStorage.setItem("av_phone", rawPhone);
    closeModal("register-modal");
    toast("🎉 Welcome! KES 30 bonus added!", "success");
    initLoggedIn();
  } catch { toast("Network error. Try again.", "error"); }
  finally { btn.disabled = false; btn.innerText = "Create Account"; }
}

// ================================================================
// AUTH — LOGIN
// ================================================================
async function doLogin() {
  const rawPhone = el("login-phone").value.trim();
  const pin      = el("login-pin").value.trim();
  if (!rawPhone || !pin) return toast("Fill in all fields", "error");
  if (pin.length !== 4)  return toast("PIN must be 4 digits", "error");
  const phone = formatPhone(rawPhone);
  if (!phone) return toast("Invalid phone number", "error");

  const btn = el("btn-login-submit");
  btn.disabled = true; btn.innerText = "Signing in...";
  try {
    const res  = await fetch(API + "/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone, pin })
    });
    const data = await res.json();
    if (!res.ok) { toast(data.message || "Login failed", "error"); return; }
    token = data.token;
    localStorage.setItem("av_token", token);
    localStorage.setItem("av_phone", rawPhone);
    closeModal("login-modal");
    toast("Welcome back! ✈️", "success");
    initLoggedIn();
  } catch { toast("Network error", "error"); }
  finally { btn.disabled = false; btn.innerText = "Sign In"; }
}

// ================================================================
// AUTH — RESET PIN (no OTP — just phone + new PIN)
// ================================================================
async function doResetPin() {
  const rawPhone = el("reset-phone").value.trim();
  const newPin   = el("reset-new-pin").value.trim();
  const newPin2  = el("reset-new-pin2").value.trim();

  if (!rawPhone) return toast("Enter your phone number", "error");
  if (!newPin)   return toast("Enter your new PIN", "error");
  if (newPin !== newPin2) return toast("PINs do not match", "error");

  const pinErr = validatePin(newPin);
  if (pinErr)  return toast(pinErr, "error");

  const phone = formatPhone(rawPhone);
  if (!phone) return toast("Invalid phone number", "error");

  const btn = el("btn-reset-submit");
  btn.disabled = true; btn.innerText = "Resetting...";
  try {
    const res  = await fetch(API + "/auth/reset-pin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone, newPin })
    });
    const data = await res.json();
    if (!res.ok) { toast(data.message || "Reset failed", "error"); return; }
    toast("✅ PIN reset! Please sign in.", "success");
    closeModal("reset-modal");
    setTimeout(() => openModal("login-modal"), 300);
  } catch { toast("Network error. Try again.", "error"); }
  finally { btn.disabled = false; btn.innerText = "Reset PIN"; }
}

// ================================================================
// PHONE MASKING — confirm field shows asterisks while typing
// ================================================================
function maskPhoneConfirm(input) {
  // We store the real value in a data attribute,
  // but display asterisks for the last N-3 chars
  const val = input.value;
  if (val.length > 3) {
    const visible = val.slice(0, 3);
    const masked  = "*".repeat(val.length - 3);
    // We need the real value for comparison — store it
    input.dataset.real = val;
  } else {
    input.dataset.real = val;
  }
}

// ================================================================
// UTILS
// ================================================================
function logout() {
  token = null;
  localStorage.removeItem("av_token");
  if (socket) socket.disconnect();
  if (pollTimer) clearInterval(pollTimer);
  location.reload();
}

let toastTimer = null;
function toast(msg, type = "info") {
  const t = el("toast");
  if (!t) return;
  if (toastTimer) { clearTimeout(toastTimer); t.classList.remove("show"); setTimeout(() => showToast(t, msg, type), 150); }
  else showToast(t, msg, type);
}
function showToast(t, msg, type) {
  t.innerText   = msg;
  t.className   = type === "success" ? "success" : type === "error" ? "error" : "info";
  t.classList.add("show");
  toastTimer = setTimeout(() => { t.classList.remove("show"); toastTimer = null; }, 3500);
}

function openModal(id)         { const m = el(id); if (m) m.classList.add("open"); }
function closeModal(id)        { const m = el(id); if (m) m.classList.remove("open"); }
function switchModal(from, to) { closeModal(from); setTimeout(() => openModal(to), 200); }

document.addEventListener("click", (e) => {
  if (e.target.classList.contains("modal-bg")) e.target.classList.remove("open");
});

// ================================================================
// GLOBAL EXPORTS
// ================================================================
window.startGame         = startGame;
window.cancelBet         = cancelBet;
window.cashOut           = cashOut;
window.logout            = logout;
window.openModal         = openModal;
window.closeModal        = closeModal;
window.switchModal       = switchModal;
window.openDeposit       = openDeposit;
window.openWithdraw      = openWithdraw;
window.doDeposit         = doDeposit;
window.doWithdraw        = doWithdraw;
window.doLogin           = doLogin;
window.doRegister        = doRegister;
window.doResetPin        = doResetPin;
window.setAmount         = setAmount;
window.setDepAmount      = setDepAmount;
window.toggleAutoCashout = toggleAutoCashout;
window.maskPhoneConfirm  = maskPhoneConfirm;