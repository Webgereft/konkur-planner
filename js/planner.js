
"use strict";

/*
 * برنامه‌ریز کنکوریار
 * نسخه اول: برنامه‌ریزی ظرفیت‌محور با مرور فاصله‌دار
 *
 * توجه:
 * تعداد فصل‌ها و ضرایب زیر همان اطلاعات اولیه پروژه هستند
 * و باید در صورت تغییر منابع رسمی قابل ویرایش باشند.
 */

const PLANNER_DB = {
  "تجربی": {
    "زیست‌شناسی": {
      coeff: 12,
      chapters: {
        "دهم": 7,
        "یازدهم": 9,
        "دوازدهم": 8
      }
    },
    "شیمی": {
      coeff: 9,
      chapters: {
        "دهم": 3,
        "یازدهم": 3,
        "دوازدهم": 4
      }
    },
    "فیزیک": {
      coeff: 7,
      chapters: {
        "دهم": 4,
        "یازدهم": 3,
        "دوازدهم": 4
      }
    },
    "ریاضی": {
      coeff: 7,
      chapters: {
        "دهم": 5,
        "یازدهم": 4,
        "دوازدهم": 3
      }
    },
    "زمین‌شناسی": {
      coeff: 1,
      chapters: {
        "یازدهم": 7,
        "دوازدهم": 5
      }
    }
  }
};

const PLANNER_SETTINGS = {
  sessionMinutes: 75,
  reviewMinutes: 15,
  reviewGaps: [1, 3, 7],
  maxSessionMinutes: 90,
  minDailyMinutes: 30
};

// تبدیل نام‌های قدیمی به نام یکسان
function normalizeSubjectName(subject) {
  const aliases = {
    "زیست": "زیست‌شناسی",
    "زیست شناسی": "زیست‌شناسی"
  };

  return aliases[subject] || subject;
}

// ساخت فهرست فصل‌ها
function getPlannerTopics(field = "تجربی") {
  const subjects = PLANNER_DB[field];

  if (!subjects) return [];

  const topics = [];

  Object.entries(subjects).forEach(([subject, info]) => {
    Object.entries(info.chapters).forEach(
      ([grade, chapterCount]) => {
        for (let i = 1; i <= chapterCount; i++) {
          topics.push({
            subject,
            grade,
            chapter: `${grade} - فصل ${i}`,
            weight: info.coeff,
            priority: info.coeff / chapterCount
          });
        }
      }
    );
  });

  return topics;
}

// مرتب‌سازی متعادل درس‌ها
function balanceTopics(topics) {
  const groups = {};

  topics.forEach(topic => {
    if (!groups[topic.subject]) {
      groups[topic.subject] = [];
    }

    groups[topic.subject].push(topic);
  });

  Object.values(groups).forEach(group => {
    group.sort((a, b) => b.priority - a.priority);
  });

  const result = [];
  const subjects = Object.keys(groups).sort(
    (a, b) =>
      groups[b][0].priority - groups[a][0].priority
  );

  while (subjects.some(s => groups[s].length > 0)) {
    subjects.forEach(subject => {
      if (groups[subject].length > 0) {
        result.push(groups[subject].shift());
      }
    });
  }

  return result;
}

// ساخت برنامه
function generatePlan(config = {}) {
  const field = config.field || "تجربی";

  const daysLeft = Math.max(
    1,
    Math.floor(Number(config.daysLeft) || 1)
  );

  const dailyHours = Math.max(
    1,
    Math.min(16, Number(config.dailyHours) || 6)
  );

  const dailyLimit = dailyHours * 60;

  const topics = balanceTopics(
    getPlannerTopics(field)
  );

  if (!topics.length) return [];

  const plan = [];
  const dailyUsage = {};

  let sessionCounter = 1;

  function getUsage(day) {
    return dailyUsage[day] || 0;
  }

  function addUsage(day, minutes) {
    dailyUsage[day] = getUsage(day) + minutes;
  }

  function findAvailableDay(startDay, minutes) {
    for (
      let day = Math.max(1, startDay);
      day <= daysLeft;
      day++
    ) {
      if (getUsage(day) + minutes <= dailyLimit) {
        return day;
      }
    }

    return null;
  }

  function addSession({
    day,
    subject,
    chapter,
    grade,
    minutes,
    type
  }) {
    if (!day || day > daysLeft) return null;

    const session = {
      id: `planner_${sessionCounter++}`,
      day,
      subject,
      chapter,
      grade,
      minutes,
      type,
      done: false,
      createdAt: new Date().toISOString()
    };

    plan.push(session);
    addUsage(day, minutes);

    return session;
  }

  // مرحله اول: جلسات مطالعه اصلی
  let nextDay = 1;

  topics.forEach(topic => {
    const minutes = Math.min(
      PLANNER_SETTINGS.sessionMinutes,
      PLANNER_SETTINGS.maxSessionMinutes,
      dailyLimit
    );

    const day = findAvailableDay(nextDay, minutes);

    if (!day) return;

    const mainSession = addSession({
      day,
      subject: topic.subject,
      chapter: topic.chapter,
      grade: topic.grade,
      minutes,
      type: "study"
    });

    if (mainSession) {
      nextDay = day;
    }
  });

  // مرحله دوم: مرورهای فاصله‌دار
  const originalSessions = plan.filter(
    session => session.type === "study"
  );

  originalSessions.forEach(session => {
    PLANNER_SETTINGS.reviewGaps.forEach(gap => {
      const desiredDay = session.day + gap;

      if (desiredDay > daysLeft) return;

      const reviewDay = findAvailableDay(
        desiredDay,
        PLANNER_SETTINGS.reviewMinutes
      );

      if (!reviewDay) return;

      addSession({
        day: reviewDay,
        subject: session.subject,
        chapter: session.chapter,
        grade: session.grade,
        minutes: PLANNER_SETTINGS.reviewMinutes,
        type: "review"
      });
    });
  });

  // مرتب‌سازی نهایی
  plan.sort((a, b) => {
    if (a.day !== b.day) return a.day - b.day;

    if (a.type !== b.type) {
      return a.type === "study" ? -1 : 1;
    }

    return a.subject.localeCompare(b.subject, "fa");
  });

  return plan;
}

// آمار کلی برنامه
function getPlanStats(plan = []) {
  const stats = {
    totalSessions: plan.length,
    completedSessions: 0,
    totalMinutes: 0,
    completedMinutes: 0,
    studySessions: 0,
    reviewSessions: 0,
    remainingSessions: 0,
    completionPercent: 0
  };

  plan.forEach(session => {
    stats.totalMinutes += Number(session.minutes) || 0;

    if (session.type === "study") {
      stats.studySessions++;
    }

    if (session.type === "review") {
      stats.reviewSessions++;
    }

    if (session.done) {
      stats.completedSessions++;
      stats.completedMinutes +=
        Number(session.minutes) || 0;
    }
  });

  stats.remainingSessions =
    stats.totalSessions - stats.completedSessions;

  stats.completionPercent =
    stats.totalSessions > 0
      ? Math.round(
          stats.completedSessions /
          stats.totalSessions * 100
        )
      : 0;

  return stats;
}

// دریافت برنامه یک روز
function getPlanForDay(plan = [], day) {
  return plan
    .filter(session => Number(session.day) === Number(day))
    .sort((a, b) => {
      if (a.type === "study" && b.type === "review") return -1;
      if (a.type === "review" && b.type === "study") return 1;
      return 0;
    });
}

// بررسی ظرفیت روزانه
function getDailyLoad(plan = [], day) {
  return plan
    .filter(session => Number(session.day) === Number(day))
    .reduce(
      (total, session) =>
        total + (Number(session.minutes) || 0),
      0
    );
}
