let CONFIG = DB.get('config', null);
let PLAN = DB.get('plan', []);
let EXAMS = DB.get('exams', []);
let MISTAKES = DB.get('mistakes', []);

function init() {
  if (!CONFIG) {
    showPage('setup', document.querySelector('nav button[data-target="setup"]'));
  } else {
    showPage('dashboard', document.querySelector('nav button[data-target="dashboard"]'));
  }
  startCountdown();
}

function showPage(name, btn = null) {
  document.querySelectorAll('.page').forEach(p => p.classList.add('hidden'));
  const target = document.getElementById('page-' + name);
  if (target) target.classList.remove('hidden');
  
  if (btn) {
    document.querySelectorAll('nav button').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
  }

  if (name === 'dashboard') renderDashboard();
  if (name === 'plan') renderPlan();
  if (name === 'quiz') { 
    document.getElementById('quizArea').classList.add('hidden');
    document.getElementById('quizSetupArea').classList.remove('hidden');
    toggleQuizType(); loadChapters(); 
  }
  if (name === 'analytics') renderExams();
  if (name === 'mistakes') renderMistakes();
}

function startCountdown() {
  const targetDate = new Date('2025-06-30T08:00:00').getTime(); 
  const timer = setInterval(() => {
    const now = new Date().getTime();
    const distance = targetDate - now;
    if (distance < 0) {
      clearInterval(timer);
      document.getElementById('countdown-timer').innerHTML = "<h3 style='color:var(--success)'>زمان کنکور فرا رسیده است! موفق باشید</h3>";
      return;
    }
    const days = Math.floor(distance / (1000 * 60 * 60 * 24));
    const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((distance % (1000 * 60)) / 1000);
    document.getElementById('countdown-timer').innerHTML = `
      <div class="cd-box"><span>${days}</span><small>روز</small></div>
      <div class="cd-box"><span>${hours}</span><small>ساعت</small></div>
      <div class="cd-box"><span>${minutes}</span><small>دقیقه</small></div>
      <div class="cd-box"><span>${seconds}</span><small>ثانیه</small></div>
    `;
  }, 1000);
}

function clearPlan() {
  if(confirm("آیا مطمئن هستید؟ تمام برنامه‌ها پاک می‌شوند.")) {
    PLAN = [];
    DB.set('plan', PLAN);
    renderPlan();
    renderDashboard();
  }
}

function saveSetup() {
  const daysLeft = +document.getElementById('daysLeft').value;
  const dailyHours = +document.getElementById('dailyHours').value;
  if (!daysLeft || !dailyHours) return alert("مقادیر را وارد کنید");
  CONFIG = { field: 'تجربی', daysLeft, dailyHours };
  DB.set('config', CONFIG);
  if (typeof generatePlan === 'function') {
    PLAN = generatePlan(CONFIG);
    DB.set('plan', PLAN);
    showPage('dashboard', document.querySelector('nav button[data-target="dashboard"]'));
  } else {
    alert("خطا در ساخت برنامه.");
  }
}

function addManualSession() {
  const day = +document.getElementById('manualDay').value;
  const subject = document.getElementById('manualSubject').value;
  const chapter = document.getElementById('manualChapter').value.trim();
  const minutes = +document.getElementById('manualMinutes').value;
  if (!day || !chapter || !minutes) return alert("مقادیر را کامل کنید.");
  PLAN.push({ id: 'manual_' + Date.now(), day, subject, chapter, minutes, type: 'manual', done: false });
  DB.set('plan', PLAN);
  document.getElementById('manualChapter').value = '';
  renderPlan();
}

function deleteSession(id) {
  if(confirm("حذف شود؟")) {
    PLAN = PLAN.filter(s => s.id !== id);
    DB.set('plan', PLAN);
    renderPlan();
    renderDashboard();
  }
}

function renderDashboard() {
  if (!CONFIG) return;
  const pending = PLAN.filter(s => !s.done).sort((a, b) => a.day - b.day);
  const done = PLAN.filter(s => s.done).length;
  const doneMin = PLAN.filter(s => s.done).reduce((sum, s) => sum + s.minutes, 0);

  document.getElementById('summary').innerHTML = `
    <div class="card">📖 رشته: ${CONFIG.field}</div>
    <div class="card">✅ انجام شده: ${done} از ${PLAN.length}</div>
    <div class="card">⏱️ مطالعه: ${Math.round(doneMin/60)} ساعت</div>
  `;

  const panel = document.getElementById('todayTasks');
  if (pending.length === 0) {
    panel.innerHTML = '<div class="card" style="border-color:#10b981; text-align:center;">🎉 برنامه تمام شد!</div>';
    return;
  }

  panel.innerHTML = pending.slice(0, 15).map(s => `
    <label class="session-item">
      <input type="checkbox" onchange="toggleSession('${s.id}')">
      <div class="session-info">
        <strong>${s.subject} ${s.type==='review'?'(مرور)':''}</strong> - ${s.chapter}
        <small>📅 روز ${s.day} | ⏱️ ${s.minutes} دقیقه</small>
      </div>
    </label>
  `).join('');
}

function toggleSession(id) {
  const s = PLAN.find(x => x.id === id);
  if (s) { s.done = !s.done; DB.set('plan', PLAN); renderDashboard(); }
}

function renderPlan() {
  const byDay = {};
  PLAN.forEach(p => { if (!byDay[p.day]) byDay[p.day] = []; byDay[p.day].push(p); });
  const sortedDays = Object.keys(byDay).sort((a, b) => a - b);
  const el = document.getElementById('weeklyPlan');
  
  if (sortedDays.length === 0) {
    el.innerHTML = '<p style="color:#a1a1aa; text-align:center;">برنامه‌ای وجود ندارد.</p>';
    return;
  }

  let html = '';
  sortedDays.forEach(day => {
    html += `<div class="card"><h4>📅 روز ${day}</h4><ul>`;
    byDay[day].forEach(t => {
      const deleteBtn = `<button onclick="deleteSession('${t.id}')" style="background:transparent; border:none; color:#f43f5e; cursor:pointer;"><i class="fa-solid fa-trash"></i></button>`;
      html += `<li style="display:flex; justify-content:space-between; align-items:center; opacity:${t.done?'0.5':'1'}; text-decoration:${t.done?'line-through':'none'};">
        <span>${t.done ? '✅' : '⬜'} <b>${t.subject}</b> - ${t.chapter} (${t.minutes}د)</span>
        ${deleteBtn}
      </li>`;
    });
    html += `</ul></div>`;
  });
  el.innerHTML = html;
}

function toggleQuizType() {
  const type = document.getElementById('quizType').value;
  document.getElementById('customOptions').style.display = type === 'custom' ? 'block' : 'none';
}

function loadChapters() {
  const subject = document.getElementById('quizSubject').value;
  const grade = document.getElementById('quizGrade').value;
  // از QUESTION_BANK که در quiz-engine.js پر شده استفاده میکنیم
  const chapters = (typeof QUESTION_BANK !== 'undefined' && QUESTION_BANK[subject] && QUESTION_BANK[subject][grade]) ? QUESTION_BANK[subject][grade] : {};
  
  const list = document.getElementById('chapterList');
  const keys = Object.keys(chapters);
  if (keys.length === 0) { list.innerHTML = '<p style="color:#a1a1aa; font-size:0.8rem;">سوالی نیست.</p>'; return; }
  list.innerHTML = keys.map(ch => `<label><input type="checkbox" value="${ch}" checked> ${ch}</label>`).join('');
}

function createQuiz() {
  const subject = document.getElementById('quizSubject').value;
  const type = document.getElementById('quizType').value;
  const count = +document.getElementById('quizCount').value;
  
  if (type === 'custom') {
    const grade = document.getElementById('quizGrade').value;
    const chs = [...document.querySelectorAll('#chapterList input:checked')].map(i => i.value);
    if (chs.length === 0) return alert("یک فصل انتخاب کنید");
    if (typeof startCustomQuiz === 'function') startCustomQuiz(subject, grade, chs, count);
  } else {
    if (typeof startComprehensiveQuiz === 'function') startComprehensiveQuiz(subject, count);
  }
}

function renderExams() {
  const el = document.getElementById('examList');
  if (EXAMS.length === 0) { el.innerHTML = '<p>خالی است.</p>'; return; }
  el.innerHTML = EXAMS.slice().reverse().map(e => `
    <div class="session-item" style="cursor:default;">
      <div class="session-info"><strong>${e.subject}</strong>: ${e.percent}% (تراز: ${e.traz})</div>
    </div>`).join('');
}

function addMistake() {
  const txt = document.getElementById('mistakeText').value.trim();
  if (!txt) return;
  MISTAKES.push({ text: txt });
  DB.set('mistakes', MISTAKES);
  document.getElementById('mistakeText').value = '';
  renderMistakes();
}

function renderMistakes() {
  const el = document.getElementById('mistakeList');
  if (MISTAKES.length === 0) { el.innerHTML = '<p>خالی است.</p>'; return; }
  el.innerHTML = MISTAKES.slice().reverse().map(m => `<li>${m.text}</li>`).join('');
}

init();
