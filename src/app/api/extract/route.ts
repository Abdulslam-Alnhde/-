import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { visionModelsChain } from "@/lib/gemini-config";
import {
  isTransientNetworkError,
  sleep,
  userFacingGeminiError,
} from "@/lib/gemini-helpers";
import { requireAuth } from "@/lib/auth-server";
import { getQuestionDisplayLabel } from "@/lib/question-labels";
import { round2 } from "@/lib/exam-keypoints-normalize";

import { aiManager } from "@/lib/ai-manager";

export const dynamic = "force-dynamic";

const MODELS = visionModelsChain();

/**
 * تعليمات ثابتة للنموذج: الجودة هنا أهم من اختصار المخرجات.
 * تُفصَل عن نص المهمة لتبقى محاور التقييم دقيقة عند التصحيح الآلي.
 */
const EXTRACT_SYSTEM_INSTRUCTION = `You are an expert at building grading rubrics for university exams.
You will receive images or PDF pages of an exam paper; your task is to return structured JSON only.

## Mandatory: keyPoints language and grounding
- Every keyPoints[].point must be written in **English** (clear academic English).
- Derive criteria **only** from the provided exam/model-answer text (and attached reference materials if any). Do not invent facts or topics that are not supported by that text.
- keyPoints are used for **automated grading later**. Vague criteria make grading unfair.

### Required method (do not describe this in JSON)
1. For each question/sub-question: extract the exact question text and model answer from the paper.
2. Decompose the model answer into logical parts (definition, steps, formula, example, edge case, code…).
3. For each important part expected in an excellent answer, add **one** keyPoints item stating precisely what the student must demonstrate (scientific meaning, not verbatim copying).
4. Do not use a single vague rubric line for a long multi-part question; do not over-split a short question.

### Shape of each keyPoints[].point
- A **complete English sentence** (typically 12–25 words for a medium item) stating the criterion, not emotion.
- Forbidden as the only rubric line: "correct answer", "shows understanding", "adequate response" without specifying **what** from the model answer.

### defaultGrade weights
- Reflect the weight of each idea in the model answer; approximate the sum of defaultGrade to questionMaxPoints without weakening the criteria text.

### Question and model answer language
- Keep question and modelAnswer in the **same language as the exam paper** (often Arabic). Only keyPoints[].point must be English.`;

function detectMimeType(file: File): string {
  let mimeType = file.type;
  if (!mimeType || mimeType === "application/octet-stream") {
    const name = file.name?.toLowerCase() || "";
    if (name.endsWith(".pdf")) return "application/pdf";
    if (name.endsWith(".png")) return "image/png";
    if (name.endsWith(".jpg") || name.endsWith(".jpeg")) return "image/jpeg";
    if (name.endsWith(".webp")) return "image/webp";
    return "application/pdf";
  }
  return mimeType;
}

function mapKeyPointsRaw(raw: any[]): { point: string; defaultGrade: number }[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((k) => ({
    point: String(k?.point ?? ""),
    defaultGrade: Number(k?.defaultGrade ?? k?.grade ?? 0) || 0,
  }));
}

function finiteMax(n: unknown): number | undefined {
  const x = Number(n);
  return Number.isFinite(x) && x > 0 ? x : undefined;
}

/**
 * لا نضغط الدرجات هنا — الإبقاء على صياغة المحاور كما أخرجها النموذج يحافظ على دقة المعايير؛
 * ضبط المجموع مع questionMaxPoints يتم عند اعتماد الحفظ في الواجهة.
 */
function buildKeyPointsForQuestion(sub: any): { point: string; defaultGrade: number }[] {
  const raw = mapKeyPointsRaw(sub?.keyPoints);
  return raw.map((k) => ({
    point: k.point.trim(),
    defaultGrade: round2(Number(k.defaultGrade) || 0),
  }));
}

/** يوحّد شكل الأسئلة مع ترقيم هرمي (مثل 3.1، 3.2) وملاحظة المعلم الفارغة */
function normalizeExtractPayload(data: any) {
  const title = typeof data?.title === "string" ? data.title : "";
  const out: any[] = [];

  if (Array.isArray(data?.questionGroups) && data.questionGroups.length > 0) {
    for (const g of data.questionGroups) {
      const gn = Number(g.groupNumber ?? g.number) || 1;
      const subs = g.subQuestions || g.items || [];
      subs.forEach((sub: any, j: number) => {
        const si =
          subs.length === 1 ? 1 : Number(sub.subIndex ?? j + 1);
        const kp = buildKeyPointsForQuestion(sub);
        const qmp = finiteMax(sub.questionMaxPoints ?? sub.maxPoints);
        out.push({
          question: String(sub.question ?? sub.text ?? ""),
          modelAnswer: String(sub.modelAnswer ?? sub.answer ?? ""),
          keyPoints: kp,
          groupNumber: gn,
          subIndex: si,
          ...(qmp != null ? { questionMaxPoints: qmp } : {}),
          displayLabel: getQuestionDisplayLabel(
            {
              groupNumber: gn,
              subIndex: si,
              displayLabel:
                typeof sub.displayLabel === "string"
                  ? sub.displayLabel
                  : undefined,
            },
            out.length
          ),
          teacherNote: "",
        });
      });
    }
  }

  let rawQuestions: any[] = [];
  if (out.length === 0 && Array.isArray(data?.questions)) {
    rawQuestions = data.questions;
  }

  if (!Array.isArray(rawQuestions) || rawQuestions.length === 0) {
    return { title, questions: out };
  }

  for (let i = 0; i < rawQuestions.length; i++) {
    const item = rawQuestions[i];
    if (!item || typeof item !== "object") continue;

    const subs =
      item.subQuestions || item.sub_questions || item.parts || item.items;

    if (Array.isArray(subs) && subs.length > 0) {
      const groupNum =
        Number(item.groupNumber ?? item.mainNumber ?? item.number) || i + 1;
      subs.forEach((sub: any, j: number) => {
        const subIdx =
          subs.length === 1 ? 1 : Number(sub.subIndex ?? sub.index ?? j + 1);
        const kp = buildKeyPointsForQuestion(sub);
        const qmp = finiteMax(sub.questionMaxPoints ?? sub.maxPoints);
        out.push({
          question: String(sub.question ?? sub.text ?? ""),
          modelAnswer: String(sub.modelAnswer ?? sub.answer ?? ""),
          keyPoints: kp,
          groupNumber: groupNum,
          subIndex: subIdx,
          ...(qmp != null ? { questionMaxPoints: qmp } : {}),
          displayLabel: getQuestionDisplayLabel(
            {
              groupNumber: groupNum,
              subIndex: subIdx,
              displayLabel:
                typeof sub.displayLabel === "string"
                  ? sub.displayLabel
                  : undefined,
            },
            out.length
          ),
          teacherNote: "",
        });
      });
      continue;
    }

    const gn = Number(item.groupNumber ?? item.number) || i + 1;
    const sn = 1;
    const kp = buildKeyPointsForQuestion(item);
    const qmp = finiteMax(item.questionMaxPoints ?? item.maxPoints);

    out.push({
      question: String(item.question ?? ""),
      modelAnswer: String(item.modelAnswer ?? ""),
      keyPoints: kp,
      groupNumber: gn,
      subIndex: sn,
      ...(qmp != null ? { questionMaxPoints: qmp } : {}),
      displayLabel: getQuestionDisplayLabel(
        {
          groupNumber: gn,
          subIndex: sn,
          displayLabel:
            typeof item.displayLabel === "string" ? item.displayLabel : undefined,
        },
        out.length
      ),
      teacherNote: "",
    });
  }

  return { title, questions: out };
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth();
    if (auth.error) return auth.error;

    const formData = await req.formData();
    const multi = formData.getAll("examFiles") as File[];
    const legacy = formData.get("examFile") as File | null;
    const referenceFiles = formData.getAll("referenceFiles") as File[];

    const examFiles: File[] = [];
    for (const f of multi) {
      if (f instanceof File && f.size > 0) examFiles.push(f);
    }
    if (examFiles.length === 0 && legacy instanceof File && legacy.size > 0) {
      examFiles.push(legacy);
    }

    if (examFiles.length === 0) {
      return NextResponse.json(
        { error: "لم يتم رفع أي ملف للاختبار" },
        { status: 400 }
      );
    }

    if (aiManager.getAvailableKeysCount() === 0) {
      return NextResponse.json(
        { error: "مفاتيح API الخاصة بـ Gemini غير مهيأة على الخادم." },
        { status: 500 }
      );
    }

    const genAI = aiManager.getClient();

    const userTaskPrompt = `## المهمة
حلّل الملفات المرفقة (ورقة الاختبار؛ قد يكون أكثر من ملفاً لأجزاء متتابعة).
إن وُجدت مواد مرجعية إضافية في الرسالة، استخدمها لتعزيز المصطلحات والسياق العلمي فقط.

**مهم:** كل عنصر داخل keyPoints يجب أن يكون حقل point باللغة الإنجليزية فقط، ومشتقاً حصراً من نص السؤال/الإجابة النموذجية في المرفقات.

التزم بتعليمات النظام السابقة بخصوص **جودة keyPoints** واشتقاقها من الإجابة النموذجية جملة بجملة فكرياً.

لكل سؤال/فرع:
- \`question\` و \`modelAnswer\` كما في الورقة (أو تلخيص منظم إذا كانت الإجابة النموذجية طويلة جداً مع الإبقاء على كل المعايير).
- \`questionMaxPoints\`: الدرجة المذكورة في الورقة لهذا السؤال/الفرع.
- \`keyPoints\`: قائمة غنية بالمعايير كما في تعليمات النظام (لا تُفرّغ المحتوى).

## ترقيم الأسئلة (مهم جداً)
- إذا ظهر في الورقة **سؤال رئيسي برقم** (مثلاً 3) وتحته **عدة أسئلة فرعية** (أ، ب، ج أو (1)(2)(3) أو أسطر منفصلة)، يجب تمييزها:
  - استخدم \`groupNumber\` = رقم السؤال الرئيسي.
  - لكل فرع استخدم \`subIndex\` = 1، 2، 3…
  - أو ضع الأسئلة الفرعية داخل مصفوفة \`subQuestions\` تحت السؤال الرئيسي.
- **groupNumber** و **subIndex** أدق من displayLabel: رقم السؤال الرئيسي كما يظهر **مطبوعاً على الورقة** (مثل 3)، وليس ترتيب العنصر داخل JSON.
- **displayLabel** اختياري؛ النظام يبني التسمية من groupNumber و subIndex لتفادي أخطاء الترقيم.
- للأسئلة الفرعية: groupNumber=3 و subIndex=1 يعني 3.1. لسؤال مستقل بلا فروع: رقم واحد فقط في الورقة (مثل 4) مع subIndex=1.

## المخرجات — JSON فقط (بدون markdown):
{
  "title": "عنوان الاختبار",
  "questions": [
    {
      "groupNumber": 3,
      "subQuestions": [
        {
          "subIndex": 1,
          "displayLabel": "3.1",
          "question": "نص السؤال الفرعي",
          "modelAnswer": "الإجابة النموذجية",
          "questionMaxPoints": 5,
          "keyPoints": [
            { "point": "State the correct definition of … as in the model answer.", "defaultGrade": 2 },
            { "point": "Apply step … with justification matching the model.", "defaultGrade": 3 }
          ]
        }
      ]
    },
    {
      "displayLabel": "4",
      "groupNumber": 4,
      "subIndex": 1,
      "question": "سؤال مستقل بدرجة واحدة من الورقة",
      "modelAnswer": "...",
      "questionMaxPoints": 4,
      "keyPoints": [ { "point": "English criterion derived from model text only.", "defaultGrade": 2 } ]
    }
  ]
}

- لكل سؤال أو فرع: أضف **questionMaxPoints** = إجمالي درجة ذلك السؤال/الفرع كما هو مذكور في الورقة (رقماً).
- **لا تتجاوز** مجموع defaultGrade لـ questionMaxPoints بشكل كبير؛ إن اقتربت من السقف فهذا مقبول والنظام يضبط لاحقاً.
- سؤال مستقل برقم واحد (مثل 4) يجب أن يكون **subIndex**: 1 دائماً وليس نفس رقم المجموعة (لا تستخدم 4 كـ subIndex لسؤال 4).

يمكنك أيضاً إرجاع قائمة مسطحة من العناصر التي تحتوي كل منها: questionMaxPoints، displayLabel، groupNumber، subIndex، question، modelAnswer، keyPoints.

أعد JSON واحداً فقط دون markdown.`;

    let lastError: unknown = null;
    const maxAttemptsPerModel = 3;

    for (const modelName of MODELS) {
      try {
        console.log(`[extract-exam] Trying model: ${modelName}`);

        const model = genAI.getGenerativeModel({
          model: modelName,
          systemInstruction: EXTRACT_SYSTEM_INSTRUCTION,
          generationConfig: {
            temperature: 0,
            maxOutputTokens: 12288,
            topP: 1,
            topK: 1,
          },
        });

        const parts: any[] = [{ text: userTaskPrompt }];

        for (const examFile of examFiles) {
          const bytes = await examFile.arrayBuffer();
          parts.push({
            inlineData: {
              data: Buffer.from(bytes).toString("base64"),
              mimeType: detectMimeType(examFile),
            },
          });
        }

        if (referenceFiles && referenceFiles.length > 0) {
          for (const ref of referenceFiles) {
            if (ref instanceof File && ref.size > 0) {
              const refBytes = await ref.arrayBuffer();
              parts.push({
                inlineData: {
                  data: Buffer.from(refBytes).toString("base64"),
                  mimeType: detectMimeType(ref),
                },
              });
            }
          }
        }

        let rawResponse = "";
        for (let attempt = 1; attempt <= maxAttemptsPerModel; attempt++) {
          try {
            const result = await model.generateContent(parts);
            rawResponse = result.response.text();
            break;
          } catch (e: unknown) {
            if (
              attempt < maxAttemptsPerModel &&
              isTransientNetworkError(e)
            ) {
              await sleep(500 * attempt);
              continue;
            }
            throw e;
          }
        }
        if (!rawResponse) {
          throw new Error("لم يُعدّ النموذج أي نصاً بعد الاستدعاء.");
        }
        console.log(
          `[extract-exam] Raw response from ${modelName}:`,
          rawResponse.substring(0, 300)
        );

        let cleanResponse = rawResponse
          .replace(/```json\s*/gi, "")
          .replace(/```\s*/gi, "")
          .trim();

        const jsonMatch = cleanResponse.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
          throw new Error("لم يتم العثور على JSON صحيح في استجابة النموذج.");
        }

        const parsed = JSON.parse(jsonMatch[0]);
        const normalized = normalizeExtractPayload(parsed);
        console.log(`[extract-exam] ✅ Success with model: ${modelName}`);
        return NextResponse.json(normalized);
      } catch (err: any) {
        lastError = err;
        const status = err?.status || err?.code;
        console.error(
          `[extract-exam] Model ${modelName} failed:`,
          err?.message || err
        );

        if (
          status === 429 ||
          err?.message?.includes("429") ||
          err?.message?.includes("quota")
        ) {
          return NextResponse.json(
            {
              error:
                "الخدمة مزدحمة حالياً، يرجى الانتظار 30 ثانية والمحاولة مرة أخرى.",
            },
            { status: 429 }
          );
        }

        console.warn(`[extract-exam] Falling back to next model...`);
      }
    }

    console.error("[extract-exam] All models failed:", lastError);
    return NextResponse.json(
      { error: userFacingGeminiError(lastError) },
      { status: 500 }
    );
  } catch (error: any) {
    console.error("EXAM EXTRACTION CRITICAL ERROR:", error);
    if (error?.status === 429 || error?.message?.includes("429")) {
      return NextResponse.json(
        {
          error:
            "الخدمة مزدحمة حالياً، يرجى الانتظار 30 ثانية والمحاولة مرة أخرى.",
        },
        { status: 429 }
      );
    }
    return NextResponse.json(
      { error: userFacingGeminiError(error) },
      { status: 500 }
    );
  }
}
