import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-app.js";
import {
  getAuth,
  RecaptchaVerifier,
  signInWithPhoneNumber
} from "https://www.gstatic.com/firebasejs/10.12.4/firebase-auth.js";

// 🔥 YOUR CONFIG
const firebaseConfig = {
  apiKey: "AIzaSyBb-NBiJNfMjuLUn6IsoAEWiiox0x45xEY",
  authDomain: "aviator-78db3.firebaseapp.com",
  projectId: "aviator-78db3",
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

let confirmationResult = null;

// ✅ INIT RECAPTCHA
window.addEventListener("load", () => {
  console.log("🔥 Initializing reCAPTCHA...");

  window.recaptchaVerifier = new RecaptchaVerifier(
    auth,
    "recaptcha-container",
    {
      size: "normal"
    }
  );

  window.recaptchaVerifier.render()
    .then(() => console.log("✅ reCAPTCHA ready"))
    .catch(err => console.error("❌ reCAPTCHA error", err));
});

// ✅ SEND OTP
window.sendOTP = async (phone) => {
  console.log("📲 Sending OTP to:", phone);

  if (!window.recaptchaVerifier) {
    throw new Error("reCAPTCHA not ready");
  }

  confirmationResult = await signInWithPhoneNumber(
    auth,
    phone,
    window.recaptchaVerifier
  );

  console.log("✅ OTP SENT");
  return true;
};

// ✅ VERIFY OTP
window.verifyOTP = async (code) => {
  if (!confirmationResult) {
    throw new Error("No OTP session");
  }

  const result = await confirmationResult.confirm(code);
  console.log("✅ OTP VERIFIED");

  return result.user;
};