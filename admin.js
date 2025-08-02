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
        const op = document.createElement("option");
        op.value = ev.id; op.textContent = ev.name;
        if (ev.active) op.selected = true;
        eventActiveSelect.appendChild(op);
      });
    }
    // Filter dropdown (viewer)
    if (eventFilter) {
      const selVal = eventFilter.value;
      eventFilter.innerHTML = `<option value="">— सभी इवेंट —</option>`;
      EVENTS.forEach(ev => {
        const op = document.createElement("option");
        op.value = ev.name; op.textContent = ev.name + (ev.active ? " (Active)" : "");
        eventFilter.appendChild(op);
      });
      // restore selection if possible
      if (selVal && Array.from(eventFilter.options).some(o => o.value === selVal)) {
        eventFilter.value = selVal;
      }
    }
  }

  function updateActiveEventLabel(){
    const act = EVENTS.find(e => e.active);
    activeEventLabel.textContent = act ? act.name : "—";
    if (act && eventActiveSelect) eventActiveSelect.value = act.id;
  }

  // Event management actions
  if (addEventBtn) {
    addEventBtn.addEventListener("click", async () => {
      const name = (eventNameInput.value || "").trim();
      if (!name) return alert("इवेंट का नाम लिखें");
      await db.collection("events").add({ name, active: false });
      eventNameInput.value = "";
      Swal.fire("जोड़ा गया", "इवेंट सूची में जोड़ दिया गया है।", "success");
    });
  }
  if (setActiveBtn) {
    setActiveBtn.addEventListener("click", async () => {
      const id = eventActiveSelect.value;
      if (!id) return;
      const all = await db.collection("events").get();
      const batch = db.batch();
      all.docs.forEach(doc => {
        batch.update(doc.ref, { active: doc.id === id });
      });
      await batch.commit();
      Swal.fire("सफल", "यह इवेंट अब Active है।", "success");
    });
  }
  if (endEventBtn) {
    endEventBtn.addEventListener("click", async () => {
      const ok = await Swal.fire({
        title: "इवेंट समाप्त करें?",
        text: "Active इवेंट हट जाएगा और फॉर्म default कारण दिखाएगा।",
        icon: "question",
        showCancelButton: true,
        confirmButtonText: "हाँ, समाप्त करें"
      });
      if (!ok.isConfirmed) return;
      const snap = await db.collection("events").where("active", "==", true).get();
      const batch = db.batch();
      snap.docs.forEach(doc => batch.update(doc.ref, { active: false }));
      await batch.commit();
      Swal.fire("हो गया", "अब कोई इवेंट Active नहीं है।", "success");
    });
  }

  // 🔍 Filter & Search
  function applyFilter() {
    const q = (searchInput.value || "").toLowerCase().trim();
    const r = reasonSelect.value || "";
    const m = mandalSelect.value || "";
    const vt = (visitorType.value || "all");   // all | office | event
    const evName = (eventFilter.value || "");  // event name or ""

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

      const matchesSearch = !q || name.includes(q) || mobile.includes(q) || addr.includes(q);
      const matchesReason = !r || reason === r;
      const matchesMandal = !m || mandal === m;

      // Office vs Event tagging
      const isEvent = EVENT_SET.has(reason);
      const isOffice = !isEvent; // (डिफॉल्ट/ऑफिस कारण)

      // VisitorType filter
      const matchesType =
        (vt === "all") ||
        (vt === "office" && isOffice) ||
        (vt === "event" && isEvent);

      // Specific event filter (only when vt=event)
      const matchesEventName =
        (vt !== "event") || (!evName) || (reason === evName);

      // Date
      const ts = row.timestamp?.toDate?.() ? row.timestamp.toDate() : null;
      const matchesDate =
        (!from && !to) ||
        (ts && (!from || ts >= from) && (!to || ts <= to));

      return matchesSearch && matchesReason && matchesMandal && matchesType && matchesEventName && matchesDate;
    });

    render(viewRows);
    renderAnalytics(viewRows); // analytics भी current filters पर
  }

  // UI events
  [fromDate, toDate, reasonSelect, mandalSelect, visitorType, eventFilter].forEach(el => {
    el.addEventListener("change", applyFilter);
  });
  searchInput.addEventListener("input", applyFilter);
  clearBtn.addEventListener("click", () => {
    fromDate.value = ""; toDate.value = "";
    reasonSelect.value = ""; mandalSelect.value = "";
    searchInput.value = "";
    visitorType.value = "all";
    eventFilter.value = "";
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
      await db.collection("visitors").doc(docId).delete();

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

  /* ============================
     ✅ Analytics (current filters applied)
     ============================*/
  function renderAnalytics(rows) {
    // Build fast lookup for event names
    const evSet = EVENT_SET;

    // Person-wise stats (key by mobile; fallback by name)
    const person = new Map(); // key => {name,mobile,officeCount,eventCount,events:{[name]:count}}
    const busyDays = new Map(); // yyyy-mm-dd => office count
    const eventCounts = new Map(); // eventName => count

    function keyFor(r){
      const mobile = (r.mobile || r["मोबाइल"] || "").toString().trim();
      const name = (r.name || r["नाम"] || "").toString().trim();
      return mobile || name || r.id;
    }
    function dateOnly(ts){
      const d = ts?.toDate?.() ? ts.toDate() : null;
      if (!d) return "";
      const y = d.getFullYear(), m = String(d.getMonth()+1).padStart(2,"0"), day = String(d.getDate()).padStart(2,"0");
      return `${y}-${m}-${day}`;
    }

    rows.forEach(r => {
      const reason = (r.reason || r["कारण"] || "").toString().trim();
      const isEvent = evSet.has(reason);
      const isOffice = !isEvent;

      const k = keyFor(r);
      if (!person.has(k)) person.set(k, {
        name: (r.name || r["नाम"] || "—"),
        mobile: (r.mobile || r["मोबाइल"] || "—"),
        officeCount: 0, eventCount: 0, events: {}
      });
      const p = person.get(k);
      if (isEvent) {
        p.eventCount++;
        p.events[reason] = (p.events[reason] || 0) + 1;
        eventCounts.set(reason, (eventCounts.get(reason) || 0) + 1);
      } else {
        p.officeCount++;
        const d = dateOnly(r.timestamp);
        if (d) busyDays.set(d, (busyDays.get(d) || 0) + 1);
      }
    });

    // Top visitors (by officeCount desc, then eventCount)
    const top = Array.from(person.values()).sort((a,b) =>
      (b.officeCount - a.officeCount) || (b.eventCount - a.eventCount)
    );

    // Busy office days
    const busy = Array.from(busyDays.entries()).sort((a,b) => b[1]-a[1]); // [date, count]

    // Event summary
    const evSumm = Array.from(eventCounts.entries()).sort((a,b) => b[1]-a[1]); // [event, count]

    // Selected event details
    const selEventName = eventFilter.value || "";
    const selectedEventRows = selEventName
      ? rows.filter(r => (r.reason || r["कारण"] || "") === selEventName)
      : [];

    // Render helpers
    function htmlTable(headers, rows){
      let h = `<table style="width:100%; border-collapse:collapse;"><thead><tr>`;
      headers.forEach(th => h += `<th style="border-bottom:1px solid #eee; padding:6px; text-align:left; font-size:13px;">${th}</th>`);
      h += `</tr></thead><tbody>`;
      rows.forEach(r => {
        h += `<tr>`;
        r.forEach(td => h += `<td style="border-bottom:1px solid #f3f3f3; padding:6px; font-size:13px;">${td}</td>`);
        h += `</tr>`;
      });
      h += `</tbody></table>`;
      return h;
    }

    // 1) Person-wise
    const personRows = top.slice(0, 200).map(p => {
      const evList = Object.entries(p.events).map(([n,c]) => `${n} (${c})`).join(", ") || "—";
      return [escapeHtml(p.name), p.mobile, p.officeCount, p.eventCount, escapeHtml(evList)];
    });
    document.getElementById("analyticsTopVisitors").innerHTML =
      htmlTable(["नाम","मोबाइल","Office Visits","Event Visits","Events (count)"], personRows);

    // 2) Busy office days
    const busyRows = busy.slice(0, 60).map(([d,c]) => [d, c]);
    document.getElementById("analyticsBusyOfficeDays").innerHTML =
      htmlTable(["तारीख","Office Count"], busyRows);

    // 3) Event summary
    const evRows = evSumm.map(([n,c]) => [escapeHtml(n), c]);
    document.getElementById("analyticsEventSummary").innerHTML =
      htmlTable(["Event","Count"], evRows);

    // 4) Selected event details
    const selRows = selectedEventRows.slice(0, 500).map(r => {
      const ts = r.timestamp?.toDate?.() ? r.timestamp.toDate().toLocaleString() : "";
      return [escapeHtml(r.name || r["नाम"] || ""), (r.mobile || r["मोबाइल"] || ""), ts, escapeHtml(r.address || r["पता"] || "")];
    });
    document.getElementById("analyticsSelectedEvent").innerHTML =
      selEventName
        ? htmlTable([`Event: ${escapeHtml(selEventName)} — नाम`, "मोबाइल", "समय", "पता"], selRows)
        : `<div class="empty">कोई इवेंट चयनित नहीं।</div>`;
  }
});
