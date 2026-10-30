
"use strict";

const WORKER_URL = "https://konkorsaz.webgereft.workers.dev";

if (typeof pdfjsLib !== "undefined") {
  pdfjsLib.GlobalWorkerOptions.workerSrc =
    "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
}

// نگهداری تنظیمات آخرین پردازش
let lastPDFImport = {
  subject: "",
  examYear: null,
  examSession: "",
  examLocation: "inside"
};

function getPDFElementValue(id, fallback = "") {
  const element = document.getElementById(id);
  return element ? element.value.trim() : fallback;
}

function getPDFImportSettings() {
  return {
    subject: getPDFElementValue("pdfSubject", "زیست‌شناسی"),
    examYear: Number(getPDFElementValue("pdfYear", "")) || null,
    examSession: getPDFElementValue("pdfSession", ""),
    examLocation: getPDFElementValue("pdfLocation", "inside")
  };
}

// پردازش اصلی PDF
async function extractFromPDF() {
  const questionFile =
    document.getElementById("pdfQuestions")?.files?.[0];

  const answerInput =
    document.getElementById("pdfAnswers") ||
    document.getElementById("pdfAnswerKey") ||
    document.getElementById("pdfAnswersKey");

  const answerFile = answerInput?.files?.[0];

  const button = document.querySelector(
    'button[onclick="extractFromPDF()"]'
  );

  const status = document.getElementById("pdfStatus");

  function updateStatus(message) {
    if (status) status.innerText = message;
    if (button) button.innerText = message;
  }

  if (!questionFile || !answerFile) {
    alert("لطفاً هر دو فایل سؤال و پاسخ‌نامه را انتخاب کن.");
    return;
  }

  if (
    typeof supabaseClient === "undefined" ||
    typeof pdfjsLib === "undefined"
  ) {
    alert("کتابخانه PDF یا اتصال Supabase بارگذاری نشده است.");
    return;
  }

  try {
    if (button) button.disabled = true;

    updateStatus("در حال خواندن فایل‌ها...");

    const settings = getPDFImportSettings();

    const questionText = await readPDFText(questionFile);
    const answerText = await readPDFText(answerFile);

    if (questionText.trim().length < 100) {
      throw new Error(
        "متن سؤال استخراج نشد. احتمالاً PDF اسکن‌شده است."
      );
    }

    if (answerText.trim().length < 10) {
      throw new Error(
        "متن پاسخ‌نامه استخراج نشد."
      );
    }

    updateStatus("هوش مصنوعی در حال استخراج سؤال‌ها...");

    const questions = await extractQuestionsWithAI(
      questionText,
      answerText
    );

    if (!questions.length) {
      throw new Error("سؤالی از فایل‌ها استخراج نشد.");
    }

    const rows = questions
      .map(question => convertQuestionToDatabaseRow(
        question,
        settings
      ))
      .filter(Boolean);

    if (!rows.length) {
      throw new Error(
        "هیچ سؤال معتبری برای ذخیره‌سازی وجود ندارد."
      );
    }

    updateStatus("در حال ذخیره سؤال‌ها در Supabase...");

    let savedCount = 0;

    for (let i = 0; i < rows.length; i += 50) {
      const batch = rows.slice(i, i + 50);

      const { data, error } = await supabaseClient
        .from("questions_bank")
        .insert(batch)
        .select("id");

      if (error) {
        console.error("Supabase error:", error);
        throw new Error(
          "ذخیره‌سازی ناموفق بود: " + error.message
        );
      }

      savedCount += data ? data.length : batch.length;
    }

    const unknownCount = rows.filter(
      row => row.correct_answer === null
    ).length;

    lastPDFImport = settings;

    const report =
      `پردازش انجام شد!\n\n` +
      `تعداد سؤال‌های استخراج‌شده: ${questions.length}\n` +
      `تعداد سؤال‌های ذخیره‌شده: ${savedCount}\n` +
      `پاسخ‌های نامشخص: ${unknownCount}\n\n` +
      `وضعیت سؤال‌ها: در انتظار بررسی`;

    updateStatus("پردازش با موفقیت تمام شد.");

    alert(report);

  } catch (error) {
    console.error("PDF processing error:", error);

    updateStatus("خطا در پردازش فایل‌ها");

    alert(
      "خطا در پردازش:\n" +
      (error.message || String(error))
    );

  } finally {
    if (button) {
      button.disabled = false;
      button.innerText = "شروع پردازش و استخراج";
    }
  }
}

// تبدیل سؤال استخراج‌شده به قالب جدول Supabase
function convertQuestionToDatabaseRow(question, settings) {
  if (!question || typeof question !== "object") {
    return null;
  }

  const options = Array.isArray(question.options)
    ? question.options.map(value => String(value || "").trim())
    : [];

  if (
    !question.q ||
    String(question.q).trim().length < 3 ||
    options.length !== 4 ||
    options.some(option => !option)
  ) {
    return null;
  }

  const answer = Number.isInteger(question.answer) &&
    question.answer >= 0 &&
    question.answer <= 3
      ? question.answer + 1
      : null;

  return {
    subject: settings.subject,
    exam_year: settings.examYear,
    exam_session: settings.examSession || null,
    question_number: Number(question.number) || null,

    question_text: String(question.q).trim(),

    option_a: options[0],
    option_b: options[1],
    option_c: options[2],
    option_d: options[3],

    correct_answer: answer,

    explanation: question.explanation
      ? String(question.explanation)
      : null,

    source: "PDF + AI extraction",
    exam_location: settings.examLocation,

    verification_status: "pending"
  };
}

// خواندن متن PDF
async function readPDFText(file) {
  if (!file || file.type !== "application/pdf") {
    throw new Error("فایل انتخاب‌شده باید PDF باشد.");
  }

  const buffer = await file.arrayBuffer();

  const pdf = await pdfjsLib.getDocument({
    data: new Uint8Array(buffer)
  }).promise;

  const pageTexts = [];

  for (
    let pageNumber = 1;
    pageNumber <= pdf.numPages;
    pageNumber++
  ) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();

    const text = content.items
      .map(item => item.str || "")
      .join(" ");

    pageTexts.push(
      `--- صفحه ${pageNumber} ---\n${text}`
    );
  }

  return pageTexts.join("\n\n");
}

// استخراج سؤال‌ها با هوش مصنوعی
async function extractQuestionsWithAI(
  questionText,
  answerText
) {
  const maxCharsPerFile = 20000;

  const prompt = `
متن زیر از PDF سؤال‌ها و PDF پاسخ‌نامه یک آزمون استخراج شده است.

وظایف:
1. تمام سؤال‌های قابل شناسایی را استخراج کن.
2. متن سؤال و چهار گزینه را دقیق حفظ کن.
3. شماره اصلی هر سؤال را در number قرار بده.
4. پاسخ‌نامه را با شماره سؤال تطبیق بده.
5. answer اندیس صفرمبنای گزینه صحیح باشد:
   گزینه اول = 0
   گزینه دوم = 1
   گزینه سوم = 2
   گزینه چهارم = 3
6. اگر پاسخ مشخص نیست، answer را null قرار بده.
7. پاسخ را حدس نزن.
8. اگر پاسخ‌نامه شماره گزینه دارد، آن را به اندیس صفرمبنا تبدیل کن.
9. متن توضیح پاسخ را در explanation قرار بده، اگر موجود بود.
10. فقط JSON معتبر تولید کن.

ساختار:
{
  "questions": [
    {
      "number": 1,
      "q": "متن سؤال",
      "options": [
        "گزینه اول",
        "گزینه دوم",
        "گزینه سوم",
        "گزینه چهارم"
      ],
      "answer": 0,
      "explanation": ""
    }
  ]
}

متن سؤال‌ها:
${questionText.substring(0, maxCharsPerFile)}

متن پاسخ‌نامه:
${answerText.substring(0, maxCharsPerFile)}
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
      "ارتباط با سرور هوش مصنوعی برقرار نشد: " +
      error.message
    );
  }

  const responseText = await response.text();

  if (!response.ok) {
    throw new Error(
      `خطای سرور (${response.status}): ` +
      responseText.substring(0, 500)
    );
  }

  let data;

  try {
    data = JSON.parse(responseText);
  } catch {
    throw new Error("پاسخ سرور JSON معتبر نیست.");
  }

  if (data?.error) {
    throw new Error(
      data.error.message || "خطای هوش مصنوعی"
    );
  }

  const aiText = data?.candidates?.[0]?.content?.parts
    ?.map(part => part.text || "")
    .join("");

  if (!aiText) {
    throw new Error("پاسخ هوش مصنوعی خالی است.");
  }

  let parsed;

  try {
    parsed = JSON.parse(aiText);
  } catch {
    throw new Error(
      "خروجی هوش مصنوعی JSON معتبر نیست."
    );
  }

  const questions = Array.isArray(parsed)
    ? parsed
    : parsed.questions;

  if (!Array.isArray(questions)) {
    throw new Error("فهرست سؤال‌ها پیدا نشد.");
  }

  return questions;
}
