// script.js

// 🔧 Firebase Configuration
const firebaseConfig = {
  apiKey: "AIzaSyD-xaGtrczkUCT7rwEOuRnHzVE9AohYsKU",
  authDomain: "bjplivefirebase.firebaseapp.com",
  projectId: "bjplivefirebase",
  storageBucket: "bjplivefirebase.firebasestorage.app",
  messagingSenderId: "236867156337",
  appId: "1:236867156337:web:1fbd6c535689a6f34d5ed0",
  measurementId: "G-M5KY8DW9JD"
};
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const storage = firebase.storage();

const TELEGRAM_BOT_TOKEN = "8064306737:AAFvXvc3vIT1kyccGiPbpYGCAr9dgKJcRzw";
const TELEGRAM_CHAT_ID = "733804072";

function normalizeMobile(input) {
  let digits = (input || "").toString().replace(/\D/g, "");
  if (digits.length > 10) digits = digits.slice(-10);
  return digits;
}

function fmtTS(ts) {
  try {
    if (!ts) return "";
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleString();
  } catch { return ""; }
}

function queueSave(entry) {
  const key = "offlineQueueVisitors";
  const q = JSON.parse(localStorage.getItem(key) || "[]");
  q.push(entry);
  localStorage.setItem(key, JSON.stringify(q));
}

async function processQueue() {
  const key = "offlineQueueVisitors";
  const q = JSON.parse(localStorage.getItem(key) || "[]");
  if (!q.length) return;

  const left = [];
  for (const entry of q) {
    try {
      const imgBlob = await (await fetch(entry.selfieData)).blob();
      const filePath = `selfies/${Date.now()}_${entry.mobile}.jpg`;
      const up = await storage.ref(filePath).put(imgBlob);
      const selfieURL = await up.ref.getDownloadURL();

      await db.collection("visitors").add({
        name: entry.name,
        mobile: entry.mobile,
        designation: entry.designation,
        address: entry.address,
        mandal: entry.mandal,
        reason: entry.reason,
        selfie: selfieURL,
        timestamp: firebase.firestore.FieldValue.serverTimestamp()
      });

      const text = `नया आगंतुक:\nनाम: ${entry.name}\nमोबाइल: ${entry.mobile}\nपद: ${entry.designation}\nमंडल: ${entry.mandal}\nपता: ${entry.address}\nकारण: ${entry.reason}\n📷 Selfie: ${selfieURL}`;
      await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: TELEGRAM_CHAT_ID, text })
      });
    } catch (e) {
      left.push(entry);
    }
  }
  localStorage.setItem(key, JSON.stringify(left));
}

document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("visitor-form");
  const video = document.getElementById("camera");
  const canvas = document.getElementById("snapshot");
  const selfieInput = document.getElementById("selfieData");

  async function startCamera() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      video.srcObject = stream;
    } catch (err) {
      console.warn("कैमरा ओपन नहीं हुआ:", err.message);
    }
  }
  startCamera();

  // --- Active Event → Header + Reason Prefill ---
  (function setupActiveEventBinding() {
    const headingEl = document.getElementById("formHeading");
    const reasonSel = document.getElementById("reason");

    function ensureOptionAndSelect(value, select = true) {
      if (!value || !reasonSel) return;
      const exists = Array.from(reasonSel.options).some(o => o.value === value);
      if (!exists) {
        const op = document.createElement("option");
        op.value = value;
        op.textContent = value;
        // Add near top (after placeholder if any)
        if (reasonSel.firstChild && reasonSel.firstChild.tagName === "OPTION" && reasonSel.firstChild.value === "") {
          reasonSel.insertBefore(op, reasonSel.firstChild.nextSibling);
        } else {
          reasonSel.insertBefore(op, reasonSel.firstChild);
        }
      }
      if (select) reasonSel.value = value;
    }

    function sanitizeIfNA() {
      if (!reasonSel) return;
      const v = (reasonSel.value || "").trim().toLowerCase();
      if (v === "na" || v === "n/a") reasonSel.value = "";
    }

    db.collection("events").where("active", "==", true).limit(1)
      .onSnapshot((snap) => {
        const doc = snap.docs[0];
        const data = doc ? doc.data() : null;
        const evName = (data && data.name ? String(data.name).trim() : "");

        if (evName) {
          if (headingEl) headingEl.textContent = `इवेंट: ${evName}`;
          if (reasonSel) {
            sanitizeIfNA();
            ensureOptionAndSelect(evName, true);
            // reasonSel.disabled = true; // अगर लॉक करना हो तो अनकॉमेंट करें
          }
        } else {
          if (headingEl) headingEl.textContent = "भाजपा कार्यालय पर आपका स्वागत है";
          if (reasonSel) {
            // reasonSel.disabled = false;
            const v = (reasonSel.value || "").trim();
            const defaults = ["कार्यालय पर बैठक","जिला अध्यक्ष से भेंट","ट्रांसफर / शासकीय कार्य / शिकायत","कार्यालय पर सामान्य उपस्थिति","अन्य कोई कार्य",""];
            if (v && !defaults.includes(v)) {
              reasonSel.value = "";
            }
          }
        }
      }, (err) => {
        console.warn("Active event listener error:", err && err.message ? err.message : err);
      });
  })();


  window.capturePhoto = function () {
    const ctx = canvas.getContext("2d");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0);
    selfieInput.value = canvas.toDataURL("image/jpeg");
    canvas.style.display = "block";
  };

  const mobileInput = document.getElementById("mobile");
  mobileInput.addEventListener("blur", async (e) => {
    const raw = e.target.value;
    const mobile = normalizeMobile(raw);
    e.target.value = mobile;
    if (mobile.length !== 10) return;

    const [oldSnap, newSnap] = await Promise.all([
      db.collection("jila_format_2025").where("मोबाइल", "==", mobile).limit(1).get(),
      db.collection("visitors").where("mobile", "==", mobile).limit(1).get()
    ]);

    const doc = newSnap.docs[0] || oldSnap.docs[0];
    if (doc) {
      const data = doc.data();
      form.name.value = data["नाम"] || data["name"] || "";
      form.designation.value = data["पद"] || data["designation"] || "";
      form.address.value = data["पता"] || data["address"] || "";
      form.mandal.value = data["मंडल"] || data["mandal"] || "";
    }
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const submitBtn = form.querySelector("button[type='submit']");
    submitBtn.disabled = true;

    const name = form.name.value.trim(),
      mobile = normalizeMobile(form.mobile.value.trim()),
      designation = form.designation.value.trim(),
      address = form.address.value.trim(),
      mandal = form.mandal.value,
      reason = form.reason.value,
      selfieData = form.selfieData.value;

    if (!name || !mobile || !designation || !address || !mandal || !reason || !selfieData) {
      alert("सभी फ़ील्ड/सेल्फ़ी भरना ज़रूरी है।");
      submitBtn.disabled = false;
      return;
    }

    if (!navigator.onLine) {
      queueSave({ name, mobile, designation, address, mandal, reason, selfieData });
      Swal.fire({
        title: "ऑफ़लाइन मोड",
        text: "डेटा सेव कर लिया गया है, इंटरनेट चालू होने पर भेजा जाएगा।",
        icon: "success",
        timer: 2000,
        showConfirmButton: false
      });
      form.reset();
      canvas.style.display = "none";
      selfieInput.value = "";
      startCamera();
      submitBtn.disabled = false;
      return;
    }

    try {
      const imgBlob = await (await fetch(selfieData)).blob();
      const filePath = `selfies/${Date.now()}_${mobile}.jpg`;
      const up = await storage.ref(filePath).put(imgBlob);
      const selfieURL = await up.ref.getDownloadURL();

      await db.collection("visitors").add({
        name, mobile, designation, address, mandal, reason,
        selfie: selfieURL,
        timestamp: firebase.firestore.FieldValue.serverTimestamp()
      });

      const text = `नया आगंतुक:\nनाम: ${name}\nमोबाइल: ${mobile}\nपद: ${designation}\nमंडल: ${mandal}\nपता: ${address}\nकारण: ${reason}\n📷 Selfie: ${selfieURL}`;
      await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: TELEGRAM_CHAT_ID, text })
      });

      Swal.fire({
        title: "✅ धन्यवाद!",
        text: "आपकी जानकारी सफलतापूर्वक सेव हो गई है।",
        icon: "success",
        timer: 1500,
        showConfirmButton: false
      });
      form.reset();
      canvas.style.display = "none";
      selfieInput.value = "";
      startCamera();
    } catch (err) {
      console.error("❌ Submit Error:", err);
      alert("कुछ त्रुटि हुई, कृपया पुनः प्रयास करें।");
    }
    submitBtn.disabled = false;
  });

  processQueue();
  window.addEventListener("online", processQueue);
});
