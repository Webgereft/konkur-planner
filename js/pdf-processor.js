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
                subject: 'نامشخص', // می‌توانید از کاربر بپرسید یا از AI بخواهید تشخیص دهد
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
