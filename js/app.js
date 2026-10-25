// --- 1. ذخیره تنظیمات و ساخت برنامه ---
function saveSetup() {
  const daysLeft = +document.getElementById('daysLeft').value;
  const dailyHours = +document.getElementById('dailyHours').value;
  
  if (!daysLeft || !dailyHours) {
    alert("لطفاً روزهای باقی‌مانده و ساعت مطالعه را وارد کنید.");
    return;
  }

  CONFIG = {
    field: document.getElementById('field').value,
    daysLeft: daysLeft,
    dailyHours: dailyHours
  };
  
  DB.set('config', CONFIG);
  
  // ساخت برنامه هوشمند
  PLAN = generatePlan(CONFIG);
  DB.set('plan', PLAN);
  
  // رفتن به داشبورد
  showPage('dashboard', document.querySelector('nav button:nth-child(2)'));
}

// --- 2. رندر کردن داشبورد (نمایش تسک‌های امروز) ---
function renderDashboard() {
  if (!CONFIG) return;
  
  // پیدا کردن تسک‌ها (مرتب‌شده بر اساس روز)
  const allPending = PLAN.filter(s => !s.done).sort((a, b) => a.day - b.day);
  
  // محاسبه آمار
  const totalDone = PLAN.filter(s => s.done).length;
  const totalTasks = PLAN.length;
  const doneMinutes = PLAN.filter(s => s.done).reduce((sum, s) => sum + s.minutes, 0);

  document.getElementById('summary').innerHTML = `
    <div class="card">📖 رشته: ${CONFIG.field}</div>
    <div class="card">⏳ روز مانده: ${CONFIG.daysLeft}</div>
    <div class="card">✅ انجام شده: ${totalDone} از ${totalTasks} جلسه</div>
    <div class="card">⏱️ زمان مطالعه: ${Math.round(doneMinutes/60)} ساعت</div>
  `;

  const panelEl = document.getElementById('todayTasks');
  if (allPending.length === 0) {
    panelEl.innerHTML = '<div class="card" style="border-color:#4ecca3; text-align:center;">🎉 تبریک! تمام برنامه انجام شد.</div>';
    return;
  }

  // نمایش 15 جلسه بعدی
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

// --- 3. تیک زدن جلسات ---
function toggleSession(sessionId) {
  const session = PLAN.find(s => s.id === sessionId);
  if (!session) return;
  
  session.done = !session.done;
  DB.set('plan', PLAN);
  renderDashboard(); // آپدیت خودکار پنل
}

// --- 4. رندر کردن صفحه کل برنامه ---
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

  // نمایش ۷ روز اول
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
