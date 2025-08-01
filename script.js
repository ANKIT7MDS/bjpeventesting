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

// ✅ Local queue key
const OFFLINE_QUEUE_KEY = "visitorQueue";

function saveToQueue(data){
  let q = JSON.parse(localStorage.getItem(OFFLINE_QUEUE_KEY) || "[]");
  q.push(data);
  localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(q));
}

async function flushQueue(){
  let q = JSON.parse(localStorage.getItem(OFFLINE_QUEUE_KEY) || "[]");
  if (!q.length) return;

  for (let entry of q){
    try{
      await db.collection("visitors").add(entry);
    }catch(e){ console.warn("Queue push error", e); }
  }
  localStorage.removeItem(OFFLINE_QUEUE_KEY);
}

window.addEventListener("online", flushQueue);

/* -------------------------------------------
   Helpers
--------------------------------------------*/
function normalizeMobile(input) {
  let digits = (input || "").toString().replace(/\D/g, "");
  if (digits.length > 10) digits = digits.slice(-10);
  return digits;
}

document.addEventListener("DOMContentLoaded", async () => {
  const form = document.getElementById("visitor-form");
  const video = document.getElementById("camera");
  const canvas = document.getElementById("snapshot");
  const selfieInput = document.getElementById("selfieData");
  const heading = document.getElementById("form-heading");
  const reasonDropdown = document.getElementById("reason");

  // ✅ Fetch Active Event
  try{
    const evSnap = await db.collection("events").where("active","==",true).limit(1).get();
    if(!evSnap.empty){
      const ev = evSnap.docs[0].data();
      heading.textContent = `${ev.name} पंजीयन`;
      reasonDropdown.innerHTML = `<option value="${ev.name}" selected>${ev.name}</option>`;
    }
  }catch(e){ console.warn("Event fetch error:", e); }

  // ✅ Camera Start
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
    video.srcObject = stream;
  } catch (err) {
    console.warn("कैमरा ओपन नहीं हुआ:", err.message);
  }

  window.capturePhoto = function () {
    const ctx = canvas.getContext("2d");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0);
    selfieInput.value = canvas.toDataURL("image/jpeg");
    canvas.style.display = "block";
  };

  // ✅ Submit Handler
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

    try {
      // Upload selfie
      const imgBlob = await (await fetch(selfieData)).blob();
      const filePath = `selfies/${Date.now()}_${mobile}.jpg`;
      const up = await storage.ref(filePath).put(imgBlob);
      const selfieURL = await up.ref.getDownloadURL();

      const payload = {
        name, mobile, designation, address, mandal, reason, selfie: selfieURL,
        timestamp: firebase.firestore.FieldValue.serverTimestamp()
      };

      if(navigator.onLine){
        await db.collection("visitors").add(payload);
      }else{
        saveToQueue(payload);
      }

      // Telegram
      await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: TELEGRAM_CHAT_ID, text:
`नया आगंतुक:
नाम: ${name}
मोबाइल: ${mobile}
पद: ${designation}
मंडल: ${mandal}
पता: ${address}
कारण: ${reason}
📷 Selfie: ${selfieURL}` })
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
