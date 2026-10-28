// تنظیمات pdf.js
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

// کلمات کلیدی برای تشخیص درس
const SUBJECT_KEYWORDS = {
  "زیست": ["زیست", "یاخته", "دنا", "رنای", "پروتئین", "ژن", "کروموزوم", "جاندار", "گیاه", "جانور"],
  "فیزیک": ["فیزیک", "شتاب", "سرعت", "نیرو", "انرژی", "مدار", "الکترون", "موج", "نوسان", "مغناطیس"],
  "شیمی": ["شیمی", "مول", "واکنش", "اتم", "الکترون", "پیوند", "محلول", "اسید", "باز", "ترکیب"],
  "ریاضی": ["ریاضی", "تابع", "معادله", "مثلث", "حد", "مشتق", "انتگرال", "احتمال", "هندسه", "دنباله"],
  "زمین‌شناسی": ["زمین", "سنگ", "کانی", "آتشفشان", "گسل", "زلزله", "فسیل", "رسوب", "خاک", "آبخوان"]
};

function detectSubject(text) {
  let scores = { "زیست": 0, "فیزیک": 0, "شیمی": 0, "ریاضی": 0, "زمین‌شناسی": 0 };
  for (const [subject, keywords] of Object.entries(SUBJECT_KEYWORDS)) {
    keywords.forEach(kw => {
      if (text.includes(kw)) scores[subject]++;
    });
  }
  let detected = "زیست"; // پیش‌فرض
  let maxScore = 0;
  for (const [sub, score] of Object.entries(scores)) {
    if (score > maxScore) {
      maxScore = score;
      detected = sub;
    }
  }
  return detected;
}

async function extractFromPDF() {
  const qFile = document.getElementById('pdfQuestions').files[0];
  const aFile = document.getElementById('pdfAnswers').files[0];

  if (!qFile || !aFile) {
    return alert("لطفا هر دو فایل سوالات و پاسخنامه را انتخاب کنید.");
  }

  alert("در حال پردازش فایل‌ها... این کار ممکن است چند لحظه طول بکشد.");

  try {
    // 1. خواندن فایل سوالات و پاسخنامه
    const qText = await readPDFText(qFile);
    const aText = await readPDFText(aFile);
    
    // 2. تشخیص خودکار درس
    const detectedSubject = detectSubject(qText);
    
    // 3. استخراج سوالات
    alert("در حال استخراج سوالات و گزینه‌ها...");
    const extractedQuestions = parseQuestions(qText, detectedSubject);

    if (extractedQuestions.length === 0) {
        return alert("متاسفانه سوالی پیدا نشد. ممکن است ساختار PDF با الگوهای ما همخوانی نداشته باشد.");
    }

    // 4. ذخیره در دیتابیس
    await saveQuestionsToDB(extractedQuestions, detectedSubject);
    
    alert(`تعداد ${extractedQuestions.length} سوال از درس ${detectedSubject} با موفقیت استخراج و ذخیره شد!`);
    
  } catch (error) {
    console.error("خطا:", error);
    alert("خطا در خواندن فایل PDF: " + error.message);
  }
}

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

// الگوریتم ساده استخراج سوالات
function parseQuestions(text, subject) {
    const questions = [];
    // این الگو دنبال شماره سوال (مثل 1- یا 1) ) و سپس متن می‌گردد
    // این یک الگوی ساده است و ممکن است نیاز به تغییرات داشته باشد
    const questionRegex = /(\d+)[-\.)\s]+(.*?)(?=\d+[-\.)\s]+|$)/gs;
    
    let match;
    while ((match = questionRegex.exec(text)) !== null) {
        const qTextBlock = match[2].trim();
        // در اینجا باید گزینه‌ها را هم از داخل qTextBlock جدا کنیم
        // برای سادگی، ما فعلاً فقط متن سوال را ذخیره می‌کنیم و گزینه‌ها را خالی می‌گذاریم
        if (qTextBlock.length > 20) { // فیلتر کردن متن‌های خیلی کوتاه
            questions.push({
                q: qTextBlock.substring(0, 500), // محدود کردن طول متن سوال
                options: ["گزینه 1", "گزینه 2", "گزینه 3", "گزینه 4"], // به صورت موقت
                answer: 0 // به صورت موقت
            });
        }
    }
    return questions;
}

async function saveQuestionsToDB(questions, subject) {
    // ذخیره در دیتابیس Supabase
    for (const q of questions) {
        const { error } = await supabaseClient
            .from('questions_bank')
            .insert([{
                subject: subject,
                grade: 'نامشخص', // در نسخه فعلی پایه را نمی‌دانیم
                chapter: 'عمومی',
                question_text: q.q,
                options: q.options,
                correct_answer: q.answer
            }]);
        if (error) console.error("خطا در ذخیره سوال:", error);
    }
}
