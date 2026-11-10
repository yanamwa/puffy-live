import { distributeQuizQuestions } from "./quizQuestionDistribution.js";
import { buildPracticeQuizPrompt } from "./practiceQuizPrompt.js";
import Swal from "sweetalert2";
import "./quizGenerationUi.css";

export function requestQuizSettings({
  assessment = "practice",
  tutorialPreview = false,
} = {}) {
  if (assessment !== "main") return requestPracticeQuizSettings();
  return requestMainQuizSettings({ tutorialPreview });
}

function requestMainQuizSettings({ tutorialPreview = false } = {}) {
  return Swal.fire({
    title: "Generate Main Quiz",
    customClass: {
      popup: "quizGeneratorPopup practiceGeneratorPopup mainGeneratorPopup",
      confirmButton: "quizGeneratorConfirm",
      cancelButton: "quizGeneratorCancel",
    },
    html: `<p class="quizGeneratorIntro">Configure your adaptive main assessment.</p>${tutorialPreview ? '<div id="main-quiz-generation-tutorial"></div>' : ""}<div class="practiceGeneratorFields">
      <label for="main-total">Total Questions</label><input id="main-total" type="number" min="1" max="100" step="1" value="20" aria-describedby="main-total-hint" required /><small id="main-total-hint" class="quizQuestionLimit">Maximum: 100 questions</small>
      <div id="main-quiz-question-distribution"><section><h3>Question Distribution</h3><p class="quizAutoDistributionHint">Enter the number of each question type. The counts must add up to Total Questions.</p><div class="practiceTypeGrid">
      <div><label for="main-mc">Multiple Choice</label><input id="main-mc" type="number" min="0" max="100" step="1" value="10" required /></div>
      <div><label for="main-id">Identification</label><input id="main-id" type="number" min="0" max="100" step="1" value="5" required /></div>
      <div><label for="main-tf">True/False</label><input id="main-tf" type="number" min="0" max="100" step="1" value="5" required /></div></div>
      <div class="practiceDistributionSummary" aria-live="polite"><strong id="main-assigned">20 of 20 questions assigned</strong></div></section></div>
      <section id="main-quiz-passing-grade"><h3>Passing Grade</h3><div class="mainRequiredScore"><span>70% passing grade</span><strong id="main-required" aria-live="polite">14/20</strong><small>Required correct answers to pass, automatically calculated from the total questions.</small></div></section>
      <section><h3>Adaptive Assessment</h3><ul class="mainAdaptiveList"><li>Practice results personalize questions when available</li><li>Students can start without completing Practice Quiz</li><li>Questions grounded in saved lesson sources</li></ul></section>
      </div>`,
    showCloseButton: !tutorialPreview,
    closeButtonAriaLabel: "Close Main Quiz generation",
    showCancelButton: !tutorialPreview,
    confirmButtonText: "Generate",
    cancelButtonText: "Cancel",
    showConfirmButton: !tutorialPreview,
    allowOutsideClick: !tutorialPreview,
    allowEscapeKey: !tutorialPreview,
    buttonsStyling: false,
    focusConfirm: false,
    didOpen: (popup) => {
      popup.parentElement.style.zIndex = "1000000";
      const get = (id) => popup.querySelector("#main-" + id);
      const update = () => {
        const total = Number(get("total").value);
        const assigned = ["mc", "id", "tf"].reduce(
          (n, id) => n + Number(get(id).value),
          0,
        );
        get("assigned").textContent =
          `${assigned} of ${total} questions assigned`;
        get("assigned").dataset.valid = String(
          get("total").checkValidity() &&
            ["mc", "id", "tf"].every((id) => get(id).checkValidity()) &&
            assigned === total,
        );
        get("required").textContent = get("total").checkValidity()
          ? `${Math.ceil((total * 70) / 100)}/${total}`
          : "—";
      };
      get("total").addEventListener("input", () => {
        if (get("total").checkValidity())
          distributeQuizQuestions(Number(get("total").value)).forEach(
            (count, index) => {
              get(["mc", "id", "tf"][index]).value = count;
            },
          );
        update();
      });
      ["mc", "id", "tf"].forEach((id) =>
        get(id).addEventListener("input", update),
      );
      update();
      if (tutorialPreview) {
        popup.querySelectorAll("input").forEach((input) => {
          input.disabled = true;
        });
      }
    },
    preConfirm: () => {
      const get = (id) => Swal.getPopup().querySelector("#main-" + id);
      if (["total", "mc", "id", "tf"].some((id) => !get(id).checkValidity())) {
        Swal.showValidationMessage(
          "Enter whole question counts (1–100 total).",
        );
        return false;
      }
      const questionCount = Number(get("total").value),
        multipleChoiceCount = Number(get("mc").value),
        identificationCount = Number(get("id").value),
        trueFalseCount = Number(get("tf").value);
      if (
        multipleChoiceCount + identificationCount + trueFalseCount !==
        questionCount
      ) {
        Swal.showValidationMessage(
          "Question type counts must equal Total Questions.",
        );
        return false;
      }
      return {
        assessmentType: "main",
        questionCount,
        multipleChoiceCount,
        identificationCount,
        trueFalseCount,
        passingPercentage: 70,
      };
    },
  });
}

function requestPracticeQuizSettings() {
  return Swal.fire({
    title: "Generate Practice Quiz",
    customClass: {
      popup: "quizGeneratorPopup practiceGeneratorPopup",
      confirmButton: "quizGeneratorConfirm",
      cancelButton: "quizGeneratorCancel",
    },
    html: `<p class="quizGeneratorIntro">Create questions grounded in your saved lesson materials.</p>
      <div class="practiceGeneratorFields">
        <label for="quiz-question-count">Total Questions</label><input id="quiz-question-count" type="number" min="1" max="100" step="1" value="20" aria-describedby="quiz-question-count-hint" required /><small id="quiz-question-count-hint" class="quizQuestionLimit">Maximum: 100 questions</small>
        <section><h3>Question Distribution</h3><div class="practiceTypeGrid">
          <div><label for="quiz-multiple-choice-count">Multiple Choice</label><input id="quiz-multiple-choice-count" type="number" min="0" max="100" step="1" value="10" required /></div>
          <div><label for="quiz-identification-count">Identification</label><input id="quiz-identification-count" type="number" min="0" max="100" step="1" value="5" required /></div>
          <div><label for="quiz-true-false-count">True or False</label><input id="quiz-true-false-count" type="number" min="0" max="100" step="1" value="5" required /></div>
        </div><div class="practiceDistributionSummary" aria-live="polite"><span id="quiz-type-summary"></span><strong id="quiz-type-total"></strong></div></section>
        <section><h3>Cognitive Distribution</h3>
          <div class="practiceSkillHeading"><label for="quiz-lots-count">LOTS Questions<small>Remember • Understand • Apply</small></label></div>
          <input id="quiz-lots-count" type="number" min="0" max="20" step="1" value="12" required />
          <div class="practiceSkillHeading"><label for="quiz-hots-count">HOTS Questions<small>Analyze • Evaluate • Create</small></label></div>
          <input id="quiz-hots-count" type="number" min="0" max="20" step="1" value="8" required />
          <div class="practiceCognitiveTrack" aria-hidden="true"><i id="quiz-lots-share"></i></div>
          <p id="quiz-cognitive-summary" aria-live="polite"></p>
        </section>
      </div>`,
    showCloseButton: true,
    closeButtonAriaLabel: "Close Practice Quiz generation",
    showCancelButton: true,
    confirmButtonText: "Save",
    cancelButtonText: "Cancel",
    buttonsStyling: false,
    focusConfirm: false,
    didOpen: (popup) => {
      popup.parentElement.style.zIndex = "1000000";
      const total = popup.querySelector("#quiz-question-count");
      const lots = popup.querySelector("#quiz-lots-count");
      const hots = popup.querySelector("#quiz-hots-count");
      const typeInputs = [
        "multiple-choice",
        "identification",
        "true-false",
      ].map((type) => popup.querySelector(`#quiz-${type}-count`));
      const update = () => {
        const count = Number(total.value);
        const validTotal = total.checkValidity();
        lots.max = validTotal ? count : 0;
        hots.max = validTotal ? count : 0;
        const low = Number(lots.value),
          high = Number(hots.value);
        const [mc, ids, tf] = typeInputs.map((input) => Number(input.value));
        typeInputs.forEach((input) => {
          input.max = validTotal ? count : 100;
        });
        popup.querySelector("#quiz-type-summary").textContent =
          `${mc} Multiple Choice • ${ids} Identification • ${tf} True/False`;
        const sum = popup.querySelector("#quiz-type-total");
        sum.textContent = `${mc + ids + tf}/${validTotal ? count : "—"}`;
        sum.dataset.valid = String(
          validTotal &&
            typeInputs.every((input) => input.checkValidity()) &&
            mc + ids + tf === count,
        );
        popup.querySelector("#quiz-lots-share").style.width =
          `${validTotal ? (low / count) * 100 : 0}%`;
        popup.querySelector("#quiz-cognitive-summary").textContent =
          `${low} LOTS • ${high} HOTS`;
      };
      total.addEventListener("input", () => {
        if (total.checkValidity()) {
          const count = Number(total.value);
          distributeQuizQuestions(count).forEach((value, index) => {
            typeInputs[index].value = value;
          });
          lots.value = Math.min(count, Math.max(0, Number(lots.value) || 0));
          hots.value = count - Number(lots.value);
        }
        update();
      });
      [lots, hots].forEach((input) =>
        input.addEventListener("input", () => {
          if (total.checkValidity() && input.checkValidity())
            (input === lots ? hots : lots).value =
              Number(total.value) - Number(input.value);
          update();
        }),
      );
      typeInputs.forEach((input) => input.addEventListener("input", update));
      update();
    },
    preConfirm: () => {
      const popup = Swal.getPopup();
      const inputs = [
        "question",
        "multiple-choice",
        "identification",
        "true-false",
      ].map((type) => popup.querySelector(`#quiz-${type}-count`));
      const [
        questionCount,
        multipleChoiceCount,
        identificationCount,
        trueFalseCount,
      ] = inputs.map((input) => Number(input.value));
      if (inputs.some((input) => !input.checkValidity())) {
        Swal.showValidationMessage(
          "Enter whole question counts from 0 to 100, with at least one total question.",
        );
        return false;
      }
      if (
        multipleChoiceCount + identificationCount + trueFalseCount !==
        questionCount
      ) {
        Swal.showValidationMessage(
          "Question type counts must add up to Total Questions.",
        );
        return false;
      }
      const lotsCount = Number(popup.querySelector("#quiz-lots-count").value);
      const hotsCount = Number(popup.querySelector("#quiz-hots-count").value);
      if (
        ["lots", "hots"].some(
          (skill) =>
            !popup.querySelector(`#quiz-${skill}-count`).checkValidity(),
        ) ||
        lotsCount + hotsCount !== questionCount
      ) {
        Swal.showValidationMessage(
          "Enter whole LOTS and HOTS counts that add up to Total Questions.",
        );
        return false;
      }
      return {
        assessmentType: "practice",
        questionCount,
        multipleChoiceCount,
        identificationCount,
        trueFalseCount,
        lotsCount,
        hotsCount: questionCount - lotsCount,
      };
    },
  });
}

export function quizGenerationFields(settings, lesson = {}) {
  return settings.assessmentType === "practice"
    ? {
        prompt: buildPracticeQuizPrompt({ ...settings, ...lesson }),
        assessment_type: "practice",
        question_count: settings.questionCount,
        multiple_choice_count: settings.multipleChoiceCount,
        identification_count: settings.identificationCount,
        true_false_count: settings.trueFalseCount,
        lots_count: settings.lotsCount,
        hots_count: settings.hotsCount,
      }
    : {
        assessment_type: "main",
        question_count: settings.questionCount,
        multiple_choice_count: settings.multipleChoiceCount,
        identification_count: settings.identificationCount,
        true_false_count: settings.trueFalseCount,
        passing_percentage: settings.passingPercentage,
      };
}

export function quizSourceFields(courseId, lessonId, pages = []) {
  const ids = [
    ...new Set(
      pages.flatMap((p) => [
        ...(p.source_document_ids || []),
        ...(p.source_document_id ? [p.source_document_id] : []),
      ]),
    ),
  ];
  return {
    course_id: Number(courseId),
    lesson_id:
      Number.isInteger(Number(lessonId)) && Number(lessonId) > 0
        ? Number(lessonId)
        : null,
    document_ids: ids,
  };
}

export function notifyQuizGenerated(count) {
  Swal.close();
  return Swal.fire({
    toast: true,
    position: "top-end",
    icon: "success",
    title: "Quiz generated",
    text: `${count} questions ready. Review the answers and save your changes.`,
    showConfirmButton: false,
    showCloseButton: true,
    timer: 6500,
    timerProgressBar: true,
    customClass: { popup: "quizGeneratorPopup" },
    didOpen: (popup) => {
      popup.parentElement.style.zIndex = "1000000";
    },
  });
}
