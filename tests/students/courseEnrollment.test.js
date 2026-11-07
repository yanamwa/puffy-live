import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import test from "node:test";
import { transformSync } from "esbuild";

const readSource = (path) =>
  readFileSync(new URL(path, import.meta.url), "utf8");
const withoutImports = (source) =>
  source.replace(/^import[\s\S]*?;\r?\n/gm, "");
const course = { id: 42, code: "PB-SELF", title: "Understanding the Self" };

function harness({
  status = 201,
  data = {
    success: true,
    pending: true,
    enrolled: false,
    message: "Waiting for professor approval.",
  },
  lookupStatus = 200,
  token = "student-token",
  networkFails = false,
} = {}) {
  const entries = new Map([
    ["puffy-user", JSON.stringify({ id: 7 })],
    ["puffy-token", token],
  ]);
  const requests = [];
  const alerts = [];
  const events = [];
  const submitted = [];
  const context = vm.createContext({
    API_BASE: "http://localhost/api",
    URLSearchParams,
    localStorage: {
      getItem: (key) => entries.get(key) || null,
      setItem: (key, value) => entries.set(key, value),
    },
    sessionStorage: { getItem: () => null },
    window: { dispatchEvent: (event) => events.push(event) },
    CustomEvent: class {
      constructor(type, options) {
        this.type = type;
        this.detail = options.detail;
      }
    },
    Swal: { fire: async (options) => alerts.push(options) },
    fetch: async (url, options) => {
      requests.push({ url, ...options });
      if (networkFails) throw new Error("Network unavailable");
      const responseStatus = options.method === "GET" ? lookupStatus : status;
      return {
        status: responseStatus,
        ok: responseStatus >= 200 && responseStatus < 300,
        json: async () =>
          options.method === "GET"
            ? {
                success: lookupStatus === 200,
                course,
                message: "Could not find course.",
              }
            : data,
      };
    },
  });
  vm.runInContext(
    withoutImports(
      readSource("../../src/pages/student/courses/studentCourseData.js"),
    ).replace(/^export /gm, "") +
      withoutImports(
        readSource("../../src/pages/student/courses/courseEnrollment.js"),
      ).replace(/^export /gm, "") +
      ";this.api = { requestCourseEnrollmentByCode, enrollStudentInCourseAsync };",
    context,
  );
  return {
    entries,
    requests,
    alerts,
    events,
    submitted,
    enroll: () => context.api.enrollStudentInCourseAsync(course),
    submit: (code = " pb-self ", options = {}) =>
      context.api.requestCourseEnrollmentByCode(code, {
        onSubmitted: (result) => submitted.push(result),
        ...options,
      }),
  };
}

test("code submission sends a request without marking a pending student as enrolled", async () => {
  const h = harness();
  const result = await h.submit();
  assert.equal(result.pending, true);
  assert.equal(result.course.id, 42);
  assert.equal(h.requests.length, 2);
  assert.equal(
    new URL(h.requests[0].url).searchParams.get("courseCode"),
    "pb-self",
  );
  assert.equal(h.requests[1].method, "POST");
  assert.equal(h.requests[1].headers.Authorization, "Bearer student-token");
  assert.equal(JSON.parse(h.requests[1].body).courseId, 42);
  assert.equal(h.entries.has("student-enrolled-courses:7"), false);
  assert.equal(h.events.length, 0);
  assert.equal(h.submitted.length, 1);
  assert.equal(h.alerts[0].title, "Enrollment Request Sent");
  assert.match(h.alerts[0].text, /professor approval/);
});

test("an approved response says already enrolled and updates only this account", async () => {
  const h = harness({
    status: 409,
    data: {
      success: false,
      status: "approved",
      message: "You are already enrolled in this course.",
    },
  });
  const result = await h.submit();
  assert.equal(result.enrolled, true);
  assert.equal(result.alreadyEnrolled, true);
  assert.equal(h.alerts[0].title, "Already Enrolled");
  assert.equal(h.alerts[0].text, "You are already enrolled in this course.");
  assert.deepEqual(JSON.parse(h.entries.get("student-enrolled-courses:7")), [
    "42",
  ]);
  assert.equal(h.entries.has("student-enrolled-courses"), false);
  assert.equal(h.events.length, 1);
});

test("a canceled join-link effect cannot send an extra request or show a stale alert", async () => {
  const h = harness();
  let active = true;
  const obsolete = h.submit("PB-SELF", { isActive: () => active });
  active = false;
  assert.equal(await obsolete, null);
  assert.equal(h.requests.length, 1);
  assert.equal(h.requests[0].method, "GET");
  assert.equal(h.alerts.length, 0);
  assert.equal(h.submitted.length, 0);

  const current = await h.submit();
  assert.equal(current.pending, true);
  assert.equal(h.requests.filter(({ method }) => method === "POST").length, 1);
  assert.equal(h.alerts.length, 1);
});

test("an existing pending request is reported without granting course access", async () => {
  const h = harness({
    status: 409,
    data: {
      success: false,
      status: "pending",
      message: "Your enrollment request is already pending approval.",
    },
  });
  const result = await h.submit();
  assert.equal(result.pending, true);
  assert.equal(result.enrolled, false);
  assert.equal(result.alreadyRequested, true);
  assert.equal(h.alerts[0].title, "Request Already Sent");
  assert.equal(h.entries.has("student-enrolled-courses:7"), false);
  assert.equal(h.events.length, 0);
});

test("empty and invalid codes keep the modal open and never send enrollment requests", async () => {
  const blank = harness();
  assert.equal(await blank.submit(" "), null);
  assert.equal(blank.requests.length, 0);
  assert.equal(blank.submitted.length, 0);
  assert.equal(blank.alerts[0].title, "Enter Course Code");
  const invalid = harness({ lookupStatus: 404 });
  assert.equal(await invalid.submit(), null);
  assert.equal(invalid.requests.length, 1);
  assert.equal(invalid.submitted.length, 0);
  assert.equal(invalid.alerts[0].title, "Course Not Found");
});

test("API, network and login failures cannot fall back to local enrollment", async () => {
  for (const options of [
    {
      status: 500,
      data: { success: false, message: "Could not save request." },
    },
    { status: 401, data: { success: false, message: "Please sign in again." } },
    { networkFails: true },
    { token: "" },
    { data: { success: true } },
  ]) {
    const h = harness(options);
    await assert.rejects(h.enroll());
    assert.equal(h.entries.has("student-enrolled-courses:7"), false);
    assert.equal(await h.submit(), null);
    assert.equal(h.alerts[0].icon, "error");
    assert.equal(h.submitted.length, 0);
    assert.equal(h.events.length, 0);
  }
});

test("the code modal ignores repeated clicks and Enter while a request is in progress", async () => {
  let release;
  let joins = 0;
  let cancels = 0;
  const pending = new Promise((resolve) => {
    release = resolve;
  });
  const context = vm.createContext({
    useRef: (current) => ({ current }),
    useState: () => [false, () => {}],
    h: (type, props, ...children) => ({ type, props, children }),
  });
  const compiled = transformSync(
    withoutImports(
      readSource("../../src/pages/student/courses/JoinCourseModal.jsx"),
    ).replace("export default ", ""),
    { loader: "jsx", jsxFactory: "h" },
  ).code;
  vm.runInContext(compiled + ";this.Modal = JoinCourseModal;", context);
  const tree = context.Modal({
    open: true,
    courseCode: "PB-SELF",
    onJoin: async () => {
      joins += 1;
      await pending;
    },
    onCancel: () => {
      cancels += 1;
    },
    onCourseCodeChange: () => {},
  });
  const nodes = [];
  function visit(node) {
    if (!node || typeof node !== "object") return;
    nodes.push(node);
    node.children.forEach(visit);
  }
  visit(tree);
  const button = nodes.find(
    ({ props }) => props?.className === "join-course-submit",
  );
  const input = nodes.find(({ type }) => type === "input");
  const first = button.props.onClick();
  await button.props.onClick();
  input.props.onKeyDown({ key: "Enter", preventDefault() {} });
  tree.props.onMouseDown();
  assert.equal(joins, 1);
  assert.equal(cancels, 0);
  release();
  await first;
  await button.props.onClick();
  tree.props.onMouseDown();
  assert.equal(joins, 2);
  assert.equal(cancels, 1);
});
