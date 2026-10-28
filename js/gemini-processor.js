// کلید API خود را اینجا وارد کنید (با AIza شروع می‌شود)
const GEMINI_API_KEY = 'YOUR_GEMINI_API_KEY_HERE';

async function extractQuestionsWithAI(rawText) {
  // آدرس API گوگل جمینی (مدل سریع و رایگان Flash)
  const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`;

  const prompt = `
    شما یک دستیار هوشمند هستید. متن زیر از یک فایل PDF کنکور استخراج شده است. 
    لطفاً سوالات را به صورت دقیق پیدا کن و به فرمت JSON زیر برگردان:
    [
      {
        "q": "متن کامل سوال",
        "options": ["گزینه 1", "گزینه 2", "گزینه 3", "گزینه 4"],
        "answer": 0
      }
    ]
    نکته: فیلد answer باید شماره گزینه صحیح باشد (0 برای گزینه اول، 1 برای گزینه دوم و...).
    اگر پاسخ صحیح در متن مشخص نیست، آن را 0 بگذار.
    
    متن PDF:
    ${rawText.substring(0, 20000)} 
  `;

  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: "application/json" // این خط باعث می‌شود خروجی همیشه JSON باشد
        }
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    
    // استخراج متن JSON از پاسخ هوش مصنوعی
    let aiText = data.candidates[0].content.parts[0].text;
    
    // تبدیل به آرایه جاوااسکریپت
    const questions = JSON.parse(aiText);
    return questions;

  } catch (error) {
    console.error("خطا در ارتباط با هوش مصنوعی:", error);
    alert("خطا در پردازش با هوش مصنوعی. لطفاً بررسی کنید که فیلترشکن شما روشن است و کلید API صحیح است.");
    return [];
  }
}
