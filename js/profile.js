
const PROFILE = {
  async get() {
    const user = await AUTH.getUser();

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

    const profile = {
      user_id: user.id,
      first_name: firstName.trim(),
      last_name: lastName.trim(),
      updated_at: new Date().toISOString()
    };

    const { data, error } = await supabaseClient
      .from("student_profiles")
      .upsert(profile, { onConflict: "user_id" })
      .select()
      .single();

    if (error) throw error;

    return data;
  }
};

async function loadProfile() {
  try {
    const profile = await PROFILE.get();

    document.getElementById("profileFirstName").value =
      profile?.first_name || "";

    document.getElementById("profileLastName").value =
      profile?.last_name || "";

  } catch (error) {
    console.error("Profile loading error:", error);
    alert("دریافت اطلاعات پروفایل ناموفق بود.");
  }
}

async function saveProfile() {
  const firstName = document
    .getElementById("profileFirstName").value;

  const lastName = document
    .getElementById("profileLastName").value;

  const message = document.getElementById("profileMessage");

  if (!firstName.trim() || !lastName.trim()) {
    message.textContent = "نام و نام خانوادگی را وارد کن.";
    return;
  }

  try {
    await PROFILE.save(firstName, lastName);

    message.textContent = "اطلاعات پروفایل با موفقیت ذخیره شد 💜";
    message.style.color = "green";

  } catch (error) {
    console.error(error);
    message.textContent = "ذخیره اطلاعات انجام نشد: " + error.message;
    message.style.color = "red";
  }
}
