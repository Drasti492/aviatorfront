import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-app.js";
import {
  getAuth,
  RecaptchaVerifier,
  signInWithPhoneNumber
} from "https://www.gstatic.com/firebasejs/10.12.4/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyBb-NBiJNfMjuLUn6IsoAEWiiox0x45xEY",
  authDomain: "aviator-78db3.firebaseapp.com",
  projectId: "aviator-78db3",
  storageBucket: "aviator-78db3.firebasestorage.app",
  messagingSenderId: "974672784155",
  appId: "1:974672784155:web:93ef6e668e0fd069e341be"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

let confirmationResult = null;

// INIT RECAPTCHA (ONLY ONCE)
function initRecaptcha() {
  if (window.recaptchaVerifier) return;

  window.recaptchaVerifier = new RecaptchaVerifier(
    "recaptcha-container",
    {
      size: "invisible"
    },
    auth
  );

  window.recaptchaVerifier.render();
}

// SEND OTP
async function sendOTP(phone) {
  try {
    initRecaptcha();

    confirmationResult = await signInWithPhoneNumber(
      auth,
      phone,
      window.recaptchaVerifier
    );

    return true;
  } catch (err) {
    console.error("OTP ERROR:", err);
    throw err;
  }
}

// VERIFY OTP
async function verifyOTP(code) {
  if (!confirmationResult) throw new Error("No OTP session found");

  const result = await confirmationResult.confirm(code);
  return result.user;
}

// EXPOSE TO GLOBAL
window.sendOTP = sendOTP;
window.verifyOTP = verifyOTP;