"use strict";

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
  submitted: false,
  mode: "single",
  subjectCounts: {}
};

let lastQuizResult = null;

function normalizeQuizSubject(subject) {
  const aliases = {
    "زیست": "زیست‌شناسی",
    "زمین": "زمین‌شناسی"
  };

  return aliases[subject] || subject;
}

function shuffleQuizQuestions(items) {
  const result = [...items];

  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }

  return result;
}

function quizEscapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, c => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  })[c]);
}

async function fetchQuestionsFromDB(subject, count) {
  const normalized = normalizeQuizSubject(subject);

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
      exam_location
    `)
    .eq("subject", normalized)
    .eq("verification_status", "verified")
    .not("correct_answer", "is", null);

  if (error) {
    console.error(error);
    throw new Error("دریافت سؤال‌های " + normalized + " ناموفق بود.");
  }

  const valid = (data || []).filter(q =>
    q.question_text &&
    q.option_a &&
    q.option_b &&
    q.option_c &&
    q.option_d &&
    Number(q.correct_answer) >= 1 &&
    Number(q.correct_answer) <= 4
  );

  if (!valid.length) {
    throw new Error(
      "برای درس «" + normalized + "» سؤال تأییدشده‌ای موجود نیست."
    );
  }

  if (valid.length < count) {
    throw new Error(
      `برای ${normalized} فقط ${valid.length} سؤال تأییدشده موجود است؛ تعداد درخواستی ${count} است.`
    );
  }

  return shuffleQuizQuestions(valid)
    .slice(0, count)
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
      exam_session: q.exam_session,
      source: q.source || "",
      exam_location: q.exam_location || ""
    }));
}

/* ---------------------------
   ساخت آزمون تک‌درس
---------------------------- */

async function createQuizFromDatabase(subject, count, type) {
  const button = document.querySelector(
    '#quizSetupArea button[onclick="createQuiz()"]'
  );

  try {
    if (button) {
      button.disabled = true;
      button.textContent = "در حال دریافت سؤال‌ها...";
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

    initQuizSession(questions, subject, type, {
      mode: "single"
    });

  } catch (error) {
    console.error(error);
    alert(error.message || "ساخت آزمون ناموفق بود.");
  } finally {
    if (button) {
      button.disabled = false;
      button.textContent = "شروع آزمون 🚀";
    }
  }
}

/* ---------------------------
   ساخت آزمون جامع چنددرسی
---------------------------- */

async function createComprehensiveQuiz(type) {
  const subjects = [
    "زیست‌شناسی",
    "شیمی",
    "فیزیک",
    "ریاضی",
    "زمین‌شناسی"
  ];

  const ids = {
    "زیست‌شناسی": "bio",
    "شیمی": "chem",
    "فیزیک": "physics",
    "ریاضی": "math",
    "زمین‌شناسی": "earth"
  };

  const selected = subjects.map(subject => {
    const id = ids[subject];

    return {
      subject,
      count: Number(
        document.getElementById("count-" + id)?.value || 0
      ),
      enabled: !!document.getElementById(
        "include-" + id
      )?.checked
    };
  }).filter(item => item.enabled && item.count > 0);

  if (!selected.length) {
    alert("حداقل یک درس و تعداد سؤال آن را انتخاب کن.");
    return;
  }

  const button = document.getElementById(
    "createComprehensiveButton"
  );

  try {
    if (button) {
      button.disabled = true;
      button.textContent = "در حال آماده‌سازی آزمون جامع...";
    }

    const groups = await Promise.all(
      selected.map(item =>
        fetchQuestionsFromDB(item.subject, item.count)
      )
    );

    const questions = shuffleQuizQuestions(
      groups.flat()
    );

    const counts = Object.fromEntries(
      selected.map(item => [
        item.subject,
        item.count
      ])
    );

    initQuizSession(
      questions,
      "آزمون جامع",
      type,
      {
        mode: "comprehensive",
        subjectCounts: counts
      }
    );

  } catch (error) {
    console.error(error);
    alert(error.message || "ساخت آزمون جامع ناموفق بود.");
  } finally {
    if (button) {
      button.disabled = false;
      button.textContent = "شروع آزمون جامع 🚀";
    }
  }
}

/* ---------------------------
   شروع جلسه آزمون
---------------------------- */

function initQuizSession(
  questions,
  subject,
  type,
  options = {}
) {
  clearInterval(currentQuiz.timerInterval);

  currentQuiz = {
    questions,
    answers: {},
    subject,
    type,
    startTime: Date.now(),
    duration:
      type === "زمان‌دار"
        ? questions.length * QUIZ_SETTINGS.secondsPerQuestion
        : 0,
    timerInterval: null,
    submitted: false,
    mode: options.mode || "single",
    subjectCounts: options.subjectCounts || {}
  };

  const setup = document.getElementById("quizSetupArea");
  const comprehensive = document.getElementById(
    "comprehensiveSetupArea"
  );
  const area = document.getElementById("quizArea");

  if (setup) setup.style.display = "none";
  if (comprehensive) comprehensive.style.display = "none";
  if (area) area.style.display = "block";

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

  document.querySelectorAll(".page-section").forEach(page => {
    page.classList.remove("active");
  });

  document.getElementById("page-quiz")?.classList.add("active");

  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });
}

/* ---------------------------
   زمان آزمون
---------------------------- */

function getQuizElapsedTime() {
  return currentQuiz.startTime
    ? Math.floor((Date.now() - currentQuiz.startTime) / 1000)
    : 0;
}

function getQuizRemainingTime() {
  return currentQuiz.type === "زمان‌دار"
    ? Math.max(
        0,
        currentQuiz.duration - getQuizElapsedTime()
      )
    : 0;
}

function formatQuizTime(seconds) {
  return (
    String(Math.floor(seconds / 60)).padStart(2, "0") +
    ":" +
    String(seconds % 60).padStart(2, "0")
  );
}

function updateQuizTimer() {
  const element = document.getElementById("quizTimer");

  if (!element) return;

  if (currentQuiz.type === "زمان‌دار") {
    const remaining = getQuizRemainingTime();

    element.textContent =
      "⏳ زمان باقی‌مانده: " +
      formatQuizTime(remaining);

    element.style.background =
      remaining <= 60 ? "#ffe6ed" : "";

    element.style.color =
      remaining <= 60 ? "#c34b70" : "";

  } else {
    element.textContent =
      "⏱️ زمان سپری‌شده: " +
      formatQuizTime(getQuizElapsedTime());
  }
}

/* ---------------------------
   نمایش سؤال‌ها
---------------------------- */

function renderQuizUI() {
  const container = document.getElementById(
    "quizQuestions"
  );

  if (!container) return;

  let lastSubject = "";

  container.innerHTML = currentQuiz.questions
    .map((question, index) => {
      const heading =
        question.subject !== lastSubject
          ? `
            <h3 class="quiz-subject-heading">
              ${quizEscapeHTML(question.subject)}
            </h3>
          `
          : "";

      lastSubject = question.subject;

      return `
        ${heading}

        <article
          class="card quiz-question"
          id="quiz-question-${index}"
        >
          <h4>
            سؤال ${Number(index + 1).toLocaleString("fa-IR")}
          </h4>

          <p>
            ${quizEscapeHTML(question.question_text)
              .replace(/\n/g, "<br>")}
          </p>

          <div class="quiz-options">
            ${question.options.map((option, optionIndex) => `
              <label class="quiz-option">
                <input
                  type="radio"
                  name="question_${index}"
                  value="${optionIndex}"
                  onchange="selectQuizAnswer(${index},${optionIndex})"
                >

                <span>
                  ${["الف", "ب", "ج", "د"][optionIndex]}.
                  ${quizEscapeHTML(option)}
                </span>
              </label>
            `).join("")}
          </div>

          <p
            class="muted"
            id="answer-status-${index}"
          >
            هنوز پاسخی انتخاب نشده است.
          </p>
        </article>
      `;
    })
    .join("");
}

/* ---------------------------
   انتخاب پاسخ
---------------------------- */

function selectQuizAnswer(questionIndex, optionIndex) {
  if (
    currentQuiz.submitted ||
    !currentQuiz.questions[questionIndex] ||
    optionIndex < 0 ||
    optionIndex > 3
  ) {
    return;
  }

  currentQuiz.answers[questionIndex] = optionIndex;

  const status = document.getElementById(
    "answer-status-" + questionIndex
  );

  if (status) {
    status.textContent = "پاسخ انتخاب شد ✓";
    status.style.color = "#26785c";
  }
}

/* ---------------------------
   محاسبه نتیجه
---------------------------- */

function summarizeQuestions(questions, answers) {
  let correct = 0;
  let wrong = 0;
  let unanswered = 0;

  questions.forEach((question, index) => {
    const selected = answers[index];

    if (selected === undefined) {
      unanswered++;
    } else if (selected === question.answer) {
      correct++;
    } else {
      wrong++;
    }
  });

  const total = questions.length;

  const raw = total
    ? (correct / total) * 100
    : 0;

  const netScore = QUIZ_SETTINGS.negativeMarking
    ? correct - wrong / QUIZ_SETTINGS.negativeMarkingFactor
    : correct;

  const net = total
    ? (netScore / total) * 100
    : 0;

  return {
    total,
    correct,
    wrong,
    unanswered,
    percent: Number(raw.toFixed(1)),
    netPercent: Number(net.toFixed(1))
  };
}

function calculateQuizResult() {
  const overall = summarizeQuestions(
    currentQuiz.questions,
    currentQuiz.answers
  );

  const subjectResults = {};

  const subjects = [
    ...new Set(
      currentQuiz.questions.map(question => question.subject)
    )
  ];

  subjects.forEach(subject => {
    const indexed = currentQuiz.questions
      .map((question, index) => ({
        question,
        index
      }))
      .filter(item => item.question.subject === subject);

    const subsetAnswers = {};

    indexed.forEach((item, index) => {
      if (
        currentQuiz.answers[item.index] !== undefined
      ) {
        subsetAnswers[index] =
          currentQuiz.answers[item.index];
      }
    });

    subjectResults[subject] = summarizeQuestions(
      indexed.map(item => item.question),
      subsetAnswers
    );
  });

  const estimatedTraz = Math.max(
    0,
    Math.round(5000 + overall.netPercent * 20)
  );

  return {
    ...overall,
    traz: estimatedTraz,
    subjectResults
  };
}

/* ---------------------------
   ذخیره نتیجه در Supabase
---------------------------- */

async function saveDetailedExam(
  result,
  examDate,
  duration
) {
  const {
    data: userData,
    error: userError
  } = await supabaseClient.auth.getUser();

  if (userError) throw userError;

  const user = userData.user;

  if (!user) {
    throw new Error("نشست کاربری معتبر نیست.");
  }

  const examPayload = {
    user_id: user.id,

    exam_title:
      currentQuiz.mode === "comprehensive"
        ? "آزمون جامع"
        : "آزمون " + currentQuiz.subject,

    exam_date: examDate,
    total_questions: result.total,
    correct_count: result.correct,
    wrong_count: result.wrong,
    unanswered_count: result.unanswered,
    raw_percentage: result.percent,
    net_percentage: result.netPercent,
    estimated_score: result.traz,
    subject_results: result.subjectResults
  };

  const {
    data: examRow,
    error: examError
  } = await supabaseClient
    .from("exam_results")
    .insert(examPayload)
    .select("id")
    .single();

  if (examError) throw examError;

  const answerRows = currentQuiz.questions.map(
    (question, index) => ({
      exam_id: examRow.id,
      user_id: user.id,
      question_id: question.id,

      question_number:
        question.question_number ?? index + 1,

      subject: question.subject,

      selected_answer:
        currentQuiz.answers[index] === undefined
          ? null
          : currentQuiz.answers[index] + 1,

      correct_answer: question.answer + 1,

      is_correct:
        currentQuiz.answers[index] !== undefined &&
        currentQuiz.answers[index] === question.answer,

      is_unanswered:
        currentQuiz.answers[index] === undefined
    })
  );

  const {
    error: answersError
  } = await supabaseClient
    .from("exam_answers")
    .insert(answerRows);

  if (answersError) throw answersError;

  return examRow.id;
}

/* ---------------------------
   ثبت و تصحیح آزمون
---------------------------- */

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

  const duration = getQuizElapsedTime();
  const examDate = new Date().toISOString();

  currentQuiz.submitted = true;

  clearInterval(currentQuiz.timerInterval);

  const result = calculateQuizResult();

  const exam = {
    id: "exam_" + Date.now(),
    subject: currentQuiz.subject,
    type: currentQuiz.type,
    mode: currentQuiz.mode,
    ...result,
    duration,
    date: examDate,
    subjectResults: result.subjectResults
  };

  let detailedSaved = false;

  try {
    exam.supabaseId = await saveDetailedExam(
      result,
      examDate,
      duration
    );

    detailedSaved = true;

  } catch (error) {
    console.error(
      "ذخیره تفصیلی آزمون ناموفق بود:",
      error
    );
  }

  try {
    if (
      typeof EXAMS !== "undefined" &&
      Array.isArray(EXAMS)
    ) {
      EXAMS.push(exam);

      const legacySaved = await DB.set(
        "exams",
        EXAMS
      );

      if (legacySaved === false) {
        console.warn(
          "ذخیره سابقه در student_data ناموفق بود."
        );
      }
    }

  } catch (error) {
    console.error(
      "ذخیره سابقه آزمون ناموفق بود:",
      error
    );
  }

  lastQuizResult = {
    ...result,
    exam,

    questions: currentQuiz.questions.map(
      (question, index) => ({
        ...question,
        selected:
          currentQuiz.answers[index] ?? null
      })
    )
  };

  showQuizResult(result);

  if (typeof updateDashboard === "function") {
    updateDashboard();
  }

  if (typeof renderExams === "function") {
    renderExams();
  }

  renderDetailedResult(result, detailedSaved);

  if (typeof showPage === "function") {
    showPage("exam-result");
  }

  if (autoSubmitted) {
    alert(
      "زمان آزمون تمام شد و پاسخ‌ها ثبت شدند."
    );
  }
}

/* ---------------------------
   نمایش نتیجه کلی
---------------------------- */

function showQuizResult(result) {
  const values = {
    "res-subject": currentQuiz.subject,
    "res-total": result.total,
    "res-correct": result.correct,
    "res-wrong": result.wrong,
    "res-traz": result.traz,
    "res-percent-text": result.percent + "٪"
  };

  Object.entries(values).forEach(([id, value]) => {
    const element = document.getElementById(id);

    if (element) {
      element.textContent = String(value);
    }
  });

  const circle = document.getElementById(
    "res-percent-circle"
  );

  if (circle) {
    circle.style.background =
      `conic-gradient(
        var(--primary)
        ${Math.max(0, Math.min(100, result.percent))}%,
        #eee 0
      )`;
  }
}

/* ---------------------------
   نمایش تحلیل تفصیلی
---------------------------- */

function renderDetailedResult(result, saved) {
  const target = document.getElementById(
    "res-detailed"
  );

  if (!target) return;

  target.innerHTML = `
    <div class="stats-grid">

      <div class="stat-card">
        <span>درصد خالص</span>
        <strong>${result.netPercent}٪</strong>
      </div>

      <div class="stat-card">
        <span>نزده</span>
        <strong>${result.unanswered}</strong>
      </div>

      <div class="stat-card">
        <span>زمان آزمون</span>
        <strong>
          ${formatQuizTime(lastQuizResult.exam.duration)}
        </strong>
      </div>

    </div>

    <h3>نتیجه هر درس</h3>

    ${Object.entries(result.subjectResults)
      .map(([subject, item]) => `
        <div class="list-item">
          <strong>${quizEscapeHTML(subject)}</strong>

          <span>
            ${item.percent}٪ خام ·
            ${item.netPercent}٪ خالص ·
            ${item.correct} صحیح ·
            ${item.wrong} غلط ·
            ${item.unanswered} نزده
          </span>
        </div>
      `)
      .join("")}

    <p class="muted">
      ${
        saved
          ? "نتیجه و پاسخ‌ها در فضای ابری ذخیره شدند."
          : "ذخیره تفصیلی ابری انجام نشد؛ اتصال و سیاست‌های دسترسی Supabase را بررسی کن."
      }
    </p>

    <div class="field">
      <label>خروجی آزمون</label>

      <button
        class="btn"
        onclick="printQuestionBooklet()"
      >
        چاپ دفترچه سؤال / ذخیره PDF
      </button>

      <button
        class="btn btn-secondary"
        onclick="printAnswerSheet()"
      >
        چاپ پاسخ‌برگ / ذخیره PDF
      </button>
    </div>
  `;
}

/* ---------------------------
   نام داوطلب
---------------------------- */

function getStudentDisplayName() {
  const first =
    document.getElementById("profileFirstName")
      ?.value?.trim() || "";

  const last =
    document.getElementById("profileLastName")
      ?.value?.trim() || "";

  return (
    first + " " + last
  ).trim() || "داوطلب کنکور";
}

/* ---------------------------
   ساخت صفحه چاپ
---------------------------- */

function printDocument(title, body) {
  const win = window.open("", "_blank");

  if (!win) {
    alert(
      "برای ساخت PDF، اجازه بازشدن پنجره جدید را فعال کن."
    );
    return;
  }

  const logo = new URL(
    "logo.png",
    window.location.href
  ).href;

  win.document.write(`
    <!DOCTYPE html>
    <html lang="fa" dir="rtl">

    <head>
      <meta charset="UTF-8">

      <title>${quizEscapeHTML(title)}</title>

      <link
        href="https://fonts.googleapis.com/css2?family=Vazirmatn:wght@400;600;700;800&display=swap"
        rel="stylesheet"
      >

      <style>
        @page {
          size: A4;
          margin: 15mm;
        }

        * {
          box-sizing: border-box;
        }

        body {
          font-family: Vazirmatn, sans-serif;
          color: #28243a;
          margin: 0;
        }

        header {
          display: flex;
          align-items: center;
          gap: 14px;
          border-bottom: 2px solid #8061ce;
          padding-bottom: 12px;
          margin-bottom: 18px;
        }

        header img {
          width: 65px;
          height: 65px;
          object-fit: contain;
        }

        h1 {
          font-size: 20px;
          color: #6845b5;
          margin: 0;
        }

        h2 {
          font-size: 16px;
        }

        .meta {
          font-size: 12px;
          color: #666;
          margin-top: 5px;
        }

        .q {
          page-break-inside: avoid;
          border: 1px solid #ddd;
          border-radius: 9px;
          padding: 12px;
          margin: 10px 0;
        }

        .option {
          padding: 5px 8px;
          font-size: 13px;
        }

        .bubble {
          display: inline-block;
          border: 1.5px solid #333;
          border-radius: 50%;
          width: 19px;
          height: 19px;
          text-align: center;
          line-height: 17px;
          margin: 0 5px;
        }

        .answer-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          border-bottom: 1px solid #ddd;
          padding: 10px 2px;
          page-break-inside: avoid;
        }

        @media print {
          button {
            display: none;
          }
        }
      </style>
    </head>

    <body>

      <header>
        <img src="${logo}" alt="لوگو">

        <div>
          <h1>
            کنکوریار | ${quizEscapeHTML(title)}
          </h1>

          <div class="meta">
            نام: ${quizEscapeHTML(getStudentDisplayName())}
            ·
            تاریخ: ${new Date().toLocaleDateString("fa-IR")}
          </div>
        </div>
      </header>

      ${body}

      <script>
        window.onload = () => {
          setTimeout(() => window.print(), 500);
        };
      <\/script>

    </body>
    </html>
  `);

  win.document.close();
}

/* ---------------------------
   چاپ دفترچه سؤال
---------------------------- */

function printQuestionBooklet() {
  if (!lastQuizResult) return;

  const body = lastQuizResult.questions
    .map((question, index) => `
      <section class="q">

        <strong>
          ${index + 1}.
          ${quizEscapeHTML(question.subject)}
        </strong>

        <p>
          ${quizEscapeHTML(question.question_text)
            .replace(/\n/g, "<br>")}
        </p>

        ${question.options.map((option, optionIndex) => `
          <div class="option">
            ${["الف", "ب", "ج", "د"][optionIndex]})
            ${quizEscapeHTML(option)}
          </div>
        `).join("")}

      </section>
    `)
    .join("");

  printDocument(
    "دفترچه سؤالات",
    body
  );
}

/* ---------------------------
   چاپ پاسخ‌برگ
---------------------------- */

function printAnswerSheet() {
  if (!lastQuizResult) return;

  const body = `
    <h2>پاسخ‌برگ آزمون</h2>

    ${lastQuizResult.questions
      .map((question, index) => `
        <div class="answer-row">

          <strong>
            ${index + 1}.
            ${quizEscapeHTML(question.subject)}
          </strong>

          <span>
            ${["الف", "ب", "ج", "د"]
              .map(option => `
                <span class="bubble">
                  ${option}
                </span>
              `)
              .join("")}
          </span>

        </div>
      `)
      .join("")}

    <p class="meta">
      پاسخ صحیح در این پاسخ‌برگ درج نشده است.
    </p>
  `;

  printDocument(
    "پاسخ‌برگ",
    body
  );
}

/* ---------------------------
   خروج از آزمون
---------------------------- */

function exitQuiz() {
  if (
    !currentQuiz.submitted &&
    !confirm(
      "با خروج از آزمون، پاسخ‌ها ثبت نمی‌شوند. ادامه می‌دهی؟"
    )
  ) {
    return;
  }

  clearInterval(currentQuiz.timerInterval);

  currentQuiz = {
    questions: [],
    answers: {},
    subject: "",
    type: "بدون زمان",
    startTime: null,
    duration: 0,
    timerInterval: null,
    submitted: true,
    mode: "single",
    subjectCounts: {}
  };

  document.getElementById(
    "quizSetupArea"
  )?.style.setProperty("display", "block");

  document.getElementById(
    "comprehensiveSetupArea"
  )?.style.setProperty("display", "block");

  document.getElementById(
    "quizArea"
  )?.style.setProperty("display", "none");

  const questions = document.getElementById(
    "quizQuestions"
  );

  if (questions) {
    questions.innerHTML = "";
  }

  if (typeof showPage === "function") {
    showPage("quiz");
  }
}
