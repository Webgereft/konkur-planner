
"use strict";

/* =====================================
   متغیرهای اصلی کنکوریار
===================================== */

let CONFIG = null;
let PLAN = [];
let EXAMS = [];
let MISTAKES = [];

let appReady = false;

const $ = id => document.getElementById(id);

/* =====================================
   ابزارهای کمکی
===================================== */

function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  })[char]);
}

function faNumber(value) {
  return Number(value || 0).toLocaleString("fa-IR");
}

function showMessage(message) {
  alert(message);
}

function getTodayDate() {
  return new Date().toISOString().slice(0, 10);
}

/* =====================================
   بارگذاری اطلاعات کاربر
===================================== */

async function init() {
  if (appReady) return;

  try {
    const user = await AUTH.getUser();

    if (!user) return;

    const [
      savedConfig,
      savedPlan,
      savedExams,
      savedMistakes
    ] = await Promise.all([
      DB.get("config", null),
      DB.get("plan", []),
      DB.get("exams", []),
      DB.get("mistakes", [])
    ]);

    CONFIG = savedConfig;
    PLAN = Array.isArray(savedPlan) ? savedPlan : [];
    EXAMS = Array.isArray(savedExams) ? savedExams : [];
    MISTAKES = Array.isArray(savedMistakes) ? savedMistakes : [];

    if (CONFIG) {
      fillSetupFields();
    }

    updateDashboard();
    renderPlan();
    renderExams();
    renderMistakes();

    appReady = true;

    if (CONFIG) {
      showPage("dashboard");
    } else {
      showPage("setup");
    }

  } catch (error) {
    console.error("خطا در بارگذاری برنامه:", error);
    showMessage("بارگذاری اطلاعات با مشکل مواجه شد. صفحه را دوباره بارگذاری کن.");
  }
}

/* =====================================
   مدیریت صفحات
===================================== */

function showPage(page) {
  const pages = document.querySelectorAll(".page-section");

  pages.forEach(section => {
    section.classList.remove("active");
  });

  const target = $("page-" + page);

  if (target) {
    target.classList.add("active");
  }

  document.querySelectorAll(".nav-btn").forEach(button => {
    button.classList.remove("active");

    if (
      button.getAttribute("onclick") ===
      `showPage('${page}')`
    ) {
      button.classList.add("active");
    }
  });

  if (page === "quiz") {
    const setup = $("quizSetupArea");
    const area = $("quizArea");

    if (
      typeof currentQuiz !== "undefined" &&
      currentQuiz.questions.length &&
      !currentQuiz.submitted
    ) {
      if (setup) setup.style.display = "none";
      if (area) area.style.display = "block";
    } else {
      if (setup) setup.style.display = "block";
      if (area) area.style.display = "none";
    }
  }

  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });
}

/* =====================================
   تنظیمات برنامه
===================================== */

function fillSetupFields() {
  if (!CONFIG) return;

  if ($("field")) {
    $("field").value = CONFIG.field || "تجربی";
  }

  if ($("grade")) {
    $("grade").value = CONFIG.grade || "دوازدهم";
  }

  if ($("dailyHours")) {
    $("dailyHours").value = CONFIG.dailyHours || 6;
  }

  if ($("daysLeft")) {
    $("daysLeft").value = CONFIG.daysLeft || 244;
  }
}

async function saveSetup() {
  const field = $("field")?.value || "تجربی";
  const grade = $("grade")?.value || "دوازدهم";
  const dailyHours = Number($("dailyHours")?.value || 6);
  const daysLeft = Number($("daysLeft")?.value || 244);

  if (
    !Number.isFinite(dailyHours) ||
    dailyHours < 1 ||
    dailyHours > 18
  ) {
    showMessage("ساعت مطالعه باید بین ۱ تا ۱۸ ساعت باشد.");
    return;
  }

  if (
    !Number.isFinite(daysLeft) ||
    daysLeft < 1
  ) {
    showMessage("تعداد روزهای باقی‌مانده معتبر نیست.");
    return;
  }

  CONFIG = {
    field,
    grade,
    dailyHours,
    daysLeft,
    updatedAt: new Date().toISOString()
  };

  try {
    const saved = await DB.set("config", CONFIG);

    if (saved === false) return;

    PLAN = generatePlan(CONFIG);

    await DB.set("plan", PLAN);

    updateDashboard();
    renderPlan();

    showMessage("تنظیمات ذخیره شد و برنامه مطالعاتی ساخته شد 💜");

    showPage("dashboard");

  } catch (error) {
    console.error(error);
    showMessage("ساخت برنامه با خطا مواجه شد.");
  }
}

/* =====================================
   مدیریت برنامه مطالعاتی
===================================== */

async function persistPlan() {
  const saved = await DB.set("plan", PLAN);

  if (saved !== false) {
    renderPlan();
    updateDashboard();
  }
}

async function addManualSession() {
  const dayName = $("manualDay")?.value;
  const subject = $("manualSubject")?.value;
  const minutes = Number($("manualMinutes")?.value || 0);
  const chapter = $("manualChapter")?.value?.trim() || "مطالعه آزاد";

  if (!subject || !dayName || minutes < 5 || minutes > 1440) {
    showMessage("اطلاعات جلسه مطالعه معتبر نیست.");
    return;
  }

  const nextDay = PLAN.reduce(
    (max, item) => Math.max(max, Number(item.day || 0)),
    0
  ) + 1;

  PLAN.push({
    id: "manual_" + Date.now(),
    day: nextDay,
    dayName,
    subject,
    minutes,
    chapter,
    completed: false,
    manual: true,
    createdAt: new Date().toISOString()
  });

  await persistPlan();

  if ($("manualChapter")) {
    $("manualChapter").value = "";
  }

  showMessage("جلسه مطالعه اضافه شد 🌱");
}

async function toggleSession(id) {
  const session = PLAN.find(item => String(item.id) === String(id));

  if (!session) return;

  session.completed = !session.completed;

  await persistPlan();
}

async function deleteSession(id) {
  if (!confirm("این جلسه از برنامه حذف شود؟")) return;

  PLAN = PLAN.filter(item => String(item.id) !== String(id));

  await persistPlan();
}

async function clearPlan() {
  if (!confirm("تمام برنامه مطالعاتی پاک شود؟")) return;

  PLAN = [];
  await persistPlan();

  showMessage("برنامه پاک شد.");
}

/* =====================================
   نمایش برنامه
===================================== */

function renderPlan() {
  const container = $("weeklyPlan");

  if (!container) return;

  if (!PLAN.length) {
    container.innerHTML = `
      <div class="card muted">
        هنوز برنامه‌ای ساخته نشده است.
      </div>
    `;
    return;
  }

  const grouped = {};

  PLAN.forEach(item => {
    const day = item.dayName || ("روز " + item.day);

    if (!grouped[day]) {
      grouped[day] = [];

    }

    grouped[day].push(item);
  });

  container.innerHTML = Object.entries(grouped)
    .map(([day, sessions]) => `
      <div class="card">
        <h3>${escapeHTML(day)}</h3>

        ${sessions.map(session => `
          <div class="list-item">
            <div>
              <strong>${escapeHTML(session.subject)}</strong>
              <div class="muted">
                ${escapeHTML(session.chapter || "مطالعه آزاد")}
                · ${faNumber(session.minutes)} دقیقه
              </div>
            </div>

            <div style="display:flex;gap:7px;align-items:center">
              <input
                type="checkbox"
                ${session.completed ? "checked" : ""}
                onchange="toggleSession('${escapeHTML(session.id)}')"
                aria-label="تکمیل جلسه"
              >

              <button onclick="deleteSession('${escapeHTML(session.id)}')">
                حذف
              </button>
            </div>
          </div>
        `).join("")}
      </div>
    `)
    .join("");
}

/* =====================================
   داشبورد و آمار
===================================== */

function updateDashboard() {
  const completed = PLAN.filter(item => item.completed);

  const totalMinutes = completed.reduce(
    (sum, item) => sum + Number(item.minutes || 0),
    0
  );

  const hours = (totalMinutes / 60).toFixed(1);

  if ($("totalStudyHours")) {
    $("totalStudyHours").textContent = faNumber(hours);
  }

  if ($("totalSessions")) {
    $("totalSessions").textContent = faNumber(completed.length);
  }

  if ($("totalExams")) {
    $("totalExams").textContent = faNumber(EXAMS.length);
  }

  renderTodayTasks();

  const summary = $("summary");

  if (summary) {
    summary.innerHTML = `
      <div class="stats-grid">
        <div class="stat-card">
          <span>جلسات تکمیل‌شده</span>
          <strong>${faNumber(completed.length)}</strong>
        </div>

        <div class="stat-card">
          <span>زمان مطالعه</span>
          <strong>${faNumber(hours)} ساعت</strong>
        </div>

        <div class="stat-card">
          <span>آزمون‌های ثبت‌شده</span>
          <strong>${faNumber(EXAMS.length)}</strong>
        </div>
      </div>
    `;
  }
}

function renderTodayTasks() {
  const container = $("todayTasks");

  if (!container) return;

  const pending = PLAN
    .filter(item => !item.completed)
    .slice(0, 10);

  if (!pending.length) {
    container.innerHTML = `
      <p class="muted">
        همه جلسات برنامه تکمیل شده‌اند یا هنوز برنامه‌ای ثبت نشده است.
      </p>
    `;
    return;
  }

  container.innerHTML = pending.map(item => `
    <div class="list-item">
      <div>
        <strong>${escapeHTML(item.subject)}</strong>
        <div class="muted">
          ${escapeHTML(item.chapter || "")}
          · ${faNumber(item.minutes)} دقیقه
        </div>
      </div>

      <input
        type="checkbox"
        onchange="toggleSession('${escapeHTML(item.id)}')"
        aria-label="تکمیل جلسه"
      >
    </div>
  `).join("");
}

/* =====================================
   آزمون
===================================== */

async function createQuiz() {
  const subject = $("quizSubject")?.value;
  const count = Number($("quizCount")?.value || 10);
  const type = $("quizType")?.value || "بدون زمان";

  if (!subject) {
    showMessage("لطفاً یک درس انتخاب کن.");
    return;
  }

  if (typeof createQuizFromDatabase !== "function") {
    showMessage("موتور آزمون بارگذاری نشده است.");
    return;
  }

  await createQuizFromDatabase(subject, count, type);
}

/* =====================================
   نتایج آزمون
===================================== */

function renderExams() {
  const container = $("examList");

  if (!container) return;

  if (!EXAMS.length) {
    container.innerHTML = `
      <div class="card muted">
        هنوز آزمونی ثبت نشده است.
      </div>
    `;
    return;
  }

  const sorted = [...EXAMS].sort((a, b) =>
    new Date(b.date || 0) - new Date(a.date || 0)
  );

  container.innerHTML = sorted.map(exam => {
    const date = exam.date
      ? new Date(exam.date).toLocaleDateString("fa-IR")
      : "نامشخص";

    return `
      <div class="card">
        <h3>${escapeHTML(exam.subject)}</h3>

        <div class="stats-grid">
          <div class="stat-card">
            <span>درصد</span>
            <strong>${faNumber(exam.percent)}٪</strong>
          </div>

          <div class="stat-card">
            <span>صحیح</span>
            <strong>${faNumber(exam.correct)}</strong>
          </div>

          <div class="stat-card">
            <span>غلط</span>
            <strong>${faNumber(exam.wrong)}</strong>
          </div>
        </div>

        <p class="muted">
          تاریخ: ${escapeHTML(date)}
          · تراز تخمینی: ${faNumber(exam.traz)}
        </p>
      </div>
    `;
  }).join("");
}

/* =====================================
   دفتر اشتباهات
===================================== */

async function addMistake() {
  const input = $("mistakeText");
  const text = input?.value?.trim();

  if (!text) {
    showMessage("ابتدا متن اشتباه یا نکته را وارد کن.");
    return;
  }

  MISTAKES.unshift({
    id: "mistake_" + Date.now(),
    text,
    date: new Date().toISOString()
  });

  const saved = await DB.set("mistakes", MISTAKES);

  if (saved === false) {
    MISTAKES.shift();
    return;
  }

  if (input) input.value = "";

  renderMistakes();

  showMessage("به دفتر اشتباهات اضافه شد 📕");
}

async function deleteMistake(id) {
  if (!confirm("این مورد حذف شود؟")) return;

  const oldMistakes = [...MISTAKES];

  MISTAKES = MISTAKES.filter(
    item => String(item.id) !== String(id)
  );

  const saved = await DB.set("mistakes", MISTAKES);

  if (saved === false) {
    MISTAKES = oldMistakes;
    return;
  }

  renderMistakes();
}

function renderMistakes() {
  const container = $("mistakeList");

  if (!container) return;

  if (!MISTAKES.length) {
    container.innerHTML = `
      <div class="card muted">
        دفتر اشتباهاتت هنوز خالی است.
      </div>
    `;
    return;
  }

  container.innerHTML = MISTAKES.map(item => {
    const date = item.date
      ? new Date(item.date).toLocaleDateString("fa-IR")
      : "";

    return `
      <div class="card">
        <p>${escapeHTML(item.text)}</p>

        <div style="display:flex;justify-content:space-between;align-items:center">
          <span class="muted">${escapeHTML(date)}</span>

          <button class="btn btn-danger"
            onclick="deleteMistake('${escapeHTML(item.id)}')">
            حذف
          </button>
        </div>
      </div>
    `;
  }).join("");
}

/* =====================================
   بارگذاری اولیه
===================================== */

document.addEventListener("DOMContentLoaded", () => {
  console.log("کنکوریار آماده است.");
});
