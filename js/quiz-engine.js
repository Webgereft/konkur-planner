
"use strict";

/* =====================================
   تنظیمات موتور آزمون
===================================== */

const QUIZ_SETTINGS = {
  secondsPerQuestion: 90,
  negativeMarking: true,
  negativeMarkingFactor: 3
};

let currentQuiz = {
  questions: [],
  answers: {},
  subject: "",
  type: "بدون زمان",
  startTime: null,
  duration: 0,
  timerInterval: null,
  submitted: false
};

/* =====================================
   ابزارهای کمکی
===================================== */

function normalizeQuizSubject(subject) {
  const aliases = {
    "زیست": "زیست‌شناسی",
    "زمین": "زمین‌شناسی"
  };

  return aliases[subject] || subject;
}

function shuffleQuizQuestions(questions) {
  const result = [...questions];

  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }

  return result;
}

function quizEscapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  })[char]);
}

/* =====================================
   دریافت سؤال از Supabase
===================================== */

async function fetchQuestionsFromDB(subject, count) {
  const normalizedSubject = normalizeQuizSubject(subject);

  const { data, error } = await supabaseClient
    .from("questions_bank")
    .select(`
      id,
      subject,
      exam_year,
      exam_session,
      question_number,
      question_text,
      option_a,
      option_b,
      option_c,
      option_d,
      correct_answer,
      explanation,
      source,
      exam_location,
      verification_status
    `)
    .eq("subject", normalizedSubject)
    .eq("verification_status", "verified")
    .not("correct_answer", "is", null);

  if (error) {
    console.error("خطا در دریافت سؤال‌ها:", error);
    throw new Error("دریافت سؤال‌ها از بانک اطلاعاتی ناموفق بود.");
  }

  if (!data || data.length === 0) {
    throw new Error(
      "برای این درس سؤال تأییدشده‌ای پیدا نشد. ابتدا سؤال‌ها را در بانک سؤال تأیید کن."
    );
  }

  const validQuestions = data.filter(q => {
    const answer = Number(q.correct_answer);

    return (
      q.question_text &&
      q.option_a &&
      q.option_b &&
      q.option_c &&
      q.option_d &&
      answer >= 1 &&
      answer <= 4
    );
  });

  if (!validQuestions.length) {
    throw new Error("سؤال معتبر و دارای پاسخ صحیح در بانک پیدا نشد.");
  }

  return shuffleQuizQuestions(validQuestions)
    .slice(0, Math.min(count, validQuestions.length))
    .map(q => ({
      id: q.id,
      subject: q.subject,
      question_number: q.question_number,
      question_text: q.question_text,
      options: [
        q.option_a,
        q.option_b,
        q.option_c,
        q.option_d
      ],
      answer: Number(q.correct_answer) - 1,
      explanation: q.explanation || "",
      exam_year: q.exam_year,
      exam_session: q.exam_session
    }));
}

/* =====================================
   ساخت آزمون
===================================== */

async function createQuizFromDatabase(subject, count, type) {
  const startButton = document.querySelector(
    '#quizSetupArea button[onclick="createQuiz()"]'
  );

  try {
    if (startButton) {
      startButton.disabled = true;
      startButton.textContent = "در حال دریافت سؤال‌ها...";
    }

    if (!Number.isInteger(Number(count)) || Number(count) < 1) {
      throw new Error("تعداد سؤال معتبر نیست.");
    }

    if (!["زمان‌دار", "بدون زمان"].includes(type)) {
      throw new Error("نوع آزمون معتبر نیست.");
    }

    const questions = await fetchQuestionsFromDB(
      subject,
      Number(count)
    );

    if (!questions.length) {
      throw new Error("سؤالی برای این آزمون پیدا نشد.");
    }

    initQuizSession(questions, subject, type);

  } catch (error) {
    console.error(error);
    alert(error.message || "ساخت آزمون با خطا مواجه شد.");

  } finally {
    if (startButton) {
      startButton.disabled = false;
      startButton.textContent = "شروع آزمون 🚀";
    }
  }
}

/* =====================================
   شروع جلسه آزمون
===================================== */

function initQuizSession(questions, subject, type) {
  clearInterval(currentQuiz.timerInterval);

  currentQuiz = {
    questions,
    answers: {},
    subject,
    type,
    startTime: Date.now(),
    duration: type === "زمان‌دار"
      ? questions.length * QUIZ_SETTINGS.secondsPerQuestion
      : 0,
    timerInterval: null,
    submitted: false
  };

  const setupArea = document.getElementById("quizSetupArea");
  const quizArea = document.getElementById("quizArea");

  if (setupArea) setupArea.style.display = "none";
  if (quizArea) quizArea.style.display = "block";

  renderQuizUI();
  updateQuizTimer();

  currentQuiz.timerInterval = setInterval(() => {
    if (currentQuiz.submitted) return;

    updateQuizTimer();

    if (
      currentQuiz.type === "زمان‌دار" &&
      getQuizRemainingTime() <= 0
    ) {
      submitQuiz(true);
    }
  }, 1000);

  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });
}

/* =====================================
   محاسبه زمان
===================================== */

function getQuizElapsedTime() {
  if (!currentQuiz.startTime) return 0;

  return Math.floor(
    (Date.now() - currentQuiz.startTime) / 1000
  );
}

function getQuizRemainingTime() {
  if (currentQuiz.type !== "زمان‌دار") return 0;

  return Math.max(
    0,
    currentQuiz.duration - getQuizElapsedTime()
  );
}

function formatQuizTime(seconds) {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;

  return (
    String(minutes).padStart(2, "0") +
    ":" +
    String(remainingSeconds).padStart(2, "0")
  );
}

function updateQuizTimer() {
  const timer = document.getElementById("quizTimer");

  if (!timer) return;

  if (currentQuiz.type === "زمان‌دار") {
    const remaining = getQuizRemainingTime();

    timer.textContent =
      "⏳ زمان باقی‌مانده: " + formatQuizTime(remaining);

    if (remaining <= 60) {
      timer.style.background = "#ffe6ed";
      timer.style.color = "#c34b70";
    } else {
      timer.style.background = "";
      timer.style.color = "";
    }

  } else {
    timer.textContent =
      "⏱️ زمان سپری‌شده: " +
      formatQuizTime(getQuizElapsedTime());

    timer.style.background = "";
    timer.style.color = "";
  }
}

/* =====================================
   نمایش سؤال‌ها
===================================== */

function renderQuizUI() {
  const container = document.getElementById("quizQuestions");

  if (!container) return;

  container.innerHTML = currentQuiz.questions
    .map((question, index) => `
      <div
        class="card quiz-question"
        id="quiz-question-${index}"
      >
        <h4>
          سؤال ${Number(index + 1).toLocaleString("fa-IR")}
        </h4>

        <p>${quizEscapeHTML(question.question_text)}</p>

        <div class="quiz-options">
          ${question.options.map((option, optionIndex) => `
            <label class="quiz-option">
              <input
                type="radio"
                name="question_${index}"
                value="${optionIndex}"
                onchange="selectQuizAnswer(${index}, ${optionIndex})"
              >

              <span>
                ${["الف", "ب", "ج", "د"][optionIndex]}.
                ${quizEscapeHTML(option)}
              </span>
            </label>
          `).join("")}
        </div>

        <p class="muted" id="answer-status-${index}">
          هنوز پاسخی انتخاب نشده است.
        </p>
      </div>
    `)
    .join("");
}

/* =====================================
   ثبت پاسخ کاربر
===================================== */

function selectQuizAnswer(questionIndex, optionIndex) {
  if (currentQuiz.submitted) return;

  if (
    questionIndex < 0 ||
    questionIndex >= currentQuiz.questions.length
  ) {
    return;
  }

  if (optionIndex < 0 || optionIndex > 3) return;

  currentQuiz.answers[questionIndex] = optionIndex;

  const status = document.getElementById(
    "answer-status-" + questionIndex
  );

  if (status) {
    status.textContent = "پاسخ انتخاب شد ✓";
    status.style.color = "#26785c";
  }
}

/* =====================================
   محاسبه نتیجه آزمون
===================================== */

function calculateQuizResult() {
  const questions = currentQuiz.questions;

  let correct = 0;
  let wrong = 0;
  let unanswered = 0;

  questions.forEach((question, index) => {
    const selected = currentQuiz.answers[index];

    if (selected === undefined) {
      unanswered++;
    } else if (selected === question.answer) {
      correct++;
    } else {
      wrong++;
    }
  });

  const total = questions.length;

  const rawPercent = total
    ? (correct / total) * 100
    : 0;

  const netScore = QUIZ_SETTINGS.negativeMarking
    ? correct - wrong / QUIZ_SETTINGS.negativeMarkingFactor
    : correct;

  const netPercent = total
    ? (netScore / total) * 100
    : 0;

  const estimatedTraz = Math.max(
    0,
    Math.round(5000 + netPercent * 20)
  );

  return {
    total,
    correct,
    wrong,
    unanswered,
    percent: Number(rawPercent.toFixed(1)),
    netPercent: Number(netPercent.toFixed(1)),
    traz: estimatedTraz
  };
}

/* =====================================
   ثبت نهایی آزمون
===================================== */

async function submitQuiz(autoSubmitted = false) {
  if (
    currentQuiz.submitted ||
    !currentQuiz.questions.length
  ) {
    return;
  }

  if (
    !autoSubmitted &&
    !confirm("آیا از ثبت و تصحیح آزمون مطمئنی؟")
  ) {
    return;
  }

  currentQuiz.submitted = true;
  clearInterval(currentQuiz.timerInterval);

  const result = calculateQuizResult();

  const exam = {
    id: "exam_" + Date.now(),
    subject: currentQuiz.subject,
    type: currentQuiz.type,
    ...result,
    duration: getQuizElapsedTime(),
    date: new Date().toISOString()
  };

  try {
    if (typeof EXAMS !== "undefined" && Array.isArray(EXAMS)) {
      EXAMS.push(exam);
      await DB.set("exams", EXAMS);
    }

  } catch (error) {
    console.error("خطا در ذخیره نتیجه آزمون:", error);
    alert("نتیجه محاسبه شد، اما ذخیره آن در فضای ابری با مشکل مواجه شد.");
  }

  showQuizResult(result);

  if (typeof updateDashboard === "function") {
    updateDashboard();
  }

  if (typeof renderExams === "function") {
    renderExams();
  }

  if (typeof showPage === "function") {
    showPage("exam-result");
  }

  if (autoSubmitted) {
    alert("زمان آزمون تمام شد و پاسخ‌ها به‌صورت خودکار ثبت شدند.");
  }

  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });
}

/* =====================================
   نمایش نتیجه در صفحه
===================================== */

function showQuizResult(result) {
  const values = {
    "res-subject": currentQuiz.subject,
    "res-total": result.total,
    "res-correct": result.correct,
    "res-wrong": result.wrong,
    "res-traz": result.traz,
    "res-percent-text": result.percent + "%"
  };

  Object.entries(values).forEach(([id, value]) => {
    const element = document.getElementById(id);

    if (element) {
      element.textContent = String(value);
    }
  });

  const circle = document.getElementById("res-percent-circle");

  if (circle) {
    circle.style.setProperty("--percent", result.percent);
    circle.style.background =
      `conic-gradient(var(--primary) ${result.percent}%, #eee ${result.percent}% 100%)`;
  }
}

/* =====================================
   خروج از آزمون
===================================== */

function exitQuiz() {
  if (
    !currentQuiz.submitted &&
    !confirm("با خروج از آزمون، پاسخ‌ها ثبت نمی‌شوند. ادامه می‌دهی؟")
  ) {
    return;
  }

  clearInterval(currentQuiz.timerInterval);

  currentQuiz.submitted = true;

  const setupArea = document.getElementById("quizSetupArea");
  const quizArea = document.getElementById("quizArea");

  if (setupArea) setupArea.style.display = "block";
  if (quizArea) quizArea.style.display = "none";

  const questions = document.getElementById("quizQuestions");

  if (questions) questions.innerHTML = "";

  currentQuiz.questions = [];
  currentQuiz.answers = {};

  if (typeof showPage === "function") {
    showPage("quiz");
  }
}
