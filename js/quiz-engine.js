// بانک سوال (نمونه - شما باید سوالات کنکور را اینجا اضافه کنید)
const QUESTION_BANK = {
  "زیست": {
    "دهم": {
      "گوارش و جذب مواد": [
        { q: "کدام آنزیم در دهان شروع به هضم نشاسته می‌کند؟", options: ["آمیلاز", "پپسین", "لیپاز", "تریپسین"], answer: 0 },
        { q: "جذب اصلی مواد مغذی در کدام بخش انجام می‌شود؟", options: ["معده", "روده باریک", "روده بزرگ", "مری"], answer: 1 }
      ]
    }
  },
  "شیمی": {
    "دهم": {
      "آرایش الکترونی و جدول تناوبی": [
        { q: "عنصری با عدد اتمی 17 در کدام گروه جدول تناوبی قرار دارد؟", options: ["گروه 1", "گروه 17", "گروه 18", "گروه 2"], answer: 1 }
      ]
    }
  }
};

let currentQuiz = { questions: [], answers: [], startTime: null, timerInterval: null, subject: "" };

function startCustomQuiz(subject, grade, chapters, count) {
  let pool = [];
  chapters.forEach(ch => {
    const bank = QUESTION_BANK[subject]?.[grade]?.[ch];
    if (bank) pool.push(...bank);
  });
  if (pool.length === 0) { alert("هنوز سوالی برای این فصل‌ها در سیستم ثبت نشده است!"); return; }
  
  const selected = pool.sort(() => 0.5 - Math.random()).slice(0, Math.min(count, pool.length));
  initQuizSession(selected, `${subject} - ${grade}`);
}

function startComprehensiveQuiz(subject, count) {
  let pool = [];
  const grades = Object.keys(SUBJECTS_DB["تجربی"][subject] || {}).filter(k => k !== "ضریب");
  grades.forEach(g => {
    Object.values(QUESTION_BANK[subject]?.[g] || {}).forEach(arr => pool.push(...arr));
  });
  if (pool.length === 0) { alert("هنوز سوالی برای این درس در سیستم ثبت نشده است!"); return; }
  
  const selected = pool.sort(() => 0.5 - Math.random()).slice(0, Math.min(count, pool.length));
  initQuizSession(selected, `آزمون جامع ${subject}`);
}

function initQuizSession(questions, title) {
  currentQuiz.questions = questions;
  currentQuiz.answers = new Array(questions.length).fill(null);
  currentQuiz.startTime = Date.now();
  currentQuiz.subject = title;
  
  document.querySelector('.card label').classList.add('hidden'); // مخفی کردن تنظیمات
  
  renderQuizUI();
  
  // شروع تایمر
  if (currentQuiz.timerInterval) clearInterval(currentQuiz.timerInterval);
  currentQuiz.timerInterval = setInterval(() => {
    const diff = Math.floor((Date.now() - currentQuiz.startTime) / 1000);
    const m = String(Math.floor(diff / 60)).padStart(2, '0');
    const s = String(diff % 60).padStart(2, '0');
    document.getElementById('quizTimer').innerText = `⏱️ زمان: ${m}:${s}`;
  }, 1000);
}

function renderQuizUI() {
  document.getElementById('quizArea').classList.remove('hidden');
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
  
  currentQuiz.questions.forEach((q, i) => {
    if (currentQuiz.answers[i] === q.answer) correct++;
  });
  
  const percent = Math.round((correct / currentQuiz.questions.length) * 100);
  
  // ثبت در بخش تحلیل
  const coeff = SUBJECTS_DB["تجربی"][currentQuiz.subject.split(' ')[0]]?.["ضریب"] || 5;
  EXAMS.push({ subject: currentQuiz.subject, percent, traz: estimateTraz(percent, coeff) });
  DB.set('exams', EXAMS);
  
  alert(`آزمون تمام شد!\nپاسخ صحیح: ${correct} از ${currentQuiz.questions.length}\nدرصد شما: ${percent}%\n\nنتیجه در بخش "تحلیل آزمون" ذخیره شد.`);
  showPage('analytics');
}
