import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { visionModelsChain } from "@/lib/gemini-config";
import {
  isTransientNetworkError,
  sleep,
  userFacingGeminiError,
} from "@/lib/gemini-helpers";
import { requireAuth } from "@/lib/auth-server";

import { aiManager } from "@/lib/ai-manager";

export const dynamic = "force-dynamic";

const MODELS = visionModelsChain();

/** قواعد لغوية إلزامية — يمنع ترجمة أو إثراء النموذج لإجابة الطالب */
const VERBATIM_RULES = `
LANGUAGE FIDELITY (mandatory):
- Transcribe ONLY what appears on the paper for the student's answer. Verbatim transcription / OCR.
- NEVER translate between languages. If the student wrote in English only, studentAnswer must be English only.
- NEVER add Arabic words, glosses, bilingual labels, or "helpful" translations that are not on the paper.
- Do NOT paraphrase, summarize, correct spelling, or "improve" wording unless fixing obvious OCR character errors for the SAME language.
- Mixed Arabic+English on paper: copy exactly. English-only on paper: English-only in studentAnswer.
`;

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth();
    if (auth.error) return auth.error;

    const formData = await req.formData();
    const file = formData.get("file") as File;
    const targetQuestionNumber = formData.get("targetQuestionNumber");
    const targetQuestionText = formData.get("targetQuestionText");
    const targetQuestionLabel = formData.get("targetQuestionLabel");
    const examQuestionsRaw = formData.get("examQuestions");

    let examQuestionsContext = "";
    if (examQuestionsRaw) {
      try {
        const qs = JSON.parse(examQuestionsRaw as string);
        examQuestionsContext = `\n\nEXAM QUESTIONS REFERENCE (Use 'id' for questionNumber):\n` + 
          qs.map((q: any) => `ID: ${q.id} | Label: ${q.label} | Text: ${q.text}`).join("\n");
      } catch (e) {}
    }

    if (!file) {
      return NextResponse.json({ error: "لم يتم العثور على ملف الطالب المرفوع" }, { status: 400 });
    }

    if (aiManager.getAvailableKeysCount() === 0) {
      return NextResponse.json({ error: "مفاتيح API الخاصة بـ Gemini مفقودة" }, { status: 500 });
    }

    const genAI = aiManager.getClient();

    const bytes = await file.arrayBuffer();
    const base64Data = Buffer.from(bytes).toString("base64");

    // Detect mime type properly
    let mimeType = file.type;
    if (!mimeType || mimeType === "application/octet-stream") {
      const name = file.name?.toLowerCase() || "";
      if (name.endsWith(".pdf")) mimeType = "application/pdf";
      else if (name.endsWith(".png")) mimeType = "image/png";
      else if (name.endsWith(".jpg") || name.endsWith(".jpeg")) mimeType = "image/jpeg";
      else if (name.endsWith(".webp")) mimeType = "image/webp";
      else mimeType = "image/jpeg"; // safe default
    }

    const prompt = targetQuestionNumber
      ? `You are an expert OCR assistant (transcription only — not a translator).
Focus ONLY on the question labeled "${targetQuestionLabel || targetQuestionNumber}" which has this text: "${targetQuestionText}".
Find the student's handwritten or typed answer for this specific question on the provided paper.
${VERBATIM_RULES}
Return ONLY raw JSON (no markdown, no code blocks): {"questionNumber": ${targetQuestionNumber}, "studentAnswer": "string"}`
      : `You are an expert OCR assistant (transcription only — not a translator or grader).
Extract all student answers from this exam paper.
Identify which question each answer belongs to. Match the answers to the provided EXAM QUESTIONS REFERENCE.
${VERBATIM_RULES}
Return ONLY raw JSON array (no markdown, no code blocks):
[{"questionNumber": 1, "questionText": "brief question text as on paper", "studentAnswer": "full student answer text"}]

Important rules:
- questionNumber MUST be the exact numeric 'ID' from the EXAM QUESTIONS REFERENCE that matches the question.
- questionText: short excerpt of the question wording as printed (same languages as on paper).
- Return ONLY the JSON array, nothing else.
- If a question has no answer, use empty string for studentAnswer.${examQuestionsContext}`;

    let lastError: unknown = null;
    const maxAttemptsPerModel = 3;

    for (const modelName of MODELS) {
      for (let attempt = 1; attempt <= maxAttemptsPerModel; attempt++) {
        try {
          console.log(
            `[extract-student] Trying model: ${modelName} (attempt ${attempt}/${maxAttemptsPerModel})`
          );

          const model = genAI.getGenerativeModel({
            model: modelName,
            generationConfig: {
              temperature: 0,
            },
          });

          const result = await model.generateContent([
            { text: prompt },
            {
              inlineData: {
                data: base64Data,
                mimeType: mimeType as any,
              },
            },
          ]);

          const rawResponse = result.response.text();
          console.log(
            `[extract-student] Raw response from ${modelName}:`,
            rawResponse.substring(0, 200)
          );

          let cleanResponse = rawResponse
            .replace(/```json\s*/gi, "")
            .replace(/```\s*/gi, "")
            .trim();

          const jsonMatch = targetQuestionNumber
            ? cleanResponse.match(/\{[\s\S]*\}/)
            : cleanResponse.match(/\[[\s\S]*\]/);

          if (!jsonMatch) {
            console.warn(
              `[extract-student] No valid JSON in response from ${modelName}. Raw:`,
              rawResponse
            );
            throw new Error("لم يتم العثور على JSON صحيح في استجابة النموذج.");
          }

          const extractedData = JSON.parse(jsonMatch[0]);
          console.log(`[extract-student] ✅ Success with model: ${modelName}`);
          return NextResponse.json(extractedData);
        } catch (err: unknown) {
          lastError = err;
          const anyErr = err as { status?: number; message?: string };
          const status = anyErr?.status;
          console.error(
            `[extract-student] Model ${modelName} failed:`,
            anyErr?.message || err
          );

          if (
            status === 429 ||
            String(anyErr?.message).includes("429") ||
            String(anyErr?.message).includes("quota")
          ) {
            return NextResponse.json(
              {
                error:
                  "الخدمة مزدحمة حالياً، يرجى الانتظار 30 ثانية والمحاولة مرة أخرى.",
              },
              { status: 429 }
            );
          }

          if (
            attempt < maxAttemptsPerModel &&
            isTransientNetworkError(err)
          ) {
            await sleep(500 * attempt);
            continue;
          }

          break;
        }
      }
      console.warn(`[extract-student] Falling back to next model...`);
    }

    console.error("[extract-student] All models failed. Last error:", lastError);
    return NextResponse.json(
      { error: userFacingGeminiError(lastError) },
      { status: 500 }
    );

  } catch (error: any) {
    console.error("CRITICAL EXTRACTION ERROR:", error);

    if (error?.status === 429 || error?.message?.includes("429")) {
      return NextResponse.json(
        { error: "الخدمة مزدحمة حالياً، يرجى الانتظار 30 ثانية والمحاولة مرة أخرى." },
        { status: 429 }
      );
    }

    return NextResponse.json(
      { error: userFacingGeminiError(error) },
      { status: 500 }
    );
  }
}
