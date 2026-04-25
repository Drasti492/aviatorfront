const API = "https://aviator-9raf.onrender.com/api";

function formatPhone(p) {
  p = p.replace(/\D/g, "");
  if (p.startsWith("0")) p = "254" + p.slice(1);
  if (!p.startsWith("254")) p = "254" + p;
  return "+" + p;
}

// ================= LOGIN =================
window.startPhoneLogin = async function () {
  const phoneInput = document.getElementById("login-phone").value;
  const phone = formatPhone(phoneInput);

  try {
    await sendOTP(phone);
    document.getElementById("login-otp").style.display = "block";
    alert("OTP sent");
  } catch (err) {
    console.error(err);
    alert("OTP failed (check Firebase config)");
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

    alert("Login success");
    location.reload();
  } catch (err) {
    console.error(err);
    alert("Login failed");
  }
};

// ================= REGISTER =================
window.startPhoneAuth = async function () {
  const phoneInput = document.getElementById("reg-phone").value;
  const phone = formatPhone(phoneInput);

  try {
    await sendOTP(phone);
    document.getElementById("otp-section").style.display = "block";
    alert("OTP sent");
  } catch (err) {
    console.error(err);
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

    alert("Account created");
    location.reload();
  } catch (err) {
    console.error(err);
    alert("Signup failed");
  }
};