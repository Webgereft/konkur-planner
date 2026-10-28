// شناسه ثابت برای ردیف اطلاعات کاربر (چون فعلاً سیستم لاگین نداریم)
const CLOUD_ROW_ID = 1;

const DB = {
  // خواندن اطلاعات از Supabase
  async get(key, fallback = null) {
    try {
      const { data, error } = await supabaseClient
        .from('user_data')
        .select(key)
        .eq('id', CLOUD_ROW_ID)
        .single();
      
      // اگر ردیفی وجود نداشت (خطای PGRST116)، مقدار پیش‌فرض را برگردان
      if (error && error.code === 'PGRST116') return fallback;
      if (error) throw error;
      
      return data && data[key] ? data[key] : fallback;
    } catch (err) {
      console.error(`خطا در خواندن ${key} از Supabase:`, err);
      return fallback;
    }
  },

  // ذخیره اطلاعات در Supabase (Upsert: اگر نبود بساز، اگر بود آپدیت کن)
  async set(key, value) {
    try {
      const { error } = await supabaseClient
        .from('user_data')
        .upsert({ 
          id: CLOUD_ROW_ID, 
          [key]: value, 
          updated_at: new Date() 
        });
      
      if (error) throw error;
      console.log(`اطلاعات (${key}) در ابر ذخیره شد.`);
    } catch (err) {
      console.error(`خطا در ذخیره ${key} در Supabase:`, err);
      alert("خطا در ذخیره اطلاعات در فضای ابری. لطفاً اتصال اینترنت را بررسی کنید.");
    }
  },

  async remove(key) {
    await this.set(key, null);
  }
};
