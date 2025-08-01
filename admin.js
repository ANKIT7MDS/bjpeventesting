// ✅ UPDATED FILE: admin.js
// Visitors listing पहले जैसा रखा गया + Events Management नया जोड़ा गया

const firebaseConfig = {
  apiKey: "AIzaSyD-xaGtrczkUCT7rwEOuRnHzVE9AohYsKU",
  authDomain: "bjplivefirebase.firebaseapp.com",
  projectId: "bjplivefirebase"
};
if (!firebase.apps?.length) firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

document.addEventListener("DOMContentLoaded", () => {
  // ✅ Visitors पुराना कोड जस का तस (untouched)
  // ... [मौजूदा visitors listing कोड वही रहेगा] ...

  // ✅ Event Management नया
  const eventNameInput = document.getElementById("eventNameInput");
  const addEventBtn = document.getElementById("addEventBtn");
  const eventList = document.getElementById("eventList");

  function renderEvents(events) {
    eventList.innerHTML = "";
    events.forEach(ev => {
      const div = document.createElement("div");
      div.textContent = ev.name + (ev.active ? " ✅(Active)" : "");
      const setBtn = document.createElement("button");
      setBtn.textContent = "Set Active";
      setBtn.style.marginLeft = "10px";
      setBtn.addEventListener("click", () => setActive(ev.id));
      div.appendChild(setBtn);
      eventList.appendChild(div);
    });
  }

  async function loadEvents() {
    const snap = await db.collection("events").get();
    const events = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderEvents(events);
  }

  addEventBtn.addEventListener("click", async () => {
    const name = eventNameInput.value.trim();
    if (!name) return alert("इवेंट नाम लिखें");
    await db.collection("events").add({ name, active: false });
    eventNameInput.value = "";
    loadEvents();
  });

  async function setActive(id) {
    const all = await db.collection("events").get();
    const batch = db.batch();
    all.docs.forEach(doc => {
      batch.update(doc.ref, { active: doc.id === id });
    });
    await batch.commit();
    loadEvents();
    Swal.fire("सफल", "यह इवेंट अब Active है", "success");
  }

  loadEvents();
});
