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

    // 2. پردازش محلی متن (بدون هوش مصنوعی)
    btn.innerText = "در حال جدا کردن سوالات...";
    const extractedQuestions = parseQuestionsLocally(rawText);

    if (extractedQuestions.length === 0) {
        throw new Error("سوالی پیدا نشد. ممکن است ساختار فایل PDF با الگوی ما سازگار نباشد.");
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

    alert(`تعداد ${savedCount} سوال با موفقیت در دیتابیس ذخیره شد!`);
    
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

// تابع پردازش محلی متن (جدا کردن سوالات با Regex)
function parseQuestionsLocally(text) {
    const questions = [];
    // الگوی ساده: پیدا کردن شماره سوال (مثل 1- یا 1.) و سپس متن
    const regex = /(\d+)\s*[-.)]\s*(.*?)(?=\d+\s*[-.)]|$)/gs;
    
    let match;
    while ((match = regex.exec(text)) !== null) {
        const qTextBlock = match[2].trim();
        if (qTextBlock.length > 20) {
            // در این روش، ما گزینه‌ها را به صورت دقیق نداریم، پس به صورت موقت می‌گذاریم
            questions.push({
                q: qTextBlock.substring(0, 300),
                options: ["گزینه 1", "گزینه 2", "گزینه 3", "گزینه 4"], 
                answer: 0 
            });
        }
    }
    return questions;
}
