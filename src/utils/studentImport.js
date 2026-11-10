const COLUMNS = {
  name: ["name", "fullname", "studentname", "learnername"],
  email: [
    "email",
    "emailaddress",
    "studentemail",
    "schoolmail",
    "schoolemail",
    "institutionalemail",
  ],
  studentId: [
    "studentid",
    "studentnumber",
    "studentno",
    "id",
    "idnumber",
    "schoolid",
    "learnerid",
    "registrationnumber",
  ],
  gender: ["gender", "sex"],
  course: ["course", "program", "courseprogram", "degreeprogram"],
  yearLevel: ["year", "yearlevel", "studentyear", "grade", "gradelevel"],
  sectionName: ["section", "sectionname", "studentsection", "block"],
  firstName: ["firstname", "givenname", "givennames", "forename"],
  lastName: ["lastname", "surname", "familyname"],
};

const POSITIONAL_COLUMNS = {
  name: 0,
  email: 1,
  studentId: 2,
  gender: 3,
  yearLevel: 4,
  sectionName: 5,
};

const GENDER_NAMES = new Map([
  ["m", "Male"],
  ["male", "Male"],
  ["f", "Female"],
  ["female", "Female"],
]);

const YEAR_LEVELS = ["1st Year", "2nd Year", "3rd Year", "4th Year"];

const SECTION_PATTERN = /^(?:[A-Z][A-Z0-9]*\s*-\s*)?([1-4][A-F])$/i;

function parseCsvRows(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    const nextCharacter = text[index + 1];

    if (character === '"') {
      if (inQuotes && nextCharacter === '"') {
        cell += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (character === "," && !inQuotes) {
      row.push(cell);
      cell = "";
    } else if ((character === "\n" || character === "\r") && !inQuotes) {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
      if (character === "\r" && nextCharacter === "\n") {
        index += 1;
      }
    } else {
      cell += character;
    }
  }

  if (inQuotes) {
    throw new Error("CSV contains an unclosed quotation mark.");
  }

  row.push(cell);
  rows.push(row);
  return rows;
}

function getColumnIndices(row) {
  const headers = row.map((cell) =>
    cell.toLowerCase().replace(/[^a-z0-9]/g, ""),
  );
  return Object.fromEntries(
    Object.entries(COLUMNS).map(([field, aliases]) => [
      field,
      headers.findIndex((header) => aliases.includes(header)),
    ]),
  );
}

function generateStudentEmail(firstName, lastName) {
  const emailPart = (name) =>
    name
      .toLowerCase()
      .normalize("NFC")
      .replace(/\p{Pd}/gu, "-")
      .replace(/[‘’]/g, "'")
      .replace(/[^\p{L}\p{M}\p{N}!#$%&'*+./=?^_\x60{|}~-]/gu, "")
      .replace(/\.{2,}/g, ".")
      .replace(/^\.|\.$/g, "");
  const givenNames = emailPart(firstName);
  const surname = emailPart(lastName);
  return /[\p{L}\p{N}]/u.test(givenNames) && /[\p{L}\p{N}]/u.test(surname)
    ? givenNames + "." + surname + "@cvsu.edu.ph"
    : "";
}

export function getStudentImportLayout(rows, rowIndex, hasHeaders) {
  const columns = hasHeaders ? getColumnIndices(rows[rowIndex].cells) : {};
  const classLabel = rows
    .slice(0, rowIndex)
    .flatMap(({ cells }) => cells)
    .map((cell) => SECTION_PATTERN.exec(cell))
    .find(Boolean);

  return {
    rowIndex,
    hasHeaders,
    columns,
    defaultSection: classLabel?.[1].toUpperCase() ?? "",
  };
}

export function canImportStudentLayout({ columns, defaultSection }) {
  const hasColumn = (field) => columns[field] >= 0;
  const hasSplitName = hasColumn("firstName") && hasColumn("lastName");
  const selected = Object.values(columns).filter((index) => index >= 0);

  return (
    (hasColumn("name") || hasSplitName) &&
    (hasColumn("email") || hasSplitName) &&
    hasColumn("studentId") &&
    hasColumn("gender") &&
    (hasColumn("sectionName") || SECTION_PATTERN.test(defaultSection.trim())) &&
    new Set(selected).size === selected.length
  );
}

function detectStudentImportLayout(rows) {
  // Old headerless imports used Name, Email, Student ID, Gender, Year Level, Section.
  const [, email, studentId, gender, , section] = rows[0].cells;
  if (
    email?.includes("@") &&
    studentId &&
    /^(male|female)$/i.test(gender) &&
    SECTION_PATTERN.test(section)
  ) {
    return {
      ...getStudentImportLayout(rows, 0, false),
      columns: POSITIONAL_COLUMNS,
    };
  }

  // Prefer a row with both name and ID headings over title and metadata rows.
  const matches = rows.map(({ cells }) => getColumnIndices(cells));
  const headerIndex = matches.findIndex(
    ({ name, firstName, lastName, studentId }) =>
      studentId >= 0 && (name >= 0 || (firstName >= 0 && lastName >= 0)),
  );
  const likelyHeader = matches.findIndex(
    (columns) =>
      Object.values(columns).filter((index) => index >= 0).length >= 2,
  );
  return getStudentImportLayout(
    rows,
    Math.max(0, headerIndex < 0 ? likelyHeader : headerIndex),
    true,
  );
}

export function mapStudentImportRows(
  rows,
  { rowIndex, hasHeaders, columns, defaultSection },
) {
  return rows
    .slice(rowIndex + Number(hasHeaders))
    .flatMap(({ cells, sourceRow }) => {
      const value = (field) => cells[columns[field]] ?? "";
      const firstName = value("firstName");
      const lastName = value("lastName");
      const name =
        value("name") || [firstName, lastName].filter(Boolean).join(" ");
      const email = value("email") || generateStudentEmail(firstName, lastName);
      const studentId = value("studentId");
      const rawGender = value("gender");
      const gender = GENDER_NAMES.get(rawGender.toLowerCase()) ?? rawGender;
      const year = value("yearLevel");
      const section = value("sectionName");
      const course = value("course");

      if (!(name || email || studentId || gender || year || section)) {
        return [];
      }

      const rawSection = (section || defaultSection)
        .toUpperCase()
        .replace(/\s+/g, "");
      const sectionName = SECTION_PATTERN.exec(rawSection)?.[1] ?? rawSection;
      const yearLevel = year
        ? (YEAR_LEVELS[Number(year) - 1] ?? year)
        : (YEAR_LEVELS[Number(sectionName[0]) - 1] ?? "");
      return [
        {
          sourceRow,
          name,
          email,
          studentId,
          gender,
          yearLevel,
          sectionName,
          ...(course ? { course } : {}),
        },
      ];
    });
}

async function readStudentImportRows(file) {
  const extension = file.name.split(".").pop()?.toLowerCase();
  if (extension === "xlsx") {
    const { readSheet } = await import("read-excel-file/browser");
    return readSheet(file, 1);
  }
  if (extension === "csv") {
    const bytes = await file.arrayBuffer();
    let csv;
    try {
      csv = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    } catch {
      // Excel can also save CSV using the Windows code page.
      csv = new TextDecoder("windows-1252").decode(bytes);
    }
    return parseCsvRows(csv);
  }
  throw new Error("Only CSV and XLSX files are supported.");
}

export async function parseStudentImportFile(file, onNeedsMapping) {
  const sourceRows = await readStudentImportRows(file);
  const rows = sourceRows
    .map((row, index) => ({
      cells: row.map((cell) => String(cell ?? "").trim()),
      sourceRow: index + 1,
    }))
    .filter(({ cells }) => cells.some(Boolean));
  if (rows.length === 0) return [];

  const layout = detectStudentImportLayout(rows);
  if (canImportStudentLayout(layout)) {
    return mapStudentImportRows(rows, layout);
  }
  if (!onNeedsMapping)
    throw new Error("Match the roster columns before importing.");
  onNeedsMapping({ rows, layout });
  return null;
}
