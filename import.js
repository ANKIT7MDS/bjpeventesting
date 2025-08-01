// ===============================
// Visitors Importer (CSV → Firestore)
// Passcode guard + Preview + Validations
// ===============================

// 🔐 Simple passcode guard (optional)
const PASSCODE = "BJP-Admin-2025";
if (!sessionStorage.getItem("import_ok")) {
  const p = prompt("Admin Passcode?");
  if (p !== PASSCODE) {
    alert("Unauthorized");
    location.href = "/"; // अपनी साइट का होम
  } else {
    sessionStorage.setItem("import_ok", "1");
  }
}

// 🔧 Firebase config (आपके प्रोजेक्ट का)
const firebaseConfig = {
  apiKey: "AIzaSyD-xaGtrczkUCT7rwEOuRnHzVE9AohYsKU",
  authDomain: "bjplivefirebase.firebaseapp.com",
  projectId: "bjplivefirebase"
};
if (!firebase.apps?.length) firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

/* ---------- Constants & Helpers ---------- */
const MANDALS = [
  "भेंसोदा","भानपुरा","गरोठ","मेलखेडा","खड़ावदा","शामगढ़","सुवासरा","बसाई",
  "सीतामऊ","क्यामपुर","सीतामऊ ग्रामीण","गुर्जर बरडिया","धुंदधड़का","बुढा",
  "पिपलिया मंडी","मल्हारगढ़","दलोदा","मगरामाता जी","मंदसौर ग्रामीण",
  "मंदसौर उत्तर","मंदसौर दक्षिण","अन्य जिले से आये"
];
const REASONS = [
  "कार्यालय पर बैठक",
  "जिला अध्यक्ष से भेंट",
  "ट्रांसफर / शासकीय कार्य / शिकायत",
  "कार्यालय पर सामान्य उपस्थिति",
  "अन्य कोई कार्य"
];

function normalizeMobile(input){
  let d = (input || "").toString().replace(/\D/g,"");
  if (d.length > 10) d = d.slice(-10);
  return d;
}
function parseTS(v){
  if (!v) return null;
  const s = (v+"").trim();
  const iso = Date.parse(s);
  if (!Number.isNaN(iso)) return new Date(iso);
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(.*)$/);
  if (m){
    const d = new Date(+m[3], +m[2]-1, +m[1]);
    if (!Number.isNaN(d.getTime())) return d;
  }
  return null;
}
// Google Drive file URL → direct image url (uc?export=view&id=..)
function toDirectDriveUrl(url){
  if (!url) return "";
  try {
    const u = new URL(url);
    // patterns: /file/d/<ID>/view, open?id=<ID>, u/0/folders/...
    let id = "";
    const parts = u.pathname.split("/");
    const idx = parts.indexOf("d");
    if (u.hostname.includes("drive.google.com")){
      if (u.searchParams.get("id")) {
        id = u.searchParams.get("id");
      } else if (idx>=0 && parts[idx+1]) {
        id = parts[idx+1];
      }
      if (id) return `https://drive.google.com/uc?export=view&id=${id}`;
    }
  } catch {}
  return url;
}
function escapeHtml(s){
  return (s||"").toString()
    .replace(/&/g,"&amp;").replace(/</g,"&lt;")
    .replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#039;");
}
function norm(s){ return (s||"").toString().normalize("NFC").replace(/\s+/g,""); }

/* ---------- DOM ---------- */
const fileEl = document.getElementById("file");
const parseBtn = document.getElementById("parseBtn");
const importBtn = document.getElementById("importBtn");
const skipDup = document.getElementById("skipDup");
const useNowTS = document.getElementById("useNowTS");
const fixDrive = document.getElementById("fixDrive");
const prog = document.getElementById("prog");
const statusEl = document.getElementById("status");
const reportEl = document.getElementById("report");
const prevTbl = document.getElementById("preview");
const phead = document.getElementById("phead");
const pbody = document.getElementById("pbody");

let parsedRows = [];
let rawHeaders = [];

function getVal(row, keys){
  for (const k of keys){
    if (row[k] != null && row[k] !== "") return row[k];
  }
  return "";
}
// Map row: (Hindi/English headers दोनों सपोर्ट)
function mapRow(row){
  const name  = getVal(row, ["नाम","name","Name"]);
  const mobileRaw = getVal(row, ["मोबाइल","मोबाइल नंबर","mobile","Mobile","Phone"]);
  const designation = getVal(row, ["पद","designation","Designation"]);
  const address = getVal(row, ["पता","बूथ / वार्ड / पता","address","Address"]);
  const mandal = getVal(row, ["मंडल","mandal","Mandal"]);
  const reason = getVal(row, ["कारण","purpose","reason","Reason"]);
  const selfie = getVal(row, ["Selfie URL","selfie_url","selfie","Selfie","photo","Photo","image","Image"]);
  const tsVal  = getVal(row, ["timestamp","Timestamp","date","Date","दिनांक","तारीख"]);
  return { name, mobileRaw, designation, address, mandal, reason, selfie, tsVal };
}
function validateRow(m){
  const errors = [];
  const mobile = normalizeMobile(m.mobileRaw);
  if (!m.name) errors.push("नाम खाली");
  if (!mobile || mobile.length !== 10) errors.push("मोबाइल 10 अंकों में नहीं");
  if (m.mandal){
    const ok = MANDALS.some(x => norm(x) === norm(m.mandal));
    if (!ok) errors.push("मंडल सूची से मेल नहीं");
  }
  if (m.reason){
    const ok = REASONS.includes(m.reason);
    if (!ok) errors.push("कारण सूची से मेल नहीं");
  }
  return errors;
}

/* ---------- Preview ---------- */
parseBtn.addEventListener("click", () => {
  const f = fileEl.files?.[0];
  if (!f) return Swal.fire("फ़ाइल चुनें", "कृपया CSV चुनें।", "warning");

  Papa.parse(f, {
    header: true,
    skipEmptyLines: true,
    complete: (res) => {
      const rows = res.data;
      rawHeaders = res.meta.fields || [];
      buildPreview(rows);
    },
    error: (err) => {
      console.error(err);
      Swal.fire("Error", "CSV पढ़ने में समस्या।", "error");
    }
  });
});

function buildPreview(rows){
  parsedRows = [];
  phead.innerHTML = ""; pbody.innerHTML = ""; prevTbl.style.display = "table";

  ["status","name","mobile","designation","address","mandal","reason","timestamp","selfie_url"].forEach(h => {
    const th = document.createElement("th");
    th.textContent = h.toUpperCase();
    phead.appendChild(th);
  });

  let okCnt=0, warnCnt=0, errCnt=0;

  rows.forEach((row) => {
    const m = mapRow(row);
    const mobile = normalizeMobile(m.mobileRaw);
    const errs = validateRow(m);
    const ts = useNowTS.checked ? new Date() : parseTS(m.tsVal);

    let selfieUrl = (m.selfie || "").toString().trim();
    if (fixDrive.checked) selfieUrl = toDirectDriveUrl(selfieUrl);

    let cls="ok", msg="OK";
    if (errs.length){
      if (errs.some(e => /मोबाइल/.test(e) || /नाम/.test(e))) { cls="err"; msg=errs.join(", "); errCnt++; }
      else { cls="warn"; msg=errs.join(", "); warnCnt++; }
    } else okCnt++;

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td class="${cls}">${escapeHtml(msg)}</td>
      <td>${escapeHtml(m.name)}</td>
      <td>${escapeHtml(mobile)}</td>
      <td>${escapeHtml(m.designation)}</td>
      <td>${escapeHtml(m.address)}</td>
      <td>${escapeHtml(m.mandal)}</td>
      <td>${escapeHtml(m.reason)}</td>
      <td>${ts? ts.toLocaleString() : ""}</td>
      <td>${escapeHtml(selfieUrl)}</td>
    `;
    pbody.appendChild(tr);

    if (m.name && mobile.length===10){
      parsedRows.push({
        name: (m.name||"").toString().trim(),
        mobile,
        designation: (m.designation||"").toString().trim(),
        address: (m.address||"").toString().trim(),
        mandal: (m.mandal||"").toString().trim(),
        reason: (m.reason||"").toString().trim(),
        selfie: selfieUrl,
        timestampRaw: ts
      });
    }
  });

  reportEl.innerHTML = `Total: <b>${rows.length}</b> | <span class="ok">OK: ${okCnt}</span> | <span class="warn">Warn: ${warnCnt}</span> | <span class="err">Error: ${errCnt}</span>`;
  importBtn.disabled = parsedRows.length === 0;
}

/* ---------- Import ---------- */
importBtn.addEventListener("click", async () => {
  if (!parsedRows.length) return Swal.fire("Nothing to import", "Valid rows not found.", "warning");

  const { isConfirmed } = await Swal.fire({
    title: "इम्पोर्ट शुरू करें?",
    text: `मान्य पंक्तियाँ: ${parsedRows.length}. यह डेटा visitors कलेक्शन में जोड़ा जाएगा।`,
    icon: "question",
    showCancelButton: true,
    confirmButtonText: "हाँ, Import"
  });
  if (!isConfirmed) return;

  prog.style.display = "inline-block";
  prog.value = 0; prog.max = parsedRows.length;
  statusEl.textContent = "इम्पोर्ट हो रहा है…";

  let done=0, skipped=0, failed=0;

  for (let i=0; i<parsedRows.length; i++){
    const r = parsedRows[i];
    try {
      // डुप्लीकेट मोबाइल स्किप (optional)
      if (skipDup.checked){
        const dup = await db.collection("visitors").where("mobile","==", r.mobile).limit(1).get();
        if (!dup.empty){
          skipped++; prog.value = ++done; continue;
        }
      }

      const payload = {
        name: r.name,
        mobile: r.mobile,
        designation: r.designation,
        address: r.address,
        mandal: r.mandal,
        reason: r.reason,
        selfie: r.selfie || ""
      };
      if (r.timestampRaw) payload.timestamp = firebase.firestore.Timestamp.fromDate(r.timestampRaw);
      else payload.timestamp = firebase.firestore.FieldValue.serverTimestamp();

      await db.collection("visitors").add(payload);

      // थ्रॉटल (बड़े इम्पोर्ट में मदद)
      if (i>0 && i%50===0) await new Promise(res=>setTimeout(res, 400));
    } catch (e){
      console.error("Row import failed:", r, e);
      failed++;
    } finally {
      prog.value = ++done;
    }
  }

  statusEl.textContent = `✔️ Complete. Imported: ${done - skipped - failed}, Skipped: ${skipped}, Failed: ${failed}`;
  Swal.fire("इम्पोर्ट पूरा", statusEl.textContent, "success");
});
