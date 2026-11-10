import assert from "node:assert/strict";
import test from "node:test";
import {
  canImportStudentLayout,
  getStudentImportLayout,
  mapStudentImportRows,
  parseStudentImportFile,
} from "../../src/utils/studentImport.js";

function parseCsv(text) {
  return parseStudentImportFile(new File([text], "roster.csv"));
}

test("imports a class roster with metadata before the headers", async () => {
  const students = await parseCsv(
    [
      "ITEC 80A (202610741)",
      "BSIT-3C",
      "2026-2027 (FIRST)",
      "",
      ",Last Name,First Name,Middle Name,Full Name,Sex,Student Number,Course",
      '1,DE LEÓN,ANA MARIE,CRUZ,"DE LEÓN, ANA MARIE C.",FEMALE,00123456,BSIT',
      "",
      '2,REYES,LUIS,,"REYES, LUIS",MALE,202410001,BSIT',
    ].join("\r\n"),
  );

  assert.deepEqual(students, [
    {
      sourceRow: 6,
      course: "BSIT",
      name: "DE LEÓN, ANA MARIE C.",
      email: "anamarie.deleón@cvsu.edu.ph",
      studentId: "00123456",
      gender: "Female",
      yearLevel: "3rd Year",
      sectionName: "3C",
    },
    {
      sourceRow: 8,
      course: "BSIT",
      name: "REYES, LUIS",
      email: "luis.reyes@cvsu.edu.ph",
      studentId: "202410001",
      gender: "Male",
      yearLevel: "3rd Year",
      sectionName: "3C",
    },
  ]);
});

test("uses explicit email and class details when the roster supplies them", async () => {
  const [student] = await parseCsv(
    [
      "BSIT-3C",
      "Last Name,First Name,Sex,Student Number,Email,Section,Year Level",
      "REYES,ANA MARIE,FEMALE,202410001,ana.reyes@cvsu.edu.ph,2B,2nd Year",
    ].join("\n"),
  );

  assert.equal(student.name, "ANA MARIE REYES");
  assert.equal(student.email, "ana.reyes@cvsu.edu.ph");
  assert.equal(student.yearLevel, "2nd Year");
  assert.equal(student.sectionName, "2B");
});

test("keeps supporting legacy files with or without the standard header", async () => {
  const row =
    "Ana Marie Reyes,ana.reyes@cvsu.edu.ph,202410001,Female,3rd Year,3C";
  const [headerless] = await parseCsv(row);
  const [labeled] = await parseCsv(
    "Name,Email,Student ID,Gender,Year Level,Section\n" + row,
  );

  assert.deepEqual(headerless, {
    sourceRow: 1,
    name: "Ana Marie Reyes",
    email: "ana.reyes@cvsu.edu.ph",
    studentId: "202410001",
    gender: "Female",
    yearLevel: "3rd Year",
    sectionName: "3C",
  });
  assert.deepEqual(labeled, { ...headerless, sourceRow: 2 });
});

test("imports alternate headers and reordered columns", async () => {
  const [student] = await parseCsv(
    "School Email,Block,Learner ID,Gender,Given Names,Surname,Program\n" +
      "ana.reyes@cvsu.edu.ph,BSIT-3C,00123456,F,ANA MARIE,REYES,BSCS",
  );
  assert.deepEqual(student, {
    sourceRow: 2,
    name: "ANA MARIE REYES",
    course: "BSCS",
    email: "ana.reyes@cvsu.edu.ph",
    studentId: "00123456",
    gender: "Female",
    yearLevel: "3rd Year",
    sectionName: "3C",
  });
});

test("offers column matching for an unfamiliar layout before importing any rows", async () => {
  const file = new File(
    [
      "Class roster\n\n" +
        "Mail Address,Student ID,Learner,Category,Track\n" +
        "ana.reyes@cvsu.edu.ph,00123456,Ana Reyes,Female,BSIT",
    ],
    "custom.csv",
  );
  let table;
  assert.equal(
    await parseStudentImportFile(file, (value) => {
      table = value;
    }),
    null,
  );
  const layout = getStudentImportLayout(table.rows, 1, true);
  assert.equal(layout.columns.studentId, 1);
  layout.columns = {
    ...layout.columns,
    name: 2,
    email: 0,
    gender: 3,
    course: 4,
  };
  assert.equal(canImportStudentLayout(layout), false);
  layout.defaultSection = "3C";
  assert.equal(canImportStudentLayout(layout), true);
  assert.deepEqual(mapStudentImportRows(table.rows, layout), [
    {
      sourceRow: 4,
      name: "Ana Reyes",
      course: "BSIT",
      email: "ana.reyes@cvsu.edu.ph",
      studentId: "00123456",
      gender: "Female",
      yearLevel: "3rd Year",
      sectionName: "3C",
    },
  ]);
  layout.columns.gender = layout.columns.studentId;
  assert.equal(canImportStudentLayout(layout), false);
});

test("keeps the first student row when matching a file without headers", async () => {
  const file = new File(["3C,F,00123456,Ana Marie,Reyes"], "custom.csv");
  let table;
  assert.equal(
    await parseStudentImportFile(file, (value) => {
      table = value;
    }),
    null,
  );
  const layout = getStudentImportLayout(table.rows, 0, false);
  layout.columns = {
    sectionName: 0,
    gender: 1,
    studentId: 2,
    firstName: 3,
    lastName: 4,
  };
  assert.equal(canImportStudentLayout(layout), true);
  const [student] = mapStudentImportRows(table.rows, layout);
  assert.equal(student.sourceRow, 1);
  assert.equal(student.email, "anamarie.reyes@cvsu.edu.ph");
});

test("preserves hyphens and accented letters in UTF-8 and Windows-1252 CSV", async () => {
  const csv =
    "First Name,Last Name,Gender,Student ID,Section\n" +
    "Ana-Marie,Peña,Female,00123456,3C";
  for (const encoding of ["utf8", "latin1"]) {
    const file = new File([Buffer.from(csv, encoding)], "roster.csv");
    const [student] = await parseStudentImportFile(file);
    assert.equal(student.email, "ana-marie.peña@cvsu.edu.ph");
  }
});

test("keeps email punctuation and uses an explicitly supplied address", async () => {
  const [generated, supplied] = await parseCsv(
    "First Name,Last Name,Gender,Student ID,Section,Email\n" +
      "Ma. Ana‑Marie,O’Peña,Female,00123456,3C,\n" +
      "Luis,Peña,Male,00123457,3C,luis.peña-2@cvsu.edu.ph",
  );
  assert.equal(generated.email, "ma.ana-marie.o'peña@cvsu.edu.ph");
  assert.equal(supplied.email, "luis.peña-2@cvsu.edu.ph");
});
