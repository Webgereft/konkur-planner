
"use strict";

/*
 * موتور آزمون کنکوریار
 * دریافت سؤال‌ها از Supabase
 * پاسخ صحیح در دیتابیس: 1 تا 4
 * پاسخ صحیح در موتور آزمون: 0 تا 3
 */

let currentQuiz = {
  questions: [],
  answers: [],
  startTime: null,
  timerInterval: null,
  subject: "",
  type: "آموزشی",
  duration: 0
};

// تبدیل نام درس‌ها به نام استاندارد دیتابیس
function normalizeQuizSubject(subject) {
  const aliases = {
    "زیست": "زیست‌شناسی",
    "زیست شناسی": "زیست‌شناسی"
  };

  return aliases[subject] || subject;
}

// انتخاب تصادفی سؤال‌ها بدون تکرار
function shuffleQuestions(items) {
  const result = [...items];

  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }

  return result;
}

// جلوگیری از ورود متن سؤال به HTML به شکل کد
function escapeQuizHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  })[char]);
}

// دریافت سؤال‌های معتبر از Supabase
async function fetchQuestionsFromDB(subject, count) {
  if (typeof supabaseClient === "undefined") {
    throw new Error("اتصال Supabase برقرار نیست.");
  }

  const normalizedSubject = normalizeQuizSubject(subject);

  const { data, error } = await supabaseClient
    .from("questions_bank")
    .select(`
      id,
      subject,
      question_number,
      question_text,
      option_a,
      option_b,
      option_c,
      option_d,
      correct_answer,
      explanation,
      exam_year,
      exam_session,
      exam_location,
      verification_status
    `)
    .eq("subject", normalizedSubject)
    .eq("verification_status", "verified")
    .not("correct_answer", "is", null);

  if (error) {
    console.error("خطای دریافت سؤال‌ها:", error);
    throw new Error("دریافت سؤال‌ها ناموفق بود: " + error.message);
  }

  const questions = (data || [])
    .map(row => {
      const options = [
        row.option_a,
        row.option_b,
        row.option_c,
        row.option_d
      ];

      const answer = Number(row.correct_answer) - 1;

      if (
        !row.question_text ||
        options.some(option => !option) ||
        !Number.isInteger(answer) ||
        answer < 0 ||
        answer > 3
      ) {
        return null;
      }

      return {
        id: row.id,
        q: row.question_text,
        options,
        answer,
        explanation: row.explanation || "",
        subject: row.subject,
        year: row.exam_year,
        session: row.exam_session,
        number: row.question_number,
        location: row.exam_location
      };
    })
    .filter(Boolean);

  return shuffleQuestions(questions).slice(
    0,
    Math.max(1, Number(count) || 10)
  );
}

// ساخت آزمون از بانک سؤال
async function startComprehensiveQuiz(subject, count) {
  await createQuizFromDatabase(subject, count, "آموزشی");
}

// ساخت آزمون انتخابی
async function startCustomQuiz(subject, grade, chapters, count) {
  /*
   * در نسخه فعلی جدول questions_bank ستون‌های grade و chapter ندارد.
   * بنابراین فعلاً آزمون انتخابی از کل بانک همان درس ساخته می‌شود.
   * بعد از افزودن ستون‌ها، فیلتر فصل و پایه را فعال می‌کنیم.
   */
  await createQuizFromDatabase(subject, count, "آموزشی");
}

// ساخت و شروع آزمون
async function createQuizFromDatabase(subject, count, type) {
  const button = document.querySelector(
    'button[onclick="createQuiz()"]'
  );

  try {
    if (button) {
      button.disabled = true;
      button.innerText = "در حال دریافت سؤال‌ها...";
    }

    const questions = await fetchQuestionsFromDB(
      subject,
      count
    );

    if (!questions.length) {
      alert(
        "سؤال تأییدشده‌ای برای این درس پیدا نشد.\n\n" +
        "ابتدا سؤال‌ها را در جدول questions_bank بررسی و " +
        "verification_status آن‌ها را به verified تغییر بده."
      );
      return;
    }

    initQuizSession(
      questions,
      normalizeQuizSubject(subject),
      type
    );

  } catch (error) {
    console.error(error);
    alert(error.message || "خطا در ساخت آزمون.");

  } finally {
    if (button) {
      button.disabled = false;
      button.innerText = "ساخت آزمون";
    }
  }
}

// راه‌اندازی جلسه آزمون
function initQuizSession(questions, title, type = "آموزشی") {
  if (currentQuiz.timerInterval) {
    clearInterval(currentQuiz.timerInterval);
  }

  currentQuiz = {
    questions,
    answers: new Array(questions.length).fill(null),
    startTime: Date.now(),
    timerInterval: null,
    subject: title,
    type,
    duration: type === "زمان‌دار"
      ? questions.length * 90
      : 0
  };

  const setup = document.getElementById("quizSetupArea");
  const area = document.getElementById("quizArea");

  if (setup) setup.style.display = "none";
  if (area) area.style.display = "block";

  renderQuizUI();
  updateQuizTimer();

  currentQuiz.timerInterval = setInterval(() => {
    updateQuizTimer();

    if (
      currentQuiz.type === "زمان‌دار" &&
      getRemainingTime() <= 0
    ) {
      submitQuiz();
    }
  }, 1000);
}

// زمان باقی‌مانده آزمون
function getRemainingTime() {
  if (currentQuiz.type !== "زمان‌دار") return 0;

  const elapsed = Math.floor(
    (Date.now() - currentQuiz.startTime) / 1000
  );

  return Math.max(0, currentQuiz.duration - elapsed);
}

// نمایش زمان
function updateQuizTimer() {
  const timer = document.getElementById("quizTimer");
  if (!timer) return;

  if (currentQuiz.type === "زمان‌دار") {
    const remaining = getRemainingTime();
    const minutes = Math.floor(remaining / 60);
    const seconds = remaining % 60;

    timer.innerText =
      `زمان باقی‌مانده: ${String(minutes).padStart(2, "0")}:` +
      `${String(seconds).padStart(2, "0")}`;

  } else {
    const elapsed = Math.floor(
      (Date.now() - currentQuiz.startTime) / 1000
    );

    const minutes = Math.floor(elapsed / 60);
    const seconds = elapsed % 60;

    timer.innerText =
      `زمان سپری‌شده: ${String(minutes).padStart(2, "0")}:` +
      `${String(seconds).padStart(2, "0")}`;
  }
}

// نمایش سؤال‌ها
function renderQuizUI() {
  const container = document.getElementById("quizQuestions");
  if (!container) return;

  container.innerHTML = currentQuiz.questions
    .map((question, index) => {
      const optionsHTML = question.options
        .map((option, optionIndex) => {
          const checked =
            currentQuiz.answers[index] === optionIndex;

          return `
            <label class="option-label">
              <input
                type="radio"
                name="question_${index}"
                value="${optionIndex}"
                ${checked ? "checked" : ""}
                onchange="selectQuizAnswer(${index}, ${optionIndex})"
              >
              <span>
                ${escapeQuizHTML(option)}
              </span>
            </label>
          `;
        })
        .join("");

      return `
        <div class="question-card">
          <h4>
            سؤال ${index + 1}
          </h4>

          <div class="question-text">
            ${escapeQuizHTML(question.q)}
          </div>

          <div class="question-options">
            ${optionsHTML}
          </div>
        </div>
      `;
    })
    .join("");
}

// ثبت پاسخ داوطلب
function selectQuizAnswer(questionIndex, optionIndex) {
  if (!currentQuiz.questions[questionIndex]) return;

  currentQuiz.answers[questionIndex] = optionIndex;
}

// ثبت و تصحیح آزمون
async function submitQuiz() {
  if (!currentQuiz.questions.length) return;

  if (currentQuiz.timerInterval) {
    clearInterval(currentQuiz.timerInterval);
    currentQuiz.timerInterval = null;
  }

  const questions = currentQuiz.questions;

  let correct = 0;
  let wrong = 0;
  let unanswered = 0;

  questions.forEach((question, index) => {
    const answer = currentQuiz.answers[index];

    if (answer === null || answer === undefined) {
      unanswered++;
    } else if (answer === question.answer) {
      correct++;
    } else {
      wrong++;
    }
  });

  const total = questions.length;
  const answered = correct + wrong;

  // درصد پاسخ صحیح از کل سؤال‌ها
  const percent = total
    ? Math.round((correct / total) * 100)
    : 0;

  // درصد پاسخ صحیح با نمره منفی استاندارد چهارگزینه‌ای
  const netPercent = total
    ? Math.round(
        ((correct - wrong / 3) / total) * 10000
      ) / 100
    : 0;

  const elapsedSeconds = Math.floor(
    (Date.now() - currentQuiz.startTime) / 1000
  );

  // تراز صرفاً تخمینی است و تراز رسمی محسوب نمی‌شود
  const estimatedTraz = Math.max(
    0,
    Math.round(5000 + netPercent * 20)
  );

  const exam = {
    id: "exam_" + Date.now(),
    subject: currentQuiz.subject,
    type: currentQuiz.type,
    date: new Date().toISOString(),
    total,
    correct,
    wrong,
    unanswered,
    answered,
    percent,
    netPercent,
    traz: estimatedTraz,
    durationSeconds: elapsedSeconds
  };

  // ذخیره نتیجه
  if (typeof EXAMS !== "undefined") {
    EXAMS.push(exam);

    if (typeof DB !== "undefined") {
      await DB.set("exams", EXAMS);
    }
  }

  // نمایش نتیجه
  const setText = (id, value) => {
    const element = document.getElementById(id);
    if (element) element.innerText = value;
  };

  setText("res-subject", exam.subject);
  setText("res-total", total);
  setText("res-correct", correct);
  setText("res-wrong", wrong);
  setText("res-traz", estimatedTraz);
  setText("res-percent-text", percent + "%");

  const circle = document.getElementById("res-percent-circle");

  if (circle) {
    circle.style.borderColor =
      percent >= 70
        ? "#10b981"
        : percent >= 40
          ? "#f59e0b"
          : "#f43f5e";

    circle.style.color = circle.style.borderColor;
  }

  // نمایش تعداد نزده‌ها در صورت وجود عنصر
  setText("res-unanswered", unanswered);

  // نمایش درصد نمره منفی‌دار در صورت وجود عنصر
  setText("res-net-percent", netPercent + "%");

  if (typeof showPage === "function") {
    showPage("exam-result");
  }

  return exam;
}

// بازگشت به صفحه انتخاب آزمون
function exitQuiz() {
  if (currentQuiz.timerInterval) {
    clearInterval(currentQuiz.timerInterval);
    currentQuiz.timerInterval = null;
  }

  const area = document.getElementById("quizArea");
  const setup = document.getElementById("quizSetupArea");

  if (area) area.style.display = "none";
  if (setup) setup.style.display = "block";
}
