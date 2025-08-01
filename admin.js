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

  const addEventBtn = document.getElementById("addEventBtn");
  const eventInput = document.getElementById("eventName");
  const eventList = document.getElementById("eventList");

  let allRows = [];   
  let viewRows = [];  

  const REASONS = [
    "कार्यालय पर बैठक",
    "जिला अध्यक्ष से भेंट",
    "ट्रांसफर / शासकीय कार्य / शिकायत",
    "कार्यालय पर सामान्य उपस्थिति",
    "अन्य कोई कार्य"
  ];
  const MANDALS = [
    "भेंसोदा","भानपुरा","गरोठ","मेलखेडा","खड़ावदा","शामगढ़","सुवासरा","बसाई",
    "सीतामऊ","क्यामपुर","सीतामऊ ग्रामीण","गुर्जर बरडिया","धुंदधड़का","बुढा",
    "पिपलिया मंडी","मल्हारगढ़","दलोदा","मगरामाता जी","मंदसौर ग्रामीण",
    "मंदसौर उत्तर","मंदसौर दक्षिण","अन्य जिले से आये"
  ];

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

  // ✅ Event List Load
  function loadEvents(){
    db.collection("events").get().then(snap=>{
      eventList.innerHTML="";
      snap.forEach(doc=>{
        const d=doc.data();
        const btn=document.createElement("button");
        btn.textContent = d.active ? `✅ ${d.name}` : d.name;
        btn.style.margin="3px";
        btn.addEventListener("click", async ()=>{
          // सभी को inactive
          const all=await db.collection("events").get();
          all.forEach(a=>db.collection("events").doc(a.id).update({active:false}));
          // इसको active
          await db.collection("events").doc(doc.id).update({active:true});
          loadEvents();
          Swal.fire("Active इवेंट सेट", `${d.name} अब सक्रिय है।`,"success");
        });
        eventList.appendChild(btn);
      });
    });
  }
  loadEvents();

  addEventBtn.addEventListener("click", async ()=>{
    const name=eventInput.value.trim();
    if(!name) return alert("इवेंट नाम दर्ज करें");
    await db.collection("events").add({name, active:false});
    eventInput.value="";
    loadEvents();
  });

  // ✅ Realtime visitors
  db.collection("visitors").orderBy("timestamp", "desc").limit(1000)
    .onSnapshot((snap) => {
      allRows = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      applyFilter();
    }, (err) => {
      console.error("Firestore listeners error:", err);
      tb.innerHTML = `<tr><td colspan="9">❌ डेटा लोड करने में समस्या</td></tr>`;
    });

  function applyFilter() {
    const q = (searchInput.value || "").toLowerCase().trim();
    const r = reasonSelect.value || "";
    const m = mandalSelect.value || "";

    const from = fromDate.value ? new Date(fromDate.value + "T00:00:00") : null;
    const
