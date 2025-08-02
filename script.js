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

// 🔐 Telegram Config (जैसा पहले था)
const TELEGRAM_BOT_TOKEN = "8064306737:AAFvXvc3vIT1kyccGiPbpYGCAr9dgKJcRzw";
const TELEGRAM_CHAT_ID = "733804072";

/* -------------------------------------------
   Helpers: Mobile normalize + Field autodetect
--------------------------------------------*/

// मोबाइल को केवल 10 अंकों में normalize करें ( +91 / spaces / dashes हटें )
function normalizeMobile(input) {
  let digits = (input || "").toString().replace(/\D/g, "");
  if (digits.length > 10) digits = digits.slice(-10);
  return digits;
}

// jila_format_2025 में "मोबाइल" फ़ील्ड की असली key (स्पेलिंग/स्पेस) ऑटो-डिटेक्ट
let MOBILE_FIELD = "मोबाइल"; // default
async function detectMobileFieldKey(ref) {
  try {
    const snap = await ref.limit(1).get();
    if (!snap.empty) {
      const sample = snap.docs[0].data();
      const keys = Object.keys(sample);
      const foundHindi = keys.find(k => k.replace(/\s+/g, "").match(/मोब(ा|ाइ)ल/i));
      if (foundHindi) {
        MOBILE_FIELD = foundHindi;
      } else if (keys.includes("mobile")) {
        MOBILE_FIELD = "mobile";
      } else if (keys.includes("मोबाइल")) {
        MOBILE_FIELD = "मोबाइल";
      } else if (keys.includes("मोबाईल")) {
        MOBILE_FIELD = "मोबाईल";
      }
      console.log("🧭 Detected mobile field key:", `"${MOBILE_FIELD}"`, "Available keys:", keys);
    } else {
      console.warn("⚠️ jila_format_2025 खाली लग रहा है (limit 1).");
    }
  } catch (e) {
    console.error("❌ detectMobileFieldKey error:", e);
  }
}

// तारीख दिखाने के लिए (visitors में timestamp हो तो)
function fmtTS(ts) {
  try {
    if (!ts) return "";
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleString();
  } catch { return ""; }
}

/* -------------------------------------------
   🔴 NEW: Dynamic Event Heading + Reason auto‑fill
--------------------------------------------*/
let __defaultReasonOptions = null; // पेज से रीड करके कैश करेंगे

async function applyActiveEvent() {
  const headingEl = document.getElementById("formHeading");
  const reasonSel = document.getElementById("reason");
  if (!headingEl || !reasonSel) return;

  // पहली बार पर default reasons cache कर लें
  if (!__defaultReasonOptions) {
    __defaultReasonOptions = Array.from(reasonSel.options).map(op => ({ value: op.value, text: op.text }));
  }

  try {
    const snap = await db.collection("events").where("active", "==", true).limit(1).get();
    if (!snap.empty) {
      const name = (snap.docs[0].data().name || "").toString().trim();
      if (name) {
        headingEl.textContent = `${name} पंजीयन`;
        // reason में सिर्फ वही नाम
        reasonSel.innerHTML = "";
        const op = document.createElement("option");
        op.value = name; op.textContent = name; op.selected = true;
        reasonSel.appendChild(op);
        return;
      }
    }
    // कोई active event नहीं → default state
    headingEl.textContent = "भाजपा कार्यालय पर आपका स्वागत है";
    reasonSel.innerHTML = "";
    (__defaultReasonOptions || []).forEach(o => {
      const op = document.createElement("option");
      op.value = o.value; op.textContent = o.text;
      reasonSel.appendChild(op);
    });
  } catch (e) {
    console.warn("applyActiveEvent error:", e);
  }
}

// realtime update (admin से Set Active होते ही)
function subscribeActiveEvent() {
  db.collection("events").onSnapshot(() => applyActiveEvent(), (e) => console.warn("events listen:", e?.message || e));
}

/* -------------------------------------------
   🔴 NEW: Offline Queue Mode
--------------------------------------------*/
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
      // selfie upload
      const imgBlob = await (await fetch(entry.selfieData)).blob();
      const filePath = `selfies/${Date.now()}_${entry.mobile}.jpg`;
      const up = await storage.ref(filePath).put(imgBlob);
      const selfieURL = await up.ref.getDownloadURL();

      // Firestore save
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

      // Telegram alert (ऑनलाइन मोड जैसा)
      const text = `नया आगंतुक:
नाम: ${entry.name}
मोबाइल: ${entry.mobile}
पद: ${entry.designation}
मंडल: ${entry.mandal}
पता: ${entry.address}
कारण: ${entry.reason}
📷 Selfie: ${selfieURL}`;
      await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: TELEGRAM_CHAT_ID, text })
      });
    } catch (e) {
      console.warn("Queue item failed, keeping for later:", e?.message || e);
      left.push(entry); // बचा रहने दो
    }
  }
  localStorage.setItem(key, JSON.stringify(left));
  if (!left.length) console.log("✅ Offline queue fully synced.");
}

/* -------------------------------------------
   MAIN
--------------------------------------------*/
document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("visitor-form");
  const video = document.getElementById("camera");
  const canvas = document.getElementById("snapshot");
  const selfieInput = document.getElementById("selfieData");

  // 🔎 रेफरेंस: पुराना + नया
  const oldDataRef = db.collection("jila_format_2025"); // पुराने रिकॉर्ड (हिन्दी फील्ड)
  const newDataRef = db.collection("visitors");         // नए सबमिशन (English फील्ड)

  // मोबाइल key ऑटो-डिटेक्ट (पेज लोड पर एक बार)
  detectMobileFieldKey(oldDataRef);

  // ✅ Start Camera
  async function startCamera() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      video.srcObject = stream;
    } catch (err) {
      console.warn("कैमरा ओपन नहीं हुआ:", err.message);
    }
  }
  startCamera();

  // 📸 Capture Photo
  window.capturePhoto = function () {
    const ctx = canvas.getContext("2d");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0);
    selfieInput.value = canvas.toDataURL("image/jpeg");
    canvas.style.display = "block";
  };

  // 🔁 URL params → auto-fill
  const params = new URLSearchParams(window.location.search);
  for (let [k, v] of params.entries()) {
    const el = form.elements[k];
    if (el) el.value = decodeURIComponent(v.replace(/\+/g, " "));
  }

  // 🧩 हेल्पर: चुने हुए रिकॉर्ड से फॉर्म भरना (Hindi/English दोनों फील्ड सपोर्ट)
  function fillFormFromData(data) {
    form.name.value = data["नाम"] || data["name"] || "";
    form.designation.value = data["पद"] || data["designation"] || "";
    form.address.value = data["पता"] || data["address"] || "";

    // मंडल टेक्स्ट से सुरक्षित मैच
    const mandalValue = (data["मंडल"] || data["mandal"] || "").toString().trim();
    const mandalSelect = form.mandal;
    let found = false;
    for (let i = 0; i < mandalSelect.options.length; i++) {
      if (mandalSelect.options[i].text.trim() === mandalValue) {
        mandalSelect.selectedIndex = i;
        found = true;
        break;
      }
    }
    if (!found && mandalValue) console.warn("⚠️ मंडल ड्रॉपडाउन में नहीं मिला:", mandalValue);
  }

  // 🔍 मोबाइल से Auto‑fetch (पुराना + नया)
  const mobileInput = document.getElementById("mobile");

  // सर्च आइकन (यदि मौजूद) पर क्लिक = blur ट्रिगर
  const searchIcon = mobileInput?.parentElement?.querySelector("span");
  if (searchIcon) {
    searchIcon.addEventListener("click", () => mobileInput.blur());
  }

  mobileInput.addEventListener("blur", async (e) => {
    const raw = e.target.value;
    const mobile = normalizeMobile(raw);
    e.target.value = mobile; // इनपुट में normalized value रखें

    if (mobile.length !== 10) {
      console.warn("⚠️ मोबाइल नंबर वैध नहीं है (10 अंक ज़रूरी)");
      return;
    }

    try {
      console.log("🔍 Firebase से खोज रहे हैं...", { oldField: MOBILE_FIELD, value: mobile });

      // दोनों कलेक्शन में एकसाथ सर्च
      const [oldSnap, newSnap] = await Promise.all([
        oldDataRef.where(MOBILE_FIELD, "==", mobile).limit(10).get(),
        newDataRef.where("mobile", "==", mobile).limit(10).get()
      ]);

      const candidates = [];

      // पुराने रिकॉर्ड जोड़ें
      oldSnap.forEach(d => {
        const dt = d.data();
        candidates.push({
          id: `old_${d.id}`,
          src: "पुराना",
          ts: 0,
          data: dt
        });
      });

      // नए रिकॉर्ड जोड़ें
      newSnap.forEach(d => {
        const dt = d.data();
        candidates.push({
          id: `new_${d.id}`,
          src: "नया",
          ts: dt.timestamp || 0,
          data: dt
        });
      });

      if (candidates.length === 0) {
        console.warn("❌ कोई रिकॉर्ड नहीं मिला इस नंबर से:", mobile);
        return;
      }

      // अगर सिर्फ एक मिला → सीधे fill
      if (candidates.length === 1) {
        fillFormFromData(candidates[0].data);
        Swal.fire("रिकॉर्ड मिला", `${candidates[0].src} स्रोत से जानकारी भर दी गई है।`, "info");
        return;
      }

      // कई मिले → timestamp desc के आधार पर sort (नया ऊपर)
      candidates.sort((a, b) => {
        const ta = a.ts?.toMillis ? a.ts.toMillis() : (a.ts || 0);
        const tb = b.ts?.toMillis ? b.ts.toMillis() : (b.ts || 0);
        return tb - ta;
      });

      // SweetAlert चुनने के लिए options
      const options = {};
      candidates.forEach(c => {
        const dt = c.data;
        const name = (dt["नाम"] || dt["name"] || "").toString().trim() || "—";
        const mandal = (dt["मंडल"] || dt["mandal"] || "").toString().trim() || "—";
        const addr = (dt["पता"] || dt["address"] || "").toString().trim() || "—";
        const when = fmtTS(c.ts);
        const meta = c.src + (when ? ` • ${when}` : "");
        options[c.id] = `${name} — ${mandal} — ${addr} (${meta})`;
      });

      const { value: chosenId } = await Swal.fire({
        title: "एक से अधिक रिकॉर्ड मिले",
        text: "कृपया सही रिकॉर्ड चुनें",
        input: "select",
        inputOptions: options,
        inputPlaceholder: "रिकॉर्ड चुनें",
        confirmButtonText: "चुनें",
        cancelButtonText: "रद्द करें",
        showCancelButton: true,
        allowOutsideClick: false
      });

      if (chosenId) {
        const chosen = candidates.find(c => c.id === chosenId);
        if (chosen) {
          fillFormFromData(chosen.data);
          Swal.fire("रिकॉर्ड चयनित", "चयनित जानकारी भर दी गई है।", "success");
        }
      } else {
        console.log("यूज़र ने चयन रद्द किया।");
      }
    } catch (err) {
      console.error("🚫 Auto-fetch Error:", err);
    }
  });

  // 🔁 Event heading / reason setup + offline queue sync
  applyActiveEvent();
  subscribeActiveEvent();
  processQueue();
  window.addEventListener("online", processQueue);

  // 📨 Submit Handler (मौजूदा जैसा, बस offline support जोड़ा)
  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const name = form.name.value.trim(),
      mobile = normalizeMobile(form.mobile.value.trim()),
      designation = form.designation.value.trim(),
      address = form.address.value.trim(),
      mandal = form.mandal.value,
      reason = form.reason.value,
      selfieData = form.selfieData.value;

    if (!name || !mobile || !designation || !address || !mandal || !reason || !selfieData) {
      return alert("सभी फ़ील्ड/सेल्फ़ी भरना ज़रूरी है।");
    }

    // 🔌 Offline? → Queue
    if (!navigator.onLine) {
      queueSave({ name, mobile, designation, address, mandal, reason, selfieData });
      Swal.fire("सहेजा गया", "इंटरनेट उपलब्ध होने पर आपका डेटा स्वतः भेज दिया जाएगा।", "success");
      form.reset();
      canvas.style.display = "none";
      return;
    }

    try {
      // Upload selfie
      const imgBlob = await (await fetch(selfieData)).blob();
      const filePath = `selfies/${Date.now()}_${mobile}.jpg`;
      const up = await storage.ref(filePath).put(imgBlob);
      const selfieURL = await up.ref.getDownloadURL();

      // Save Firestore (नई एंट्री)
      await db.collection("visitors").add({
        name, mobile, designation, address, mandal, reason, selfie: selfieURL,
        timestamp: firebase.firestore.FieldValue.serverTimestamp()
      });

      // Send Telegram alert
      const text = `नया आगंतुक:
नाम: ${name}
मोबाइल: ${mobile}
पद: ${designation}
मंडल: ${mandal}
पता: ${address}
कारण: ${reason}
📷 Selfie: ${selfieURL}`;
      await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: TELEGRAM_CHAT_ID, text })
      });

      Swal.fire("धन्यवाद!", "आपकी जानकारी सफल रूप से सहेज ली गई है।", "success");
      form.reset();
      canvas.style.display = "none";
    } catch (err) {
      console.error("❌ Submit Error:", err);
      alert("कुछ गलत हुआ। कृपया पुनः प्रयास करें।");
    }
  });
});
