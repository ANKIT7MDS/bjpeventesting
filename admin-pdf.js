import jsPDF from "https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.es.min.js";


export function exportToPDF(data) {
  const doc = new jsPDF();
  const labels = {
    name: "नाम",
    mobile: "मोबाइल",
    designation: "पद",
    mandal: "मंडल",
    reason: "कारण",
    timestamp: "तारीख"
  };

  let y = 20;
  doc.setFontSize(14).text("आगंतुक विवरण", 20, y);
  y += 10;

  Object.entries(labels).forEach(([key, label]) => {
    const value = data[key] || "—";
    doc.setFontSize(12).text(`${label}: ${value}`, 20, y);
    y += 8;
  });

  if (data.selfieUrl) {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      doc.addImage(img, "JPEG", 20, y, 60, 60);
      doc.save(`${data.mobile}.pdf`);
    };
    img.src = data.selfieUrl;
  } else {
    doc.save(`${data.mobile}.pdf`);
  }
}
