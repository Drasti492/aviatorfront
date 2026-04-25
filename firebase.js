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
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

let confirmationResult;

// ✅ ALWAYS ENSURE RECAPTCHA EXISTS
async function ensureRecaptcha() {
  if (!window.recaptchaVerifier) {
    window.recaptchaVerifier = new RecaptchaVerifier(
      auth,
      "recaptcha-container",
      {
        size: "normal", // change to "invisible" later
      }
    );

    await window.recaptchaVerifier.render();
  }
}

// ✅ SEND OTP
window.sendOTP = async (phone) => {
  try {
    if (!phone.startsWith("+")) {
      throw new Error("Use format: +2547XXXXXXXX");
    }

    await ensureRecaptcha(); // 🔥 FIX

    confirmationResult = await signInWithPhoneNumber(
      auth,
      phone,
      window.recaptchaVerifier
    );

    return true;

  } catch (err) {
    console.error("OTP ERROR:", err);

    // 🔥 reset recaptcha if it breaks
    if (window.recaptchaVerifier) {
      window.recaptchaVerifier.clear();
      window.recaptchaVerifier = null;
    }

    alert(err.message);
    throw err;
  }
};

// ✅ VERIFY OTP
window.verifyOTP = async (code) => {
  if (!confirmationResult) {
    throw new Error("No OTP session. Click send OTP again.");
  }

  const result = await confirmationResult.confirm(code);
  return result.user;
};