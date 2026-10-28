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
  const done = PLAN.filter(s => s.done
