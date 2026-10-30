
/* =====================================
   سیستم ورود و ثبت نام کنکوریار
===================================== */

const AUTH = {

  /* =====================================
     ثبت نام
  ===================================== */

  async register(email, password) {
    email = (email || "").trim().toLowerCase();

    if (!email || !password) {
      alert("ایمیل و رمز عبور را وارد کن.");
      return false;
    }

    if (password.length < 8) {
      alert("رمز عبور باید حداقل ۸ کاراکتر باشد.");
      return false;
    }

    try {
      const { data, error } =
        await supabaseClient.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo:
              window.location.origin +
              window.location.pathname
          }
        });

      if (error) throw error;

      if (data.session && data.user) {
        await this.handleSignedIn(data.user);

        alert("ثبت‌نام موفق بود! خوش آمدی 🌸");
        return true;

      } else {
        alert(
          "ثبت‌نام انجام شد. اگر تأیید ایمیل فعال است، ایمیلت را بررسی کن."
        );

        return true;
      }

    } catch (error) {
      console.error("Register error:", error);

      alert("خطا در ثبت‌نام: " + error.message);
      return false;
    }
  },


  /* =====================================
     ورود
  ===================================== */

  async login(email, password) {
    email = (email || "").trim().toLowerCase();

    if (!email || !password) {
      alert("ایمیل و رمز عبور را وارد کن.");
      return false;
    }

    try {
      const { data, error } =
        await supabaseClient.auth.signInWithPassword({
          email,
          password
        });

      if (error) throw error;

      if (!data.user) {
        throw new Error("اطلاعات کاربر دریافت نشد.");
      }

      await this.handleSignedIn(data.user);

      alert("با موفقیت وارد شدی 💜");

      return true;

    } catch (error) {
      console.error("Login error:", error);

      alert("خطا در ورود: " + error.message);
      return false;
    }
  },


  /* =====================================
     ایجاد اطلاعات اولیه کاربر
  ===================================== */

  async handleSignedIn(user) {
    if (!user || !user.id) {
      throw new Error("اطلاعات حساب کاربری معتبر نیست.");
    }

    const { error } = await supabaseClient
      .from("student_data")
      .upsert(
        { user_id: user.id },
        {
          onConflict: "user_id",
          ignoreDuplicates: true
        }
      );

    if (error) {
      console.error("Student data error:", error);
      throw error;
    }

    window.location.reload();
  },


  /* =====================================
     دریافت کاربر فعلی
  ===================================== */

  async getUser() {
    try {
      const { data, error } =
        await supabaseClient.auth.getSession();

      if (error) {
        console.error("Get session error:", error);
        throw error;
      }

      const sessionUser = data?.session?.user;

      if (sessionUser && sessionUser.id) {
        return sessionUser;
      }

      const { data: userData, error: userError } =
        await supabaseClient.auth.getUser();

      if (userError) {
        console.error("Get user error:", userError);
        return null;
      }

      return userData?.user || null;

    } catch (error) {
      console.error("Authentication error:", error);
      return null;
    }
  },


  /* =====================================
     بررسی نشست کاربر
  ===================================== */

  async checkSession() {
    const user = await this.getUser();

    const authPage =
      document.getElementById("authPage");

    const appContent =
      document.getElementById("appContent");

    if (authPage) {
      authPage.style.display = user ? "none" : "flex";
    }

    if (appContent) {
      appContent.style.display = user ? "block" : "none";
    }

    const emailElement =
      document.getElementById("userEmail");

    if (emailElement && user) {
      emailElement.textContent = user.email || "";
    }

    return user;
  },


  /* =====================================
     خروج از حساب
  ===================================== */

  async logout() {
    if (!confirm("از حساب کاربری خارج می‌شوی؟")) {
      return;
    }

    try {
      const { error } =
        await supabaseClient.auth.signOut();

      if (error) throw error;

      window.location.reload();

    } catch (error) {
      console.error("Logout error:", error);

      alert("خطا در خروج: " + error.message);
    }
  }

};


/* =====================================
   تغییر فرم ورود و ثبت نام
===================================== */

function switchAuthMode(mode) {
  const loginForm =
    document.getElementById("loginForm");

  const registerForm =
    document.getElementById("registerForm");

  const title =
    document.getElementById("authTitle");

  if (loginForm) {
    loginForm.style.display =
      mode === "login" ? "block" : "none";
  }

  if (registerForm) {
    registerForm.style.display =
      mode === "register" ? "block" : "none";
  }

  if (title) {
    title.textContent =
      mode === "login"
        ? "ورود به کنکوریار"
        : "ساخت حساب کاربری";
  }
}


/* =====================================
   ارسال فرم ورود
===================================== */

async function submitLogin() {
  const email =
    document.getElementById("loginEmail")?.value || "";

  const password =
    document.getElementById("loginPassword")?.value || "";

  await AUTH.login(email, password);
}


/* =====================================
   ارسال فرم ثبت نام
===================================== */

async function submitRegister() {
  const email =
    document.getElementById("registerEmail")?.value || "";

  const password =
    document.getElementById("registerPassword")?.value || "";

  const confirmPassword =
    document.getElementById("confirmPassword")?.value || "";

  if (password !== confirmPassword) {
    alert("رمز عبور و تکرار آن یکسان نیستند.");
    return;
  }

  await AUTH.register(email, password);
}


/* =====================================
   راه اندازی احراز هویت
===================================== */

async function initializeAuthentication() {
  try {
    const user = await AUTH.checkSession();

    if (user) {
      if (typeof init === "function") {
        await init();
      }
    }

    return user;

  } catch (error) {
    console.error(
      "Authentication initialization error:",
      error
    );

    return null;
  }
}
