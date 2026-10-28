// ==========================================
// کد کامل پردازش PDF و اتصال به هوش مصنوعی گوگل
// ==========================================

// کلید API شما
const GEMINI_API_KEY = 'AQ.Ab8RN6JX1YfgakTM_GRhBR5FEtNohJ3CGfttFPYWMCqd0j_S_A';

// تنظیمات pdf.js
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

async function extractFromPDF() {
  const qFile = document.getElementById('pdfQuestions').files[0];
  
  if (!qFile) {
    return alert("لطفا فایل PDF سوالات را انتخاب کنید.");
  }

  const btn = document.querySelector('button[onclick="extractFromPDF()"]');
  btn.innerText = "در حال خواندن PDF...";
  btn.disabled = true;

  try {
    // 1. خواندن متن خام از PDF
    const rawText = await readPDFText(qFile);
    
    if (rawText.length < 100) {
        throw new Error("متن استخراج شده از PDF بسیار کوتاه است. ممکن است فایل تصویری باشد.");
    }

    // 2. ارسال متن به هوش مصنوعی
    btn.innerText = "هوش مصنوعی در حال استخراج سوالات است...";
    const extractedQuestions = await extractQuestionsWithAI(rawText);

    if (extractedQuestions.length === 0) {
        throw new Error("هوش مصنوعی نتوانست سوالی پیدا کند.");
    }

    // 3. ذخیره در دیتابیس Supabase
    btn.innerText = "در حال ذخیره در دیتابیس ابری...";
    
    let savedCount = 0;
    for (const q of extractedQuestions) {
        const { error } = await supabaseClient
            .from('questions_bank')
            .insert([{
                subject: 'نامشخص', 
                grade: 'نامشخص',
                chapter: 'عمومی',
                question_text: q.q,
                options: q.options,
                correct_answer: q.answer
            }]);
        if (!error) savedCount++;
    }

    alert(`تعداد ${savedCount} سوال با موفقیت در دیتابیس ذخیره شد! حالا می‌توانید فیلترشکن را خاموش کنید.`);
    
  } catch (error) {
    console.error("خطا:", error);
    alert("خطا در پردازش: " + error.message);
  } finally {
    btn.innerText = "شروع پردازش و استخراج";
    btn.disabled = false;
  }
}

// تابع خواندن فایل PDF
async function readPDFText(file) {
  const reader = new FileReader();
  return new Promise((resolve, reject) => {
    reader.onload = async (e) => {
      try {
        const typedarray = new Uint8Array(e.target.result);
        const pdf = await pdfjsLib.getDocument(typedarray).promise;
        let fullText = "";
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const content = await page.getTextContent();
          fullText += content.items.map(item => item.str).join(' ') + "\n";
        }
        resolve(fullText);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}

// تابع هوش مصنوعی
async function extractQuestionsWithAI(rawText) {
  const API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent';

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
      headers: {
        'Content-Type': 'application/json',
        'X-goog-api-key': GEMINI_API_KEY // استفاده از هدر جدید
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: "application/json"
        }
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error("جزئیات خطای گوگل:", errorData);
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    let aiText = data.candidates[0].content.parts[0].text;
    return JSON.parse(aiText);

  } catch (error) {
    console.error("خطا در ارتباط با هوش مصنوعی:", error);
    throw new Error("خطا در ارتباط با هوش مصنوعی. لطفاً بررسی کنید که فیلترشکن روشن است و کلید API صحیح است.");
  }
}
