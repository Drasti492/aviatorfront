
  // Import the functions you need from the SDKs you need
  import { initializeApp } from "https://www.gstatic.com/firebasejs/12.12.1/firebase-app.js";
  

  // web app's Firebase configuration
  const firebaseConfig = {
    apiKey: "AIzaSyBb-NBiJNfMjuLUn6IsoAEWiiox0x45xEY",
    authDomain: "aviator-78db3.firebaseapp.com",
    projectId: "aviator-78db3",
    storageBucket: "aviator-78db3.firebasestorage.app",
    messagingSenderId: "974672784155",
    appId: "1:974672784155:web:93ef6e668e0fd069e341be"
  };


 // Initialize Firebase
  const app = initializeApp(firebaseConfig);

  import {
  getAuth,
  RecaptchaVerifier,
  signInWithPhoneNumber
} from "https://www.gstatic.com/firebasejs/12.12.1/firebase-auth.js";

const auth = getAuth();

let confirmationResult;

window.sendOTP = async function(phone){
  window.recaptchaVerifier = new RecaptchaVerifier(
    "recaptcha-container",
    { size: "invisible" },
    auth
  );

  confirmationResult = await signInWithPhoneNumber(
    auth,
    phone,
    window.recaptchaVerifier
  );
};

window.verifyOTP = async function(code){
  const result = await confirmationResult.confirm(code);
  return result.user;
};
