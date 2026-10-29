import assert from "node:assert/strict";
import { mainQuizScheduleState } from "../../src/utils/mainQuizSchedule.js";

const settings = {
  enabled: true,
  unlockAt: "2026-10-11T01:01:00+08:00",
  lockAt: "2026-10-11T01:05:00+08:00",
};
const opens = Date.parse(settings.unlockAt);
const closes = Date.parse(settings.lockAt);
assert.equal(mainQuizScheduleState(settings, opens - 1), "scheduled");
assert.equal(mainQuizScheduleState(settings, opens), "open");
assert.equal(mainQuizScheduleState(settings, closes - 1), "open");
assert.equal(mainQuizScheduleState(settings, closes), "closed");
assert.equal(
  mainQuizScheduleState({ ...settings, enabled: false }, opens),
  "disabled",
);
assert.equal(mainQuizScheduleState({ enabled: true }, closes), "open");
assert.equal(
  mainQuizScheduleState({ enabled: true, lockAt: settings.lockAt }, closes),
  "closed",
);
