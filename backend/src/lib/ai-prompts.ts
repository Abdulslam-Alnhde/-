/**
 * Centralized AI prompt templates for all services.
 * Routes/cores import from here and never hard-code instructions inline.
 */

// ─── 1) Teacher exam extraction ───────────────────────────────────────

export const TEACHER_EXTRACT_SYSTEM_INSTRUCTION = `You extract university exam questions into structured JSON for later grading.

Return JSON only.

Rules:
- Extract 100% of visible questions and sub-questions.
- Keep question text and model answers in the exam language.
- Do NOT translate between Arabic and English. Preserve Arabic wording, punctuation, and line breaks as much as possible.
- questionType must be "OBJECTIVE" for multiple-choice, true/false, matching, fill-in-the-blank, and direct short-answer questions.
- Objective questions must use keyPoints: [] and only set questionMaxPoints.
- questionType must be "RUBRIC" for explanation, essay, definition, derivation, and multi-step questions.
- For rubric questions only, keyPoints must be in the SAME language as the model answer (Arabic if the answer is Arabic). Derive 2–8 concise grading criteria from the model answer only; do not invent facts.
- Read numbering exactly as printed. Use groupNumber for the major question and subIndex for each sub-question.
- If the paper says "Explain any N of the following", "terms", "concepts", or "definitions", emit each listed item as its own sub-question under the same groupNumber.
- The sum of defaultGrade inside one rubric question must equal questionMaxPoints when possible.
- Do not add commentary, markdown, or prose outside JSON.`;

export function buildTeacherUserTaskPrompt(): string {
  return `Extract the uploaded exam into JSON.

Required JSON shape:
{
  "title": "Exam title",
  "questions": [
    {
      "groupNumber": 1,
      "subIndex": 1,
      "questionType": "RUBRIC",
      "question": "Question text",
      "modelAnswer": "Model answer",
      "questionMaxPoints": 5,
      "keyPoints": [
        { "point": "Grading criterion in the same language as modelAnswer", "defaultGrade": 2.5 },
        { "point": "Second criterion from the model answer only", "defaultGrade": 2.5 }
      ]
    }
  ]
}

Important:
- Preserve the original language of the exam (Arabic stays Arabic). Do NOT translate title/question/modelAnswer.
- If a question is objective, use questionType: "OBJECTIVE" and keyPoints: [].
- For RUBRIC questions, provide 2+ keyPoints in the same language as modelAnswer, summing defaultGrade to questionMaxPoints when possible.
- If a major question contains multiple listed terms or items, split them into separate sub-questions.
- Read numbering exactly from the paper.
- Never invent questions or answers not present in the uploaded exam file.
- If a field is unknown, return an empty string instead of fabrication.
- Return JSON only.`;
}

export function buildTeacherBatchPrompt(batchIndex: number, batchCount: number): string {
  return `Extract exam questions from this batch only.

Batch ${batchIndex + 1}/${batchCount}:
Extract only questions that explicitly appear in this batch.
Never invent questions not visible in the provided content parts.
If an answer is missing in this batch, return an empty string.`;
}

export function buildTeacherJsonRepairPrompt(rawResponse: string): string {
  return `Convert the following model output into strict valid JSON only.

Rules:
- Preserve extracted questions and answers as much as possible.
- Return one JSON object with keys "title" and "questions".
- If the content is a bare questions array, wrap it as {"title":"","questions":[...]}.
- Do not add commentary or markdown.

MODEL OUTPUT:
${rawResponse}`;
}

export function buildTeacherFillMissingAnswersPrompt(
  missing: Array<{ groupNumber?: number; subIndex?: number; question: string }>
): string {
  return `Fill only the missing model answers for these already-extracted exam questions.

Return JSON only in this shape:
{"answers":[{"groupNumber":1,"subIndex":1,"modelAnswer":"string"}]}

Rules:
- Use only the uploaded reference/model-answer files.
- Keep the answer in the source language.
- Do not rewrite numbering or question text.
- If an answer truly does not exist in the reference files, leave modelAnswer as an empty string.

Missing questions:
${JSON.stringify(missing, null, 2)}`;
}

export const TEACHER_FILL_SYSTEM_INSTRUCTION =
  "You complete missing model answers for extracted exam questions. Return JSON only.";

// ─── 2) Student answer extraction (handwriting OCR) ───────────────────

// تعليمات خاصة باستخراج إجابات الطالب لضمان الدقة العالية
export const STUDENT_EXTRACT_SYSTEM_INSTRUCTION = `You are a professional literal transcriber. Your goal is to extract student handwritten answers with 100% fidelity.

STRICT RULES:
1. VERBATIM ONLY: Transcribe exactly what is written. Do NOT improve grammar, do NOT summarize, and do NOT fix spelling.
2. NO HALLUCINATION: If a word is illegible, write [?]. Do NOT guess based on context.
3. PRESERVE STRUCTURE: Keep the sentences in the same order. If the student repeats a word, transcribe it twice.
4. LANGUAGE: Keep Arabic in Arabic and English in English. Do NOT translate.
5. NO COMMENTARY: Return ONLY the JSON object.`;

export const STUDENT_VERBATIM_RULES = `
LANGUAGE FIDELITY (mandatory):
- Transcribe ONLY what appears on the paper for the student's answer.
- NEVER translate between languages.
- NEVER add Arabic words, glosses, bilingual labels, or helpful translations not on the paper.
- Do NOT paraphrase, summarize, correct spelling, or improve wording unless fixing obvious OCR character errors in the SAME language.
- Mixed Arabic+English on paper: copy exactly. English-only on paper: English-only in studentAnswer.
- Preserve readable spacing and line breaks from the source when possible.
- Never glue Arabic letters or words together during transcription.
- If a part is unreadable, leave it blank rather than guessing.`;

const STUDENT_HANDWRITING_RULES = `
HANDWRITING (mandatory):
- Handwritten answers are valid answers. Do NOT ignore handwriting even if faint or messy.
- Look for handwritten content near the question area AND anywhere on the page where the student continued the answer.
- Preserve math symbols, arrows, crossed-out text, and line breaks.
- If the student wrote something but a word is unclear, transcribe what is visible and keep unclear fragments as-is (do NOT guess missing words).`;

const STUDENT_INK_RULES = `
INK / CORRECTIONS (mandatory):
- Treat clearly red-ink markings as teacher annotations and exclude them from studentAnswer when they are obviously corrections (ticks, crosses, scoring marks, "correct/wrong" symbols).
- If the student themselves wrote in red ink as part of their answer, include it.
- Preserve code, formulas, identifiers, and variable names exactly (case-sensitive). Do NOT rename variables, do NOT reformat code.`;

export function makeStudentExtractionRules(): string {
  return [STUDENT_VERBATIM_RULES, STUDENT_HANDWRITING_RULES, STUDENT_INK_RULES].join("\n");
}

export function buildStudentSinglePrompt(params: {
  questionNumber: number;
  questionText?: string;
  questionLabel?: string;
}): string {
  const { questionNumber, questionText, questionLabel } = params;
  const resolvedQuestionText = questionText || "";

  return `${STUDENT_EXTRACT_SYSTEM_INSTRUCTION}

TASK:
Extract the student's answer for this specific question:
Question Number: ${questionNumber} ${questionLabel ? `(${questionLabel})` : ""}
Question Text: "${resolvedQuestionText}"

REQUIRED JSON FORMAT:
{
  "questionNumber": ${questionNumber},
  "questionText": "${resolvedQuestionText}",
  "studentAnswer": "The literal transcription of the student's handwritten answer goes here. Be exhaustive and do not skip any sentences."
}

FINAL REMINDER: If the student wrote a long paragraph, you MUST transcribe every single word of it.`;
}

export function buildStudentBatchPrompt(
  batch: Array<{ id: number; label?: string; text?: string }>
): string {
  const questionsList = batch
    .map((q) => `- Q${q.id}: ${q.text || "No text provided"}`)
    .join("\n");

  return `${STUDENT_EXTRACT_SYSTEM_INSTRUCTION}

TASK:
Identify and transcribe the student's answers for the following ${batch.length} questions from the image:
${questionsList}

REQUIRED JSON FORMAT:
{
  "answers": [
    {
      "questionNumber": "ID of the question",
      "studentAnswer": "Literal, exhaustive transcription"
    }
  ]
}

CRITICAL: If a question is answered on the paper but missing from your output, the system fails. Ensure every visible sentence is captured.`;
}

export function buildStudentJsonRepairPrompt(rawText: string): string {
  return `Convert the following model output into strict valid JSON only.

Return one JSON object only.
Do not add commentary or markdown.
Keep the extracted student answer exactly as much as possible.

MODEL OUTPUT:
${rawText}`;
}

// ─── 3) Grading prompts ───────────────────────────────────────────────

export function buildGradingPrompt(params: {
  sortedAnswers: unknown;
  normalizedKeyPoints: unknown;
  examTotalGrade: unknown;
  referenceMaterialsText: string;
}): string {
  const { sortedAnswers, normalizedKeyPoints, examTotalGrade, referenceMaterialsText } =
    params;
  return `
أنت مقيّم أكاديمي صارم ومحايد. هدفك هو التصحيح المنطقي والموضوعي بدرجات ثابتة تماماً.
يجب أن تكون تقييماتك حتمية (Deterministic) بحيث تعطي نفس الدرجة لأي إجابة تحمل نفس المعنى أو نفس المنطق ولا تتأثر بموقع الإجابة في النص.

## مبادئ التقييم الصارمة:
1. **ثبات المعيار (Consistency)**: يجب تطبيق المعايير بدقة رياضية. إذا حقق الطالب المعطيات المطلوبة في الفرع، امنحه الدرجة المحددة لذلك الفرع كاملة.
2. **الأولوية للمعنى والمفهوم**: لا تتأثر بأسلوب التعبير. إذا كانت إجابة الطالب تحتوي على المفهوم العلمي أو المنطقي الصحيح بأي صيغة كانت، تُعتبر صحيحة بنسبة 100%.
3. **تجاهل فوضى النصوص (OCR Noise)**: تجاهل تماماً أي حروف زائدة، أخطاء إملائية طفيفة، أو علامات ترقيم غريبة ناتجة عن التصوير الضوئي ما دامت الكلمة العلمية أو المنطقية واضحة ومفهومة.
4. **الأكواد والرياضيات (الحل بالمنطق)**: المتغيرات المختلفة أو استخدام سكريبت بدلاً من دالة لا يُنقص الدرجة إطلاقاً الكود الصحيح منطقياً والذي يؤدي الغرض يأخذ الدرجة كاملة مهما كان شكله.
5. **منح النقاط (Scoring)**: قيّم كل فرع من فروع السؤال (Key Point) بشكل مستقل. إذا تطابقت الفكرة، امنح الطالب نفس درجة (maxWeight) الخاصة بهذا الفرع.
6. **تعليمات المعلم الصريحة (teacherNote)**: تعتبر قوانين عليا. التزم بها حرفياً وتجاهل أي شيء يتعارض معها.
7. **لا تتردد ولا تناقض نفسك**: إذا كانت الإجابة صحيحة منطقياً، امنحها الدرجة، لا تضع درجات جزئية إلا إذا كانت الإجابة ناقصة المعطيات حقاً.

## أمثلة عملية للتصحيح (Few-Shot Examples):

### مثال 1 — إجابة صحيحة المعنى رغم اختلاف الصياغة:
- **السؤال**: "ما هي الخوارزمية المستخدمة لترتيب الأرقام تصاعدياً بكفاءة O(n log n)؟"
- **الإجابة النموذجية**: "خوارزمية الدمج (Merge Sort)"
- **إجابة الطالب**: "ميرج سورت أو الترتيب بالدمج"
- **الحكم**: 'matched: true, earnedGrade: maxWeight' ← المعنى مطابق تماماً، اختلاف اللغة لا يُنقص.

### مثال 2 — إجابة ناقصة (جزء من الأفكار):
- **السؤال**: "اذكر خصائص قاعدة البيانات العلاقية (3 خصائص)."
- **المفاتيح**: ["الجداول", "المفاتيح الأجنبية", "SQL"]
- **إجابة الطالب**: "تستخدم جداول ومفاتيح"
- **الحكم**: فرعان صحيحان، فرع واحد ناقص. earnedGrade = (maxWeight1 + maxWeight2), الفرع الثالث = 0.

### مثال 3 — إجابة فارغة أو لا صلة لها:
- **إجابة الطالب**: "لا أعرف" أو فارغة تماماً.
- **الحكم**: 'matched: false, earnedGrade: 0' لجميع الفروع.

## قواعد العودة (JSON Output Rules):
- أعد نفس "studentAnswer" و"questionText" الواردة في المدخلات بالضبط.
- "score" يجب أن يكون مساوياً لمجموع درجات الفروع المحققة وألا يتجاوز questionMaxPoints.
- "evaluatedKeyPoints": لكل نقطة في النموذج، ضع earnedGrade و matched=true في حال توفرها.
- الأرقام بمنزلتين عشريتين.

## بيانات السياق
- examTotalGrade (سقف الاختبار الكلي): ${examTotalGrade ?? "غير محدد"}
- الملازم والملاحظات: ${referenceMaterialsText || "لا يوجد."}

## بيانات التصحيح (JSON) — الأوزان مقسّمة بالتساوي على الفروع
إجابات الطالب: ${JSON.stringify(sortedAnswers)}
معايير الأسئلة (تشمل maxWeight لكل فرع): ${JSON.stringify(normalizedKeyPoints)}

## المخرجات
أعد JSON فقط بهذا الشكل:
{
  "totalScore": number,
  "breakdown": [
    {
      "questionNumber": number,
      "questionText": string,
      "studentAnswer": string,
      "modelAnswer": string,
      "score": number,
      "reasoningAr": string,
      "missingPoints": string[],
      "evaluatedKeyPoints": [
        { "point": string, "earnedGrade": number, "matched": boolean }
      ]
    }
  ]
}
`;
}

export function buildSemanticRescuePrompt(params: {
  questionText: string;
  modelAnswer: string;
  studentAnswer: string;
  keyPoints: string[];
}): string {
  const { questionText, modelAnswer, studentAnswer, keyPoints } = params;
  return `
تحقق دلالي صارم لسؤال واحد (بدون تطابق حرفي).
احكم فقط: هل إجابة الطالب صحيحة مفاهيمياً مقارنة بالنموذج؟

قواعد إلزامية:
- تقبل اختلاف الأسلوب والصياغة والمرادفات.
- لا تعتبر الاختلاف اللغوي سبباً للخصم إذا المعنى العلمي صحيح.
- لا تُصَحِّح بالإملاء؛ صحّح بالمفهوم.
- إذا كان المعنى يحقق كل المطلوب، أجب true.

المدخلات:
- If the student's answer is Arabic and the model answer is English, or vice versa, compare meaning only.
- Language mismatch alone must never reduce the score.
- questionText: ${JSON.stringify(questionText)}
- modelAnswer: ${JSON.stringify(modelAnswer)}
- studentAnswer: ${JSON.stringify(studentAnswer)}
- keyPoints: ${JSON.stringify(keyPoints)}

أعد JSON فقط:
{
  "conceptuallyCorrect": boolean,
  "confidence": number,
  "reasonAr": string
}
`;
}
