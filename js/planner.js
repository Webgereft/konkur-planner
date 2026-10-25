// ==========================================
// دیتابیس دروس و ضرایب (برای رشته تجربی)
// ==========================================
const PLANNER_DB = {
  "تجربی": {
    "زیست": { "coeff": 12, "chapters": { "دهم": 7, "یازدهم": 9, "دوازدهم": 8 } },
    "شیمی": { "coeff": 9, "chapters": { "دهم": 3, "یازدهم": 3, "دوازدهم": 4 } },
    "فیزیک": { "coeff": 7, "chapters": { "دهم": 4, "یازدهم": 3, "دوازدهم": 4 } },
    "ریاضی": { "coeff": 7, "chapters": { "دهم": 5, "یازدهم": 4, "دوازدهم": 3 } },
    "زمین‌شناسی": { "coeff": 1, "chapters": { "یازدهم": 7, "دوازدهم": 5 } }
  }
};

function generatePlan(config) {
  const { field, daysLeft, dailyHours } = config;
  const subjects = PLANNER_DB[field];
  if (!subjects) return [];

  let topics = [];

  // 1. استخراج مباحث و محاسبه وزن هوشمند
  for (const [subject, info] of Object.entries(subjects)) {
    for (const [grade, chapterCount] of Object.entries(info.chapters)) {
      for (let i = 1; i <= chapterCount; i++) {
        const chapterName = `${grade} - فصل ${i}`;
        // وزن = ضریب درس * اهمیت فصل (فرض میکنیم فصول اول وزن بیشتری دارند)
        const weight = info.coeff * (1 + (chapterCount - i) * 0.1); 
        topics.push({ subject, grade, chapter: chapterName, weight });
      }
    }
  }

  // 2. مرتب‌سازی مباحث بر اساس وزن (سخت‌ترین و مهم‌ترین مباحث اول)
  topics.sort((a, b) => b.weight - a.weight);

  // 3. محاسبه ظرفیت زمانی
  const totalMinutes = daysLeft * dailyHours * 60;
  const totalWeight = topics.reduce((sum, t) => sum + t.weight, 0);
  
  let plan = [];
  let dayIndex = 1;
  let minutesToday = 0;
  const dayLimit = dailyHours * 60;
  let sessionId = 1;

  // 4. توزیع مباحث در روزها و جلسات
  topics.forEach(topic => {
    // سهم این مبحث از کل زمان
    const share = (topic.weight / totalWeight) * totalMinutes;
    let remainingMinutes = Math.max(45, Math.round(share)); // حداقل 45 دقیقه

    // تقسیم به جلسات حداکثر 90 دقیقه‌ای (پومودورو)
    while (remainingMinutes > 0) {
      const sessionTime = Math.min(remainingMinutes, 90); // حداکثر 90 دقیقه در یک جلسه
      
      // اگر امروز جا نداریم، برو روز بعد
      if (minutesToday + sessionTime > dayLimit) {
        dayIndex++;
        minutesToday = 0;
        if (dayIndex > daysLeft) break; // اگر از روزهای باقی‌مانده گذشت
      }

      // اضافه کردن جلسه مطالعه
      plan.push({
        id: `s_${sessionId++}`,
        day: dayIndex,
        subject: topic.subject,
        chapter: topic.chapter,
        minutes: sessionTime,
        type: 'study',
        done: false
      });
      minutesToday += sessionTime;
      remainingMinutes -= sessionTime;

      // 5. اضافه کردن جلسات مرور هوشمند (بعد از 1 و 3 و 7 روز)
      [1, 3, 7].forEach(gap => {
        const reviewDay = dayIndex + gap;
        if (reviewDay <= daysLeft) {
          plan.push({
            id: `r_${sessionId++}`,
            day: reviewDay,
            subject: topic.subject,
            chapter: topic.chapter,
            minutes: 15, // زمان مرور
            type: 'review',
            done: false
          });
        }
      });
    }
  });

  // مرتب‌سازی نهایی بر اساس روز
  plan.sort((a, b) => a.day - b.day || a.type.localeCompare(b.type));
  return plan;
}
