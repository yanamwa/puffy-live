
const asNumber = (value) =>
  value == null ||
  value === "" ||
  !Number.isFinite(Number(value))
    ? null
    : Number(value);

const percent = (value) => {
  const n = asNumber(value);
  return n == null
    ? "N/A"
    : `${n.toFixed(1).replace(/\.0$/, "")}%`;
};

const text = (value) =>
  value == null ? "" : String(value);

export async function downloadReportsPdf({
  data,
  view,
  metrics,
  range,
  studentRows,
  reportOwner = "Admin",
}) {
  if (!data) {
    throw new Error("No report data is available.");
  }

  const [{ jsPDF }, { default: autoTable }] =
    await Promise.all([
      import("jspdf"),
      import("jspdf-autotable"),
    ]);

  const doc = new jsPDF({
    orientation: "landscape",
    unit: "mm",
    format: "a4",
  });

  const width = doc.internal.pageSize.getWidth();
  const height = doc.internal.pageSize.getHeight();
  const margin = 14;
  const bottom = 16;

  let y = 37;

  // PDF header
  doc.setFillColor(239, 246, 255);
  doc.rect(0, 0, width, 29, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(28, 58, 102);
  doc.text("PUFFYBRAIN", margin, 15);

  doc.setFontSize(10);
  doc.text(`${reportOwner.toUpperCase()} REPORTS DASHBOARD`, margin, 22);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(80, 89, 105);

  doc.text(
    `Report period: ${range.start} to ${range.end}`,
    width - margin,
    15,
    { align: "right" }
  );

  const generated = data.generatedAt
    ? new Date(data.generatedAt)
    : new Date();

  const generatedLabel = Number.isNaN(generated.getTime())
    ? text(data.generatedAt)
    : generated.toLocaleString();

  doc.text(
    `Generated: ${generatedLabel}`,
    width - margin,
    22,
    { align: "right" }
  );

  const ensureSpace = (required) => {
    if (y + required > height - bottom) {
      doc.addPage();
      y = 18;
    }
  };

  const section = (title, headers, rows) => {
    ensureSpace(21);

    doc.setTextColor(28, 58, 102);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text(title, margin, y);

    y += 4;

    const body = rows.length
      ? rows
      : [
          headers.map((_, i) =>
            i === 0 ? "No records found" : ""
          ),
        ];

    autoTable(doc, {
      startY: y,
      head: [headers],
      body,
      theme: "grid",
      margin: {
        left: margin,
        right: margin,
        top: 16,
        bottom,
      },
      styles: {
        font: "helvetica",
        fontSize: 8,
        cellPadding: 2.7,
        overflow: "linebreak",
        valign: "middle",
      },
      headStyles: {
        fillColor: [35, 90, 155],
        textColor: 255,
        fontStyle: "bold",
      },
      alternateRowStyles: {
        fillColor: [247, 250, 253],
      },
      showHead: "everyPage",
      rowPageBreak: "avoid",
    });

    y = doc.lastAutoTable.finalY + 11;
  };

  section(
    "Overview",
    ["Metric", "Value", "Scope"],
    metrics.map((m) => [
      text(m.label),
      text(m.value),
      text(m.detail),
    ])
  );

  section(
    "Course Reports",
    [
      "Course",
      "Professor",
      "Students",
      "Modules",
      "Quiz Attempts",
      "Average Score",
      "Module Completion",
    ],
    view.courseRows.map((c) => [
      text(c.name),
      text(c.professor),
      text(c.students),
      text(c.modules),
      text(c.attempts),
      percent(c.average),
      percent(c.completion),
    ])
  );

  section(
    "Student Performance",
    [
      "Student",
      "Course",
      "Graded Attempts",
      "Average Score",
      "Modules Completed",
      "Assessment Status",
    ],
    studentRows.map((s) => [
      text(s.name),
      text(s.course),
      text(s.attempts),
      percent(s.avg),
      `${s.completed}/${s.total}`,
      s.avg == null
        ? "Not assessed"
        : view.passing == null
          ? "Threshold not configured"
          : s.intervention
            ? "Needs attention"
            : "Assessed",
    ])
  );

  section(
    "Professor Activity",
    [
      "Professor",
      "Courses Handled",
      "Modules",
      "Unique Students",
      "Quiz Attempts",
    ],
    view.professors.map((p) => [
      text(p.name),
      text(p.courses),
      text(p.modules),
      text(p.students),
      text(p.quizAttempts),
    ])
  );

  section(
    "Quiz Participation",
    ["Metric", "Value"],
    [
      ["All Attempts", text(view.totalAttempts)],
      ["Scored Attempts", text(view.scored)],
      ["Average Quiz Score", percent(view.average)],
      ["Passing Threshold", percent(view.passing)],
      ["Pass Rate", percent(view.passRate)],
    ]
  );

  section(
    "Quiz Mode Activity",
    ["Quiz Mode", "Attempts"],
    view.modeRows.map((m) => [
      text(m.label),
      text(m.value),
    ])
  );

  section(
    "Attempts by Date",
    ["Date", "Attempts"],
    view.participation.map((p) => [
      text(p.label),
      text(p.value),
    ])
  );

  section(
    "Students Needing Attention",
    [
      "Student",
      "Course",
      "Average Score",
      "Graded Attempts",
    ],
    view.intervention.map((s) => [
      text(s.name),
      text(s.course),
      percent(s.avg),
      text(s.attempts),
    ])
  );

  // Page numbers and footer
  const pages = doc.internal.getNumberOfPages();

  for (let page = 1; page <= pages; page++) {
    doc.setPage(page);

    doc.setDrawColor(220, 226, 235);
    doc.line(
      margin,
      height - 12,
      width - margin,
      height - 12
    );

    doc.setFontSize(8);
    doc.setTextColor(100, 110, 124);

    doc.text(
      "PuffyBrain | Administrative report | Reporting threshold is advisory, not a final grade.",
      margin,
      height - 7
    );

    doc.text(
      `Page ${page} of ${pages}`,
      width - margin,
      height - 7,
      { align: "right" }
    );
  }

  const safeDate =
    /^\d{4}-\d{2}-\d{2}$/.test(range.start)
      ? range.start
      : "report";

  doc.save(`PuffyBrain-${reportOwner.replaceAll(" ", "-")}-Report-${safeDate}.pdf`);
}
