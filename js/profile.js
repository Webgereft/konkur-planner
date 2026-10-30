
/* =====================================
   سیستم مدیریت پروفایل کنکوریار
===================================== */

// دریافت کاربر از نشست مستقیم Supabase
const PROFILE = {

  async getCurrentUser() {
    const { data, error } =
      await supabaseClient.auth.getSession();

    if (error) throw error;

    const user = data?.session?.user;

    if (!user || !user.id) {
      throw new Error(
        "نشست ورود پیدا نشد. لطفاً ابتدا وارد حساب کاربری شو."
      );
    }

    return user;
  },

  async get() {
    const user = await this.getCurrentUser();

    const { data, error } = await supabaseClient
      .from("student_profiles")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    if (error) throw error;

    return data;
  },

  async save(firstName, lastName) {
    const user = await this.getCurrentUser();

    const profile = {
      user_id: user.id,
      first_name: firstName.trim(),
      last_name: lastName.trim(),
      updated_at: new Date().toISOString()
    };

    const { data, error } = await supabaseClient
      .from("student_profiles")
      .upsert(profile, {
        onConflict: "user_id"
      })
      .select()
      .single();

    if (error) throw error;

    return data;
  }
};


/* =====================================
   بارگذاری اطلاعات پروفایل
===================================== */

async function loadProfile() {
  try {
    const profile = await PROFILE.get();

    const firstNameInput =
      document.getElementById("profileFirstName");

    const lastNameInput =
      document.getElementById("profileLastName");

    if (firstNameInput) {
      firstNameInput.value = profile?.first_name || "";
    }

    if (lastNameInput) {
      lastNameInput.value = profile?.last_name || "";
    }

  } catch (error) {
    console.error("Profile loading error:", error);

    const message =
      document.getElementById("profileMessage");

    if (message) {
      message.textContent =
        "دریافت اطلاعات ناموفق بود: " + error.message;

      message.style.color = "red";
    }
  }
}


/* =====================================
   ذخیره اطلاعات پروفایل
===================================== */

async function saveProfile() {

  const firstNameInput =
    document.getElementById("profileFirstName");

  const lastNameInput =
    document.getElementById("profileLastName");

  const message =
    document.getElementById("profileMessage");

  if (!firstNameInput || !lastNameInput || !message) {
    console.error("عناصر فرم پروفایل پیدا نشدند.");
    return;
  }

  const firstName = firstNameInput.value.trim();
  const lastName = lastNameInput.value.trim();

  if (!firstName || !lastName) {
    message.textContent =
      "لطفاً نام و نام خانوادگی را وارد کن.";

    message.style.color = "red";
    return;
  }

  try {
    message.textContent = "در حال ذخیره اطلاعات...";

    message.style.color = "inherit";

    await PROFILE.save(firstName, lastName);

    message.textContent =
      "اطلاعات با موفقیت ذخیره شد 💜";

    message.style.color = "green";

  } catch (error) {
    console.error("Profile saving error:", error);

    message.textContent =
      "ذخیره اطلاعات انجام نشد: " + error.message;

    message.style.color = "red";
  }
}
