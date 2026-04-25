const API = "https://aviator-9raf.onrender.com/api";

// ========== FORMAT PHONE ==========
function formatPhone(p) {
  p = p.replace(/\D/g, "");
  if (p.startsWith("0")) p = "254" + p.slice(1);
  if (!p.startsWith("254")) p = "254" + p;
  return "+" + p;
}

// ========== REGISTER ==========
window.startPhoneAuth = async function () {
  const phone = formatPhone(document.getElementById("reg-phone").value);

  try {
    await sendOTP(phone);
    document.getElementById("otp-section").style.display = "block";
  } catch (err) {
    console.log(err);
    alert("OTP failed");
  }
};

window.completeAuth = async function () {
  const code = document.getElementById("otp-code").value;
  const name = document.getElementById("reg-name").value;

  try {
    const user = await verifyOTP(code);
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

    localStorage.setItem("av_token", data.token);
    location.reload();
  } catch (err) {
    console.log(err);
    alert("Signup failed");
  }
};

// ========== LOGIN ==========
window.startPhoneLogin = async function () {
  const phone = formatPhone(document.getElementById("login-phone").value);

  try {
    await sendOTP(phone);
    document.getElementById("login-otp").style.display = "block";
  } catch (err) {
    alert("OTP failed");
  }
};

window.verifyPhoneLogin = async function () {
  const code = document.getElementById("login-code").value;

  try {
    const user = await verifyOTP(code);
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

    localStorage.setItem("av_token", data.token);
    location.reload();
  } catch (err) {
    console.log(err);
    alert("Login failed");
  }
};