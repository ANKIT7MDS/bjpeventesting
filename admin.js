// ✅ Firebase config
const firebaseConfig = {
  apiKey: "AIzaSyD-xaGtrczkUCT7rwEOuRnHzVE9AohYsKU",
  authDomain: "bjplivefirebase.firebaseapp.com",
  projectId: "bjplivefirebase"
};
if (!firebase.apps?.length) firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

document.addEventListener("DOMContentLoaded", () => {
  // ================================
  // 🔹 Visitors Table Logic (जैसा पहले था)
  // ================================
  const tb = document.querySelector("#dataTable tbody");
  const emptyState = document.getElementById("emptyState");

  const fromDate = document.getElementById("fromDate");
  const toDate = document.getElementById("toDate");
  const reasonSelect = document.getElementById("reasonSelect");
  const mandalSelect = document.getElementById("mandalSelect");
  const searchInput = document.getElementById("searchInput");
  const exportBtn = document.getElementById("exportBtn");
  const clearBtn = document.getElementById("clearBtn");

  let allRows = [], viewRows = [];

  const REASONS = [
    "कार्यालय पर बैठक", "जिला अध्यक्ष से भेंट",
    "ट्रांसफर / शासकीय कार्य / शिकायत", "कार्यालय पर सामान्य उपस्थिति",
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

  db.collection("visitors")
    .orderBy("timestamp", "desc")
    .limit(1000)
    .onSnapshot((snap) => {
      allRows = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      applyFilter();
    });

  function applyFilter() {
    const q = (searchInput.value || "").toLowerCase().trim();
    const r = reasonSelect.value || "";
    const m = mandalSelect.value || "";
    const from = fromDate.value ? new Date(fromDate.value + "T00:00:00") : null;
    const to = toDate.value ? new Date(toDate.value + "T23:59:59") : null;

    viewRows = allRows.filter(row => {
      const name = (row.name || "").toLowerCase();
      const mobile = (row.mobile || "").toLowerCase();
      const addr = (row.address || "").toLowerCase();
      const mandal = (row.mandal || "");
      const reason = (row.reason || "");
      const ts = row.timestamp?.toDate?.() ? row.timestamp.toDate() : null;

      return (
        (!q || name.includes(q) || mobile.includes(q) || addr.includes(q)) &&
        (!r || reason === r) &&
        (!m || mandal === m) &&
        (!from || (ts && ts >= from)) &&
        (!to || (ts && ts <= to))
      );
    });

    render(viewRows);
  }

  function render(rows) {
    tb.innerHTML = "";
    if (!rows.length) {
      emptyState.style.display = "block";
      return;
    }
    emptyState.style.display = "none";

    rows.forEach(r => {
      const ts = r.timestamp?.toDate?.() ? r.timestamp.toDate() : null;
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${ts ? ts.toLocaleString() : ""}</td>
        <td>${r.name || ""}</td>
        <td>${r.mobile || ""}</td>
        <td>${r.designation || ""}</td>
        <td>${r.mandal || ""}</td>
        <td>${r.reason || ""}</td>
        <td>${r.address || ""}</td>
        <td>${r.selfie ? `<img src="${r.selfie}" class="preview" />` : "—"}</td>
        <td><button class="btn-del" data-id="${r.id}" data-selfie="${r.selfie || ""}">🗑️</button></td>
      `;
      tb.appendChild(tr);
    });

    document.querySelectorAll("img.preview").forEach(img => {
      img.addEventListener("click", () => {
        Swal.fire({ imageUrl: img.src, showConfirmButton: false });
      });
    });
  }

  [fromDate, toDate, reasonSelect, mandalSelect].forEach(el => el.addEventListener("change", applyFilter));
  searchInput.addEventListener("input", applyFilter);
  clearBtn.addEventListener("click", () => {
    fromDate.value = ""; toDate.value = "";
    reasonSelect.value = ""; mandalSelect.value = "";
    searchInput.value = ""; applyFilter();
  });

  exportBtn.addEventListener("click", () => {
    const header = ["समय","नाम","मोबाइल","पद","मंडल","कारण","पता","सेल्फ़ी"];
    let csv = header.join(",") + "\n";
    viewRows.forEach(r => {
      const ts = r.timestamp?.toDate?.() ? r.timestamp.toDate().toLocaleString() : "";
      const row = [ts, r.name, r.mobile, r.designation, r.mandal, r.reason, r.address, r.selfie];
      csv += row.map(v => `"${(v || "").replace(/"/g, '""')}"`).join(",") + "\n";
    });
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "visitors.csv"; a.click();
    URL.revokeObjectURL(url);
  });

  tb.addEventListener("click", async (e) => {
    const btn = e.target.closest(".btn-del");
    if (!btn) return;
    const docId = btn.dataset.id;
    const selfie = btn.dataset.selfie;
    const confirm = await Swal.fire({
      title: "हटाएँ?",
      text: "पक्का हटाना है?",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "हाँ",
    });
    if (!confirm.isConfirmed) return;
    await db.collection("visitors").doc(docId).delete();
    if (selfie && firebase.storage?.refFromURL) {
      try {
        await firebase.storage().refFromURL(selfie).delete();
      } catch {}
    }
    Swal.fire("हटाया गया", "", "success");
  });

  // ================================
  // 🔹 Event Management Section
  // ================================
  const newEventNameInput = document.getElementById("newEventName");
  const addEventBtn = document.getElementById("addEventBtn");
  const eventListEl = document.getElementById("eventList");

  async function loadEvents() {
    const snap = await db.collection("events").orderBy("createdAt", "desc").get();
    eventListEl.innerHTML = "";
    snap.forEach(doc => {
      const d = doc.data();
      const li = document.createElement("li");
      li.innerHTML = `
        <b>${d.name}</b>
        ${d.isActive ? "<span style='color:green'>[Active]</span>" : ""}
        <button data-id="${doc.id}" class="setActiveBtn">Set Active</button>
      `;
      eventListEl.appendChild(li);
    });
  }

  addEventBtn.addEventListener("click", async () => {
    const name = newEventNameInput.value.trim();
    if (!name) return alert("इवेंट नाम दर्ज करें");
    await db.collection("events").add({
      name,
      isActive: false,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    newEventNameInput.value = "";
    loadEvents();
  });

  eventListEl.addEventListener("click", async (e) => {
    const btn = e.target.closest(".setActiveBtn");
    if (!btn) return;
    const id = btn.dataset.id;
    const snap = await db.collection("events").get();
    const batch = db.batch();
    snap.forEach(doc => {
      const ref = doc.ref;
      batch.update(ref, { isActive: (doc.id === id) });
    });
    await batch.commit();
    loadEvents();
  });

  loadEvents(); // first load
});
