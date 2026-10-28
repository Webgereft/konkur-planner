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
  
  // برای هر درس، تعداد کلمات کلیدی موجود در متن را می‌شماریم
  for (const [subject, keywords] of Object.entries(SUBJECT_KEYWORDS)) {
    keywords.forEach(kw => {
      if (text.includes(kw)) scores[subject]++;
    });
  }
  
  // درسی که بیشترین کلمه کلیدی را دارد انتخاب می‌شود
  let detected = "نامشخص";
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
    // 1. خواندن فایل سوالات
    const qText = await readPDFText(qFile);
    
    // 2. تشخیص خودکار درس
    const detectedSubject = detectSubject(qText);
    alert(`درس تشخیص داده شده: ${detectedSubject}`);

    // 3. ذخیره متن در حافظه (برای مرحله بعد که سوالات را استخراج می‌کنیم)
    localStorage.setItem('raw_pdf_text', qText);
    
    // برای شروع، ما فقط متن را ذخیره می‌کنیم. در گام‌های بعدی، با کدهای پیچیده‌تر سوالات را از دل متن بیرون می‌کشیم
    console.log("متن سوالات:", qText.substring(0, 500) + "...");
    
    alert("متن PDF خوانده شد و درس تشخیص داده شد. حالا باید کدهای جداکننده سوالات را پیاده‌سازی کنیم.");
    
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
