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
  sectionName: [
    "section",
    "sectionname",
    "studentsection",
    "yearsection",
    "yearandsection",
    "block",
  ],
  firstName: ["firstname", "givenname", "givennames", "forename"],
  lastName: ["lastname", "surname", "familyname"],
  middleName: ["middlename", "middleinitial", "mi"],
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
const SECTION_LABEL =
  /^(?:(?:year\s*(?:&|and|\/)\s*)?section|block)\s*[:=-]\s*/i;
const SURNAME_PREFIX =
  /^(?:de la|de los|de las|dela|delos|delas|de|del|san|santa|santo|van|von)$/i;

function getSection(value) {
  const label = value.replace(SECTION_LABEL, "").trim();
  return (
    SECTION_PATTERN.exec(label.replace(/\s+/g, ""))?.[1].toUpperCase() ?? ""
  );
}

function inferNames(name, middleName) {
  const [firstPart, secondPart, commaMiddle] = name
    .split(",")
    .map((part) => part.trim());
  const words = (secondPart ?? firstPart).split(/\s+/).filter(Boolean);
  let surname = firstPart;
  if (secondPart === undefined) {
    if (words.length < 2) return {};
    let start = words.length - 1;
    for (const length of [2, 1]) {
      if (
        start > length &&
        SURNAME_PREFIX.test(words.slice(start - length, start).join(" "))
      ) {
        start -= length;
        break;
      }
    }
    surname = words.splice(start).join(" ");
  }

  const middleWords = (middleName || commaMiddle || "")
    .toLowerCase()
    .split(/\s+/);
  const hasNamedMiddle =
    (middleName || commaMiddle) &&
    words.slice(-middleWords.length).join(" ").toLowerCase() ===
      middleWords.join(" ");
  if (hasNamedMiddle && words.length > middleWords.length) {
    words.splice(-middleWords.length);
  } else if (
    !middleName &&
    !commaMiddle &&
    words.length > 2 &&
    !/^\p{L}\.?$/u.test(words.at(-1))
  ) {
    // A spelled-out trailing middle name can look like another given name.
    words.pop();
  }
  while (words.length > 1 && /^\p{L}\.?$/u.test(words.at(-1))) words.pop();
  return { firstName: words.join(" "), lastName: surname };
}

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
    .map(getSection)
    .find(Boolean);

  return {
    rowIndex,
    hasHeaders,
    columns,
    defaultSection: classLabel ?? "",
  };
}

export function canImportStudentLayout({ columns, defaultSection }) {
  const hasColumn = (field) => columns[field] >= 0;
  const hasSplitName = hasColumn("firstName") && hasColumn("lastName");
  const selected = Object.values(columns).filter((index) => index >= 0);

  return (
    (hasColumn("name") || hasSplitName) &&
    hasColumn("studentId") &&
    hasColumn("gender") &&
    (hasColumn("sectionName") || Boolean(getSection(defaultSection ?? ""))) &&
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
  { preview = false } = {},
) {
  return rows
    .slice(rowIndex + Number(hasHeaders))
    .flatMap(({ cells, sourceRow }) => {
      const value = (field) => cells[columns[field]] ?? "";
      const firstName = value("firstName");
      const lastName = value("lastName");
      const name =
        value("name") || [firstName, lastName].filter(Boolean).join(" ");
      const suppliedEmail = value("email");
      const inferred = !suppliedEmail && !(firstName && lastName);
      const names = inferred ? inferNames(name, value("middleName")) : {};
      const email =
        suppliedEmail ||
        generateStudentEmail(
          firstName || names.firstName || "",
          lastName || names.lastName || "",
        );
      const studentId = value("studentId");
      const rawGender = value("gender");
      const gender = GENDER_NAMES.get(rawGender.toLowerCase()) ?? rawGender;
      const year = value("yearLevel");
      const section = value("sectionName");
      const course = value("course");

      if (!(
        name ||
        email ||
        studentId ||
        gender ||
        year ||
        section ||
        course
      )) {
        return [];
      }

      const rawSection = (section || defaultSection)
        .toUpperCase()
        .replace(/\s+/g, "");
      const sectionName = getSection(section || defaultSection) || rawSection;
      const yearLevel =
        preview && getSection(sectionName)
          ? YEAR_LEVELS[Number(sectionName[0]) - 1]
          : year
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
          ...(preview && inferred ? { reviewName: true } : {}),
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

export async function parseStudentImportFile(
  file,
  onNeedsMapping,
  { review = false } = {},
) {
  const sourceRows = await readStudentImportRows(file);
  const rows = sourceRows
    .map((row, index) => ({
      cells: row.map((cell) => String(cell ?? "").trim()),
      sourceRow: index + 1,
    }))
    .filter(({ cells }) => cells.some(Boolean));
  if (rows.length === 0) return [];

  const layout = detectStudentImportLayout(rows);
  if (!review && canImportStudentLayout(layout)) {
    return mapStudentImportRows(rows, layout);
  }
  if (!onNeedsMapping)
    throw new Error("Match the roster columns before importing.");
  onNeedsMapping({ rows, layout });
  return null;
}

export function validateStudentImport(
  students,
  users,
  validateStudent = () => "",
) {
  const key = (value) =>
    String(value ?? "")
      .trim()
      .toLowerCase();
  const fields = [
    ["email", "Email"],
    ["studentId", "Student ID"],
  ];
  const existing = fields.map(
    ([field]) => new Map(users.map((user) => [key(user[field]), user])),
  );
  const counts = fields.map(([field]) => {
    const values = new Map();
    for (const student of students) {
      const value = key(student[field]);
      values.set(value, (values.get(value) ?? 0) + 1);
    }
    return values;
  });
  return students.map((student) => {
    const errors = [validateStudent(student)].filter(Boolean);
    if (student.course?.trim().length > 255)
      errors.push("Course must be 255 characters or fewer.");
    fields.forEach(([field, label], index) => {
      const value = key(student[field]);
      if (!value) return;
      const registered = existing[index].get(value);
      if (registered)
        errors.push(
          `${label} already registered to ${registered.name || registered.email} (${registered.email}).`,
        );
      if (counts[index].get(value) > 1)
        errors.push(`Duplicate ${label.toLowerCase()} in this file.`);
    });
    return errors;
  });
}
