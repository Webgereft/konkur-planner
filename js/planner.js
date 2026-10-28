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
  for (const [subject, info] of Object.entries(subjects)) {
    for (const [grade, chapterCount] of Object.entries(info.chapters)) {
      for (let i = 1; i <= chapterCount; i++) {
        const chapterName = `${grade} - فصل ${i}`;
        const weight = info.coeff * (1 + (chapterCount - i) * 0.1); 
        topics.push({ subject, grade, chapter: chapterName, weight });
      }
    }
  }

  topics.sort((a, b) => b.weight - a.weight);

  const totalMinutes = daysLeft * dailyHours * 60;
  const totalWeight = topics.reduce((sum, t) => sum + t.weight, 0);
  
  let plan = [];
  let dayIndex = 1;
  let minutesToday = 0;
  const dayLimit = dailyHours * 60;
  let sessionId = 1;

  topics.forEach(topic => {
    const share = (topic.weight / totalWeight) * totalMinutes;
    let remainingMinutes = Math.max(45, Math.round(share));

    while (remainingMinutes > 0) {
      const sessionTime = Math.min(remainingMinutes, 90);
      
      if (minutesToday + sessionTime > dayLimit) {
        dayIndex++;
        minutesToday = 0;
        if (dayIndex > daysLeft) break;
      }

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

      [1, 3, 7].forEach(gap => {
        const reviewDay = dayIndex + gap;
        if (reviewDay <= daysLeft) {
          plan.push({
            id: `r_${sessionId++}`,
            day: reviewDay,
            subject: topic.subject,
            chapter: topic.chapter,
            minutes: 15,
            type: 'review',
            done: false
          });
        }
      });
    }
  });

  plan.sort((a, b) => a.day - b.day || a.type.localeCompare(b.type));
  return plan;
}
