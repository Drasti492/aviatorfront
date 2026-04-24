const API = "https://wallback.onrender.com/api";

// FORMAT PHONE
function formatPhone(p) {
  p = p.replace(/\D/g, "");
  if (p.startsWith("0")) p = "254" + p.slice(1);
  if (!p.startsWith("254")) p = "254" + p;
  return "+" + p;
}

// SEND OTP
window.startPhoneAuth = async function () {
  const phoneInput = document.getElementById("reg-phone").value;
  const phone = formatPhone(phoneInput);

  try {
    await sendOTP(phone);
    document.getElementById("otp-section").style.display = "block";
    alert("OTP sent!");
  } catch (err) {
    alert("Failed to send OTP");
  }
};

// VERIFY OTP + LOGIN / REGISTER
window.completeAuth = async function () {
  const code = document.getElementById("otp-code").value;
  const phoneInput = document.getElementById("reg-phone").value;
  const name = document.getElementById("reg-name").value;

  try {
    const user = await verifyOTP(code);
const idToken = await user.getIdToken();

    //  SEND TO BACKEND
    const res = await fetch(API + "/auth/phone-login", {
     method: "POST",
     headers: {
    "Content-Type": "application/json",
    "Authorization": "Bearer " + idToken
  },
  body: JSON.stringify({
    phone: phoneInput,
    name: name
  })
});

    const data = await res.json();

    if (!res.ok) throw new Error(data.message);

    // SAVE SESSION
    localStorage.setItem("av_token", data.token);
    localStorage.setItem("av_user", JSON.stringify(data.user));

    alert("Login successful!");
    location.reload();

  } catch (err) {
    alert("Verification failed");
  }
};

//login

window.startPhoneLogin = async function () {
  const phoneInput = document.getElementById("login-phone").value;
  const phone = formatPhone(phoneInput);

  try {
    await sendOTP(phone);
    document.getElementById("login-otp").style.display = "block";
    alert("OTP sent!");
  } catch (err) {
    alert("Failed to send OTP");
  }
};

window.verifyPhoneLogin = async function () {
  const code = document.getElementById("login-code").value;
  const phoneInput = document.getElementById("login-phone").value;

  try {
    await verifyOTP(code);

    const res = await fetch(API + "/auth/phone-login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        phone: phoneInput
      })
    });

    const data = await res.json();

    if (!res.ok) throw new Error(data.message);

    localStorage.setItem("av_token", data.token);
    localStorage.setItem("av_user", JSON.stringify(data.user));

    alert("Login successful!");
    location.reload();

  } catch (err) {
    alert("Login failed");
  }
};