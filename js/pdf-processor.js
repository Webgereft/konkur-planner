
const WORKER_URL = "https://konkursaz.webgereft.workers.dev";

pdfjsLib.GlobalWorkerOptions.workerSrc =
  "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";

// پردازش دو فایل PDF و ذخیره سوالات در Supabase
async function extractFromPDF() {
  const questionsFile = document.getElementById("pdfQuestions")?.files?.[0];

  // اگر شناسه ورودی پاسخنامه در HTML متفاوت است، آن را تغییر بده.
  const answersInput =
    document.getElementById("pdfAnswers") ||
    document.getElementById("pdfAnswerKey") ||
    document.getElementById("pdfAnswersKey");

  const answersFile = answersInput?.files?.[0];

  const btn = document.querySelector(
    'button[onclick="extractFromPDF()"]'
  );

  if (!questionsFile) {
    alert("لطفاً فایل PDF سوالات را انتخاب کنید.");
    return;
  }

  if (!answersFile) {
    alert("لطفاً فایل PDF پاسخنامه را هم انتخاب کنید.");
    return;
  }

  if (btn) {
    btn.disabled = true;
    btn.innerText = "در حال خواندن فایل‌ها...";
  }

  try {
    // ۱. استخراج متن از هر دو PDF
    const questionText = await readPDFText(questionsFile);
    const answerText = await readPDFText(answersFile);

    if (questionText.trim().length < 100) {
      throw new Error(
        "متن PDF سوالات قابل استخراج نیست. ممکن است فایل اسکن‌شده باشد."
      );
    }

    if (answerText.trim().length < 10) {
      throw new Error(
        "متن PDF پاسخنامه قابل استخراج نیست. ممکن است فایل اسکن‌شده باشد."
      );
    }

    if (btn) btn.innerText = "هوش مصنوعی در حال تطبیق سوالات و پاسخ‌هاست...";

    // ۲. ارسال هر دو متن به Gemini از طریق Worker
    const questions = await extractQuestionsWithAI(
      questionText,
      answerText
    );

    if (!Array.isArray(questions) || questions.length === 0) {
      throw new Error("هیچ سوال معتبری از فایل‌ها استخراج نشد.");
    }

    if (btn) btn.innerText = "در حال ذخیره سوالات در Supabase...";

    // ۳. آماده‌سازی داده‌ها
    const rows = questions.map((q) => ({
      subject: "نامشخص",
      grade: "نامشخص",
      chapter: "عمومی",
      question_text: String(q.q || "").trim(),
      options: Array.isArray(q.options) ? q.options : [],
      correct_answer:
        Number.isInteger(q.answer) &&
        q.answer >= 0 &&
        q.answer < (q.options || []).length
          ? q.answer
          : null
    })).filter((q) =>
      q.question_text.length > 0 &&
      q.options.length >= 2
    );

    if (rows.length === 0) {
      throw new Error("سوال استخراج شدنی برای ذخیره وجود ندارد.");
    }

    // ۴. ذخیره گروهی برای کاهش تعداد درخواست‌ها
    let savedCount = 0;
    const batchSize = 50;

    for (let i = 0; i < rows.length; i += batchSize) {
      const batch = rows.slice(i, i + batchSize);

      const { data, error } = await supabaseClient
        .from("questions_bank")
        .insert(batch)
        .select("id");

      if (error) {
        console.error("خطای Supabase:", error);
        throw new Error(
          "ذخیره در Supabase ناموفق بود: " + error.message
        );
      }

      savedCount += data ? data.length : batch.length;
    }

    const unknownAnswers = rows.filter(
      (q) => q.correct_answer === null
    ).length;

    alert(
      `پردازش تمام شد!\n` +
      `سوال‌های ذخیره‌شده: ${savedCount}\n` +
      `پاسخ‌های نامشخص: ${unknownAnswers}` +
      (unknownAnswers
        ? "\nپاسخ‌های نامشخص را قبل از برگزاری آزمون بررسی کنید."
        : "")
    );

  } catch (error) {
    console.error("خطای کامل پردازش PDF:", error);
    alert("خطا در پردازش:\n" + (error.message || String(error)));
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerText = "شروع پردازش و استخراج";
    }
  }
}


// استخراج متن PDF با PDF.js
async function readPDFText(file) {
  if (!file || file.type !== "application/pdf") {
    throw new Error("فایل انتخاب‌شده باید PDF باشد.");
  }

  const buffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({
    data: new Uint8Array(buffer)
  }).promise;

  const pages = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();

    const pageText = content.items
      .map((item) => item.str || "")
      .join(" ");

    pages.push(`\n--- صفحه ${i} ---\n${pageText}`);
  }

  return pages.join("\n");
}


// ارسال سوالات و پاسخنامه به Worker
async function extractQuestionsWithAI(questionText, answerText) {
  // جلوگیری از ارسال بیش از حد متن در یک درخواست.
  // برای PDFهای بزرگ باید پردازش صفحه‌ای یا چندبخشی اضافه شود.
  const maxChars = 25000;

  const prompt = `
تو یک سیستم دقیق استخراج سوالات آزمون هستی.
متن PDF سوالات و متن PDF پاسخنامه در ادامه آمده است.

وظایف:
1. سوال‌ها را با شماره و متن کامل استخراج کن.
2. گزینه‌ها را به ترتیب اصلی و بدون تغییر معنا استخراج کن.
3. پاسخ هر سوال را فقط با استفاده از پاسخنامه تطبیق بده.
4. شماره سوال در پاسخنامه را با شماره همان سوال تطبیق بده.
5. فیلد answer باید اندیس صفرمبنای گزینه صحیح باشد:
   گزینه اول = 0، گزینه دوم = 1، گزینه سوم = 2، گزینه چهارم = 3.
6. اگر پاسخنامه پاسخ یک سوال را مشخص نمی‌کند، یا تطبیق مطمئن نیست، answer را null قرار بده.
7. هرگز پاسخ را حدس نزن و هرگز پاسخ نامعلوم را 0 قرار نده.
8. شماره اصلی سوال را در فیلد number قرار بده.
9. فقط JSON معتبر مطابق ساختار زیر برگردان؛ بدون توضیح یا Markdown.

ساختار:
{
  "questions": [
    {
      "number": 1,
      "q": "متن سوال",
      "options": ["گزینه ۱", "گزینه ۲", "گزینه ۳", "گزینه ۴"],
      "answer": 2
    }
  ]
}

PDF سوالات:
${questionText.substring(0, maxChars)}

PDF پاسخنامه:
${answerText.substring(0, maxChars)}
`;

  let response;

  try {
    response = await fetch(WORKER_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [{ text: prompt }]
          }
        ],
        generationConfig: {
          responseMimeType: "application/json"
        }
      })
    });
  } catch (error) {
    throw new Error(
      "اتصال به Worker برقرار نشد. اتصال اینترنت و آدرس Worker را بررسی کنید. جزئیات: " +
      error.message
    );
  }

  // نمایش متن واقعی خطای سرور
  if (!response.ok) {
    const errorText = await response.text();

    console.error(
      "Worker HTTP error:",
      response.status,
      errorText
    );

    throw new Error(
      `خطای Worker (${response.status}): ${errorText.substring(0, 1200)}`
    );
  }

  const responseText = await response.text();
  let data;

  try {
    data = JSON.parse(responseText);
  } catch {
    console.error("پاسخ غیر JSON از Worker:", responseText);

    throw new Error(
      "Worker پاسخ JSON معتبر برنگرداند. پاسخ دریافتی: " +
      responseText.substring(0, 500)
    );
  }

  // پاسخ استاندارد Gemini API
  const aiText = data?.candidates?.[0]?.content?.parts
    ?.map((part) => part.text || "")
    .join("");

  if (!aiText) {
    console.error("ساختار پاسخ Worker:", data);

    const apiMessage =
      data?.error?.message ||
      data?.message ||
      "متن پاسخ هوش مصنوعی خالی است.";

    throw new Error("پاسخ Gemini قابل خواندن نیست: " + apiMessage);
  }

  let parsed;

  try {
    parsed = JSON.parse(aiText);
  } catch {
    console.error("متن دریافتی از Gemini:", aiText);

    throw new Error(
      "Gemini خروجی JSON معتبر تولید نکرد. جزئیات در Console موجود است."
    );
  }

  const questions = Array.isArray(parsed)
    ? parsed
    : parsed.questions;

  if (!Array.isArray(questions)) {
    throw new Error(
      "ساختار خروجی Gemini اشتباه است؛ آرایه questions پیدا نشد."
    );
  }

  return questions;
}
