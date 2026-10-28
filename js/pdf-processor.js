// تنظیمات pdf.js
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

// کلمات کلیدی برای تشخیص درس
const SUBJECT_KEYWORDS = {
  "زیست": ["زیست", "یاخته", "دنا", "رنای", "پروتئین", "ژن", "کروموزوم"],
  "فیزیک": ["فیزیک", "شتاب", "سرعت", "نیرو", "انرژی", "مدار", "الکترون", "موج"],
  "شیمی": ["شیمی", "مول", "واکنش", "اتم", "الکترون", "پیوند", "محلول"],
  "ریاضی": ["ریاضی", "تابع", "معادله", "مثلث", "حد", "مشتق", "انتگرال"],
  "زمین‌شناسی": ["زمین", "سنگ", "کانی", "آتشفشان", "گسل", "زلزله"]
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
    const detectedSubject = detectSubject(qText);
    
    alert("متن PDF خوانده شد. در حال جستجوی سوالات...");
    
    // الگوی جدید: جستجو در کل متن (نه خط به خط) برای پیدا کردن الگوی "شماره - متن"
    // این الگو به دنبال یک عدد، خط تیره یا پرانتز، و سپس هر متنی تا شماره بعدی می‌گردد
    const regex = /(\d+)\s*[-.)]\s*(.*?)(?=\d+\s*[-.)]|$)/gs;
    
    const questions = [];
    let match;
    
    while ((match = regex.exec(qText)) !== null) {
        const qTextBlock = match[2].trim();
        // فیلتر کردن متن‌های خیلی کوتاه که احتمالا سوال نیستند
        if (qTextBlock.length > 20) {
            questions.push({
                q: qTextBlock.substring(0, 300),
                options: ["گزینه 1", "گزینه 2", "گزینه 3", "گزینه 4"], // به صورت موقت
                answer: 0 // به صورت موقت
            });
        }
    }

    if (questions.length === 0) {
        alert("سوالی پیدا نشد. فایل PDF ممکن است تصویری یا دارای ساختار بسیار پیچیده باشد.");
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
          // اینجا به جای خط جدید، با فاصله به هم وصل میکنیم
          fullText += content.items.map(item => item.str).join(' ') + " \n ";
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
