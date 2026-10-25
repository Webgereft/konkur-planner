function estimateTraz(percent, subjectCoeff, avgPercent = 50) {
  const diff = percent - avgPercent;
  const traz = 6000 + diff * 20 * (subjectCoeff / 10);
  return Math.round(Math.max(1000, Math.min(10000, traz)));
}

function progressStats(exams) {
  if (!exams.length) return { avg: 0, count: 0, trend: 0 };
  const avg = exams.reduce((s, e) => s + e.percent, 0) / exams.length;
  const trend = exams.length > 1 ? exams[exams.length - 1].percent - exams[0].percent : 0;
  return { avg: Math.round(avg), count: exams.length, trend };
}
