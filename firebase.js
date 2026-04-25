import { initializeApp } from "https://www.gstatic.com/firebasejs/12.12.1/firebase-app.js";
import {
  getAuth,
  RecaptchaVerifier,
  signInWithPhoneNumber
} from "https://www.gstatic.com/firebasejs/12.12.1/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyBb-NBiJNfMjuLUn6IsoAEWiiox0x45xEY",
  authDomain: "aviator-78db3.firebaseapp.com",
  projectId: "aviator-78db3",
  storageBucket: "aviator-78db3.appspot.com",
  messagingSenderId: "974672784155",
  appId: "1:974672784155:web:93ef6e668e0fd069e341be"
};

initializeApp(firebaseConfig);

const auth = getAuth();

let confirmationResult = null;
let recaptchaReady = false;

window.sendOTP = async function (phone) {
  try {
    if (!recaptchaReady) {
      window.recaptchaVerifier = new RecaptchaVerifier(
        "recaptcha-container",
        { size: "invisible" },
        auth
      );
      recaptchaReady = true;
    }

    confirmationResult = await signInWithPhoneNumber(
      auth,
      phone,
      window.recaptchaVerifier
    );

    return true;
  } catch (err) {
    console.log("OTP ERROR:", err);
    throw err;
  }
};

window.verifyOTP = async function (code) {
  if (!confirmationResult) throw new Error("No OTP session");

  const result = await confirmationResult.confirm(code);
  return result.user;
};