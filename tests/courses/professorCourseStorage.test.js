import assert from "node:assert/strict";

const legacy = [{ id: 1, title: "Existing course" }];
const entries = new Map([["professor-courses", JSON.stringify(legacy)]]);
globalThis.localStorage = {
  getItem: (key) => entries.get(key) ?? null,
  setItem: () => { throw new DOMException("Full", "QuotaExceededError"); },
  removeItem: (key) => entries.delete(key),
};
globalThis.sessionStorage = { getItem: () => null };
let stored;
let failWrite = false;
globalThis.indexedDB = {
  open() {
    const request = {};
    queueMicrotask(() => {
      request.result = {
        close() {},
        transaction() {
          const transaction = {
            objectStore: () => ({
              get() {
                const result = { result: structuredClone(stored) };
                queueMicrotask(() => transaction.oncomplete());
                return result;
              },
              put(value) {
                queueMicrotask(() => {
                  if (failWrite) {
                    transaction.error = new Error("Disk full");
                    transaction.onabort();
                  } else {
                    stored = structuredClone(value);
                    transaction.oncomplete();
                  }
                });
                return {};
              },
            }),
          };
          return transaction;
        },
      };
      request.onsuccess();
    });
    return request;
  },
};
const storage = await import("../../src/pages/professor/professorData.js?storage-test");
globalThis.window = { dispatchEvent() {} };
globalThis.CustomEvent = class { constructor(type, options) { this.type = type; this.detail = options?.detail; } };
await storage.loadProfessorCourseStorage();
assert.deepEqual(storage.readProfessorCourses(), legacy);
const largeCourse = [{ id: 1, lessonPages: [{ image: "data:image/png;base64," + "a".repeat(6_000_000) }] }];
await storage.saveProfessorCourses(largeCourse, { includeAll: true });
assert.deepEqual(stored, largeCourse);
assert.equal(entries.has("professor-courses"), false);
const reloaded = await import("../../src/pages/professor/professorData.js?reload-test");
await reloaded.loadProfessorCourseStorage();
assert.deepEqual(reloaded.readProfessorCourses(), largeCourse);
failWrite = true;
await assert.rejects(storage.saveProfessorCourses([{ id: 2 }], { includeAll: true }), /Could not save/);
assert.deepEqual(storage.readProfessorCourses(), largeCourse);
assert.deepEqual(stored, largeCourse);
console.log("Course storage: quota bypass, reload, and failed-write preservation passed.");
