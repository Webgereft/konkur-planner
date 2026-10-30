
/* =====================================
   مدیریت پروفایل کنکوریار
   ذخیره در جدول student_profiles
===================================== */

const PROFILE = {

  async get() {
    const { data: sessionData, error: sessionError } =
      await supabaseClient.auth.getSession();

    if (sessionError) throw sessionError;

    const user = sessionData?.session?.user;

    if (!user?.id) {
      throw new Error("ابتدا وارد حساب کاربری خودت شو.");
    }

    const { data, error } = await supabaseClient
      .from("student_profiles")
      .select("first_name, last_name")
      .eq("user_id", user.id)
      .maybeSingle();

    if (error) throw error;

    return data;
  },

  async save(firstName, lastName) {
    const { data: sessionData, error: sessionError } =
      await supabaseClient.auth.getSession();

    if (sessionError) throw sessionError;

    const user = sessionData?.session?.user;

    if (!user?.id) {
      throw new Error("نشست معتبر نیست. دوباره وارد حساب شو.");
    }

    firstName = (firstName || "").trim();
    lastName = (lastName || "").trim();

    if (!firstName || !lastName) {
      throw new Error("نام و نام خانوادگی را کامل وارد کن.");
    }

    const { data, error } = await supabaseClient
      .from("student_profiles")
      .upsert({
        user_id: user.id,
        first_name: firstName,
        last_name: lastName,
        updated_at: new Date().toISOString()
      }, {
        onConflict: "user_id"
      })
      .select("first_name, last_name")
      .single();

    if (error) throw error;

    return data;
  }
};


/* =====================================
   بارگذاری پروفایل
===================================== */

async function loadProfile() {
  const message = document.getElementById("profileMessage");

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

    if (message) message.textContent = "";

  } catch (error) {
    console.error("Profile loading error:", error);

    if (message) {
      message.textContent =
        "دریافت اطلاعات ناموفق بود: " + error.message;
      message.style.color = "red";
    }
  }
}


/* =====================================
   ذخیره پروفایل
===================================== */

async function saveProfile() {
  const firstNameInput =
    document.getElementById("profileFirstName");

  const lastNameInput =
    document.getElementById("profileLastName");

  const message =
    document.getElementById("profileMessage");

  if (!firstNameInput || !lastNameInput || !message) {
    alert("فرم پروفایل پیدا نشد.");
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
    message.style.color = "gray";

    const saved = await PROFILE.save(firstName, lastName);

    message.textContent =
      `اطلاعات ${saved.first_name} ${saved.last_name} با موفقیت ذخیره شد 💜`;

    message.style.color = "green";

  } catch (error) {
    console.error("Profile saving error:", error);

    message.textContent =
      "ذخیره اطلاعات ناموفق بود: " + error.message;

    message.style.color = "red";
  }
}
