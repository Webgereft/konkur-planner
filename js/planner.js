function generatePlan(config) {
  const { field, daysLeft, dailyHours } = config;
  const data = SUBJECTS_DB[field];
  if (!data) return [];

  const topics = [];
  
  // استخراج مباحث با توجه به ساختار جدید (پایه‌ها)
  for (const [subject, info] of Object.entries(data)) {
    for (const [grade, chapters] of Object.entries(info)) {
      if (grade === "ضریب") continue;
      
      for (const [chapter, count] of Object.entries(chapters)) {
        // وزن بر اساس ضریب درس و تعداد سوال آن فصل
        const weight = info["ضریب"] * count; 
        topics.push({ subject, grade, chapter, weight });
      }
    }
  }

  // مرتب‌سازی بر اساس وزن (ضرایب و سوالات بالاتر اول)
  topics.sort((a, b) => b.weight - a.weight);

  const totalMinutes = daysLeft * dailyHours * 60;
  const totalWeight = topics.reduce((s, t) => s + t.weight, 0) || 1;
  
  const plan = [];
  let dayIndex = 1;
  let minutesToday = 0;
  const dayLimit = dailyHours * 60;

  topics.forEach(t => {
    const share = (t.weight / totalWeight) * totalMinutes;
    let remaining = Math.max(45, Math.round(share)); 
    
    while (remaining > 0) {
      const slot = Math.min(remaining, dayLimit - minutesToday);
      if (slot <= 0) {
        dayIndex++;
        minutesToday = 0;
        if (dayIndex > daysLeft) break;
        continue;
      }
      plan.push({
        id: `session_${plan.length}`,
        day: dayIndex,
        subject: t.subject,
        grade: t.grade,
        chapter: t.chapter,
        minutes: slot,
        done: false
      });
      minutesToday += slot;
      remaining -= slot;
    }
  });

  return plan;
}
