import { attemptModuleIndex } from "../../../utils/assessmentModuleScope.js";
import MainQuizResponses from "./MainQuizResponses.jsx";
import { flushSync } from "react-dom";
import "./QuizAssessmentDashboard.css";
import { useEffect, useMemo, useState } from "react";
import styles from "./AssessmentAnalysis.module.css";
import {
  summarizeMainQuizScores,
  mainQuizQuestions,
  mainQuizAnswerAt,
} from "../../../services/mainQuizAnalysisData.js";

const STUDENTS_PER_PAGE = 5;
const BLOOM_LEVELS = {
  remembering: {
    level: "Remembering",
    category: "LOTS",
    task: "Recalls facts or information",
    reason:
      "The question asks students to recall previously learned information.",
  },
  understanding: {
    level: "Understanding",
    category: "LOTS",
    task: "Explains or interprets information",
    reason:
      "The question asks students to explain, describe, or interpret the idea.",
  },
  applying: {
    level: "Applying",
    category: "LOTS",
    task: "Uses learned knowledge in a situation",
    reason:
      "The question asks students to use learned knowledge in a given situation.",
  },
  analyzing: {
    level: "Analyzing",
    category: "HOTS",
    task: "Compares, distinguishes, examines relationships",
    reason:
      "The question requires students to compare, distinguish, or examine relationships.",
  },
  evaluating: {
    level: "Evaluating",
    category: "HOTS",
    task: "Makes and justifies a judgment",
    reason: "The question asks students to make and justify a judgment.",
  },
  creating: {
    level: "Creating",
    category: "HOTS",
    task: "Designs or produces something new",
    reason: "The question asks students to design or produce something new.",
  },
};

const BLOOM_DISPLAY_ORDER = [
  "Remembering",
  "Understanding",
  "Applying",
  "Analyzing",
  "Evaluating",
  "Creating",
];
const THINKING_SKILL_ORDER = ["LOTS", "HOTS"];
const CHART_COLORS = {
  Male: "#7fa8d6",
  Female: "#a8c0dc",
  Passed: "#7fa8d6",
  Failed: "#c9ced6",
  LOTS: "#24476b",
  HOTS: "#7fa8d6",
};

function ChartLabel({ label }) {
  return (
    <span className={styles.pieLegendLabel}>
      <i
        className={styles.pieLegendSwatch}
        style={{ backgroundColor: CHART_COLORS[label] }}
        aria-hidden="true"
      />
      {label}
    </span>
  );
}

const BLOOM_RULES = [
  {
    key: "creating",
    terms: [
      "create",
      "design",
      "develop",
      "produce",
      "construct",
      "compose",
      "formulate",
      "build",
    ],
  },
  {
    key: "analyzing",
    terms: [
      "analyze",
      "compare",
      "contrast",
      "distinguish",
      "differentiate",
      "examine",
      "relationship",
      "determine which",
    ],
  },
  {
    key: "evaluating",
    terms: [
      "evaluate",
      "justify",
      "defend",
      "critique",
      "recommend",
      "judge",
      "assess",
      "prioritize",
      "most appropriate",
      "best",
    ],
  },
  {
    key: "applying",
    terms: [
      "apply",
      "solve",
      "calculate",
      "implement",
      "demonstrate",
      "perform",
      "execute",
      "use the",
    ],
  },
  {
    key: "understanding",
    terms: [
      "explain",
      "describe",
      "summarize",
      "interpret",
      "classify",
      "give an example",
      "in your own words",
    ],
  },
];

const OPTION_LETTERS = ["A", "B", "C", "D", "E", "F"];

function parseMaybeJson(value) {
  if (typeof value !== "string") return value;

  const trimmed = value.trim();

  if (!trimmed) return value;

  try {
    return JSON.parse(trimmed);
  } catch {
    return value;
  }
}

function readArrayField(...values) {
  for (const value of values) {
    const parsed = parseMaybeJson(value);

    if (Array.isArray(parsed)) return parsed;
    if (Array.isArray(parsed?.attempts)) return parsed.attempts;
    if (Array.isArray(parsed?.responses)) return parsed.responses;
    if (Array.isArray(parsed?.results)) return parsed.results;
    if (Array.isArray(parsed?.items)) return parsed.items;
    if (Array.isArray(parsed?.questions)) return parsed.questions;
  }

  return [];
}

function getQuestionNumber(value, fallbackIndex = 0) {
  const match = String(value || "").match(/\d+/);
  return match ? Number(match[0]) : fallbackIndex + 1;
}

function makeQuestionLabel(value, fallbackIndex = 0) {
  return `Question ${getQuestionNumber(value, fallbackIndex)}`;
}

function formatNumber(value, decimals = 1) {
  if (!Number.isFinite(value)) return "0";

  return Number(value)
    .toFixed(decimals)
    .replace(/\.?0+$/, "");
}

function formatScore(value, total) {
  if (!Number.isFinite(value)) return "0";

  return `${formatNumber(value)} / ${total || 0}`;
}

function getScorePercent(score, total) {
  if (!Number.isFinite(score) || !Number(total)) return null;

  return (score / total) * 100;
}

function formatScoreWithPercent(score, total) {
  const percent = getScorePercent(score, total);

  if (!Number.isFinite(score)) return "0";
  if (!Number.isFinite(percent)) return formatScore(score, total);

  return `${formatScore(score, total)} (${formatPercent(percent)})`;
}

function formatExamineeCount(value) {
  const count = Number(value || 0);

  return `${count} ${count === 1 ? "Examinee" : "Examinees"}`;
}

function getBloomDetail(value) {
  if (!value) return null;

  const normalized = String(value)
    .toLowerCase()
    .replace(/[^a-z]/g, "");
  return Object.values(BLOOM_LEVELS).find(
    (detail) =>
      detail.level.toLowerCase() === normalized ||
      normalized.includes(detail.level.toLowerCase()),
  );
}

function normalizeCognitiveCategory(value, fallback) {
  const normalized = String(value || "").toLowerCase();

  if (normalized.includes("hots") || normalized.includes("higher"))
    return "HOTS";
  if (normalized.includes("lots") || normalized.includes("lower"))
    return "LOTS";

  return fallback;
}

function inferCognitiveLevel(question) {
  const providedLevel = getBloomDetail(question?.cognitiveLevel);
  const source = String(question?.question || "").toLowerCase();
  const inferredRule = BLOOM_RULES.find((rule) =>
    rule.terms.some((term) => source.includes(term)),
  );
  const detail =
    providedLevel ||
    BLOOM_LEVELS[inferredRule?.key] ||
    BLOOM_LEVELS.remembering;

  return {
    ...detail,
    category: normalizeCognitiveCategory(
      question?.cognitiveCategory,
      detail.category,
    ),
    reason: question?.cognitiveReason || detail.reason,
  };
}

function normalizeChoices(...values) {
  for (const value of values) {
    if (!value) continue;

    const choices = Array.isArray(value)
      ? value
      : typeof value === "string"
        ? value
            .split(/\r?\n|[,|]/g)
            .map((item) => item.trim())
            .filter(Boolean)
        : [];

    const normalized = choices
      .map((choice) => String(choice || "").trim())
      .filter(Boolean);

    if (normalized.length > 0) return normalized;
  }

  return [];
}

function cleanChoiceText(value) {
  return String(value || "")
    .replace(/^[A-Z]\s*[.)-]\s*/i, "")
    .trim();
}

function sameChoice(left, right) {
  return (
    cleanChoiceText(left).toLowerCase() === cleanChoiceText(right).toLowerCase()
  );
}

function addUniqueChoice(choices, value) {
  const cleaned = cleanChoiceText(value);

  if (!cleaned || choices.some((choice) => sameChoice(choice, cleaned))) return;

  choices.push(cleaned);
}

function getAnswerChoices(question) {
  const choices = [];

  if (Array.isArray(question?.options)) {
    question.options.forEach((choice) => addUniqueChoice(choices, choice));
  }

  addUniqueChoice(choices, question?.answer);

  if (choices.length === 0) choices.push("Correct response");
  if (choices.length === 1 && Number(question?.incorrect || 0) > 0) {
    choices.push("Other answers");
  }

  return choices.slice(0, OPTION_LETTERS.length);
}

function splitIncorrectCount(total, slots) {
  if (slots <= 0) return [];

  const weights = Array.from({ length: slots }, (_, index) => slots - index);
  const weightTotal = weights.reduce((sum, weight) => sum + weight, 0);
  let remaining = total;

  return weights.map((weight, index) => {
    if (index === weights.length - 1) return remaining;

    const count = Math.min(
      remaining,
      Math.round((total * weight) / weightTotal),
    );
    remaining -= count;
    return count;
  });
}

function readDistributionEntries(value) {
  const parsed = parseMaybeJson(value);

  if (Array.isArray(parsed)) {
    return parsed
      .map((entry, index) => {
        if (typeof entry === "number") {
          return {
            count: entry,
            index,
            key: OPTION_LETTERS[index],
            label: OPTION_LETTERS[index],
          };
        }

        if (!entry || typeof entry !== "object") return null;

        return {
          count:
            readNumber(
              entry.count,
              entry.total,
              entry.responses,
              entry.selected,
              entry.students,
              entry.value,
            ) ?? 0,
          index,
          isCorrect:
            entry.isCorrect === true ||
            entry.correct === true ||
            String(entry.isCorrect || entry.correct || "").toLowerCase() ===
              "true",
          key: entry.key || entry.letter || entry.optionKey || entry.option_key,
          label:
            entry.label ||
            entry.option ||
            entry.answer ||
            entry.choice ||
            entry.text ||
            entry.name ||
            entry.value ||
            OPTION_LETTERS[index],
        };
      })
      .filter(Boolean);
  }

  if (parsed && typeof parsed === "object") {
    return Object.entries(parsed)
      .map(([key, entry], index) => {
        const entryObject = entry && typeof entry === "object" ? entry : null;

        return {
          count:
            readNumber(
              entryObject?.count,
              entryObject?.total,
              entryObject?.responses,
              entryObject?.students,
              entry,
            ) ?? 0,
          index,
          isCorrect:
            entryObject?.isCorrect === true ||
            entryObject?.correct === true ||
            String(
              entryObject?.isCorrect || entryObject?.correct || "",
            ).toLowerCase() === "true",
          key,
          label:
            entryObject?.label ||
            entryObject?.option ||
            entryObject?.answer ||
            entryObject?.choice ||
            entryObject?.text ||
            key,
        };
      })
      .filter((entry) => Number.isFinite(entry.count));
  }

  return [];
}

function getDistributionEntries(question) {
  return readArrayField(
    question?.answerDistribution,
    question?.answer_distribution,
    question?.responseDistribution,
    question?.response_distribution,
    question?.optionDistribution,
    question?.option_distribution,
  ).length
    ? readDistributionEntries(
        readArrayField(
          question?.answerDistribution,
          question?.answer_distribution,
          question?.responseDistribution,
          question?.response_distribution,
          question?.optionDistribution,
          question?.option_distribution,
        ),
      )
    : [
        question?.answerDistribution,
        question?.answer_distribution,
        question?.responseDistribution,
        question?.response_distribution,
        question?.optionDistribution,
        question?.option_distribution,
        question?.answerCounts,
        question?.answer_counts,
        question?.optionCounts,
        question?.option_counts,
        question?.responseCounts,
        question?.response_counts,
      ].flatMap(readDistributionEntries);
}

function distributionEntryMatchesChoice(entry, choice, index) {
  const letter = OPTION_LETTERS[index]?.toLowerCase();
  const candidates = [entry.key, entry.label]
    .filter((value) => value !== undefined && value !== null)
    .map((value) => String(value).trim());

  if (!candidates.length && entry.index === index) return true;

  return candidates.some((candidate) => {
    const normalized = candidate.toLowerCase();
    const cleaned = cleanChoiceText(candidate).toLowerCase();

    return (
      normalized === letter ||
      normalized === `answer ${letter}` ||
      normalized === `${letter}.` ||
      normalized === `${letter})` ||
      cleaned === letter ||
      sameChoice(candidate, choice)
    );
  });
}

function buildAnswerDistribution(question) {
  const choices = getAnswerChoices(question);
  const totalCorrect = Math.max(
    Math.round(Number(question?.totalCorrect || 0)),
    0,
  );
  const incorrect = Math.max(Math.round(Number(question?.incorrect || 0)), 0);
  const correctIndex = choices.findIndex((choice) =>
    sameChoice(choice, question?.answer),
  );
  const resolvedCorrectIndex = correctIndex >= 0 ? correctIndex : 0;
  const explicitEntries = getDistributionEntries(question);

  if (explicitEntries.length > 0) {
    const explicitCounts = choices.map((choice, index) =>
      explicitEntries
        .filter((entry) => distributionEntryMatchesChoice(entry, choice, index))
        .reduce(
          (sum, entry) =>
            sum + Math.max(Math.round(Number(entry.count || 0)), 0),
          0,
        ),
    );

    if (explicitCounts.some((count) => count > 0)) {
      return choices.map((choice, index) => ({
        choice,
        count: explicitCounts[index],
        isCorrect:
          index === resolvedCorrectIndex ||
          explicitEntries.some(
            (entry) =>
              entry.isCorrect &&
              distributionEntryMatchesChoice(entry, choice, index),
          ),
        label: `Answer ${OPTION_LETTERS[index]}`,
      }));
    }
  }

  const counts = choices.map(() => 0);
  const incorrectIndexes = choices
    .map((_, index) => index)
    .filter((index) => index !== resolvedCorrectIndex);
  const incorrectCounts = splitIncorrectCount(
    incorrect,
    incorrectIndexes.length,
  );

  counts[resolvedCorrectIndex] = totalCorrect;
  incorrectIndexes.forEach((index, countIndex) => {
    counts[index] = incorrectCounts[countIndex] || 0;
  });

  return choices.map((choice, index) => ({
    choice,
    count: counts[index],
    isCorrect: index === resolvedCorrectIndex,
    label: `Answer ${OPTION_LETTERS[index]}`,
  }));
}

function getQuestionAnalysisTitle(question) {
  const number = getQuestionNumber(question?.label, 0);

  return number ? `Question ${number} Analysis` : "Question Analysis";
}

function normalizeGender(value) {
  const normalized = String(value || "")
    .trim()
    .toLowerCase();

  if (["male", "m"].includes(normalized)) return "male";
  if (["female", "f"].includes(normalized)) return "female";

  return "";
}

function getEnrollmentSummary(enrolledStudents = []) {
  const enrolled = Array.isArray(enrolledStudents) ? enrolledStudents : [];

  return enrolled.reduce(
    (summary, student) => {
      const gender = normalizeGender(student.gender || student.studentGender);

      if (gender === "male") {
        summary.maleStudents += 1;
      }

      if (gender === "female") {
        summary.femaleStudents += 1;
      }

      return summary;
    },
    {
      totalStudents: enrolled.length,
      maleStudents: 0,
      femaleStudents: 0,
    },
  );
}

function readNumber(...values) {
  for (const value of values) {
    if (value === null || value === undefined || value === "") continue;

    const number = Number(value);
    if (Number.isFinite(number)) return number;
  }

  return null;
}

function formatPercent(value) {
  const fixed = Number(value || 0).toFixed(2);
  return `${fixed.replace(/\.?0+$/, "")}%`;
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function normalizeQuizScore(score, total) {
  if (!Number.isFinite(score)) return null;
  if (total > 0 && score > total && score <= 100) {
    return (score / 100) * total;
  }

  return score;
}

function normalizeQuizAttempts(attempts, configuredPassScore) {
  return attempts
    .filter((attempt) => attempt.assessment_type === "main")
    .map((attempt, index) => {
      const answers = readArrayField(
        attempt?.answers,
        attempt?.responses,
        attempt?.userResults,
        attempt?.user_results,
        attempt?.answerDetails,
        attempt?.answer_details,
        attempt?.items,
      );
      const rawScore = readNumber(
        attempt?.score,
        attempt?.finalScore,
        attempt?.final_score,
        attempt?.totalCorrect,
        attempt?.total_correct,
        attempt?.correct,
        attempt?.points,
      );
      const answerScore =
        rawScore ??
        (answers.length
          ? answers.filter(
              (answer) => readAttemptCorrectness(answer, null, "") === true,
            ).length
          : null);
      const rawTotal =
        readNumber(
          attempt?.total,
          attempt?.totalItems,
          attempt?.total_items,
          attempt?.questionCount,
          attempt?.question_count,
          attempt?.maxScore,
          attempt?.max_score,
        ) ||
        answers.length ||
        0;

      return {
        answers,
        moduleIndex: attempt?.module_index ?? attempt?.moduleIndex ?? null,
        moduleTitle:
          attempt?.module_title ||
          attempt?.moduleTitle ||
          attempt?.lesson_title ||
          attempt?.lessonTitle ||
          "",
        lessonId: attempt?.lesson_id ?? attempt?.lessonId ?? null,
        email:
          attempt.student_email ||
          attempt.studentEmail ||
          attempt.email ||
          attempt.student?.email ||
          "",
        submittedAt:
          attempt.submitted_at ||
          attempt.submittedAt ||
          attempt.created_at ||
          "",
        userId: attempt.user_id ?? attempt.userId ?? attempt.student?.user_id,
        studentName:
          attempt.student_name || attempt.studentName || attempt.student?.name,
        section:
          attempt.section ||
          attempt.student_section ||
          attempt.student?.section,
        earnedScore: answerScore,
        gender: normalizeGender(
          attempt?.gender ||
            attempt?.studentGender ||
            attempt?.student_gender ||
            attempt?.user?.gender ||
            attempt?.student?.gender,
        ),
        id:
          attempt?.attempts_id ||
          attempt?.id ||
          attempt?.attemptId ||
          attempt?.attempt_id ||
          index,
        score: normalizeQuizScore(answerScore, rawTotal),
        passScore: normalizeQuizScore(readNumber(configuredPassScore), rawTotal)
          ?? Math.max(1, Math.ceil(rawTotal * 0.7)),
        total: rawTotal,
      };
    })
    .filter(
      (attempt) => Number.isFinite(attempt.score) || attempt.answers.length > 0,
    );
}

function moduleTitleForAttempt(attempt, modules, fallbackTitle) {
  const directTitle = String(attempt?.moduleTitle || "").trim();
  if (directTitle) return directTitle;

  const rawIndex = attempt?.moduleIndex ?? attempt?.module_index;
  const index = Number(rawIndex);
  if (
    rawIndex !== null &&
    rawIndex !== undefined &&
    rawIndex !== "" &&
    Number.isInteger(index)
  ) {
    const module = modules?.[index];
    const title = module?.title || module?.module_title || module?.moduleTitle;
    if (title) return String(title).trim();
  }

  const lessonId = attempt?.lessonId ?? attempt?.lesson_id;
  if (lessonId !== null && lessonId !== undefined) {
    const matchingModule = modules?.find((module) => {
      const moduleLessonId = module?.lesson_id ?? module?.lessonId;
      return moduleLessonId != null && String(moduleLessonId) === String(lessonId);
    });
    const title =
      matchingModule?.title ||
      matchingModule?.module_title ||
      matchingModule?.moduleTitle;
    if (title) return String(title).trim();
  }

  if (fallbackTitle && fallbackTitle !== "All Modules") return fallbackTitle;
  if (modules?.length === 1) {
    return String(
      modules[0]?.title ||
        modules[0]?.module_title ||
        modules[0]?.moduleTitle ||
        "Module unavailable",
    ).trim();
  }
  return "Module unavailable";
}

function readAttemptSelectedAnswer(answer) {
  if (answer === null || answer === undefined) return "";
  if (typeof answer !== "object") return String(answer);

  return String(
    answer.userAnswer ||
      answer.user_answer ||
      answer.selectedAnswer ||
      answer.selected_answer ||
      answer.selected ||
      answer.choice ||
      answer.response ||
      answer.value ||
      answer.answer ||
      "",
  );
}

function readAttemptCorrectness(answer, selectedAnswer, correctAnswer) {
  if (answer && typeof answer === "object") {
    const explicit =
      answer.isCorrect ??
      answer.is_correct ??
      answer.correct ??
      answer.wasCorrect ??
      answer.was_correct;

    if (explicit === true || explicit === false) return explicit;
    if (String(explicit).toLowerCase() === "true") return true;
    if (String(explicit).toLowerCase() === "false") return false;
  }

  if (!selectedAnswer || !correctAnswer) return null;

  return sameChoice(selectedAnswer, correctAnswer);
}

function getAttemptAnswerAt(attempt, item, index) {
  const answers = Array.isArray(attempt.answers) ? attempt.answers : [];

  if (Number.isInteger(item?.attemptIndex))
    return mainQuizAnswerAt(attempt, item.attemptIndex);

  if (item?.question) {
    const text = item.question.trim().toLowerCase();
    return answers.find(
      (answer) =>
        String(answer?.question || answer?.prompt || "")
          .trim()
          .toLowerCase() === text,
    );
  }
  if (answers[index]) return answers[index];

  const questionNumber = getQuestionNumber(item?.label, index);
  const questionText = String(item?.question || "")
    .trim()
    .toLowerCase();

  return answers.find((answer, answerIndex) => {
    if (!answer || typeof answer !== "object") return false;

    const answerNumber = getQuestionNumber(
      answer.questionNumber ||
        answer.question_number ||
        answer.label ||
        answer.item ||
        answer.key ||
        `Question ${answerIndex + 1}`,
      answerIndex,
    );
    const answerQuestion = String(answer.question || answer.prompt || "")
      .trim()
      .toLowerCase();

    return (
      answerNumber === questionNumber ||
      (questionText && answerQuestion === questionText)
    );
  });
}

function addAnswerCount(answerCounts, value) {
  const key = cleanChoiceText(value) || "No answer";
  answerCounts[key] = (answerCounts[key] || 0) + 1;
}

function getQuestionAttemptStats(attempts, item, index) {
  if (!Array.isArray(attempts) || attempts.length === 0) return null;

  return attempts.reduce(
    (stats, attempt) => {
      const answer = getAttemptAnswerAt(attempt, item, index);

      if (!answer) return stats;

      const selectedAnswer = readAttemptSelectedAnswer(answer);
      const isCorrect = readAttemptCorrectness(
        answer,
        selectedAnswer,
        item?.answer,
      );

      if (selectedAnswer || isCorrect !== null) {
        stats.responses += 1;
      }

      if (selectedAnswer) {
        addAnswerCount(stats.answerCounts, selectedAnswer);
      }

      if (isCorrect === true) {
        stats.totalCorrect += 1;

        if (attempt.gender === "female") stats.femaleCorrect += 1;
        if (attempt.gender === "male") stats.maleCorrect += 1;
      } else if (isCorrect === false) {
        stats.incorrect += 1;
      }

      return stats;
    },
    {
      answerCounts: {},
      femaleCorrect: 0,
      incorrect: 0,
      maleCorrect: 0,
      responses: 0,
      totalCorrect: 0,
    },
  );
}

function buildCognitiveAnalytics(rows) {
  const levelCounts = BLOOM_DISPLAY_ORDER.reduce((counts, level) => {
    counts[level] = 0;
    return counts;
  }, {});
  const skillCounts = THINKING_SKILL_ORDER.reduce((counts, skill) => {
    counts[skill] = 0;
    return counts;
  }, {});
  const skillPerformance = THINKING_SKILL_ORDER.reduce((summary, skill) => {
    summary[skill] = {
      correct: 0,
      total: 0,
    };
    return summary;
  }, {});

  rows.forEach((row) => {
    const detail = inferCognitiveLevel(row);
    const level = detail.level;
    const skill = detail.category;
    const responseTotal = getQuestionResponseTotal(row);

    levelCounts[level] = (levelCounts[level] || 0) + 1;
    skillCounts[skill] = (skillCounts[skill] || 0) + 1;

    if (!skillPerformance[skill]) {
      skillPerformance[skill] = {
        correct: 0,
        total: 0,
      };
    }

    skillPerformance[skill].correct += Number(row.totalCorrect || 0);
    skillPerformance[skill].total += responseTotal;
  });

  const questionTotal = Math.max(rows.length, 1);
  const levels = BLOOM_DISPLAY_ORDER.map((level) => ({
    count: levelCounts[level] || 0,
    label: level,
    percent: ((levelCounts[level] || 0) / questionTotal) * 100,
  }));
  const skills = THINKING_SKILL_ORDER.map((skill) => ({
    count: skillCounts[skill] || 0,
    label: skill,
    percent: ((skillCounts[skill] || 0) / questionTotal) * 100,
  }));
  const performance = THINKING_SKILL_ORDER.map((skill) => {
    const summary = skillPerformance[skill] || { correct: 0, total: 0 };

    return {
      label: skill,
      percent: summary.total ? (summary.correct / summary.total) * 100 : 0,
    };
  });

  return {
    levels,
    performance,
    skills,
  };
}

function getQuestionResponseTotal(question) {
  return Math.max(
    readNumber(
      question?.responses,
      question?.totalResponses,
      question?.total_responses,
    ) ?? 0,
    Number(question?.totalCorrect || 0) + Number(question?.incorrect || 0),
  );
}

function getOptionDisplayLabel(label) {
  return String(label || "").replace(/^Answer/i, "Option");
}

function getThinkingSkillName(category) {
  return String(category || "").toUpperCase() === "HOTS"
    ? "Higher-Order Thinking Skills"
    : "Lower-Order Thinking Skills";
}

function buildRows(items, totals, attempts = []) {
  return items.map((item, index) => {
    const rawLabel =
      item.label || item.item || item.question_number || `Q${index + 1}`;
    const label = makeQuestionLabel(rawLabel, index);
    const attemptStats = getQuestionAttemptStats(attempts, item, index);
    const totalCorrect = clamp(
      Math.round(
        attemptStats && attemptStats.responses > 0
          ? attemptStats.totalCorrect
          : 0,
      ),
      0,
      totals.totalStudents,
    );
    const femaleCorrect = clamp(
      Math.round(
        attemptStats && attemptStats.responses > 0
          ? attemptStats.femaleCorrect
          : 0,
      ),
      0,
      totals.femaleStudents,
    );
    const maleCorrect = clamp(
      Math.round(
        attemptStats && attemptStats.responses > 0
          ? attemptStats.maleCorrect
          : 0,
      ),
      0,
      totals.maleStudents,
    );
    const incorrect = clamp(
      Math.round(
        attemptStats && attemptStats.responses > 0 ? attemptStats.incorrect : 0,
      ),
      0,
      totals.totalStudents,
    );
    const percent = 0;
    const rawTopic = String(
      item.topic ||
        item.topicName ||
        item.topic_name ||
        item.topicTitle ||
        item.topic_title ||
        "",
    ).trim();
    const topic =
      !rawTopic || rawTopic.toLowerCase() === "unclassified"
        ? "General Concepts"
        : rawTopic;

    return {
      answerCounts: attemptStats?.answerCounts,
      label,
      questionNumber: getQuestionNumber(rawLabel, index),
      responses: attemptStats?.responses || 0,
      shortLabel: `Q${getQuestionNumber(rawLabel, index)}`,
      question:
        item.question ||
        item.prompt ||
        item.title ||
        `Assessment item ${index + 1}`,
      topic,
      answer:
        item.answer ||
        item.correctAnswer ||
        item.correct_answer ||
        "Answer not available",
      options: normalizeChoices(
        item.options,
        item.choices,
        item.answers,
        item.wrong_options,
        item.wrongOptions,
      ),
      cognitiveLevel:
        item.cognitiveLevel ||
        item.cognitive_level ||
        item.bloomLevel ||
        item.bloom_level ||
        item.taxonomyLevel ||
        item.taxonomy_level,
      cognitiveCategory:
        item.cognitiveCategory ||
        item.cognitive_category ||
        item.thinkingSkill ||
        item.thinking_skill ||
        item.thinkingCategory ||
        item.thinking_category ||
        item.hotsLots ||
        item.hots_lots,
      cognitiveReason:
        item.cognitiveReason ||
        item.cognitive_reason ||
        item.bloomReason ||
        item.bloom_reason ||
        item.classificationReason ||
        item.classification_reason,
      totalCorrect,
      femaleCorrect,
      maleCorrect,
      incorrect,
      percent:
        attemptStats && attemptStats.responses > 0
          ? (totalCorrect / Math.max(attemptStats.responses, 1)) * 100
          : percent,
    };
  });
}

function buildTableOfSpecifications(rows) {
  const groups = new Map();

  rows.forEach((question) => {
    const cognitive = inferCognitiveLevel(question);
    const topic = String(question.topic || "General Concepts").trim() || "General Concepts";
    const key = JSON.stringify([topic, cognitive.category, cognitive.level]);
    if (!groups.has(key)) {
      groups.set(key, {
        topic,
        skill: cognitive.category,
        level: cognitive.level,
        questions: 0,
        responses: 0,
        correct: 0,
      });
    }

    const group = groups.get(key);
    group.questions += 1;
    group.responses += getQuestionResponseTotal(question);
    group.correct += Number(question.totalCorrect || 0);
  });

  const skillOrder = { LOTS: 0, HOTS: 1 };
  const levelOrder = Object.fromEntries(BLOOM_DISPLAY_ORDER.map((level, index) => [level, index]));
  return [...groups.values()].sort(
    (left, right) =>
      left.topic.localeCompare(right.topic) ||
      (skillOrder[left.skill] ?? 2) - (skillOrder[right.skill] ?? 2) ||
      (levelOrder[left.level] ?? 99) - (levelOrder[right.level] ?? 99),
  );
}

function MainQuizTableOfSpecifications({ rows }) {
  return (
    <section className={styles.analysisSection}>
      <div className={styles.analysisSectionTitle}>
        Main Quiz Table of Specifications
      </div>
      <p>
        Assessment coverage and response accuracy grouped by topic, LOTS or HOTS,
        and cognitive level. Items without a specific topic are grouped under
        General Concepts.
      </p>
      <div className={styles.tableWrap}>
        <table>
          <thead>
            <tr>
              <th>Topic</th>
              <th>Thinking Skill</th>
              <th>Cognitive Level</th>
              <th>Questions</th>
              <th>Responses</th>
              <th>Accuracy</th>
            </tr>
          </thead>
          <tbody>
            {rows.length ? rows.map((row) => (
              <tr key={`${row.topic}:${row.skill}:${row.level}`}>
                <td>{row.topic}</td>
                <td>{row.skill}</td>
                <td>{row.level}</td>
                <td>{row.questions}</td>
                <td>{row.responses}</td>
                <td>{formatPercent(row.responses ? (row.correct / row.responses) * 100 : 0)}</td>
              </tr>
            )) : (
              <tr><td colSpan="6">TOS coverage appears when the quiz contains classified questions.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default function MainQuizAnalysis({
  courseId,
  courseTitle,
  attempts,
  students,
  passScore,
  responseView = false,
  moduleIndex = "all",
  modules = [],
  moduleTitle = "All Modules",
  onSummary,
}) {
  const [selectedQuestion, setSelectedQuestion] = useState(null);
  const [printing, setPrinting] = useState(false);
  const [studentPage, setStudentPage] = useState(0);
  useEffect(() => {
    const before = () => flushSync(() => setPrinting(true));
    const after = () => setPrinting(false);
    window.addEventListener("beforeprint", before);
    window.addEventListener("afterprint", after);
    return () => {
      window.removeEventListener("beforeprint", before);
      window.removeEventListener("afterprint", after);
    };
  }, []);

  const quizAttempts = useMemo(
    () => normalizeQuizAttempts(attempts, passScore),
    [attempts, passScore],
  );
  const studentResults = useMemo(() => {
    const studentsById = new Map(
      students.map((student) => [
        String(student.userId ?? student.user_id ?? student.id),
        student,
      ]),
    );
    return quizAttempts.map((attempt) => {
      const student = studentsById.get(String(attempt.userId));
      return {
        ...attempt,
        gender: attempt.gender || normalizeGender(student?.gender),
        email: student?.email || student?.student_email || attempt.email || "",
        name:
          student?.displayName ||
          student?.name ||
          student?.student_name ||
          attempt.studentName ||
          `Student ${attempt.userId ?? "(name unavailable)"}`,
        yearLevel:
          student?.yearLevel ||
          student?.year_level ||
          student?.student_year_level ||
          student?.year ||
          attempt.yearLevel ||
          attempt.year_level ||
          attempt.student_year_level ||
          attempt.student?.yearLevel ||
          attempt.student?.year_level ||
          "N/A",
        section:
          student?.sectionName ||
          student?.section_name ||
          student?.section ||
          student?.student_section ||
          attempt.section ||
          "N/A",
        moduleTitle: moduleTitleForAttempt(attempt, modules, moduleTitle),
      };
    });
  }, [quizAttempts, students, modules, moduleTitle]);
  const studentPageCount = Math.max(
    1,
    Math.ceil(studentResults.length / STUDENTS_PER_PAGE),
  );
  const currentStudentPage = Math.min(studentPage, studentPageCount - 1);
  const visibleStudentResults = printing
    ? studentResults
    : studentResults.slice(
        currentStudentPage * STUDENTS_PER_PAGE,
        (currentStudentPage + 1) * STUDENTS_PER_PAGE,
      );

  const examinees = new Map(
    studentResults.map((attempt) => [
      attempt.userId == null
        ? `attempt:${attempt.id}`
        : `student:${attempt.userId}`,
      attempt,
    ]),
  );
  const totals = getEnrollmentSummary([...examinees.values()]);

  // Each module has its own source-question numbering, including shuffled quizzes.
  const questionGroups = useMemo(() => {
    const groups = new Map();
    for (const attempt of studentResults) {
      const resolvedIndex = attemptModuleIndex(attempt, modules);
      const index = resolvedIndex >= 0 ? resolvedIndex : attempt.moduleIndex;
      const key =
        index != null
          ? `module:${index}`
          : `lesson:${attempt.lessonId ?? attempt.moduleTitle}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(attempt);
    }
    return groups;
  }, [studentResults, modules]);
  const rows = useMemo(
    () =>
      Array.from(questionGroups, ([key, group]) => {
        const groupTotals = getEnrollmentSummary(group);
        return buildRows(mainQuizQuestions(group), groupTotals, group).map(
          (row, index) => ({
            ...row,
            key: `${key}:${index}`,
            moduleTitle: group[0].moduleTitle,
          }),
        );
      }).flat(),
    [questionGroups],
  );
  const tableOfSpecifications = useMemo(
    () => buildTableOfSpecifications(rows),
    [rows],
  );
  const quizAnalytics = useMemo(
    () => summarizeMainQuizScores(quizAttempts),
    [quizAttempts],
  );
  const cognitiveAnalytics = useMemo(
    () => buildCognitiveAnalytics(rows),
    [rows],
  );
  const singleIndex =
    moduleIndex !== "all" ? moduleIndex : quizAttempts[0]?.moduleIndex;
  const quizTitle =
    questionGroups.size === 1 && singleIndex != null && Number(singleIndex) >= 0
      ? `Main Quiz ${Number(singleIndex) + 1}`
      : "Main Quiz";

  const selectedQuestionDetails = useMemo(() => {
    if (!selectedQuestion) return null;

    const totalResponses = getQuestionResponseTotal(selectedQuestion);

    return {
      answerDistribution: buildAnswerDistribution(selectedQuestion),
      cognitiveLevel: inferCognitiveLevel(selectedQuestion),
      title: getQuestionAnalysisTitle(selectedQuestion),
      totalResponses,
    };
  }, [selectedQuestion]);
  const selectedCorrectAnswer =
    selectedQuestionDetails?.answerDistribution.find(
      (answer) => answer.isCorrect,
    );
  const {
    scale,
    mixedTotals,
    averageScore,
    medianScore,
    highestScore,
    lowestScore,
    standardDeviation,
    passRate,
    responseTotal,
    studentsPassed,
  } = quizAnalytics;
  const scoreCards = [
    ["Mean Score", averageScore],
    ["Median", medianScore],
    ["Highest", highestScore],
    ["Lowest", lowestScore],
  ];
  const performanceCards = scoreCards.map(([label, score]) => ({
    label,
    primary: !Number.isFinite(score)
      ? "N/A"
      : mixedTotals
        ? formatPercent(score)
        : formatScore(score, scale),
    secondary:
      Number.isFinite(score) && !mixedTotals
        ? formatPercent(getScorePercent(score, scale))
        : "",
  }));
  performanceCards.push(
    {
      label: "Range",
      primary: responseTotal ? formatNumber(highestScore - lowestScore) : "N/A",
      secondary: responseTotal
        ? `${formatNumber(lowestScore)}–${formatNumber(highestScore)}${mixedTotals ? "%" : ""}`
        : "",
    },
    {
      label: "Std. Deviation",
      primary: responseTotal ? formatNumber(standardDeviation) : "N/A",
      secondary: mixedTotals ? "percentage points" : "",
    },
    {
      label: "Pass Rate",
      primary: responseTotal ? formatPercent(passRate) : "N/A",
      secondary: responseTotal ? `${studentsPassed} / ${responseTotal}` : "",
    },
  );
  const genderTotal = totals.maleStudents + totals.femaleStudents;
  const malePercent = genderTotal
    ? (totals.maleStudents / genderTotal) * 100
    : 0;
  const genderGradient = genderTotal
    ? `conic-gradient(#7fa8d6 0 ${malePercent}%, #a8c0dc ${malePercent}% 100%)`
    : "#edf1f5";
  const passedCount = Number.isFinite(quizAnalytics.studentsPassed)
    ? quizAnalytics.studentsPassed
    : 0;
  const failedCount = Number.isFinite(quizAnalytics.studentsFailed)
    ? quizAnalytics.studentsFailed
    : 0;
  const resultTotal = passedCount + failedCount;
  const passedPercent = resultTotal ? (passedCount / resultTotal) * 100 : 0;
  const skillTotal = cognitiveAnalytics.skills.reduce(
    (total, skill) => total + skill.count,
    0,
  );
  const lotsCount =
    cognitiveAnalytics.skills.find((skill) => skill.label === "LOTS")?.count ||
    0;
  const lotsPercent = skillTotal ? (lotsCount / skillTotal) * 100 : 0;
  const cognitiveGradient = skillTotal
    ? `conic-gradient(${CHART_COLORS.LOTS} 0 ${lotsPercent}%, ${CHART_COLORS.HOTS} ${lotsPercent}% 100%)`
    : "#edf1f5";

  if (!responseView && !quizAttempts.length) {
    return (
      <section className="qa-empty-report qa-print-report">
        <header className="qa-empty-report-heading">
          <span className="qa-empty-eyebrow">MAIN QUIZ ANALYSIS</span>
          <h2>{courseTitle}</h2>
          <p className="qa-empty-module">{moduleTitle}</p>
        </header>
        <div className="qa-empty-state" role="status">
          <h3>No results yet</h3>
          <p>Results will appear after students submit a Main Quiz matching these filters.</p>
        </div>
      </section>
    );
  }

  if (responseView) {
    return (
      <MainQuizResponses
        courseId={courseId}
        courseTitle={`${courseTitle} - ${moduleTitle}`}
        quizTitle={quizTitle}
        assessmentTitle={`${courseTitle} - ${String(quizTitle || "Main Quiz").replace(/\s+\d+$/, "")}`}
        attempts={studentResults}
        onBack={onSummary}
        embedded
      />
    );
  }

  return (
    <section className={`${styles.page} qa-print-report`}>
      <section className={styles.detailPanel}>
        <div className={styles.detailTop}>
          <div className={styles.detailTitle}>
            <span className={styles.detailEyebrow}>MAIN QUIZ ANALYSIS</span>
            <h2>{courseTitle}</h2>
            <p className="qa-report-module">{moduleTitle}</p>
            <strong>{quizTitle}</strong>
            <p>
              {rows.length} Questions &bull;{" "}
              {formatExamineeCount(examinees.size)}
              {questionGroups.size > 1 && ` • ${studentResults.length} submissions`}
            </p>
          </div>

          <button
            type="button"
            className="qa-print-button"
            onClick={() => window.print()}
          >
            Print
          </button>
        </div>

        <div className={styles.graphicalView}>
          <section className={styles.analysisSection}>
            <div className={styles.analysisSectionTitle}>
              Overall Quiz Analysis
            </div>
            <div className={styles.performanceGrid}>
              {performanceCards.map((card) => (
                <div className={styles.performanceCard} key={card.label}>
                  <span>{card.label}</span>
                  <strong>{card.primary}</strong>
                  {card.secondary ? <em>{card.secondary}</em> : null}
                </div>
              ))}
            </div>
          </section>
          <MainQuizTableOfSpecifications rows={tableOfSpecifications} />
          <section className={styles.analysisSection}>
            <div className={styles.analysisSectionTitle}>
              Student Scores
            </div>
            <div className={styles.studentScoreList}>
              {visibleStudentResults.map((student) => (
                <article
                  key={student.id}
                  className={styles.studentScoreRow}
                >
                  <div>
                    <strong>{student.name}</strong>
                    <span>Section: {student.section}</span>
                    {questionGroups.size > 1 && <span>{student.moduleTitle}</span>}
                  </div>
                  <div
                    className={styles.studentScoreBar}
                    role="img"
                    aria-label={`${student.name}: ${formatScoreWithPercent(student.earnedScore, student.total)}`}
                  >
                    <i
                      style={{
                        width: `${Math.max(0, Math.min(100, getScorePercent(student.earnedScore, student.total) || 0))}%`,
                      }}
                    />
                  </div>
                  <strong>
                    {formatScoreWithPercent(
                      student.earnedScore,
                      student.total,
                    )}
                  </strong>
                </article>
              ))}
            </div>
            {!printing && studentPageCount > 1 && (
              <nav
                className={styles.studentPagination}
                aria-label="Student scores pages"
              >
                <button
                  type="button"
                  disabled={currentStudentPage === 0}
                  onClick={() => setStudentPage(currentStudentPage - 1)}
                >
                  Previous
                </button>
                <span aria-live="polite">
                  Page {currentStudentPage + 1} of {studentPageCount}
                </span>
                <button
                  type="button"
                  disabled={currentStudentPage + 1 === studentPageCount}
                  onClick={() => setStudentPage(currentStudentPage + 1)}
                >
                  Next
                </button>
              </nav>
            )}
          </section>

          <section className={styles.analysisSection}>
            <div className={styles.analysisSectionTitle}>
              Student Overview
            </div>
            <div className={styles.pieGrid}>
              <article className={styles.pieCard}>
                <h3>Examinees</h3>
                <div
                  className={styles.pieGraphic}
                  style={{
                    background: genderGradient,
                  }}
                  role="img"
                  aria-label={`Male ${totals.maleStudents}, Female ${totals.femaleStudents}`}
                >
                  <span>Male / Female</span>
                </div>
                <div className={styles.pieLegend}>
                  <div>
                    <ChartLabel label="Male" />
                    <strong>{totals.maleStudents}</strong>
                  </div>
                  <div>
                    <ChartLabel label="Female" />
                    <strong>{totals.femaleStudents}</strong>
                  </div>
                </div>
              </article>

              <article className={styles.pieCard}>
                <h3>Quiz Result</h3>
                <div
                  className={styles.pieGraphic}
                  style={{
                    background: resultTotal
                      ? `conic-gradient(${CHART_COLORS.Passed} 0 ${passedPercent}%, ${CHART_COLORS.Failed} ${passedPercent}% 100%)`
                      : "#edf1f5",
                  }}
                  role="img"
                  aria-label={`Passed ${passedCount}, Failed ${failedCount}`}
                >
                  <span>Pass / Fail</span>
                </div>
                <div className={styles.pieLegend}>
                  <div>
                    <ChartLabel label="Passed" />
                    <strong>{passedCount}</strong>
                  </div>
                  <div>
                    <ChartLabel label="Failed" />
                    <strong>{failedCount}</strong>
                  </div>
                </div>
              </article>
            </div>
          </section>

          <section className={styles.analysisSection}>
            <div className={styles.analysisSectionTitle}>
              Cognitive Analysis
            </div>
            <div className={styles.pieGrid}>
              <article className={styles.pieCard}>
                <h3>HOTS / LOTS Distribution</h3>
                <div
                  className={styles.pieGraphic}
                  style={{ background: cognitiveGradient }}
                  role="img"
                  title={cognitiveAnalytics.skills
                    .map(
                      (skill) =>
                        `${skill.label}: ${skill.count} (${formatPercent(skill.percent)})`,
                    )
                    .join(", ")}
                  aria-label={cognitiveAnalytics.skills
                    .map(
                      (skill) =>
                        `${skill.label}: ${skill.count} (${formatPercent(skill.percent)})`,
                    )
                    .join(", ")}
                >
                  <span>HOTS / LOTS</span>
                </div>
                <div className={styles.pieLegend}>
                  {cognitiveAnalytics.skills.map((skill) => (
                    <div key={skill.label}>
                      <ChartLabel label={skill.label} />
                      <strong>
                        {skill.count} / {rows.length || 0}{" "}
                        {formatPercent(skill.percent)}
                      </strong>
                    </div>
                  ))}
                </div>
              </article>

              <article className={`${styles.pieCard} ${styles.levelCard}`}>
                <h3>Cognitive Levels</h3>
                <div className={styles.levelRows}>
                  {cognitiveAnalytics.levels.map((level) => (
                    <div key={level.label}>
                      <span>{level.label}</span>
                      <strong>{level.count}</strong>
                      <em>{formatPercent(level.percent)}</em>
                    </div>
                  ))}
                </div>
              </article>
            </div>
          </section>

          <section className={styles.analysisSection}>
            <div className={styles.analysisSectionTitle}>
              LOTS / HOTS Performance
            </div>
            <div className={styles.skillPerformance}>
              {cognitiveAnalytics.performance.map((skill) => (
                <div
                  className={styles.skillPerformanceRow}
                  key={skill.label}
                >
                  <span>{skill.label}</span>
                  <div className={styles.skillTrack}>
                    <i
                      style={{ width: `${Math.min(skill.percent, 100)}%` }}
                    />
                  </div>
                  <strong>{formatPercent(skill.percent)}</strong>
                </div>
              ))}
            </div>

            <div className={styles.thinkingSkillMeaning}>
              <span>
                <strong>LOTS</strong> means Lower-Order Thinking Skills.
              </span>
              <span>
                <strong>HOTS</strong> means Higher-Order Thinking Skills.
              </span>
            </div>
          </section>

          <section className={styles.analysisSection}>
            <div className={styles.analysisSectionTitle}>
              Question Analysis
            </div>
            {!rows.length && (
              <p>No Main Quiz question responses recorded yet.</p>
            )}

            <div className={styles.questionResponses}>
              {rows.map((item) => {
                const totalResponses = getQuestionResponseTotal(item);
                const correctPercent =
                  (item.totalCorrect / Math.max(totalResponses, 1)) * 100;

                return (
                  <article className={styles.responseCard} key={item.key}>
                    <header>
                      <span className={styles.questionNumber}>
                        {item.label}{questionGroups.size > 1 && ` · ${item.moduleTitle}`}
                      </span>
                      <h4>{item.question}</h4>
                      <div className={styles.questionResult}>
                        <span>
                          {item.totalCorrect} / {totalResponses} Correct
                        </span>
                        <strong>{formatPercent(correctPercent)}</strong>
                      </div>
                    </header>

                    <div
                      className={styles.questionProgress}
                      aria-label={`${formatPercent(correctPercent)} correct`}
                    >
                      <i
                        style={{
                          width: `${Math.min(correctPercent, 100)}%`,
                        }}
                      />
                    </div>
                    <button
                      type="button"
                      className={styles.questionViewButton}
                      onClick={() => setSelectedQuestion(item)}
                    >
                      View Analysis
                    </button>
                  </article>
                );
              })}
            </div>
          </section>
        </div>
      </section>

      {selectedQuestion && selectedQuestionDetails && (
        <div
          className={styles.modalOverlay}
          onClick={() => setSelectedQuestion(null)}
        >
          <div
            className={styles.modal}
            onClick={(event) => event.stopPropagation()}
          >
            <header>
              <h2>{selectedQuestionDetails.title}</h2>
              <button
                type="button"
                onClick={() => setSelectedQuestion(null)}
                aria-label="Close question analysis"
              >
                &times;
              </button>
            </header>

            <div className={styles.modalBody}>
              <section className={styles.modalQuestionBlock}>
                <span className={styles.modalSectionLabel}>Question</span>
                <p className={styles.analysisQuestion}>
                  {selectedQuestion.question}
                </p>

                <div className={styles.modalSkillGrid}>
                  <div className={styles.modalSkillCard}>
                    <span>Thinking Skill</span>
                    <strong>
                      {selectedQuestionDetails.cognitiveLevel.category}
                    </strong>
                  </div>

                  <div className={styles.modalSkillCard}>
                    <span>Cognitive Level</span>
                    <strong>
                      {selectedQuestionDetails.cognitiveLevel.level}
                    </strong>
                  </div>
                </div>

                <div className={styles.modalExplanation}>
                  <h3>
                    Why is this{" "}
                    {selectedQuestionDetails.cognitiveLevel.category}?
                  </h3>
                  <p>
                    This question is classified as{" "}
                    {getThinkingSkillName(
                      selectedQuestionDetails.cognitiveLevel.category,
                    )}{" "}
                    ({selectedQuestionDetails.cognitiveLevel.category}) because{" "}
                    {selectedQuestionDetails.cognitiveLevel.reason
                      .replace(
                        /^The question asks students to /i,
                        "students must ",
                      )
                      .replace(
                        /^The question requires students to /i,
                        "students must ",
                      )}
                  </p>
                </div>

                <div className={styles.modalExplanation}>
                  <h3>Cognitive Level Explanation</h3>
                  <p>
                    {selectedQuestionDetails.cognitiveLevel.level} requires
                    students to{" "}
                    {selectedQuestionDetails.cognitiveLevel.task
                      .charAt(0)
                      .toLowerCase() +
                      selectedQuestionDetails.cognitiveLevel.task.slice(1)}
                    .
                  </p>
                </div>
              </section>

              <section className={styles.modalResponseBlock}>
                <div className={styles.modalSectionLabel}>
                  Response Analysis
                </div>

                <div className={styles.modalResponseStats}>
                  <div>
                    <span>Correct:</span>
                    <strong>
                      {selectedQuestion.totalCorrect} /{" "}
                      {selectedQuestionDetails.totalResponses}
                    </strong>
                    <em>
                      {formatPercent(
                        (selectedQuestion.totalCorrect /
                          Math.max(selectedQuestionDetails.totalResponses, 1)) *
                          100,
                      )}
                    </em>
                  </div>

                  <div>
                    <span>Incorrect:</span>
                    <strong>
                      {selectedQuestion.incorrect} /{" "}
                      {selectedQuestionDetails.totalResponses}
                    </strong>
                    <em>
                      {formatPercent(
                        (selectedQuestion.incorrect /
                          Math.max(selectedQuestionDetails.totalResponses, 1)) *
                          100,
                      )}
                    </em>
                  </div>
                </div>

                <div className={styles.modalOptionBars}>
                  {selectedQuestionDetails.answerDistribution.map((answer) => {
                    const percent =
                      (answer.count /
                        Math.max(selectedQuestionDetails.totalResponses, 1)) *
                      100;
                    const label = getOptionDisplayLabel(answer.label);

                    return (
                      <div className={styles.modalOptionRow} key={answer.label}>
                        <span title={answer.choice}>{label}</span>
                        <div>
                          <i
                            className={
                              answer.isCorrect ? styles.correctBar : ""
                            }
                            style={{ width: `${Math.min(percent, 100)}%` }}
                          />
                        </div>
                        <strong>
                          {answer.count} ({formatPercent(percent)})
                          {answer.isCorrect
                            ? ` ${String.fromCharCode(10003)}`
                            : ""}
                        </strong>
                      </div>
                    );
                  })}
                </div>

                <p className={styles.correctAnswerLine}>
                  <span>Correct Answer:</span>{" "}
                  <strong>
                    {selectedCorrectAnswer
                      ? `${getOptionDisplayLabel(selectedCorrectAnswer.label)}${
                          selectedCorrectAnswer.choice
                            ? ` - ${selectedCorrectAnswer.choice}`
                            : ""
                        }`
                      : selectedQuestion.answer}
                  </strong>
                </p>
              </section>

              <details className={styles.bloomReference}>
                <summary>Bloom&apos;s level guide</summary>
                <div>
                  {Object.values(BLOOM_LEVELS).map((level) => (
                    <p key={level.level}>
                      <strong>
                        {level.level} ({level.category})
                      </strong>
                      <span>{level.task}</span>
                    </p>
                  ))}
                </div>
              </details>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
