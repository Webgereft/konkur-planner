
"use strict";

/* =========================================
   KONKORYAR - Main Application
========================================= */

let CONFIG = null;
let PLAN = [];
let EXAMS = [];
let MISTAKES = [];

let appReady = false;

const $ = id => document.getElementById(id);

const faNumber = value =>
  Number(value || 0).toLocaleString("fa-IR");

function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  })[char]);
}

/* =========================================
   INITIALIZATION
========================================= */

async function init() {
  try {
    if (typeof DB === "undefined") {
      throw new Error("فایل storage.js بارگذاری نشده است.");
    }

    const results = await Promise.all([
      DB.get("config", null),
      DB.get("plan", []),
      DB.get("exams", []),
      DB.get("mistakes", [])
    ]);

    CONFIG = results[0];
    PLAN = Array.isArray(results[1]) ? results[1] : [];
    EXAMS = Array.isArray(results[2]) ? results[2] : [];
    MISTAKES = Array.isArray(results[3]) ? results[3] : [];

    appReady = true;

    if (CONFIG) {
      showPage("dashboard");
    } else {
      showPage("setup");
    }

    updateDashboard();
    renderPlan();
    renderExams();
    renderMistakes();

  } catch (error) {
    console.error("Initialization error:", error);
    alert("خطا در راه‌اندازی سایت: " + error.message);
  }
}

/* =========================================
   PAGE NAVIGATION
========================================= */

function showPage(name, button = null) {
  document.querySelectorAll(".page-section").forEach(page => {
    page.classList.remove("active");
  });

  const target = $("page-" + name);

  if (target) {
    target.classList.add("active");
  }

  document.querySelectorAll("nav button").forEach(btn => {
    btn.classList.remove("active");
  });

  if (button) {
    button.classList.add("active");
  } else {
    const navButton = document.querySelector(
      `nav button[onclick*="'${name}'"]`
    );

    if (navButton) navButton.classList.add("active");
  }

  if (name === "dashboard") updateDashboard();
  if (name === "plan") renderPlan();
  if (name === "analytics") renderExams();
  if (name === "mistakes") renderMistakes();

  if (name === "quiz") {
    const setup = $("quizSetupArea");
    const area = $("quizArea");

    if (setup) setup.style.display = "block";
    if (area) area.style.display = "none";

    if (typeof loadChapters === "function") {
      loadChapters();
    }
  }
}

/* =========================================
   SETUP
========================================= */

async function saveSetup() {
  const dailyHours = Number($("dailyHours")?.value);
  const daysLeft = Number($("daysLeft")?.value);

  if (!dailyHours || dailyHours < 1 || dailyHours > 16) {
    alert("ساعت مطالعه روزانه باید بین ۱ تا ۱۶ باشد.");
    return;
  }

  if (!daysLeft || daysLeft < 1) {
    alert("تعداد روزهای باقی‌مانده معتبر نیست.");
    return;
  }

  CONFIG = {
    field: $("field")?.value || "تجربی",
    grade: $("grade")?.value || "دوازدهم",
    dailyHours,
    daysLeft,
    updatedAt: new Date().toISOString()
  };

  PLAN = generatePlan(CONFIG);

  await DB.set("config", CONFIG);
  await DB.set("plan", PLAN);

  updateDashboard();
  renderPlan();

  alert("تنظیمات ذخیره و برنامه اولیه ساخته شد.");

  showPage("dashboard");
}

/* =========================================
   PLAN MANAGEMENT
========================================= */

function getNextDayNumber() {
  if (!PLAN.length) return 1;

  return Math.max(...PLAN.map(s => Number(s.day) || 0)) + 1;
}

async function addManualSession() {
  const dayValue = $("manualDay")?.value;
  const subject = $("manualSubject")?.value;
  const chapter = $("manualChapter")?.value.trim();
  const minutes = Number($("manualMinutes")?.value);

  if (!chapter || !minutes || minutes < 5) {
    alert("عنوان مبحث و زمان معتبر را وارد کن.");
    return;
  }

  let day;

  const weekdays = [
    "شنبه", "یکشنبه", "دوشنبه",
    "سه‌شنبه", "چهارشنبه", "پنجشنبه", "جمعه"
  ];

  if (weekdays.includes(dayValue)) {
    day = getNextDayNumber();
  } else {
    day = Number(dayValue) || getNextDayNumber();
  }

  const session = {
    id: "manual_" + Date.now(),
    day,
    weekday: weekdays[(day - 1) % 7],
    subject,
    chapter,
    minutes,
    type: "manual",
    done: false,
    createdAt: new Date().toISOString()
  };

  PLAN.push(session);

  await DB.set("plan", PLAN);

  if ($("manualChapter")) {
    $("manualChapter").value = "";
  }

  renderPlan();
  updateDashboard();
}

async function deleteSession(id) {
  if (!confirm("این جلسه از برنامه حذف شود؟")) return;

  PLAN = PLAN.filter(session => session.id !== id);

  await DB.set("plan", PLAN);

  renderPlan();
  updateDashboard();
}

async function toggleSession(id) {
  const session = PLAN.find(item => item.id === id);

  if (!session) return;

  session.done = !session.done;
  session.completedAt = session.done
    ? new Date().toISOString()
    : null;

  await DB.set("plan", PLAN);

  renderPlan();
  updateDashboard();
}

async function clearPlan() {
  if (!confirm("تمام جلسات برنامه پاک شوند؟")) return;

  PLAN = [];

  await DB.set("plan", PLAN);

  renderPlan();
  updateDashboard();
}

/* =========================================
   DASHBOARD
========================================= */

function updateDashboard() {
  if (!appReady) return;

  const totalSessions = PLAN.length;
  const completed = PLAN.filter(s => s.done).length;

  const completedMinutes = PLAN
    .filter(s => s.done)
    .reduce((sum, s) => sum + Number(s.minutes || 0), 0);

  const studyHours = (completedMinutes / 60).toFixed(1);

  if ($("totalStudyHours")) {
    $("totalStudyHours").innerText = faNumber(studyHours);
  }

  if ($("totalSessions")) {
    $("totalSessions").innerText = faNumber(completed);
  }

  if ($("totalExams")) {
    $("totalExams").innerText = faNumber(EXAMS.length);
  }

  if ($("summary")) {
    $("summary").innerHTML = `
      <div class="card">
        <span>رشته تحصیلی</span>
        <strong>${escapeHTML(CONFIG?.field || "تجربی")}</strong>
      </div>

      <div class="card">
        <span>جلسات انجام‌شده</span>
        <strong>${faNumber(completed)} از ${faNumber(totalSessions)}</strong>
      </div>

      <div class="card">
        <span>میزان پیشرفت</span>
        <strong>
          ${totalSessions
            ? faNumber(Math.round(completed / totalSessions * 100))
            : "۰"}٪
        </strong>
      </div>
    `;
  }

  renderTodayTasks();
}

function renderTodayTasks() {
  const panel = $("todayTasks");
  if (!panel) return;

  if (!PLAN.length) {
    panel.innerHTML = `
      <div class="card">
        هنوز برنامه‌ای ساخته نشده است.
        <button onclick="showPage('setup')">ساخت برنامه</button>
      </div>
    `;
    return;
  }

  const pending = PLAN
    .filter(session => !session.done)
    .sort((a, b) => a.day - b.day)
    .slice(0, 10);

  if (!pending.length) {
    panel.innerHTML = `
      <div class="card">
        🎉 همه جلسات برنامه انجام شده‌اند!
      </div>
    `;
    return;
  }

  panel.innerHTML = pending.map(session => `
    <label class="session-item">
      <input
        type="checkbox"
        onchange="toggleSession('${session.id}')"
      >

      <div class="session-info">
        <strong>${escapeHTML(session.subject)}</strong>
        - ${escapeHTML(session.chapter)}

        <small>
          روز ${faNumber(session.day)}
          | ${faNumber(session.minutes)} دقیقه
          | ${session.type === "review" ? "مرور" : "مطالعه"}
        </small>
      </div>
    </label>
  `).join("");
}

/* =========================================
   PLAN RENDERING
========================================= */

function renderPlan() {
  const container = $("weeklyPlan");
  if (!container) return;

  if (!PLAN.length) {
    container.innerHTML = `
      <p style="text-align:center;color:var(--muted)">
        هنوز برنامه‌ای وجود ندارد.
      </p>
    `;
    return;
  }

  const groups = {};

  PLAN.forEach(session => {
    const day = Number(session.day) || 1;

    if (!groups[day]) groups[day] = [];

    groups[day].push(session);
  });

  container.innerHTML = Object.keys(groups)
    .map(Number)
    .sort((a, b) => a - b)
    .map(day => {
      const sessions = groups[day];

      const minutes = sessions.reduce(
        (sum, session) => sum + Number(session.minutes || 0),
        0
      );

      return `
        <div class="card">
          <h4>📅 روز ${faNumber(day)}</h4>

          <p>
            مجموع زمان: ${faNumber(minutes)} دقیقه
          </p>

          <ul>
            ${sessions.map(session => `
              <li class="session-item"
                style="opacity:${session.done ? ".55" : "1"}">

                <div class="session-info">
                  <strong>${escapeHTML(session.subject)}</strong>
                  - ${escapeHTML(session.chapter)}

                  <small>
                    ${faNumber(session.minutes)} دقیقه
                    | ${session.type === "review" ? "مرور" : "مطالعه"}
                  </small>
                </div>

                <div style="display:flex;gap:8px;align-items:center">
                  <input
                    type="checkbox"
                    ${session.done ? "checked" : ""}
                    onchange="toggleSession('${session.id}')"
                  >

                  <button
                    type="button"
                    onclick="deleteSession('${session.id}')"
                    aria-label="حذف جلسه"
                  >
                    🗑️
                  </button>
                </div>
              </li>
            `).join("")}
          </ul>
        </div>
      `;
    })
    .join("");
}

/* =========================================
   QUIZ SETUP
========================================= */

function toggleQuizType() {
  // تنظیمات نوع آزمون در موتور آزمون مدیریت می‌شود.
}

function loadChapters() {
  const list = $("chapterList");

  if (!list) return;

  /*
   * جدول فعلی questions_bank ستون فصل و پایه ندارد.
   * بنابراین انتخاب فصل تا زمان اصلاح دیتابیس غیرفعال می‌ماند.
   */
  if (list.tagName === "TEXTAREA") {
    list.placeholder =
      "فعلاً آزمون از کل بانک سؤال درس انتخاب‌شده ساخته می‌شود.";
    list.disabled = true;
  }
}

async function createQuiz() {
  const subject = $("quizSubject")?.value || "زیست‌شناسی";
  const count = Number($("quizCount")?.value) || 10;
  const type = $("quizType")?.value || "آموزشی";

  await createQuizFromDatabase(subject, count, type);
}

/* =========================================
   EXAM ANALYTICS
========================================= */

function renderExams() {
  const container = $("examList");
  if (!container) return;

  if (!EXAMS.length) {
    container.innerHTML = "<p>هنوز آزمونی ثبت نشده است.</p>";
    return;
  }

  container.innerHTML = [...EXAMS]
    .reverse()
    .map(exam => `
      <div class="session-item">
        <div class="session-info">
          <strong>${escapeHTML(exam.subject)}</strong>

          <small>
            درصد: ${faNumber(exam.percent)}٪
            | درست: ${faNumber(exam.correct)}
            | غلط: ${faNumber(exam.wrong)}
            | نزده: ${faNumber(exam.unanswered)}
          </small>

          <small>
            تراز تخمینی: ${faNumber(exam.traz)}
          </small>
        </div>
      </div>
    `)
    .join("");
}

/* =========================================
   MISTAKES
========================================= */

async function addMistake() {
  const input = $("mistakeText");
  const text = input?.value.trim();

  if (!text) {
    alert("متن اشتباه یا نکته را وارد کن.");
    return;
  }

  MISTAKES.push({
    id: "mistake_" + Date.now(),
    text,
    createdAt: new Date().toISOString()
  });

  await DB.set("mistakes", MISTAKES);

  input.value = "";

  renderMistakes();
}

async function deleteMistake(id) {
  if (!confirm("این مورد حذف شود؟")) return;

  MISTAKES = MISTAKES.filter(item => item.id !== id);

  await DB.set("mistakes", MISTAKES);

  renderMistakes();
}

function renderMistakes() {
  const container = $("mistakeList");
  if (!container) return;

  if (!MISTAKES.length) {
    container.innerHTML = "<p>هنوز اشتباهی ثبت نشده است.</p>";
    return;
  }

  container.innerHTML = [...MISTAKES]
    .reverse()
    .map(item => `
      <li class="session-item">
        <span>${escapeHTML(item.text)}</span>

        <button
          type="button"
          onclick="deleteMistake('${item.id}')"
          aria-label="حذف اشتباه"
        >
          🗑️
        </button>
      </li>
    `)
    .join("");
}

/* =========================================
   GLOBAL ERROR HANDLING
========================================= */

window.addEventListener("error", event => {
  console.error("Application error:", event.error);
});

/* =========================================
   START APP
========================================= */

document.addEventListener("DOMContentLoaded", init);
