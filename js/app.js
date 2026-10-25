let CONFIG = DB.get('config', null);
let PLAN = DB.get('plan', []);
let EXAMS = DB.get('exams', []);
let MISTAKES = DB.get('mistakes', []);

function init() {
  if (!CONFIG) showPage('setup');
  else { showPage('dashboard'); }
}

function showPage(name, btn = null) {
  document.querySelectorAll('.page').forEach(p => p.classList.add('hidden'));
  document.getElementById('page-' + name)?.classList.remove('hidden');
  
  if (btn) {
    document.querySelectorAll('nav button').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
  }

  if (name === 'dashboard') renderDashboard();
  if (name === 'plan') renderPlan();
  if (name === 'quiz') { toggleQuizType(); loadChapters(); }
  if (name === 'analytics') renderExams();
  if (name === 'mistakes') renderMistakes();
}

function saveSetup() {
  CONFIG = {
    field: document.getElementById('field').value,
    daysLeft: +document.getElementById('daysLeft').value,
    dailyHours: +document.getElementById('dailyHours').value,
  };
  DB.set('config', CONFIG);
  PLAN = generatePlan(CONFIG);
  DB.set('plan', PLAN);
  showPage('dashboard');
}

// --- پنل ---
function getPendingSessions() {
  return PLAN.filter(session => !session.done).sort((a, b) => a.day - b.day);
}

function renderDashboard() {
  if (!CONFIG) return;
  const pending = getPendingSessions();
  const doneMin = PLAN.filter(p => p.done).reduce((s, p) => s + p.minutes, 0);
  const totalMin = PLAN.reduce((s, p) => s + p.minutes, 0);

  document.getElementById('summary').innerHTML = `
    <div class="card">📖 رشته: ${CONFIG.field}</div>
    <div class="card">⏳ روز مانده: ${CONFIG.daysLeft}</div>
    <div class="card">✅ انجام شده: ${PLAN.length - pending.length} جلسه</div>
    <div class="card">⏱️ زمان: ${Math.round(doneMin/60)} از ${Math.round(totalMin/60)} ساعت</div>
  `;

  const panelEl = document.getElementById('todayTasks');
  if (pending.length === 0) {
    panelEl.innerHTML = '<div class="card" style="border-color:#4ecca3; text-align:center;">🎉 تمام جلسات انجام شد.</div>';
    return;
  }

  panelEl.innerHTML = `
    <div class="session-list">
      ${pending.slice(0, 15).map(session => `
        <label class="session-item">
          <input type="checkbox" onchange="toggleSession('${session.id}')">
          <div class="session-info">
            <strong>${session.subject} (${session.grade})</strong> — ${session.chapter}
            <small>⏱️ ${session.minutes} دقیقه • 📅 روز ${session.day}</small>
          </div>
        </label>
      `).join('')}
    </div>
  `;
}

function toggleSession(sessionId) {
  const session = PLAN.find(s => s.id === sessionId);
  if (!session) return;
  session.done = !session.done;
  DB.set('plan', PLAN);
  renderDashboard();
}

function renderPlan() {
  const byDay = {};
  PLAN.forEach(p => { (byDay[p.day] = byDay[p.day] || []).push(p); });
  
  document.getElementById('weeklyPlan').innerHTML = Object.entries(byDay).slice(0, 7).map(([day, tasks]) => `
    <div class="card">
      <h4 style="margin-top:0; color:#4ecca3;">روز ${day}</h4>
      <ul style="padding-right: 20px; margin: 0;">
        ${tasks.map(t => `<li style="margin-bottom:8px; opacity:${t.done ? 0.5 : 1}">${t.done ? '✅' : '⬜'} ${t.subject} (${t.grade}) - ${t.chapter} (${t.minutes}د)</li>`).join('')}
      </ul>
    </div>
  `).join('');
}

// --- آزمون ساز UI ---
function toggleQuizType() {
  const type = document.getElementById('quizType').value;
  document.getElementById('customOptions').style.display = type === 'custom' ? 'block' : 'none';
}

function loadChapters() {
  const subject = document.getElementById('quizSubject').value;
  const grade = document.getElementById('quizGrade').value;
  const chapters = SUBJECTS_DB["تجربی"][subject]?.[grade] || {};
  document.getElementById('chapterList').innerHTML = Object.keys(chapters).map(ch => `
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
    if (chapters.length === 0) { alert("حداقل یک فصل انتخاب کنید."); return; }
    startCustomQuiz(subject, grade, chapters, count);
  } else {
    startComprehensiveQuiz(subject, count);
  }
}

// --- تحلیل آزمون ---
document.getElementById('examForm')?.addEventListener('submit', e => {
  e.preventDefault();
  const subject = document.getElementById('examSubject').value;
  const percent = +document.getElementById('examPercent').value;
  const coeff = 7; // پیش‌فرض برای ثبت دستی
  
  EXAMS.push({ subject, percent, traz: estimateTraz(percent, coeff) });
  DB.set('exams', EXAMS);
  renderExams();
  e.target.reset();
});

function renderExams() {
  const stats = progressStats(EXAMS);
  document.getElementById('examList').innerHTML = `
    <div class="card" style="margin-bottom:15px;">📈 میانگین: <strong>${stats.avg}%</strong> | تعداد: ${stats.count}</div>
    ${EXAMS.slice().reverse().map(e => `<div class="card">${e.subject}: ${e.percent}% — تراز: ${e.traz}</div>`).join('')}
  `;
}

// --- دفتر اشتباهات ---
function addMistake() {
  const txt = document.getElementById('mistakeText').value.trim();
  if (!txt) return;
  MISTAKES.push({ text: txt });
  DB.set('mistakes', MISTAKES);
  document.getElementById('mistakeText').value = '';
  renderMistakes();
}

function renderMistakes() {
  document.getElementById('mistakeList').innerHTML = MISTAKES.map(m => `<li>${m.text}</li>`).join('');
}

init();
