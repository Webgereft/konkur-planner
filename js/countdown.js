
(() => {
  "use strict";

  // ۱۰ تیر ۱۴۰۶ = ۱ ژوئیه ۲۰۲۷
  // ساعت ۰۰:۰۰ به وقت ایران (UTC+03:30)
  const TARGET = new Date("2027-07-01T00:00:00+03:30").getTime();

  const formatter = new Intl.DateTimeFormat("fa-IR", {
    timeZone: "Asia/Tehran",
    year: "numeric",
    month: "long",
    day: "numeric"
  });

  function updateCountdown() {
    const container = document.getElementById("countdown-timer");
    if (!container) return;

    const now = Date.now();
    const remaining = Math.max(0, TARGET - now);

    const totalSeconds = Math.floor(remaining / 1000);
    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    container.innerHTML = `
      <div class="countdown-heading" style="width:100%;text-align:center">
        <strong>تا کنکور تجربی ۱۴۰۶</strong>
        <div style="color:var(--muted);font-size:.9rem">
          تاریخ هدف: ${formatter.format(TARGET)}
        </div>
      </div>

      <div class="cd-box">
        <strong>${days.toLocaleString("fa-IR")}</strong>
        <span>روز</span>
      </div>

      <div class="cd-box">
        <strong>${String(hours).padStart(2, "0").replace(/\d/g, d => "۰۱۲۳۴۵۶۷۸۹"[d])}</strong>
        <span>ساعت</span>
      </div>

      <div class="cd-box">
        <strong>${String(minutes).padStart(2, "0").replace(/\d/g, d => "۰۱۲۳۴۵۶۷۸۹"[d])}</strong>
        <span>دقیقه</span>
      </div>

      <div class="cd-box">
        <strong>${String(seconds).padStart(2, "0").replace(/\d/g, d => "۰۱۲۳۴۵۶۷۸۹"[d])}</strong>
        <span>ثانیه</span>
      </div>

      <div style="width:100%;text-align:center;color:var(--muted);font-size:.78rem">
        محاسبه بر اساس ساعت ایران · تاریخ هدف، غیررسمی و قابل‌ویرایش
      </div>
    `;
  }

  updateCountdown();
  setInterval(updateCountdown, 1000);
})();
