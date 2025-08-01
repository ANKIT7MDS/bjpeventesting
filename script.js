// ✅ UPDATED FILE: script.js
// पुराने को untouched रखते हुए सिर्फ नए फीचर्स जोड़े गए हैं

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

// 👉 Active Event हेडिंग और Reason auto-fill
async function applyActiveEvent() {
  const snap = await db.collection("events").where("active", "==", true).limit(1).get();
  if (!snap.empty) {
    const event = snap.docs[0].data();
    document.querySelector("h2").textContent = `${event.name} पंजीयन`;
    const reasonSelect = document.getElementById("reason");
    reasonSelect.innerHTML = `<option value=\"${event.name}\">${event.name}</option>`;
  }
}

// 👉 Offline Queue Mode
function saveToOfflineQueue(data) {
  let queue = JSON.parse(localStorage.getItem("offlineQueue") || "[]");
  queue.push(data);
  localStorage.setItem("offlineQueue", JSON.stringify(queue));
  alert("नेटवर्क नहीं है, डेटा सुरक्षित रखा गया है।");
}
async function syncOfflineQueue() {
  const queue = JSON.parse(localStorage.getItem("offlineQueue") || "[]");
  if (!queue.length) return;

  for (let entry of queue) {
    try {
      const imgBlob = await (await fetch(entry.selfieData)).blob();
      const filePath = `selfies/${Date.now()}_${entry.mobile}.jpg`;
      const up = await storage.ref(filePath).put(imgBlob);
      const selfieURL = await up.ref.getDownloadURL();
      entry.selfie = selfieURL;
      delete entry.selfieData;
      await db.collection("visitors").add({
        ...entry,
        timestamp: firebase.firestore.FieldValue.serverTimestamp()
      });
    } catch (e) {
      console.warn("❌ Sync failed for:", entry);
    }
  }
  localStorage.removeItem("offlineQueue");
  console.log("✅ Offline queue synced.");
}

// DOM Ready
window.addEventListener("DOMContentLoaded", () => {
  applyActiveEvent();
  syncOfflineQueue();

  // पुराना कोड जस का तस रहने दिया गया है (सबमिशन हैंडलर में सिर्फ try/catch के अंदर check जोड़ा गया)

  const form = document.getElementById("visitor-form");
  const canvas = document.getElementById("snapshot");

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const name = form.name.value.trim();
    const mobile = form.mobile.value.trim();
    const designation = form.designation.value.trim();
    const address = form.address.value.trim();
    const mandal = form.mandal.value.trim();
    const reason = form.reason.value;
    const selfieData = form.selfieData.value;

    if (!name || !mobile || !designation || !address || !mandal || !reason || !selfieData) {
      return alert("सभी फ़ील्ड/सेल्फ़ी भरना ज़रूरी है।");
    }

    const payload = { name, mobile, designation, address, mandal, reason, selfieData };

    if (!navigator.onLine) {
      saveToOfflineQueue(payload);
      form.reset();
      canvas.style.display = "none";
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

      Swal.fire("धन्यवाद!", "आपकी जानकारी सफल रूप से सहेज ली गई है।", "success");
      form.reset();
      canvas.style.display = "none";
    } catch (err) {
      alert("कुछ गलत हुआ। कृपया पुनः प्रयास करें।");
    }
  });
});
