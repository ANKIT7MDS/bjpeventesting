// ===============================
// Admin Panel (Visitors + Events + Analytics)
// - Visitors list (unchanged base)
// - Event management (dropdown + set active + clear)
// - Filters: date/reason/mandal + VisitorType + EventFilter
// - Analytics: per-person counts, busiest office days, event-wise counts, selected event details
// ===============================

const firebaseConfig = {
  apiKey: "AIzaSyD-xaGtrczkUCT7rwEOuRnHzVE9AohYsKU",
  authDomain: "bjplivefirebase.firebaseapp.com",
  projectId: "bjplivefirebase"
};
if (!firebase.apps?.length) firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

document.addEventListener("DOMContentLoaded", () => {
  const tb = document.querySelector("#dataTable tbody");
  const emptyState = document.getElementById("emptyState");

  const fromDate = document.getElementById("fromDate");
  const toDate   = document.getElementById("toDate");
  const reasonSelect = document.getElementById("reasonSelect");
  const mandalSelect = document.getElementById("mandalSelect");
  const searchInput  = document.getElementById("searchInput");
  const exportBtn    = document.getElementById("exportBtn");
  const clearBtn     = document.getElementById("clearBtn");

  // NEW: Visitor type + event filter
  const visitorType  = document.getElementById("visitorType");   // all | office | event
  const eventFilter  = document.getElementById("eventFilter");   // event name

  // NEW: Event management controls
  const eventNameInput   = document.getElementById("eventNameInput");
  const addEventBtn      = document.getElementById("addEventBtn");
  const eventActiveSelect= document.getElementById("eventActiveSelect");
  const setActiveBtn     = document.getElementById("setActiveBtn");
  const endEventBtn      = document.getElementById("endEventBtn");
  const activeEventLabel = document.getElementById("activeEventLabel");

  let allRows = [];      // visitors का पूरा डेटा
  let viewRows = [];     // फ़िल्टर के बाद
  let EVENTS = [];       // {id,name,active}
  let EVENT_SET = new Set(); // खोज के लिए

  // स्थायी लिस्ट (आपके फॉर्म की तरह)
  const REASONS = [
    "कार्यालय पर बैठक",
    "जिला अध्यक्ष से भेंट",
    "트ांसफर / शासकीय कार्य / शिकायत".replace("트","ट"),
    "कार्यालय पर सामान्य उपस्थिति",
    "अन्य कोई कार्य"
  ];
  const MANDALS = [
    "भेंसोदा","भानपुरा","गरोठ","मेलखेडा","खड़ावदा","शामगढ़","सुवासरा","बसाई",
    "सीतामऊ","क्यामपुर","सीतामऊ ग्रामीण","गुर्जर बरडिया","धुंदधड़का","बुढा",
    "पिपलिया मंडी","मल्हारगढ़","दलोदा","मगरामाता जी","मंदसौर ग्रामीण",
    "मंदसौर उत्तर","मंदसौर दक्षिण","अन्य जिले से आये"
  ];

  // Dropdowns भरें (once)
  REASONS.forEach(r => {
    const op = document.createElement("option");
    op.value = r; op.textContent = r;
    reasonSelect.appendChild(op);
  });
  MANDALS.forEach(m => {
    const op = document.createElement("option");
    op.value = m; op.textContent = m;
    mandalSelect.appendChild(op);
  });

  // 🔁 Realtime: visitors (latest first)
  db.collection("visitors")
    .orderBy("timestamp", "desc")
    .limit(2000)
    .onSnapshot((snap) => {
      allRows = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      applyFilter();
    }, (err) => {
      console.error("Firestore listeners error:", err);
      tb.innerHTML = `<tr><td colspan="9">❌ डेटा लोड करने में समस्या</td></tr>`;
    });

  // 🔁 Realtime: events (for management + filters)
  db.collection("events").orderBy("name").onSnapshot((snap) => {
    EVENTS = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    EVENT_SET = new Set(EVENTS.map(e => (e.name || "").toString().trim()));
    fillEventDropdowns();
    updateActiveEventLabel();
    applyFilter(); // क्योंकि event-set बदल सकता है
  });

  function fillEventDropdowns(){
    // Active-set dropdown (management)
    if (eventActiveSelect) {
      eventActiveSelect.innerHTML = "";
      EVENTS.forEach(ev => {
        const op = document.cr
