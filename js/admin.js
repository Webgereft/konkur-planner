"use strict";

let ADMIN_USERS = [];

const ADMIN_FUNCTION_NAME = "admin-dashboard";

// جلوگیری از نمایش کدهای HTML مخرب در اطلاعات کاربران
function adminEscape(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[char]);
}

function adminDate(value) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "—";

  return date.toLocaleString("fa-IR");
}

function setAdminText(id, value) {
  const element = document.getElementById(id);

  if (element) {
    element.textContent = value ?? 0;
  }
}

// بررسی دسترسی مدیر
async function checkAdminAccess() {
  const button = document.getElementById("adminNavBtn");

  if (!button || !window.supabaseClient) return;

  try {
    const {
      data: { user },
      error
    } = await supabaseClient.auth.getUser();

    if (error || !user) {
      button.hidden = true;
      return;
    }

    const { data: admin, error: adminError } =
      await supabaseClient
        .from("admin_users")
        .select("id")
        .eq("id", user.id)
        .maybeSingle();

    button.hidden = Boolean(adminError || !admin);

  } catch (error) {
    console.error("Admin access error:", error);
    button.hidden = true;
  }
}

// دریافت اطلاعات داشبورد
async function loadAdminDashboard() {
  const errorBox = document.getElementById("adminError");
  const body = document.getElementById("adminUsersList");

  if (!window.supabaseClient) {
    if (errorBox) {
      errorBox.hidden = false;
      errorBox.textContent = "اتصال به Supabase برقرار نیست.";
    }
    return;
  }

  if (errorBox) errorBox.hidden = true;

  if (body) {
    body.innerHTML =
      "<tr><td colspan='8'>در حال دریافت اطلاعات...</td></tr>";
  }

  try {
    const { data, error } =
      await supabaseClient.functions.invoke(
        ADMIN_FUNCTION_NAME,
        { method: "GET" }
      );

    if (error || !data || data.error) {
      throw new Error(
        data?.error || error?.message || "خطا در دریافت اطلاعات"
      );
    }

    ADMIN_USERS = Array.isArray(data.users) ? data.users : [];

    const stats = data.stats || {};

    setAdminText("adminTotalUsers", stats.total_users);
    setAdminText("adminTodayUsers", stats.today_signups);
    setAdminText("adminMonthUsers", stats.month_signups);
    setAdminText("adminActiveUsers", stats.active_users);
    setAdminText("adminTotalExams", stats.total_exams);

    filterAdminUsers();

  } catch (error) {
    console.error("Dashboard error:", error);

    if (errorBox) {
      errorBox.hidden = false;
      errorBox.textContent =
        "خطا در دریافت اطلاعات: " + error.message;
    }

    if (body) body.innerHTML = "";
  }
}

// جست‌وجوی کاربران
function filterAdminUsers() {
  const search = (
    document.getElementById("adminSearch")?.value || ""
  ).trim().toLowerCase();

  const filtered = ADMIN_USERS.filter(user =>
    (user.email || "").toLowerCase().includes(search)
  );

  const body = document.getElementById("adminUsersList");

  if (!body) return;

  if (!filtered.length) {
    body.innerHTML =
      "<tr><td colspan='8'>کاربری پیدا نشد.</td></tr>";
    return;
  }

  body.innerHTML = filtered.map(user => `
    <tr>
      <td>${adminEscape(user.email)}</td>
      <td>${adminDate(user.created_at)}</td>
      <td>${user.email_confirmed ? "تأیید شده" : "تأیید نشده"}</td>
      <td>${(Number(user.study_minutes || 0) / 60).toFixed(1)}</td>
      <td>${Number(user.completed_sessions || 0)}</td>
      <td>${Number(user.exam_count || 0)}</td>
      <td>
        ${user.average_percent == null
          ? "—"
          : adminEscape(user.average_percent) + "%"}
      </td>
      <td>
        <button
          type="button"
          data-user-id="${adminEscape(user.id)}"
          onclick="showAdminUser(this.dataset.userId)">
          مشاهده
        </button>
      </td>
    </tr>
  `).join("");
}

// نمایش جزئیات یک کاربر
function showAdminUser(id) {
  const user = ADMIN_USERS.find(item => item.id === id);

  const details = document.getElementById("adminUserDetails");

  if (!user || !details) return;

  details.innerHTML = `
    <h3>جزئیات دانش‌آموز</h3>

    <p><b>ایمیل:</b> ${adminEscape(user.email)}</p>

    <p><b>تاریخ عضویت:</b> ${adminDate(user.created_at)}</p>

    <p><b>وضعیت ایمیل:</b>
      ${user.email_confirmed ? "تأیید شده" : "تأیید نشده"}
    </p>

    <p><b>آخرین ورود:</b>
      ${adminDate(user.last_sign_in_at)}
    </p>

    <p><b>جلسات تکمیل‌شده:</b>
      ${Number(user.completed_sessions || 0)}
    </p>

    <p><b>کل جلسات:</b>
      ${Number(user.total_sessions || 0)}
    </p>

    <p><b>زمان مطالعه ثبت‌شده:</b>
      ${(Number(user.study_minutes || 0) / 60).toFixed(1)} ساعت
    </p>

    <p><b>تعداد آزمون‌ها:</b>
      ${Number(user.exam_count || 0)}
    </p>

    <p><b>میانگین درصد:</b>
      ${user.average_percent == null
        ? "—"
        : adminEscape(user.average_percent) + "%"}
    </p>

    <p><b>دفتر اشتباهات:</b>
      ${Number(user.mistake_count || 0)}
    </p>
  `;
}

// اجرای بررسی دسترسی پس از بارگذاری صفحه
document.addEventListener("DOMContentLoaded", () => {
  if (!window.supabaseClient) return;

  checkAdminAccess();

  supabaseClient.auth.onAuthStateChange(() => {
    checkAdminAccess();
  });
});
