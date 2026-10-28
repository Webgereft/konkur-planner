let QUESTION_BANK = {}; // این متغیر بعدا با آپلود PDF پر می‌شود
let currentQuiz = { questions: [], answers: [], startTime: null, timerInterval: null, subject: "" };

function startCustomQuiz(subject, grade, chapters, count) {
  let pool = [];
  chapters.forEach(ch => {
    const bank = QUESTION_BANK[subject]?.[grade]?.[ch];
    if (bank) pool.push(...bank);
  });
  if (pool.length === 0) { alert("سوالی برای این فصل‌ها در سیستم ثبت نشده است!"); return; }
  
  const selected = pool.sort(() => 0.5 - Math.random()).slice(0, Math.min(count, pool.length));
  initQuizSession(selected, `${subject} - ${grade}`);
}

function startComprehensiveQuiz(subject, count) {
  let pool = [];
  const grades = Object.keys(QUESTION_BANK[subject] || {});
  grades.forEach(g => {
    const chapters = QUESTION_BANK[subject][g];
    Object.values(chapters).forEach(arr => pool.push(...arr));
  });
  if (pool.length === 0) { alert("سوالی برای این درس ثبت نشده است!"); return; }
  const selected = pool.sort(() => 0.5 - Math.random()).slice(0, Math.min(count, pool.length));
  initQuizSession(selected, `آزمون جامع ${subject}`);
}

function initQuizSession(questions, title) {
  currentQuiz.questions = questions;
  currentQuiz.answers = new Array(questions.length).fill(null);
  currentQuiz.startTime = Date.now();
  currentQuiz.subject = title;
  
  document.getElementById('quizSetupArea').classList.add('hidden');
  document.getElementById('quizArea').classList.remove('hidden');
  
  renderQuizUI();
  
  if (currentQuiz.timerInterval) clearInterval(currentQuiz.timerInterval);
  currentQuiz.timerInterval = setInterval(() => {
    const diff = Math.floor((Date.now() - currentQuiz.startTime) / 1000);
    const m = String(Math.floor(diff / 60)).padStart(2, '0');
    const s = String(diff % 60).padStart(2, '0');
    document.getElementById('quizTimer').innerText = `⏱️ زمان: ${m}:${s}`;
  }, 1000);
}

function renderQuizUI() {
  const container = document.getElementById('quizQuestions');
  container.innerHTML = currentQuiz.questions.map((q, i) => `
    <div class="question-card">
      <h4>${i+1}. ${q.q}</h4>
      ${q.options.map((opt, oi) => `
        <label class="option-label">
          <input type="radio" name="q${i}" value="${oi}" onchange="currentQuiz.answers[${i}] = ${oi}">
          <span>${opt}</span>
        </label>
      `).join('')}
    </div>
  `).join('');
}

function submitQuiz() {
  clearInterval(currentQuiz.timerInterval);
  let correct = 0;
  let wrong = 0;
  
  currentQuiz.questions.forEach((q, i) => {
    if (currentQuiz.answers[i] === q.answer) correct++;
    else if (currentQuiz.answers[i] !== null) wrong++;
  });
  
  const total = currentQuiz.questions.length;
  const percent = total > 0 ? Math.round((correct / total) * 100) : 0;
  const traz = 5000 + (percent - 50) * 20;

  EXAMS.push({ subject: currentQuiz.subject, percent, traz: Math.round(traz) });
  DB.set('exams', EXAMS);

  document.getElementById('res-subject').innerText = currentQuiz.subject;
  document.getElementById('res-total').innerText = total;
  document.getElementById('res-correct').innerText = correct;
  document.getElementById('res-wrong').innerText = wrong;
  document.getElementById('res-traz').innerText = Math.round(traz);
  
  const circle = document.getElementById('res-percent-circle');
  const text = document.getElementById('res-percent-text');
  text.innerText = percent + '%';
  
  circle.className = 'result-circle';
  if (percent >= 50) { circle.style.borderColor = '#10b981'; circle.style.color = '#10b981'; circle.style.boxShadow = '0 0 20px rgba(16, 185, 129, 0.4)'; } 
  else if (percent >= 30) { circle.style.borderColor = '#f59e0b'; circle.style.color = '#f59e0b'; circle.style.boxShadow = '0 0 20px rgba(245, 158, 11, 0.4)'; } 
  else { circle.style.borderColor = '#f43f5e'; circle.style.color = '#f43f5e'; circle.style.boxShadow = '0 0 20px rgba(244, 63, 94, 0.4)'; }

  document.getElementById('quizArea').classList.add('hidden');
  showPage('exam-result', document.querySelector('nav button[data-target="quiz"]'));
}
