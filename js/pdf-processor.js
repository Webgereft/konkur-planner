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
  let detected = "زیست"; 
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

  alert("در حال پردازش فایل‌ها... لطفاً صبر کنید.");

  try {
    const qText = await readPDFText(qFile);
    
    // تشخیص درس
    const detectedSubject = detectSubject(qText);
    
    // استخراج سوالات با یک الگوی ساده‌تر
    alert("متن PDF خوانده شد. در حال استخراج سوالات...");
    
    // این یک الگوی بسیار ساده است که دنبال "1-" یا "1)" می‌گردد
    const questions = [];
    const lines = qText.split('\n');
    let currentQuestion = null;

    lines.forEach(line => {
        const trimmed = line.trim();
        // اگر خط با شماره سوال شروع شده بود (مثلا 1- یا 1)
        if (/^\d+[-.\s]/.test(trimmed) && trimmed.length > 10) {
            if (currentQuestion) {
                questions.push(currentQuestion);
            }
            // شروع سوال جدید
            currentQuestion = {
                q: trimmed,
                options: ["گزینه 1", "گزینه 2", "گزینه 3", "گزینه 4"],
                answer: 0
            };
        } 
        // اگر خط با گزینه شروع شده بود (مثلا 1) یا 2))
        else if (/^\d+\)/.test(trimmed) && currentQuestion) {
            // اینجا می‌توانیم گزینه‌ها را جایگزین کنیم
            // ولی چون الگوها دقیق نیستند، فعلاً گزینه‌ها را تغییر نمی‌دهیم
        }
    });
    if (currentQuestion) questions.push(currentQuestion);

    if (questions.length === 0) {
        alert("سوالی پیدا نشد. ممکن است ساختار فایل PDF با الگوی ما سازگار نباشد.");
        return;
    }

    // ذخیره در دیتابیس
    let savedCount = 0;
    for (const q of questions) {
        const { error } = await supabaseClient
            .from('questions_bank')
            .insert([{
                subject: detectedSubject,
                grade: 'نامشخص',
                chapter: 'عمومی',
                question_text: q.q,
                options: q.options,
                correct_answer: q.answer
            }]);
        if (!error) savedCount++;
    }

    alert(`تعداد ${savedCount} سوال از درس ${detectedSubject} با موفقیت در دیتابیس ذخیره شد!`);

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
