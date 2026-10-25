// ==========================================
// متغیرهای سراسری
// ==========================================
let CONFIG = DB.get('config', null);
let PLAN = DB.get('plan', []);
let EXAMS = DB.get('exams', []);
let MISTAKES = DB.get('mistakes', []);

// ==========================================
// راه‌اندازی اولیه
// ==========================================
function init() {
  if (!CONFIG) {
    showPage('setup');
  } else {
    showPage('dashboard', document.querySelector('nav button:nth-child(2)'));
  }
}

// ==========================================
// مدیریت صفحات (Paging)
// ==========================================
function showPage(name, btn = null) {
  // مخفی کردن همه صفحات
  document.querySelectorAll('.page').forEach(p => p.classList.add('hidden'));
  
  // نمایش صفحه هدف
  const targetPage = document.getElementById('page-' + name);
  if (targetPage) targetPage.classList.remove('hidden');
  
  // آپدیت دکمه فعال در منو
  if (btn) {
    document.querySelectorAll('nav button').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
  }

  // فراخوانی توابع رندر برای هر صفحه
  if (name === 'dashboard') renderDashboard();
  if (name === 'plan') renderPlan();
  if (name === 'quiz') { toggleQuizType(); loadChapters(); }
  if (name === 'analytics') renderExams();
  if (name === 'mistakes') renderMistakes();
}

// ==========================================
// ۱. بخش تنظیمات (Setup)
// ==========================================
function saveSetup() {
  const field = document.getElementById('field').value;
  const daysLeft = +document.getElementById('daysLeft').value;
  const dailyHours = +document.getElementById('dailyHours').value;
  
  if (!daysLeft || !dailyHours) {
    alert("لطفاً روزهای باقی‌مانده و ساعت مطالعه را وارد کنید.");
    return;
  }

  CONFIG = { field, daysLeft, dailyHours };
  DB.set('config', CONFIG);
  
  // ساخت برنامه هوشمند
  if (typeof generatePlan === 'function') {
    PLAN = generatePlan(CONFIG);
    DB.set('plan', PLAN);
  } else {
    alert("خطا: تابع برنامه‌ریزی یافت نشد. فایل planner.js را چک کنید.");
    return;
  }
  
  // رفتن به داشبورد
  showPage('dashboard', document.querySelector('nav button:nth-child(2)'));
}

// ==========================================
// ۲. داشبورد و پنل انجام کارها (Dashboard)
// ==========================================
function renderDashboard() {
  if (!CONFIG) return;
  
  const allPending = PLAN.filter(s => !s.done).sort((a, b) => a.day - b.day);
  const totalDone = PLAN.filter(s => s.done).length;
  const totalTasks = PLAN.length;
  const doneMinutes = PLAN.filter(s => s.done).reduce((sum, s) => sum + s.minutes, 0);

  // نمایش خلاصه وضعیت
  document.getElementById('summary').innerHTML = `
    <div class="card">📖 رشته: ${CONFIG.field}</div>
    <div class="card">⏳ روز مانده: ${CONFIG.daysLeft}</div>
    <div class="card">✅ انجام شده: ${totalDone} از ${totalTasks} جلسه</div>
    <div class="card">⏱️ زمان مطالعه: ${Math.round(doneMinutes/60)} ساعت</div>
  `;

  // نمایش لیست جلسات در پنل
  const panelEl = document.getElementById('todayTasks');
  if (allPending.length === 0) {
    panelEl.innerHTML = '<div class="card" style="border-color:#4ecca3; text-align:center;">🎉 تبریک! تمام برنامه انجام شد.</div>';
    return;
  }

  let html = '<div class="session-list">';
  allPending.slice(0, 15).forEach(session => {
    const isReview = session.type === 'review';
    const badge = isReview ? '<span style="color:#f9ca24">[مرور]</span>' : '';
    
    html += `
      <label class="session-item">
        <input type="checkbox" onchange="toggleSession('${session.id}')">
        <div class="session-info">
          <strong>${session.subject} ${badge}</strong> - ${session.chapter}
          <small>📅 روز ${session.day} | ⏱️ ${session.minutes} دقیقه</small>
        </div>
      </label>
    `;
  });
  html += '</div>';
  panelEl.innerHTML = html;
}

// تیک زدن جلسه
function toggleSession(sessionId) {
  const session = PLAN.find(s => s.id === sessionId);
  if (!session) return;
  session.done = !session.done;
  DB.set('plan', PLAN);
  renderDashboard(); // آپدیت خودکار
}

// ==========================================
// ۳. برنامه کل (Full Plan)
// ==========================================
function renderPlan() {
  const byDay = {};
  PLAN.forEach(p => {
    if (!byDay[p.day]) byDay[p.day] = [];
    byDay[p.day].push(p);
  });

  const el = document.getElementById('weeklyPlan');
  if (Object.keys(byDay).length === 0) {
    el.innerHTML = '<p>برنامه‌ای ساخته نشده است. به تنظیمات بروید.</p>';
    return;
  }

  let html = '';
  for (let i = 1; i <= 7; i++) {
    if (!byDay[i]) continue;
    
    html += `<div class="card">
      <h4 style="margin-top:0; color:#4ecca3;">📅 روز ${i}</h4>
      <ul style="padding-right: 20px; margin: 0;">`;
      
    byDay[i].forEach(t => {
      const opacity = t.done ? '0.5' : '1';
      const textDec = t.done ? 'line-through' : 'none';
      const badge = t.type === 'review' ? ' (مرور)' : '';
      html += `<li style="margin-bottom:8px; opacity:${opacity}; text-decoration:${textDec};">
        ${t.done ? '✅' : '⬜'} ${t.subject}${badge} - ${t.chapter} (${t.minutes}د)
      </li>`;
    });
    
    html += `</ul></div>`;
  }
  el.innerHTML = html;
}

// ==========================================
// ۴. آزمون‌ساز (Quiz Builder UI)
// ==========================================
function toggleQuizType() {
  const type = document.getElementById('quizType').value;
  document.getElementById('customOptions').style.display = type === 'custom' ? 'block' : 'none';
}

function loadChapters() {
  const subject = document.getElementById('quizSubject').value;
  const grade = document.getElementById('quizGrade').value;
  
  // استفاده از دیتابیسی که در فایل quiz-engine.js وجود دارد
  const chapters = QUESTION_BANK[subject]?.[grade] || {};
  
  const listEl = document.getElementById('chapterList');
  const keys = Object.keys(chapters);
  
  if (keys.length === 0) {
    listEl.innerHTML = '<p style="color:#a0a0a0;">سوالی برای این پایه ثبت نشده است.</p>';
    return;
  }

  listEl.innerHTML = keys.map(ch => `
    <label class="session-item">
      <input type="checkbox" value="${ch}" checked>
      <span>${ch}</span>
    </label>
  `).join('');
}

function createQuiz() {
  const subject = document.getElementById('quizSubject').value;
  const type = document.getElementById('quizType').value;
  const count = +document.getElementById('quizCount').value;
  
  if (type === 'custom') {
    const grade = document.getElementById('quizGrade').value;
    const chapters = [...document.querySelectorAll('#chapterList input:checked')].map(i => i.value);
    
    if (chapters.length === 0) { 
      alert("حداقل یک فصل انتخاب کنید."); 
      return; 
    }
    // فراخوانی تابع از quiz-engine.js
    if (typeof startCustomQuiz === 'function') {
      startCustomQuiz(subject, grade, chapters, count);
    }
  } else {
    if (typeof startComprehensiveQuiz === 'function') {
      startComprehensiveQuiz(subject, count);
    }
  }
}

// ==========================================
// ۵. تحلیل آزمون (Exam Analytics)
// ==========================================
function renderExams() {
  const el = document.getElementById('examList');
  if (!el) return;
  
  if (EXAMS.length === 0) {
    el.innerHTML = '<p style="color:#a0a0a0;">هنوز آزمونی ثبت نشده است.</p>';
    return;
  }

  let html = '';
  EXAMS.slice().reverse().forEach(e => {
    html += `<div class="card">${e.subject}: ${e.percent}% — تراز تخمینی: ${e.traz}</div>`;
  });
  el.innerHTML = html;
}

// ==========================================
// ۶. دفتر اشتباهات (Mistakes)
// ==========================================
function addMistake() {
  const txt = document.getElementById('mistakeText').value.trim();
  if (!txt) return;
  
  MISTAKES.push({ text: txt, date: Date.now() });
  DB.set('mistakes', MISTAKES);
  
  document.getElementById('mistakeText').value = '';
  renderMistakes();
}

function renderMistakes() {
  const el = document.getElementById('mistakeList');
  if (!el) return;

  if (MISTAKES.length === 0) {
    el.innerHTML = '<p style="color:#a0a0a0;">دفتر اشتباهات خالی است.</p>';
    return;
  }

  el.innerHTML = MISTAKES.slice().reverse().map(m => `
    <li>${m.text}</li>
  `).join('');
}

// ==========================================
// شروع به کار
// ==========================================
init();
