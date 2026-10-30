
const DB = {
  allowedKeys: ["config", "plan", "exams", "mistakes"],

  async get(key, fallback = null) {
    try {
      if (!this.allowedKeys.includes(key)) {
        throw new Error("کلید ذخیره‌سازی نامعتبر است.");
      }

      const user = (await supabaseClient.auth.getUser()).data.user;

      if (!user) return fallback;

      const { data, error } = await supabaseClient
        .from("student_data")
        .select(key)
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) throw error;

      if (!data || data[key] === null || data[key] === undefined) {
        return fallback;
      }

      return data[key];

    } catch (error) {
      console.error("خطا در خواندن اطلاعات:", error);
      return fallback;
    }
  },

  async set(key, value) {
    try {
      if (!this.allowedKeys.includes(key)) {
        throw new Error("کلید ذخیره‌سازی نامعتبر است.");
      }

      const { data: { user }, error: userError } =
        await supabaseClient.auth.getUser();

      if (userError) throw userError;

      if (!user) {
        throw new Error("برای ذخیره اطلاعات ابتدا وارد حساب شو.");
      }

      const { error } = await supabaseClient
        .from("student_data")
        .upsert({
          user_id: user.id,
          [key]: value,
          updated_at: new Date().toISOString()
        }, {
          onConflict: "user_id"
        });

      if (error) throw error;

      console.log("اطلاعات کاربر ذخیره شد:", key);
      return true;

    } catch (error) {
      console.error("خطا در ذخیره اطلاعات:", error);
      alert(error.message || "ذخیره اطلاعات با مشکل مواجه شد.");
      return false;
    }
  },

  async remove(key) {
    return this.set(key, null);
  }
};
