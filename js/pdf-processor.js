
const WORKER_URL = "https://konkorsaz.webgereft.workers.dev";

pdfjsLib.GlobalWorkerOptions.workerSrc =
  "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";

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

  if (!questionFile) {
    alert("لطفاً فایل PDF سوالات را انتخاب کنید.");
    return;
  }

  if (!answerFile) {
    alert("لطفاً فایل PDF پاسخنامه را هم انتخاب کنید.");
    return;
  }

  try {
    if (button) {
      button.disabled = true;
      button.innerText = "در حال خواندن PDFها...";
    }

    const questionText = await readPDFText(questionFile);
    const answerText = await readPDFText(answerFile);

    if (questionText.trim().length < 100) {
      throw new Error(
        "متن سوالات استخراج نشد؛ ممکن است PDF اسکن‌شده باشد."
      );
    }

    if (answerText.trim().length < 10) {
      throw new Error(
        "متن پاسخنامه استخراج نشد؛ ممکن است PDF اسکن‌شده باشد."
      );
    }

    if (button) {
      button.innerText = "هوش مصنوعی در حال تطبیق پاسخ‌ها...";
    }

    const questions = await extractQuestionsWithAI(
      questionText,
      answerText
    );

    const rows = questions
      .map((q) => {
        const options = Array.isArray(q.options)
          ? q.options.map((x) => String(x))
          : [];

        const answerIsValid =
          Number.isInteger(q.answer) &&
          q.answer >= 0 &&
          q.answer < options.length;

        return {
          subject: "نامشخص",
          grade: "نامشخص",
          chapter: "عمومی",
          question_text: String(q.q || "").trim(),
          options,
          correct_answer: answerIsValid ? q.answer : null
        };
      })
      .filter((q) =>
        q.question_text.length > 0 &&
        q.options.length >= 2
      );

    if (rows.length === 0) {
      throw new Error(
        "سوال معتبری برای ذخیره پیدا نشد."
      );
    }

    if (button) {
      button.innerText = "در حال ذخیره در Supabase...";
    }

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
          "خطای ذخیره در Supabase: " + error.message
        );
      }

      savedCount += data ? data.length : batch.length;
    }

    const unknownCount = rows.filter(
      (q) => q.correct_answer === null
    ).length;

    alert(
      `پردازش تمام شد!\n` +
      `سوال‌های ذخیره‌شده: ${savedCount}\n` +
      `پاسخ‌های نامشخص: ${unknownCount}` +
      (unknownCount
        ? "\nپاسخ‌های نامشخص را قبل از آزمون بررسی کن."
        : "")
    );

  } catch (error) {
    console.error("PDF processing error:", error);

    alert(
      "خطا در پردازش:\n" +
      (error?.message || String(error))
    );

  } finally {
    if (button) {
      button.disabled = false;
      button.innerText = "شروع پردازش و استخراج";
    }
  }
}


// استخراج متن صفحات PDF با PDF.js
async function readPDFText(file) {
  if (!file || file.type !== "application/pdf") {
    throw new Error("فایل انتخاب‌شده باید PDF باشد.");
  }

  const buffer = await file.arrayBuffer();

  const pdf = await pdfjsLib.getDocument({
    data: new Uint8Array(buffer)
  }).promise;

  const pageTexts = [];

  for (let pageNumber = 1;
       pageNumber <= pdf.numPages;
       pageNumber++) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();

    const text = content.items
      .map((item) => item.str || "")
      .join(" ");

    pageTexts.push(
      `--- صفحه ${pageNumber} ---\n${text}`
    );
  }

  return pageTexts.join("\n\n");
}


// ارسال متن سوالات و پاسخنامه به Worker
async function extractQuestionsWithAI(
  questionText,
  answerText
) {
  // محدودیت ساده برای جلوگیری از ارسال متن بسیار حجیم
  const maxCharsPerFile = 20000;

  const prompt = `
متن زیر از PDF سوالات و PDF پاسخنامه یک آزمون استخراج شده است.

وظایف:
1. تمام سوالات قابل شناسایی را استخراج کن.
2. متن سوال و گزینه‌ها را تا حد امکان دقیق و به ترتیب اصلی حفظ کن.
3. شماره سوال را در فیلد number ثبت کن.
4. پاسخنامه را با شماره سوال‌ها تطبیق بده.
5. answer اندیس صفرمبنای گزینه صحیح باشد:
   گزینه اول = 0، دوم = 1، سوم = 2، چهارم = 3.
6. اگر پاسخ مشخص نیست، answer را null قرار بده.
7. پاسخ را حدس نزن و پاسخ نامعلوم را صفر نگذار.
8. اگر پاسخنامه فقط حرف یا شماره گزینه دارد، آن را با گزینه‌های همان سوال تطبیق بده.
9. فقط JSON معتبر برگردان، بدون Markdown و توضیح اضافی.

ساختار خروجی:
{
  "questions": [
    {
      "number": 1,
      "q": "متن کامل سوال",
      "options": ["گزینه اول", "گزینه دوم", "گزینه سوم", "گزینه چهارم"],
      "answer": 0
    }
  ]
}

متن PDF سوالات:
${questionText.substring(0, maxCharsPerFile)}

متن PDF پاسخنامه:
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
      "ارتباط با Worker برقرار نشد. آدرس و اتصال اینترنت را بررسی کن. " +
      "جزئیات: " + (error.message || String(error))
    );
  }

  const responseText = await response.text();

  if (!response.ok) {
    console.error(
      "Worker/Gemini HTTP error:",
      response.status,
      responseText
    );

    throw new Error(
      `خطای Worker یا Gemini (${response.status}): ` +
      responseText.substring(0, 1000)
    );
  }

  let data;

  try {
    data = JSON.parse(responseText);
  } catch {
    throw new Error(
      "Worker پاسخ JSON معتبر برنگرداند: " +
      responseText.substring(0, 300)
    );
  }

  if (data?.error) {
    throw new Error(
      data.error.message ||
      JSON.stringify(data.error)
    );
  }

  const aiText = data?.candidates?.[0]?.content?.parts
    ?.map((part) => part.text || "")
    .join("");

  if (!aiText) {
    console.error("Unexpected Gemini response:", data);

    throw new Error(
      "پاسخ Gemini خالی است یا ساختار مورد انتظار را ندارد."
    );
  }

  let parsed;

  try {
    parsed = JSON.parse(aiText);
  } catch {
    throw new Error(
      "هوش مصنوعی خروجی JSON معتبر تولید نکرد."
    );
  }

  const questions = Array.isArray(parsed)
    ? parsed
    : parsed.questions;

  if (!Array.isArray(questions)) {
    throw new Error(
      "آرایه سوالات در پاسخ هوش مصنوعی پیدا نشد."
    );
  }

  return questions;
}
