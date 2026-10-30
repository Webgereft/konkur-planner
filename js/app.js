
"use strict";

/* =====================================
   متغیرهای اصلی برنامه
===================================== */

let CONFIG = null;
let PLAN = [];
let EXAMS = [];
let MISTAKES = [];

let appReady = false;

const $ = id => document.getElementById(id);

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

/* =====================================
   راه‌اندازی برنامه
===================================== */

async function init() {
  try {
    const [config, plan, exams, mistakes] = await Promise.all([
      DB.get("config", null),
      DB.get("plan", []),
      DB.get("exams", []),
      DB.get("mistakes", [])
    ]);

    CONFIG = config;
    PLAN = Array.isArray(plan) ? plan : [];
    EXAMS = Array.isArray(exams) ? exams : [];
    MISTAKES = Array.isArray(mistakes) ? mistakes : [];

    appReady = true;

    updateDashboard();
    renderPlan();
    renderExams();
    renderMistakes();

    if (CONFIG) {
      showPage("dashboard");
    } else {
      showPage("setup");
    }

    loadChapters();

  } catch (error) {
    console.error("خطا در راه‌اندازی برنامه:", error);
    alert("در بارگذاری اطلاعات مشکلی پیش آمده است.");
  }
}

/* =====================================
   جابه‌جایی بین صفحات
===================================== */

function showPage(pageName, button = null) {
  document.querySelectorAll(".page-section").forEach(page => {
    page.classList.remove("active");
  });

  const target = $("page-" + pageName);

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
      `nav button[onclick*="'${pageName}'"]`
    );

    if (navButton) {
      navButton.classList.add("active");
    }
  }

  if (pageName === "dashboard") updateDashboard();
  if (pageName === "plan") renderPlan();
  if (pageName === "analytics") renderExams();
  if (pageName === "mistakes") renderMistakes();

  if (pageName === "quiz") {
    if (typeof currentQuiz === "undefined" ||
        !currentQuiz.questions?.length ||
        currentQuiz.submitted) {
      if ($("quizSetupArea")) $("quizSetupArea").style.display = "block";
      if ($("quizArea")) $("quizArea").style.display = "none";
    }
  }
}

/* =====================================
   تنظیمات اولیه
===================================== */

async function saveSetup() {
  const field = $("field")?.value || "تجربی";
  const grade = $("grade")?.value || "دوازدهم";
  const dailyHours = Number($("dailyHours")?.value);
  const daysLeft = Number($("daysLeft")?.value);

  if (!dailyHours || dailyHours < 1 || dailyHours > 16) {
    alert("ساعت مطالعه باید بین ۱ تا ۱۶ باشد.");
    return;
  }

  if (!daysLeft || daysLeft < 1) {
    alert("تعداد روزهای باقی‌مانده معتبر نیست.");
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
    PLAN = generatePlan(CONFIG);

    await DB.set("config", CONFIG);
    await DB.set("plan", PLAN);

    updateDashboard();
    renderPlan();

    alert("برنامه مطالعاتی با موفقیت ساخته شد.");
    showPage("dashboard");

  } catch (error) {
    console.error(error);
    alert("ساخت برنامه با خطا مواجه شد.");
  }
}

/* =====================================
   مدیریت جلسات برنامه
===================================== */

async function addManualSession() {
  const weekday = $("manualDay")?.value || "شنبه";
  const subject = $("manualSubject")?.value || "زیست‌شناسی";
  const chapter = $("manualChapter")?.value.trim();
  const minutes = Number($("manualMinutes")?.value);

  if (!chapter) {
    alert("لطفاً نام مبحث را وارد کن.");
    return;
  }

  if (!minutes || minutes < 5 || minutes > 1000) {
    alert("مدت مطالعه باید حداقل ۵ دقیقه باشد.");
    return;
  }

  const maxDay = PLAN.length
    ? Math.max(...PLAN.map(s => Number(s.day) || 0))
    : 0;

  const session = {
    id: "manual_" + Date.now(),
    day: maxDay + 1,
    weekday,
    subject,
    chapter,
    minutes,
    type: "manual",
    done: false,
    createdAt: new Date().toISOString()
  };

  PLAN.push(session);

  try {
    await DB.set("plan", PLAN);

    if ($("manualChapter")) {
      $("manualChapter").value = "";
    }

    renderPlan();
    updateDashboard();

    alert("جلسه به برنامه اضافه شد.");

  } catch (error) {
    console.error(error);
    alert("ذخیره جلسه ناموفق بود.");
  }
}

async function toggleSession(id) {
  const session = PLAN.find(s => String(s.id) === String(id));

  if (!session) return;

  session.done = !session.done;

  await DB.set("plan", PLAN);

  renderPlan();
  updateDashboard();
}

async function deleteSession(id) {
  if (!confirm("این جلسه حذف شود؟")) return;

  PLAN = PLAN.filter(s => String(s.id) !== String(id));

  await DB.set("plan", PLAN);

  renderPlan();
  updateDashboard();
}

async function clearPlan() {
  if (!confirm("تمام برنامه مطالعاتی پاک شود؟")) return;

  PLAN = [];

  await DB.set("plan", PLAN);

  renderPlan();
  updateDashboard();

  alert("برنامه پاک شد.");
}

/* =====================================
   داشبورد
===================================== */

function updateDashboard() {
  if (!appReady) return;

  const completed = PLAN.filter(s => s.done);

  const totalMinutes = completed.reduce(
    (sum, s) => sum + Number(s.minutes || 0),
    0
  );

  if ($("totalStudyHours")) {
    $("totalStudyHours").innerText =
      faNumber((totalMinutes / 60).toFixed(1));
  }

  if ($("totalSessions")) {
    $("totalSessions").innerText = faNumber(completed.length);
  }

  if ($("totalExams")) {
    $("totalExams").innerText = faNumber(EXAMS.length);
  }

  const summary = $("summary");

  if (summary) {
    const progress = PLAN.length
      ? Math.round(completed.length / PLAN.length * 100)
      : 0;

    summary.innerHTML = `
      <div class="card">
        <span class="muted">رشته تحصیلی</span>
        <strong>${escapeHTML(CONFIG?.field || "تجربی")}</strong>
      </div>

      <div class="card">
        <span class="muted">پایه تحصیلی</span>
        <strong>${escapeHTML(CONFIG?.grade || "دوازدهم")}</strong>
      </div>

      <div class="card">
        <span class="muted">پیشرفت برنامه</span>
        <strong>${faNumber(progress)}٪</strong>
      </div>

      <div class="card">
        <span class="muted">ساعت مطالعه روزانه هدف</span>
        <strong>${faNumber(CONFIG?.dailyHours || 0)} ساعت</strong>
      </div>
    `;
  }

  renderTodayTasks();
}

function renderTodayTasks() {
  const container = $("todayTasks");

  if (!container) return;

  const pending = PLAN
    .filter(s => !s.done)
    .sort((a, b) => Number(a.day) - Number(b.day))
    .slice(0, 10);

  if (!pending.length) {
    container.innerHTML = `
      <div class="empty-state">
        🎉 همه جلسات برنامه انجام شده‌اند!
      </div>
    `;
    return;
  }

  container.innerHTML = pending.map(s => `
    <div class="session-item">
      <input
        type="checkbox"
        aria-label="انجام جلسه"
        onchange="toggleSession('${escapeHTML(s.id)}')"
      >

      <div class="session-info">
        <strong>${escapeHTML(s.subject)}</strong>
        <div>${escapeHTML(s.chapter)}</div>
        <small>
          ${escapeHTML(s.weekday || ("روز " + s.day))}
          | ${faNumber(s.minutes)} دقیقه
        </small>
      </div>
    </div>
  `).join("");
}

/* =====================================
   نمایش برنامه مطالعاتی
===================================== */

function renderPlan() {
  const container = $("weeklyPlan");

  if (!container) return;

  if (!PLAN.length) {
    container.innerHTML = `
      <div class="card empty-state">
        هنوز برنامه‌ای نداری. از تنظیمات برنامه بساز یا جلسه‌ای اضافه کن.
      </div>
    `;
    return;
  }

  const groups = {};

  PLAN.forEach(session => {
    const day = Number(session.day) || 1;

    if (!groups[day]) {
      groups[day] = [];
    }

    groups[day].push(session);
  });

  container.innerHTML = Object.keys(groups)
    .map(Number)
    .sort((a, b) => a - b)
    .map(day => `
      <div class="card" style="margin-bottom:15px">
        <h3 class="section-title">
          📅 ${escapeHTML(groups[day][0]?.weekday || ("روز " + faNumber(day)))}
        </h3>

        ${groups[day].map(session => `
          <div class="session-item">
            <input
              type="checkbox"
              ${session.done ? "checked" : ""}
              aria-label="وضعیت جلسه"
              onchange="toggleSession('${escapeHTML(session.id)}')"
            >

            <div class="session-info">
              <strong>${escapeHTML(session.subject)}</strong>
              <div>${escapeHTML(session.chapter)}</div>
              <small>${faNumber(session.minutes)} دقیقه</small>
            </div>

            <button
              class="btn btn-danger btn-small"
              onclick="deleteSession('${escapeHTML(session.id)}')"
            >
              حذف
            </button>
          </div>
        `).join("")}
      </div>
    `).join("");
}

/* =====================================
   تنظیمات آزمون
===================================== */

function loadChapters() {
  const chapterList = $("chapterList");

  if (chapterList && chapterList.tagName === "TEXTAREA") {
    chapterList.placeholder =
      "فعلاً آزمون از سؤال‌های تأییدشده کل درس ساخته می‌شود.";
    chapterList.disabled = true;
  }
}

async function createQuiz() {
  const subject = $("quizSubject")?.value || "زیست‌شناسی";
  const count = Number($("quizCount")?.value) || 10;
  const type = $("quizType")?.value || "بدون زمان";

  if (!["زمان‌دار", "بدون زمان"].includes(type)) {
    alert("لطفاً نوع آزمون را انتخاب کن.");
    return;
  }

  if (typeof createQuizFromDatabase !== "function") {
    alert("موتور آزمون بارگذاری نشده است. فایل quiz-engine.js را بررسی کن.");
    return;
  }

  await createQuizFromDatabase(subject, count, type);
}

/* =====================================
   تاریخچه و تحلیل آزمون‌ها
===================================== */

function renderExams() {
  const container = $("examList");

  if (!container) return;

  if (!EXAMS.length) {
    container.innerHTML = `
      <div class="empty-state">
        هنوز آزمونی ثبت نشده است.
      </div>
    `;
    return;
  }

  container.innerHTML = [...EXAMS]
    .reverse()
    .map(exam => {
      const date = exam.date
        ? new Date(exam.date).toLocaleDateString("fa-IR")
        : "بدون تاریخ";

      return `
        <div class="session-item">
          <div class="session-info">
            <strong>${escapeHTML(exam.subject || "آزمون")}</strong>

            <small>
              تاریخ: ${date}
              | نوع: ${escapeHTML(exam.type || "نامشخص")}
            </small>

            <small>
              درست: ${faNumber(exam.correct)}
              | غلط: ${faNumber(exam.wrong)}
              | نزده: ${faNumber(exam.unanswered)}
            </small>

            <small>
              درصد: ${faNumber(exam.percent)}٪
              | تراز تخمینی: ${faNumber(exam.traz)}
            </small>
          </div>
        </div>
      `;
    })
    .join("");
}

/* =====================================
   دفترچه اشتباهات
===================================== */

async function addMistake() {
  const input = $("mistakeText");
  const text = input?.value.trim();

  if (!text) {
    alert("لطفاً متن اشتباه یا نکته را وارد کن.");
    return;
  }

  MISTAKES.push({
    id: "mistake_" + Date.now(),
    text,
    createdAt: new Date().toISOString(),
    reviewed: false
  });

  await DB.set("mistakes", MISTAKES);

  input.value = "";

  renderMistakes();

  alert("مورد جدید به دفترچه اشتباهات اضافه شد.");
}

async function deleteMistake(id) {
  if (!confirm("این مورد از دفترچه حذف شود؟")) return;

  MISTAKES = MISTAKES.filter(
    mistake => String(mistake.id) !== String(id)
  );

  await DB.set("mistakes", MISTAKES);

  renderMistakes();
}

function renderMistakes() {
  const container = $("mistakeList");

  if (!container) return;

  if (!MISTAKES.length) {
    container.innerHTML = `
      <li class="empty-state">
        هنوز اشتباهی ثبت نکرده‌ای.
      </li>
    `;
    return;
  }

  container.innerHTML = [...MISTAKES]
    .reverse()
    .map(mistake => `
      <li class="session-item">
        <div class="session-info">
          ${escapeHTML(mistake.text)}
          <small>
            ${mistake.createdAt
              ? new Date(mistake.createdAt).toLocaleDateString("fa-IR")
              : ""}
          </small>
        </div>

        <button
          class="btn btn-danger btn-small"
          onclick="deleteMistake('${escapeHTML(mistake.id)}')"
        >
          حذف
        </button>
      </li>
    `)
    .join("");
}

/* =====================================
   شروع برنامه
===================================== */

document.addEventListener("DOMContentLoaded", () => {
  init();
});
