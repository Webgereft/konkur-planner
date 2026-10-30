
/* =====================================
   سیستم ثبت نام و ورود کنکوریار
===================================== */

const AUTH = {
  async register(email, password) {
    email = email.trim().toLowerCase();

    if (!email || !password) {
      alert("ایمیل و رمز عبور را وارد کن.");
      return false;
    }

    if (password.length < 8) {
      alert("رمز عبور باید حداقل ۸ کاراکتر باشد.");
      return false;
    }

    try {
      const { data, error } = await supabaseClient.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: window.location.origin +
            window.location.pathname
        }
      });

      if (error) throw error;

      if (data.session) {
        alert("ثبت‌نام موفق بود! خوش آمدی 🌸");
        await this.handleSignedIn(data.user);
      } else {
        alert("ثبت‌نام انجام شد. ایمیلت را برای تأیید حساب بررسی کن.");
      }

      return true;

    } catch (error) {
      console.error(error);
      alert("خطا در ثبت‌نام: " + error.message);
      return false;
    }
  },

  async login(email, password) {
    email = email.trim().toLowerCase();

    try {
      const { data, error } = await supabaseClient.auth.signInWithPassword({
        email,
        password
      });

      if (error) throw error;

      await this.handleSignedIn(data.user);
      alert("با موفقیت وارد شدی 💜");
      return true;

    } catch (error) {
      console.error(error);
      alert("خطا در ورود: " + error.message);
      return false;
    }
  },

  async logout() {
    if (!confirm("از حساب کاربری خارج می‌شوی؟")) return;

    const { error } = await supabaseClient.auth.signOut();

    if (error) {
      alert("خطا در خروج: " + error.message);
      return;
    }

    window.location.reload();
  },

  async handleSignedIn(user) {
    if (!user) return;

    const { error } = await supabaseClient
      .from("student_data")
      .upsert(
        { user_id: user.id },
        { onConflict: "user_id", ignoreDuplicates: true }
      );

    if (error) {
      console.error("خطا در ساخت پروفایل:", error);
      throw error;
    }

    window.location.reload();
  },

  async getUser() {
    const { data, error } = await supabaseClient.auth.getUser();

    if (error) {
      console.error(error);
      return null;
    }

    return data.user;
  },

  async checkSession() {
    const user = await this.getUser();

    const authPage = document.getElementById("authPage");
    const appContent = document.getElementById("appContent");

    if (authPage) {
      authPage.style.display = user ? "none" : "flex";
    }

    if (appContent) {
      appContent.style.display = user ? "block" : "none";
    }

    const emailElement = document.getElementById("userEmail");

    if (emailElement && user) {
      emailElement.textContent = user.email || "";
    }

    return user;
  }
};

/* =====================================
   کنترل فرم ورود و ثبت نام
===================================== */

function switchAuthMode(mode) {
  const loginForm = document.getElementById("loginForm");
  const registerForm = document.getElementById("registerForm");
  const title = document.getElementById("authTitle");

  if (loginForm) {
    loginForm.style.display = mode === "login" ? "block" : "none";
  }

  if (registerForm) {
    registerForm.style.display = mode === "register" ? "block" : "none";
  }

  if (title) {
    title.textContent = mode === "login"
      ? "ورود به کنکوریار"
      : "ساخت حساب کاربری";
  }
}

async function submitLogin() {
  const email = document.getElementById("loginEmail")?.value || "";
  const password = document.getElementById("loginPassword")?.value || "";

  await AUTH.login(email, password);
}

async function submitRegister() {
  const email = document.getElementById("registerEmail")?.value || "";
  const password = document.getElementById("registerPassword")?.value || "";
  const confirmPassword = document.getElementById("confirmPassword")?.value || "";

  if (password !== confirmPassword) {
    alert("رمز عبور و تکرار آن یکسان نیستند.");
    return;
  }

  await AUTH.register(email, password);
}
