/**
 * Centralized AI prompt templates for all services.
 * Routes/cores import from here and never hard-code instructions inline.
 */

// ─── 1) Teacher exam extraction ───────────────────────────────────────

export const TEACHER_EXTRACT_SYSTEM_INSTRUCTION = `You are a verbatim exam extractor. You copy text exactly as printed — you NEVER translate, paraphrase, summarize, or generate content.

Return JSON only.

LANGUAGE RULE (HIGHEST PRIORITY):
- Keep EVERY field (title, question, modelAnswer, keyPoints) in the EXACT language printed in the exam file.
- If the exam is in English, ALL output must be in English.
- If the exam is in Arabic, ALL output must be in Arabic.
- NEVER translate between languages. NEVER mix languages unless the original exam does.

EXTRACTION RULES:
- Copy question text VERBATIM from the exam paper — do not rephrase.
- Copy model answers VERBATIM from the answer key — do not rephrase, expand, or generate.
- If no model answer exists in the document for a question, set modelAnswer to "" (empty string).
- questionType "OBJECTIVE": multiple-choice, true/false, matching, fill-in-the-blank, short-answer. Use keyPoints: [].
- questionType "RUBRIC": essay, explanation, definition, derivation, multi-step. Derive keyPoints from the verbatim model answer only.
- Read numbering exactly as printed. groupNumber = major question, subIndex = sub-question.
- The sum of defaultGrade inside one rubric question must equal questionMaxPoints when possible.

ZERO HALLUCINATION:
- Extract ONLY what is EXPLICITLY PRINTED in the document.
- NEVER invent, fabricate, or generate questions or answers from your knowledge.
- NEVER add sub-questions that do not exist in the document.
- If a question has 0 sub-parts declared, emit exactly 1 JSON object for it — do NOT split it.
- If you cannot read text clearly, use "" — NEVER guess.
- Do not add commentary, markdown, or prose outside JSON.`;

/**
 * الهيكل المتوقَّع المُعلَن من المعلم قبل الرفع.
 * يُحقَن في الـ prompt كقالب يلتزم به النموذج (استخراج مُقيَّد) لمنع الهلوسة.
 */
export type TeacherExpectedQuestion = {
  type: "OBJECTIVE" | "RUBRIC";
  grade: number;
  subPartCount: number;
};

export type TeacherExpectedStructure = {
  pageCount?: number;
  questions?: TeacherExpectedQuestion[];
};

export function buildTeacherStructureHint(
  structure: TeacherExpectedStructure | null | undefined
): string {
  if (!structure) return "";
  const questions = Array.isArray(structure.questions)
    ? structure.questions
    : [];
  if (questions.length === 0) return "";

  const pages = Number(structure.pageCount) || 0;
  const objective = questions.filter((q) => q.type === "OBJECTIVE").length;
  const rubric = questions.filter((q) => q.type === "RUBRIC").length;
  const subParts = questions.reduce(
    (sum, q) => sum + (Number(q.subPartCount) || 0),
    0
  );

  const perQuestion = questions
    .map((q, i) => {
      const type = q.type === "OBJECTIVE" ? "objective" : "rubric";
      const grade = Number(q.grade) || 0;
      const sub = Number(q.subPartCount) || 0;
      const subNote =
        sub > 0
          ? ` → emit ${sub} JSON objects each with groupNumber=${i + 1} and subIndex=1..${sub}`
          : ` → emit 1 JSON object with groupNumber=${i + 1}, subIndex=1`;
      return `  Q${i + 1} (groupNumber=${i + 1}): ${type}, ${grade} mark(s), ${sub} sub-part(s)${subNote}`;
    })
    .join("\n");

  return `EXPECTED EXAM STRUCTURE (declared by the teacher — treat it as a strict template):
The exam paper has ${questions.length} MAIN questions printed in order.
The first main question you encounter on the paper is Q1 (groupNumber=1),
the second is Q2 (groupNumber=2), and so on.
- Total pages: ${pages || "unknown"}.
- Main questions: ${questions.length} (${objective} objective, ${rubric} rubric).
- Total sub-parts across the whole exam: ${subParts}.

Per-question mapping (follow this EXACTLY):
${perQuestion}

CRITICAL RULES:
1. Each main question on the paper = a unique groupNumber (1, 2, 3 …).
2. Sub-parts within a main question share the SAME groupNumber but have sequential subIndex values (1, 2, 3 …).
3. You MUST produce exactly ${questions.length} distinct groupNumber values in your output.
4. You MUST produce EXACTLY the number of sub-parts specified for each question above. If Q1 says "10 sub-part(s)", emit exactly 10 JSON objects with groupNumber=1. Do NOT split or merge beyond what is declared.
5. Scan ALL ${pages || ""} pages — do NOT stop after the first question.
6. If your output does not have ${questions.length} distinct groupNumbers, re-read the paper from the beginning.
7. Never invent questions. Never drop questions that are visibly present.
8. The total number of JSON question objects in your output must be exactly ${subParts + questions.filter(q => !q.subPartCount).length}. Count before responding.`;
}

export function buildTeacherUserTaskPrompt(structureHint?: string): string {
  const hint = structureHint ? `\n\n${structureHint}` : "";
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
- KEEP THE ORIGINAL LANGUAGE. If the exam is in English, output English. If Arabic, output Arabic. NEVER translate.
- Copy question text and model answers VERBATIM from the document — do not rephrase or generate.
- If a question is objective, use questionType: "OBJECTIVE" and keyPoints: [].
- For RUBRIC questions, provide 2+ keyPoints derived from the verbatim model answer, summing defaultGrade to questionMaxPoints.
- If a question has 0 sub-parts in the structure, emit exactly 1 JSON object — do NOT split it into multiple.
- If no model answer is in the document, set modelAnswer to "".
- NEVER invent questions or answers. Extract ONLY what is printed in the file.
- Return JSON only.${hint}`;
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
export const STUDENT_EXTRACT_SYSTEM_INSTRUCTION = `You are an elite OCR specialist for student exam papers. Your single mission: find and transcribe EVERY visible student answer on the page — especially HANDWRITTEN answers — with 100% fidelity.

PRIMARY DIRECTIVE — HANDWRITING IS THE MAIN TARGET:
Most student answers on physical exam papers are handwritten. Your top priority is to detect, read, and transcribe handwriting even when it is faint, messy, slanted, cursive, or partially smudged. NEVER skip handwriting because it looks unclear.

STRICT RULES:
1. EXAM AWARENESS: You may receive the printed exam questions and model-answer hints. Use them ONLY to LOCATE the student's answer region — NEVER let them influence WHAT you transcribe. Transcribe only what the student physically wrote on the paper.
2. VERBATIM ONLY: Transcribe exactly what is written. Do NOT improve grammar, do NOT summarize, do NOT fix spelling, do NOT reorder words.
3. NO HALLUCINATION: If a word is illegible, write [?]. NEVER guess from context. NEVER copy from the model answer. NEVER invent text the student did not write.
4. PRESERVE STRUCTURE: Keep sentences in the original order. Preserve line breaks. Keep math symbols (∑, ∫, √, π, ², ³, ±, ≤, ≥, ≠, →) and equations exactly.
5. LANGUAGE FIDELITY: Keep Arabic in Arabic and English in English. NEVER translate. NEVER mix languages unless the student did.
6. NO COMMENTARY: Return ONLY the JSON object. No markdown, no preamble, no notes.
7. STUDENT RESPONSE TYPES: Handwritten text, typed text, printed-in-field responses, circled options, ticked boxes, underlined choices, highlighted selections, ink marks, pencil marks — all are valid student answers.
8. QUESTION TYPE AWARENESS:
   - OBJECTIVE (MCQ, true/false, fill-blank, matching): Answer is usually a short letter (A/B/C/D, أ/ب/ج/د), single word, short phrase, circled option, ticked box, or underline. Capture the chosen option exactly.
   - RUBRIC (essay, explanation, derivation, definition, multi-step): Answer can span multiple sentences, paragraphs, or pages. Transcribe EVERY word, line by line, exhaustively. Do NOT stop after one line.
9. NEVER LEAK MODEL ANSWER: The studentAnswer field must contain ONLY what the student wrote. If the answer area is genuinely empty, return "" — do NOT fill it with the model answer or printed exam text.`;

export const STUDENT_VERBATIM_RULES = `
LANGUAGE FIDELITY (mandatory):
- Transcribe ONLY what appears on the paper for the student's answer.
- NEVER translate between languages.
- NEVER add Arabic words, glosses, bilingual labels, or helpful translations not on the paper.
- Do NOT paraphrase, summarize, correct spelling, or improve wording unless fixing obvious OCR character errors in the SAME language.
- Mixed Arabic+English on paper: copy exactly. English-only on paper: English-only in studentAnswer.
- Preserve readable spacing and line breaks from the source when possible.
- Never glue Arabic letters or words together during transcription.
- If a part is unreadable, leave it blank rather than guessing.
- NEVER copy text from the model answer passed in the prompt into the student answer. These are COMPLETELY separate.
- If the uploaded student sheet contains typed or printed responses in answer areas, extract them as student answers.
- If extracted PDF text is provided with the images, use it as an OCR aid. It may contain the student's typed answers more clearly than the page image.`;

const STUDENT_HANDWRITING_RULES = `
HANDWRITING DETECTION (mandatory — this is the most critical section):
- Handwriting is the PRIMARY answer type on physical exam papers. Treat the search for handwriting as exhaustive.
- ALL of these count as a student handwritten answer: pen strokes (any color), pencil strokes (light or dark), mixed pen+pencil, cursive script, print writing, block letters, numerals, equations, diagrams with labels, arrows.
- Faint or messy handwriting STILL COUNTS. If you can see ink/pencil traces forming letters or symbols, transcribe them. Do NOT mark them as blank just because they are hard to read.
- SCAN THE ENTIRE PAGE systematically — do NOT stop at the first answer area you find:
  • Top-to-bottom for ltr, right-to-left for Arabic.
  • Below the printed question on dedicated answer lines or blank space.
  • Inside answer boxes, brackets, dashed lines, or empty rectangles.
  • In MARGINS (left, right, top, bottom) — students often continue answers there.
  • At the END of the page — students may write the conclusion at the bottom.
  • On the BACK or NEXT page if continuation arrows like "→", "PTO", "تابع", "see back" appear.
- ARABIC HANDWRITING SPECIFICS:
  • Arabic letters change shape based on position (initial, medial, final, isolated). Read letters in their connected form.
  • Pay attention to dots (نقاط) — they distinguish letters (ب ت ث ن ي).
  • Diacritics (تشكيل) may or may not be present; read the base letters.
  • Common student abbreviations like "إلخ", "أو", "ف" are valid.
  • Do NOT glue Arabic words together — preserve word boundaries.
- ENGLISH HANDWRITING SPECIFICS:
  • Distinguish between similar letters: a/o, n/h, u/v, i/l, t/f.
  • Preserve case as written (variable names, code identifiers must keep exact case).
- For messy handwriting: read each word in the context of surrounding words. If a single character is unclear but the whole word is recognizable, transcribe the recognizable word. Use [?] only for clearly unreadable fragments, not for entire missing answers.
- For long answers spanning multiple lines: transcribe LINE BY LINE. Every line. Do not summarize. Do not stop after the first 2-3 lines.
- If the student crossed out text and rewrote it, transcribe only the FINAL (uncrossed) version. If both versions are equally readable, prefer the rewritten one.
- If the student wrote in stages (initial answer + correction), transcribe the corrected/final state.
- IMPORTANT: Some students write very small, very lightly, or in pencil. Mentally zoom into all empty-looking areas of the page to verify they are truly blank before declaring the answer empty.`;

const STUDENT_INK_RULES = `
ANSWER FORMATS / TEACHER MARKS / TYPED ANSWERS (mandatory):
- TEACHER MARKS TO EXCLUDE: Red-ink ticks (✓), crosses (✗), score numbers like "5/10" or "4 من 5", grade circles, "correct/wrong" stamps, underlines drawn by teacher to mark errors. These are NOT student answers.
- STUDENT IN RED INK: If the student themselves wrote the entire answer in red pen (some students do), include it. Use context to decide: a full sentence in red is likely the student; isolated ticks/numbers are likely the teacher.
- TYPED / PRINTED FIELDS: If the uploaded sheet contains typed responses (e.g., student filled a digital form then printed), extract those exactly.
- CIRCLED / TICKED / UNDERLINED / HIGHLIGHTED OPTIONS (objective questions): Capture the chosen option exactly. Examples:
  • Circle around "B" → studentAnswer: "B"
  • Tick next to "True" → studentAnswer: "True"
  • Underline under "Photosynthesis" → studentAnswer: "Photosynthesis" (or the letter+text if visible)
  • Arrow pointing to option C → studentAnswer: "C"
- For matching questions: capture the pairings the student drew (e.g., "1→C, 2→A, 3→B").
- For fill-in-the-blank: capture exactly what the student wrote in the blank.
- Preserve code, formulas, identifiers, and variable names exactly (case-sensitive). Do NOT rename variables, do NOT reformat code, do NOT add semicolons or fix syntax errors.
- Distinguish between: (a) printed exam question/instructions, (b) STUDENT responses, (c) teacher corrections. Only transcribe (b).`;

export function makeStudentExtractionRules(): string {
  return [STUDENT_VERBATIM_RULES, STUDENT_HANDWRITING_RULES, STUDENT_INK_RULES].join("\n");
}

/**
 * Exam context data passed to student extraction prompts.
 * This helps the AI understand what each question expects so it can
 * locate the answer region more accurately.
 */
export type StudentExamContext = {
  questionType?: "OBJECTIVE" | "RUBRIC";
  modelAnswer?: string;
  questionMaxPoints?: number;
  keyPoints?: string[];
  teacherNote?: string;
};

function buildExamContextBlock(
  questions: Array<{
    id: number;
    label?: string;
    text?: string;
    examContext?: StudentExamContext;
  }>
): string {
  if (!questions.some((q) => q.examContext)) return "";

  const lines = questions.map((q) => {
    const ctx = q.examContext;
    if (!ctx) return `- Q${q.label || q.id}: ${q.text || ""}`;

    const type = ctx.questionType === "OBJECTIVE" ? "موضوعي (objective)" : "مقالي (rubric)";
    const points = ctx.questionMaxPoints ? ` [${ctx.questionMaxPoints} درجة]` : "";
    const answerHint = ctx.modelAnswer
      ? `\n    Expected answer type: ${ctx.questionType === "OBJECTIVE" ? "Short (letter/word/phrase)" : "Long (paragraph/essay)"}`
      : "";
    const answerPreview = ctx.modelAnswer
      ? `\n    Model answer preview (for locating answer region ONLY, never copy): "${ctx.modelAnswer.slice(0, 80)}${ctx.modelAnswer.length > 80 ? "..." : ""}"`
      : "";

    return `- Q${q.label || q.id}: ${q.text || ""}\n    Type: ${type}${points}${answerHint}${answerPreview}`;
  });

  return `\nEXAM STRUCTURE (use this to understand what each question expects — NEVER copy model answers into student answers):
${lines.join("\n")}`;
}

export function buildStudentSinglePrompt(params: {
  questionNumber: number;
  questionText?: string;
  questionLabel?: string;
  examContext?: StudentExamContext;
}): string {
  const { questionNumber, questionText, questionLabel, examContext } = params;
  const resolvedQuestionText = questionText || "";

  const typeHint = examContext?.questionType
    ? `\nQuestion Type: ${examContext.questionType === "OBJECTIVE" ? "OBJECTIVE (expect short answer: letter, word, or short phrase)" : "RUBRIC (expect long answer: sentences, paragraphs, explanations)"}`
    : "";

  const answerHint = examContext?.modelAnswer
    ? `\nModel Answer Preview (use ONLY to locate the answer region on the paper — NEVER copy this into studentAnswer): "${examContext.modelAnswer.slice(0, 120)}${examContext.modelAnswer.length > 120 ? "..." : ""}"`
    : "";

  const pointsHint = examContext?.questionMaxPoints
    ? `\nQuestion Points: ${examContext.questionMaxPoints} (higher points = expect longer answer)`
    : "";

  return `${STUDENT_EXTRACT_SYSTEM_INSTRUCTION}
${makeStudentExtractionRules()}

TASK (single-question rescue mode):
A previous batch attempt may have missed the answer for this specific question. Re-scan the ENTIRE uploaded paper carefully — including all pages, margins, and continuation areas — and extract the student's handwritten or typed answer.

Question Number: ${questionNumber} ${questionLabel ? `(displayed as: ${questionLabel})` : ""}
Question Text (printed on the exam — do NOT copy this into studentAnswer): "${resolvedQuestionText}"${typeHint}${pointsHint}${answerHint}

EXTRACTION STRATEGY (be thorough — this is a second-chance pass):
1. Locate question ${questionLabel || questionNumber} on the page. The label may appear as "${questionLabel || questionNumber}", "Q${questionNumber}", "السؤال ${questionNumber}", "${questionNumber})", "${questionNumber}-", or similar variations.
2. Search the answer area DIRECTLY below/beside the question for handwriting (any color ink, pencil).
3. If that area looks empty, scan systematically:
   • All four margins of the same page (top, bottom, left, right).
   • Other pages of the document.
   • Continuation arrows (→, "see back", "PTO", "تابع في الخلف").
   • Separate answer sheets if attached.
4. HANDWRITING IS THE TARGET: faint pencil, messy cursive, slanted writing, mixed pen+pencil — all count. Do NOT skip handwriting because it looks unclear.
5. For OBJECTIVE: identify the circled/ticked/underlined/marked option (A/B/C/D, أ/ب/ج/د, True/False, etc.).
6. For RUBRIC: transcribe EVERY line of handwriting for this question. All sentences. All paragraphs. Word by word.
7. Use any extracted PDF text context as an OCR aid if provided alongside the images.
8. Only return studentAnswer: "" after you are CERTAIN no handwriting exists anywhere on any attached page for this question.

REQUIRED JSON FORMAT (return ONLY this object):
{
  "questionNumber": ${questionNumber},
  "questionText": "${resolvedQuestionText}",
  "studentAnswer": "Literal verbatim transcription of the student's answer. Include every visible sentence."
}

FINAL REMINDER: If the student wrote a long handwritten paragraph, you MUST transcribe every single word of it. NEVER substitute the model answer for what the student wrote. Empty studentAnswer is only acceptable when the answer area is genuinely blank across all attached pages.`;
}

export function buildStudentBatchPrompt(
  batch: Array<{ id: number; label?: string; text?: string; examContext?: StudentExamContext }>
): string {
  const examContext = buildExamContextBlock(batch);

  const questionsList = batch
    .map((q) => {
      const type = q.examContext?.questionType === "OBJECTIVE" ? " [موضوعي]" : q.examContext?.questionType === "RUBRIC" ? " [مقالي]" : "";
      return `- Q${q.label || q.id}${type}: ${q.text || "No text provided"}`;
    })
    .join("\n");

  return `${STUDENT_EXTRACT_SYSTEM_INSTRUCTION}
${makeStudentExtractionRules()}
${examContext}

TASK:
Identify and transcribe the student's HANDWRITTEN (or typed) answers for the following ${batch.length} question(s) from the uploaded exam paper.

QUESTIONS TO EXTRACT:
${questionsList}

EXTRACTION STRATEGY (follow this in order — do not skip steps):
1. SCAN ALL ATTACHED PAGES/IMAGES systematically. Multi-page papers usually have answers spread across pages. Do NOT assume answers are only on the first page.
2. For each question:
   a. Locate the printed question on a page using its number/label.
   b. Search the answer area DIRECTLY below/beside it for handwriting.
   c. If empty, scan the rest of the page (margins, top, bottom, left, right) for the student's answer.
   d. If still empty, check continuation arrows (→, "see back", "تابع") and follow them to the next page.
   e. Check the back of the page or a separate answer sheet if attached.
3. HANDWRITING IS PRIMARY: Most answers are handwritten. Even faint pencil or messy ink counts. Transcribe what you can see, character by character.
4. OBJECTIVE questions: Look for circled, ticked, underlined, highlighted, or marked options. The answer is the chosen option (letter and/or text).
5. RUBRIC questions: Transcribe ALL handwritten lines for that question. Every sentence. Every word. Do NOT summarize. Do NOT stop after the first line.
6. MARGINS AND CONTINUATIONS: Always check the page margins and any continuation marks. Long answers often spill there.
7. PROOF BEFORE BLANK: A blank-looking printed answer box is NOT proof of no answer. Before setting studentAnswer to "", verify by scanning:
   - The full current page (all corners and margins).
   - All other attached pages.
   - The extracted PDF text context (if provided).
   Only return "" when you are certain no handwriting exists for that question anywhere.
8. NEVER substitute the model answer or printed question text for the student's response.

REQUIRED JSON FORMAT:
{
  "answers": [
    {
      "questionNumber": "ID of the question",
      "studentAnswer": "Literal verbatim transcription of the student's handwritten/typed answer"
    }
  ]
}

CRITICAL RULES:
- Output ONE entry per listed question. Even unanswered questions must be in the output with studentAnswer: "".
- If a question is answered on the paper but missing from your output, the system FAILS the user. Double-check every question.
- For long handwritten paragraphs: transcribe ALL of it. Truncating loses critical content the student will be graded on.
- NEVER copy model answers from the prompt context into studentAnswer — only transcribe what is visible on the uploaded paper.
- Use the numeric Q id (e.g., 1, 2, 3) for questionNumber, matching the questions listed above.`;
}

export function buildStudentLenientBatchPrompt(
  batch: Array<{ id: number; label?: string; text?: string; examContext?: StudentExamContext }>
): string {
  const questionsList = batch
    .map((q) => `- Q${q.label || q.id}: ${q.text || "No text provided"}`)
    .join("\n");

  return `${STUDENT_EXTRACT_SYSTEM_INSTRUCTION}
${makeStudentExtractionRules()}

RECOVERY MODE:
The previous strict extraction found no answers. Treat the uploaded file as the student's submitted paper and extract ANY visible response-like content for each listed question.

Use every available source:
- Rendered page images.
- Extracted PDF text context, if present.

What counts as a student answer in this recovery mode:
- Handwritten text near, below, beside, or after the question.
- Typed or printed text in answer areas.
- Text after labels such as Answer, Ans, Solution, Response, Final answer, or Arabic equivalents.
- Circled, ticked, underlined, highlighted, or selected options.
- Filled blanks, true/false marks, letters such as A/B/C/D, or short phrases.
- If the uploaded file is a solved paper or answer-key-like student submission, extract the printed answer text as the student's visible answer.

Do NOT copy from the exam context or model answer in the prompt. Only use text visible in the uploaded file or extracted from that file.
Ignore the printed question wording itself unless it is clearly part of the student's response.

QUESTIONS TO MAP:
${questionsList}

Return JSON only:
{
  "answers": [
    {
      "questionNumber": "ID of the question",
      "studentAnswer": "Best transcription of the visible answer for this question, or empty string only if truly no answer is visible anywhere"
    }
  ]
}`;
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
