"use strict";

let CONFIG = null;
let PLAN = [];
let EXAMS = [];
let MISTAKES = [];

let appReady = false;

const $ = id => document.getElementById(id);

function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, c => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  })[c]);
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

/* ---------------------------
   بارگذاری اطلاعات کاربر
---------------------------- */

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

    PLAN = Array.isArray(savedPlan)
      ? savedPlan
      : [];

    EXAMS = Array.isArray(savedExams)
      ? savedExams
      : [];

    MISTAKES = Array.isArray(savedMistakes)
      ? savedMistakes
      : [];

    if (CONFIG) {
      fillSetupFields();
    }

    updateDashboard();
    renderPlan();
    renderExams();
    renderMistakes();

    appReady = true;

    showPage(
      CONFIG ? "dashboard" : "setup"
    );

  } catch (error) {
    console.error(error);

    showMessage(
      "بارگذاری اطلاعات با مشکل مواجه شد. صفحه را دوباره بارگذاری کن."
    );
  }
}

/* ---------------------------
   جابه‌جایی صفحات
---------------------------- */

function showPage(page) {
  document
    .querySelectorAll(".page-section")
    .forEach(section => {
      section.classList.remove("active");
    });

  $("page-" + page)?.classList.add("active");

  document
    .querySelectorAll(".nav-btn")
    .forEach(button => {
      button.classList.toggle(
        "active",
        button.getAttribute("onclick") ===
          `showPage('${page}')`
      );
    });

  if (page === "quiz") {
    const active =
      typeof currentQuiz !== "undefined" &&
      currentQuiz.questions.length > 0 &&
      !currentQuiz.submitted;

    if ($("quizSetupArea")) {
      $("quizSetupArea").style.display =
        active ? "none" : "block";
    }

    if ($("comprehensiveSetupArea")) {
      $("comprehensiveSetupArea").style.display =
        active ? "none" : "block";
    }

    if ($("quizArea")) {
      $("quizArea").style.display =
        active ? "block" : "none";
    }
  }

  if (page === "analytics") {
    renderAnalytics();
  }

  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });
}

/* ---------------------------
   تنظیمات اولیه
---------------------------- */

function fillSetupFields() {
  if (!CONFIG) return;

  if ($("field")) {
    $("field").value =
      CONFIG.field || "تجربی";
  }

  if ($("grade")) {
    $("grade").value =
      CONFIG.grade || "دوازدهم";
  }

  if ($("dailyHours")) {
    $("dailyHours").value =
      CONFIG.dailyHours || 6;
  }

  if ($("daysLeft")) {
    $("daysLeft").value =
      CONFIG.daysLeft || 244;
  }
}

async function saveSetup() {
  const field =
    $("field")?.value || "تجربی";

  const grade =
    $("grade")?.value || "دوازدهم";

  const dailyHours = Number(
    $("dailyHours")?.value || 6
  );

  const daysLeft = Number(
    $("daysLeft")?.value || 244
  );

  if (
    !Number.isFinite(dailyHours) ||
    dailyHours < 1 ||
    dailyHours > 18
  ) {
    showMessage(
      "ساعت مطالعه باید بین ۱ تا ۱۸ ساعت باشد."
    );
    return;
  }

  if (
    !Number.isFinite(daysLeft) ||
    daysLeft < 1
  ) {
    showMessage(
      "تعداد روزهای باقی‌مانده معتبر نیست."
    );
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
    const saved = await DB.set(
      "config",
      CONFIG
    );

    if (saved === false) return;

    PLAN = generatePlan(CONFIG);

    await DB.set("plan", PLAN);

    updateDashboard();
    renderPlan();

    showMessage(
      "تنظیمات ذخیره شد و برنامه مطالعاتی ساخته شد 💜"
    );

    showPage("dashboard");

  } catch (error) {
    console.error(error);

    showMessage(
      "ساخت برنامه با خطا مواجه شد."
    );
  }
}

/* ---------------------------
   برنامه مطالعاتی
---------------------------- */

async function persistPlan() {
  const result = await DB.set(
    "plan",
    PLAN
  );

  if (result !== false) {
    renderPlan();
    updateDashboard();
  }
}

async function addManualSession() {
  const dayName =
    $("manualDay")?.value;

  const subject =
    $("manualSubject")?.value;

  const minutes = Number(
    $("manualMinutes")?.value || 0
  );

  const chapter =
    $("manualChapter")?.value?.trim() ||
    "مطالعه آزاد";

  if (
    !subject ||
    !dayName ||
    minutes < 5 ||
    minutes > 1440
  ) {
    showMessage(
      "اطلاعات جلسه مطالعه معتبر نیست."
    );
    return;
  }

  const nextDay = PLAN.reduce(
    (max, item) =>
      Math.max(max, Number(item.day || 0)),
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

  showMessage(
    "جلسه مطالعه اضافه شد 🌱"
  );
}

async function toggleSession(id) {
  const session = PLAN.find(
    item => String(item.id) === String(id)
  );

  if (!session) return;

  session.completed = !session.completed;

  await persistPlan();
}

async function deleteSession(id) {
  if (
    !confirm("این جلسه از برنامه حذف شود؟")
  ) {
    return;
  }

  PLAN = PLAN.filter(
    item => String(item.id) !== String(id)
  );

  await persistPlan();
}

async function clearPlan() {
  if (
    !confirm("تمام برنامه مطالعاتی پاک شود؟")
  ) {
    return;
  }

  PLAN = [];

  await persistPlan();

  showMessage("برنامه پاک شد.");
}

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
    const day =
      item.dayName || ("روز " + item.day);

    if (!grouped[day]) {
      grouped[day] = [];
    }

    grouped[day].push(item);
  });

  container.innerHTML = Object
    .entries(grouped)
    .map(([day, items]) => `
      <div class="card">

        <h3>${escapeHTML(day)}</h3>

        ${items.map(item => `
          <div class="list-item">

            <div>
              <strong>
                ${escapeHTML(item.subject)}
              </strong>

              <div class="muted">
                ${escapeHTML(
                  item.chapter || "مطالعه آزاد"
                )}
                ·
                ${faNumber(item.minutes)} دقیقه
              </div>
            </div>

            <div>
              <input
                type="checkbox"
                ${item.completed ? "checked" : ""}
                onchange="toggleSession('${escapeHTML(item.id)}')"
              >

              <button
                onclick="deleteSession('${escapeHTML(item.id)}')"
              >
                حذف
              </button>
            </div>

          </div>
        `).join("")}

      </div>
    `)
    .join("");
}

/* ---------------------------
   داشبورد
---------------------------- */

function updateDashboard() {
  const done = PLAN.filter(
    item => item.completed
  );

  const minutes = done.reduce(
    (sum, item) =>
      sum + Number(item.minutes || 0),
    0
  );

  const hours = (minutes / 60).toFixed(1);

  if ($("totalStudyHours")) {
    $("totalStudyHours").textContent =
      faNumber(hours);
  }

  if ($("totalSessions")) {
    $("totalSessions").textContent =
      faNumber(done.length);
  }

  if ($("totalExams")) {
    $("totalExams").textContent =
      faNumber(EXAMS.length);
  }

  renderTodayTasks();

  if ($("summary")) {
    $("summary").innerHTML = `
      <div class="stats-grid">

        <div class="stat-card">
          <span>جلسات تکمیل‌شده</span>
          <strong>${faNumber(done.length)}</strong>
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

  container.innerHTML = pending
    .map(item => `
      <div class="list-item">

        <div>
          <strong>
            ${escapeHTML(item.subject)}
          </strong>

          <div class="muted">
            ${escapeHTML(item.chapter || "")}
            ·
            ${faNumber(item.minutes)} دقیقه
          </div>
        </div>

        <input
          type="checkbox"
          onchange="toggleSession('${escapeHTML(item.id)}')"
        >

      </div>
    `)
    .join("");
}

/* ---------------------------
   آزمون تک‌درس
---------------------------- */

async function createQuiz() {
  const subject =
    $("quizSubject")?.value;

  const count = Number(
    $("quizCount")?.value || 10
  );

  const type =
    $("quizType")?.value || "بدون زمان";

  if (!subject) {
    showMessage(
      "لطفاً یک درس انتخاب کن."
    );
    return;
  }

  if (
    typeof createQuizFromDatabase !== "function"
  ) {
    showMessage(
      "موتور آزمون بارگذاری نشده است."
    );
    return;
  }

  await createQuizFromDatabase(
    subject,
    count,
    type
  );
}

/* ---------------------------
   آزمون جامع
---------------------------- */

async function startComprehensiveQuiz() {
  const type =
    $("comprehensiveQuizType")?.value ||
    "بدون زمان";

  if (
    typeof createComprehensiveQuiz !== "function"
  ) {
    showMessage(
      "موتور آزمون جامع بارگذاری نشده است."
    );
    return;
  }

  await createComprehensiveQuiz(type);
}

/* ---------------------------
   سوابق آزمون
---------------------------- */

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

  const sorted = [...EXAMS].sort(
    (a, b) =>
      new Date(b.date || 0) -
      new Date(a.date || 0)
  );

  container.innerHTML = sorted
    .map(exam => {
      const date = exam.date
        ? new Date(exam.date).toLocaleDateString("fa-IR")
        : "نامشخص";

      const percent =
        exam.percent ??
        exam.raw_percentage ??
        0;

      const correct =
        exam.correct ??
        exam.correct_count ??
        0;

      const wrong =
        exam.wrong ??
        exam.wrong_count ??
        0;

      const unanswered =
        exam.unanswered ??
        exam.unanswered_count ??
        0;

      return `
        <div class="card">

          <h3>
            ${escapeHTML(
              exam.subject ||
              exam.exam_title ||
              "آزمون"
            )}
          </h3>

          <div class="stats-grid">

            <div class="stat-card">
              <span>درصد خام</span>
              <strong>${faNumber(percent)}٪</strong>
            </div>

            <div class="stat-card">
              <span>صحیح</span>
              <strong>${faNumber(correct)}</strong>
            </div>

            <div class="stat-card">
              <span>غلط</span>
              <strong>${faNumber(wrong)}</strong>
            </div>

            <div class="stat-card">
              <span>نزده</span>
              <strong>${faNumber(unanswered)}</strong>
            </div>

          </div>

          <p class="muted">
            تاریخ: ${escapeHTML(date)}
            ·
            تراز تخمینی:
            ${faNumber(
              exam.traz ?? exam.estimated_score
            )}
          </p>

        </div>
      `;
    })
    .join("");
}

/* ---------------------------
   تحلیل عملکرد
---------------------------- */

function renderAnalytics() {
  renderExams();

  const target = $("analyticsSummary");

  if (!target) return;

  const valid = EXAMS.filter(exam =>
    Number.isFinite(
      Number(
        exam.percent ??
        exam.raw_percentage
      )
    )
  );

  if (!valid.length) {
    target.innerHTML = `
      <p class="muted">
        پس از ثبت آزمون، تحلیل روند عملکرد اینجا نمایش داده می‌شود.
      </p>
    `;
    return;
  }

  const percentages = valid.map(exam =>
    Number(
      exam.percent ??
      exam.raw_percentage
    )
  );

  const average =
    percentages.reduce(
      (sum, value) => sum + value,
      0
    ) / percentages.length;

  const best = Math.max(...percentages);

  target.innerHTML = `
    <div class="stats-grid">

      <div class="stat-card">
        <span>تعداد آزمون</span>
        <strong>${faNumber(valid.length)}</strong>
      </div>

      <div class="stat-card">
        <span>میانگین درصد خام</span>
        <strong>${average.toFixed(1)}٪</strong>
      </div>

      <div class="stat-card">
        <span>بهترین درصد</span>
        <strong>${best.toFixed(1)}٪</strong>
      </div>

    </div>
  `;
}

/* ---------------------------
   دفتر اشتباهات
---------------------------- */

async function addMistake() {
  const input = $("mistakeText");

  const text = input?.value?.trim();

  if (!text) {
    showMessage(
      "ابتدا متن اشتباه یا نکته را وارد کن."
    );
    return;
  }

  MISTAKES.unshift({
    id: "mistake_" + Date.now(),
    text,
    date: new Date().toISOString()
  });

  const saved = await DB.set(
    "mistakes",
    MISTAKES
  );

  if (saved === false) {
    MISTAKES.shift();
    return;
  }

  input.value = "";

  renderMistakes();

  showMessage(
    "به دفتر اشتباهات اضافه شد 📕"
  );
}

async function deleteMistake(id) {
  if (!confirm("این مورد حذف شود؟")) {
    return;
  }

  const old = [...MISTAKES];

  MISTAKES = MISTAKES.filter(
    item => String(item.id) !== String(id)
  );

  const saved = await DB.set(
    "mistakes",
    MISTAKES
  );

  if (saved === false) {
    MISTAKES = old;
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

  container.innerHTML = MISTAKES
    .map(item => `
      <div class="card">

        <p>${escapeHTML(item.text)}</p>

        <div
          style="
            display:flex;
            justify-content:space-between;
            align-items:center;
          "
        >

          <span class="muted">
            ${
              item.date
                ? escapeHTML(
                    new Date(item.date)
                      .toLocaleDateString("fa-IR")
                  )
                : ""
            }
          </span>

          <button
            class="btn btn-danger"
            onclick="deleteMistake('${escapeHTML(item.id)}')"
          >
            حذف
          </button>

        </div>

      </div>
    `)
    .join("");
}

/* ---------------------------
   آماده‌سازی برنامه
---------------------------- */

document.addEventListener(
  "DOMContentLoaded",
  () => {
    console.log("کنکوریار آماده است.");
  }
);
