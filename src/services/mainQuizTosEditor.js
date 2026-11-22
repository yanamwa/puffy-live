const types = [
  ["multiple_choice", "Multiple Choice"],
  ["identification", "Identification"],
  ["true_false", "True/False"],
];
const levels = [
  "Remember",
  "Understand",
  "Apply",
  "Analyze",
  "Evaluate",
  "Create",
];

export function mountMainQuizTos(popup, topics, objectives, saved = []) {
  const container = popup.querySelector("#main-tos-rows");
  const add = popup.querySelector("#main-tos-add");
  function addRow(slot = {}, count = 1) {
    const row = document.createElement("fieldset");
    row.className = "practiceTypeGrid";
    const field = (title, key, options, value) => {
      const label = document.createElement("label");
      label.textContent = title;
      const control = document.createElement(
        options?.length ? "select" : "input",
      );
      control.dataset.field = key;
      if (options?.length) {
        for (const [option, display] of options)
          control.add(new Option(display, option));
      } else control.maxLength = key === "topic" ? 100 : 500;
      if (value != null) control.value = value;
      label.append(control);
      row.append(label);
      return control;
    };
    const choices = topics.map((t) => [t, t]);
    if (slot.topic && !topics.includes(slot.topic))
      choices.push([slot.topic, slot.topic]);
    field("Topic", "topic", choices, slot.topic);
    field("Question type", "type", types, slot.type);
    field(
      "Cognitive level",
      "cognitive_level",
      levels.map((v) => [v, v]),
      slot.cognitive_level,
    );
    const objectiveChoices = [
      ["", "Use a relevant module objective"],
      ...objectives.map((v) => [v, v]),
    ];
    if (
      slot.learning_objective &&
      !objectives.includes(slot.learning_objective)
    )
      objectiveChoices.push([slot.learning_objective, slot.learning_objective]);
    field(
      "Learning objective",
      "learning_objective",
      objectiveChoices,
      slot.learning_objective,
    );
    const number = field("Questions", "count", null, count);
    Object.assign(number, {
      type: "number",
      min: "1",
      max: "100",
      step: "1",
      required: true,
    });
    const remove = document.createElement("button");
    remove.type = "button";
    remove.textContent = "Remove assignment";
    remove.addEventListener("click", () => row.remove());
    row.append(remove);
    container.append(row);
  }
  add.addEventListener("click", () => addRow());
  const grouped = new Map();
  for (const slot of saved) {
    const key = JSON.stringify([
      slot.topic,
      slot.type,
      slot.cognitive_level,
      slot.learning_objective,
    ]);
    const row = grouped.get(key) || { slot, count: 0 };
    row.count++;
    grouped.set(key, row);
  }
  for (const { slot, count } of grouped.values()) addRow(slot, count);
  if (saved.length) container.closest("details").open = true;
}

export function readMainQuizTos(popup, expected) {
  const rows = popup.querySelectorAll("#main-tos-rows fieldset");
  if (!rows.length) return undefined;
  const slots = [];
  for (const row of rows) {
    const values = Object.fromEntries(
      [...row.querySelectorAll("[data-field]")].map((c) => [
        c.dataset.field,
        c.value.trim(),
      ]),
    );
    const { count, ...slot } = values;
    if (
      !slot.topic ||
      !Number.isInteger(Number(count)) ||
      Number(count) < 1 ||
      slots.length + Number(count) > 100
    )
      throw new Error(
        "Each TOS assignment needs a topic and a whole question count from 1 to 100.",
      );
    for (let i = 0; i < Number(count); i++) slots.push(slot);
  }
  if (
    Object.entries(expected).some(
      ([type, n]) => slots.filter((s) => s.type === type).length !== n,
    )
  )
    throw new Error(
      "Match the TOS assignments to the number of questions of each type.",
    );
  return slots;
}
