// ===============================
// Admin Panel (Visitors Only)
// - Realtime list from "visitors"
// - Date / Reason / Mandal filters + Search
// - Photo preview
// - CSV export
// - Delete entry (and optional selfie file)
// ===============================

// ✅ Firebase config — visitors-only panel
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

  let allRows = [];   // visitors का पूरा डेटा
  let viewRows = [];  // फ़िल्टर के बाद

  // स्थायी लिस्ट (आपके फॉर्म की तरह)
  const REASONS = [
    "कार्यालय पर बैठक",
    "जिला अध्यक्ष से भेंट",
    "트ांसफर / शासकीय कार्य / शिकायत".replace("트","ट"), // guard in case of copy glitch
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
    .limit(1000) // आवश्यकता अनुसार बदलिए
    .onSnapshot((snap) => {
      allRows = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      applyFilter();
    }, (err) => {
      console.error("Firestore listeners error:", err);
      tb.innerHTML = `<tr><td colspan="9">❌ डेटा लोड करने में समस्या</td></tr>`;
    });

  // 🔍 Filter & Search
  function applyFilter() {
    const q = (searchInput.value || "").toLowerCase().trim();
    const r = reasonSelect.value || "";
    const m = mandalSelect.value || "";

    // Date range
    const from = fromDate.value ? new Date(fromDate.value + "T00:00:00") : null;
    const to   = toDate.value   ? new Date(toDate.value   + "T23:59:59") : null;

    viewRows = allRows.filter(row => {
      // normalize fields
      const name   = (row.name || row["नाम"] || "").toLowerCase();
      const mobile = (row.mobile || row["मोबाइल"] || "").toLowerCase();
      const mandal = (row.mandal || row["मंडल"] || "");
      const reason = (row.reason || row["कारण"] || "");
      const addr   = (row.address || row["पता"] || "").toLowerCase();

      // text search
      const matchesSearch = !q || name.includes(q) || mobile.includes(q) || addr.includes(q);

      // reason filter
      const matchesReason = !r || reason === r;

      // mandal filter
      const matchesMandal = !m || mandal === m;

      // date filter (timestamp is Firestore Timestamp)
      const ts = row.timestamp?.toDate?.() ? row.timestamp.toDate() : null;
      const matchesDate =
        (!from && !to) ||
        (ts && (!from || ts >= from) && (!to || ts <= to));

      return matchesSearch && matchesReason && matchesMandal && matchesDate;
    });

    render(viewRows);
  }

  // UI events
  [fromDate, toDate, reasonSelect, mandalSelect].forEach(el => {
    el.addEventListener("change", applyFilter);
  });
  searchInput.addEventListener("input", applyFilter);
  clearBtn.addEventListener("click", () => {
    fromDate.value = ""; toDate.value = "";
    reasonSelect.value = ""; mandalSelect.value = "";
    searchInput.value = "";
    applyFilter();
  });

  // 🖨️ Render table
  function render(rows) {
    tb.innerHTML = "";
    if (!rows.length) {
      emptyState.style.display = "block";
      return;
    }
    emptyState.style.display = "none";

    rows.forEach(r => {
      const ts = r.timestamp?.toDate?.() ? r.timestamp.toDate() : null;
      const timeText = ts ? ts.toLocaleString() : "";

      const name = r.name || r["नाम"] || "";
      const mobile = r.mobile || r["मोबाइल"] || "";
      const desig = r.designation || r["पद"] || "";
      const mandal = r.mandal || r["मंडल"] || "";
      const reason = r.reason || r["कारण"] || "";
      const address = r.address || r["पता"] || "";
      const selfie = r.selfie || "";

      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${timeText}</td>
        <td>${escapeHtml(name)}</td>
        <td>${mobile}</td>
        <td>${escapeHtml(desig)}</td>
        <td>${escapeHtml(mandal)}</td>
        <td>${escapeHtml(reason)}</td>
        <td>${escapeHtml(address)}</td>
        <td>${selfie ? `<img src="${selfie}" class="preview" alt="selfie">` : "—"}</td>
        <td><button class="btn-del" data-id="${r.id}" data-selfie="${selfie}">🗑️</button></td>
      `;
      tb.appendChild(tr);
    });

    // फोटो प्रीव्यू
    document.querySelectorAll("img.preview").forEach(img => {
      img.addEventListener("click", () => {
        Swal.fire({
          imageUrl: img.src,
          imageAlt: "Selfie",
          showConfirmButton: false,
          showCloseButton: true,
          width: 640
        });
      });
    });
  }

  // 🗑️ Entry Delete (Visitors collection) — event delegation
  tb.addEventListener("click", async (e) => {
    const btn = e.target.closest(".btn-del");
    if (!btn) return;

    const docId = btn.dataset.id;
    const selfieUrl = btn.dataset.selfie || "";
    if (!docId) return;

    const confirm = await Swal.fire({
      title: "क्या आप इस एंट्री को हटाना चाहते हैं?",
      text: "हटाने के बाद डेटा वापस नहीं लाया जा सकता।",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "हाँ, हटाएँ",
      cancelButtonText: "रद्द करें"
    });
    if (!confirm.isConfirmed) return;

    try {
      // 1) Firestore डॉक्यूमेंट हटाएँ
      await db.collection("visitors").doc(docId).delete();

      // 2) (Optional) Storage से selfie फ़ाइल हटाएँ (यदि SDK उपलब्ध व URL हो)
      if (selfieUrl && firebase.storage?.refFromURL) {
        try {
          const storageRef = firebase.storage().refFromURL(selfieUrl);
          await storageRef.delete();
        } catch (e) {
          console.warn("Storage delete warning:", e?.message || e);
        }
      }

      Swal.fire("हटा दिया गया", "एंट्री सफलतापूर्वक हटाई गई।", "success");
      // onSnapshot के कारण UI खुद अपडेट हो जाएगा
    } catch (err) {
      console.error("Delete error:", err);
      Swal.fire("त्रुटि", "एंट्री हटाने में समस्या आई।", "error");
    }
  });

  // 📥 CSV Export (current filtered rows)
  exportBtn.addEventListener("click", () => {
    const header = ["समय","नाम","मोबाइल","पद","मंडल","आने का कारण","पता","सेल्फ़ी URL"];
    let csv = header.join(",") + "\n";

    viewRows.forEach(r => {
      const ts = r.timestamp?.toDate?.() ? r.timestamp.toDate().toLocaleString() : "";
      const row = [
        ts,
        safeCsv(r.name || r["नाम"] || ""),
        (r.mobile || r["मोबाइल"] || ""),
        safeCsv(r.designation || r["पद"] || ""),
        safeCsv(r.mandal || r["मंडल"] || ""),
        safeCsv(r.reason || r["कारण"] || ""),
        safeCsv(r.address || r["पता"] || ""),
        (r.selfie || "")
      ];
      csv += row.join(",") + "\n";
    });

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "visitors.csv"; a.click();
    URL.revokeObjectURL(url);
  });

  // Helpers
  function escapeHtml(s) {
    return (s || "").toString()
      .replace(/&/g,"&amp;").replace(/</g,"&lt;")
      .replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#039;");
  }
  function safeCsv(s) {
    const v = (s || "").toString().replace(/"/g, '""');
    return `"${v}"`;
  }
});
