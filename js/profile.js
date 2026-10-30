/* =====================================
   سیستم مدیریت پروفایل کنکوریار
===================================== */

const PROFILE = {

  async get() {
    const user = await AUTH.getUser();

    if (!user || !user.id) {
      throw new Error("کاربر وارد حساب کاربری نشده است. لطفاً دوباره وارد شو.");
    }

    const { data, error } = await supabaseClient
      .from("student_profiles")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    if (error) throw error;

    return data;
  },

  async save(firstName, lastName) {
    const user = await AUTH.getUser();

    if (!user || !user.id) {
      throw new Error("نشست کاربری معتبر نیست. لطفاً خارج شو و دوباره وارد شو.");
    }

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
    const user = await AUTH.getUser();

    if (!user || !user.id) {
      console.warn("کاربر وارد حساب نشده است.");
      return;
    }

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

    const message = document.getElementById("profileMessage");

    if (message) {
      message.textContent =
        "دریافت اطلاعات پروفایل ناموفق بود: " + error.message;

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
    message.textContent = "نام و نام خانوادگی را وارد کن.";
    message.style.color = "red";
    return;
  }

  try {
    message.textContent = "در حال ذخیره اطلاعات...";

    const savedProfile = await PROFILE.save(
      firstName,
      lastName
    );

    message.textContent =
      "اطلاعات پروفایل با موفقیت ذخیره شد 💜";

    message.style.color = "green";

    console.log("Profile saved:", savedProfile);

  } catch (error) {
    console.error("Profile saving error:", error);

    message.textContent =
      "ذخیره اطلاعات انجام نشد: " + error.message;

    message.style.color = "red";
  }
}
