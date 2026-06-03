/** Student answer extraction HTTP handler; auth enforced by BFF + internal secret. */
import { randomUUID } from "crypto";
import { userFacingAIError } from "@/lib/ai-helpers";
import {
  buildSingleQuestionPrompt,
  createStudentExtractionProviderRuntimes,
  extractSingleStudentAnswer,
  extractStudentAnswersInBatches,
  StudentExtractionError,
  type StudentExtractionLogger,
} from "@/lib/extract-student-core";
import type { StudentExamContext } from "@/lib/ai-prompts";

const STUDENT_REQUEST_TIMEOUT_MS = Math.max(
  30000,
  Math.min(
    600000,
    Number(process.env.STUDENT_EXTRACT_TIMEOUT_MS) ||
      Number(process.env.AI_REQUEST_TIMEOUT_MS) ||
      300000
  )
);

function createRequestLogger(requestId: string): StudentExtractionLogger {
  return (event) => {
    const level = event.level || "info";
    const prefix = `[extract-student][${requestId}][${event.stage}] ${event.message}`;
    const payload = {
      requestId,
      stage: event.stage,
      durationMs: event.durationMs,
      meta: event.meta,
    };
    if (level === "error") return console.error(prefix, payload);
    if (level === "warn") return console.warn(prefix, payload);
    console.log(prefix, payload);
  };
}

async function withTimeout<T>(
  task: Promise<T>,
  timeoutMs: number,
  label: string
): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () =>
        reject(
          new StudentExtractionError(
            `${label} timed out after ${timeoutMs}ms.`,
            504,
            "REQUEST_TIMEOUT",
            { timeoutMs, label }
          )
        ),
      timeoutMs
    );
  });

  try {
    return await Promise.race([task, timeoutPromise]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export async function handleExtractStudent(req: Request): Promise<Response> {
  const requestId = randomUUID();
  const logger = createRequestLogger(requestId);
  const started = Date.now();

  try {
    logger({
      stage: "request.start",
      message: "Student extraction request received.",
      meta: { method: req.method, url: req.url ?? "" },
    });

    const formData = await req.formData();
    logger({
      stage: "form.parsed",
      message: "Multipart form parsed for student extraction.",
    });

    const file = formData.get("file") as File | null;
    const targetQuestionNumberRaw = formData.get("targetQuestionNumber");
    const targetQuestionText = String(formData.get("targetQuestionText") || "");
    const targetQuestionLabel = String(formData.get("targetQuestionLabel") || "");
    const examQuestionsRaw = formData.get("examQuestions");

    if (!file) {
      logger({
        stage: "request.invalid",
        level: "warn",
        message: "Request rejected because no file was provided.",
      });
      return Response.json(
        { error: "لم يتم العثور على ملف ورقة الطالب المرفوع." },
        { status: 400 }
      );
    }

    let questions: Array<{ id: number; label?: string; text?: string; examContext?: StudentExamContext }> = [];
    if (examQuestionsRaw) {
      try {
        const parsed = JSON.parse(String(examQuestionsRaw));
        const rawList = Array.isArray(parsed) ? parsed : [];
        questions = rawList.map((q: any) => {
          const base: { id: number; label?: string; text?: string; examContext?: StudentExamContext } = {
            id: Number(q.id) || 0,
            label: q.label,
            text: q.text,
          };
          if (q.questionType || q.modelAnswer || q.questionMaxPoints || q.keyPoints) {
            base.examContext = {
              questionType: q.questionType === "OBJECTIVE" ? "OBJECTIVE" : q.questionType === "RUBRIC" ? "RUBRIC" : undefined,
              modelAnswer: typeof q.modelAnswer === "string" ? q.modelAnswer : undefined,
              questionMaxPoints: typeof q.questionMaxPoints === "number" ? q.questionMaxPoints : undefined,
              keyPoints: Array.isArray(q.keyPoints)
                ? q.keyPoints.map((kp: any) => typeof kp === "string" ? kp : String(kp?.point || "")).filter(Boolean)
                : undefined,
              teacherNote: typeof q.teacherNote === "string" ? q.teacherNote : undefined,
            };
          }
          return base;
        });
        logger({
          stage: "form.questions.parsed",
          message: "Exam questions parsed from request payload.",
          meta: {
            questionCount: questions.length,
            hasExamContext: questions.some((q) => q.examContext != null),
          },
        });
      } catch (error) {
        logger({
          stage: "form.questions.parse_failed",
          level: "warn",
          message: "Exam questions payload could not be parsed.",
          meta: { error: error instanceof Error ? error.message : String(error) },
        });
        questions = [];
      }
    }

    const providers = createStudentExtractionProviderRuntimes();
    logger({
      stage: "provider.selection",
      message: "AI providers selected for student extraction.",
      meta: {
        providerCount: providers.length,
        providers: providers.map((rt) => ({ name: rt.provider.name, models: rt.models })),
      },
    });

    const targetQuestionNumber =
      targetQuestionNumberRaw !== null && targetQuestionNumberRaw !== undefined
        ? Number(targetQuestionNumberRaw)
        : NaN;
    const isSingleQuestion =
      Number.isFinite(targetQuestionNumber) && targetQuestionNumber > 0;

    if (!isSingleQuestion && questions.length === 0) {
      logger({
        stage: "request.invalid",
        level: "warn",
        message:
          "Request rejected because no target question or exam question list was provided.",
      });
      return Response.json(
        { error: "بيانات السؤال المطلوب إعادة استخراجه غير مكتملة." },
        { status: 400 }
      );
    }

    const singleExamContext: StudentExamContext | undefined = (() => {
      if (!isSingleQuestion) return undefined;
      const match = questions.find((q) => q.id === targetQuestionNumber);
      return match?.examContext;
    })();

    const extractionTask: Promise<unknown> = isSingleQuestion
      ? (async () =>
          extractSingleStudentAnswer({
            prompt: buildSingleQuestionPrompt({
              questionNumber: targetQuestionNumber,
              questionText: targetQuestionText,
              questionLabel: targetQuestionLabel,
              examContext: singleExamContext,
            }),
            file,
            providers,
            questionNumber: targetQuestionNumber,
            examContext: singleExamContext,
            logger,
          }))()
      : extractStudentAnswersInBatches({
          file,
          questions,
          providers,
          logger,
        });

    const result = await withTimeout(
      extractionTask,
      STUDENT_REQUEST_TIMEOUT_MS,
      `student extraction request ${requestId}`
    );

    logger({
      stage: "request.success",
      message: "Student extraction completed successfully.",
      durationMs: Date.now() - started,
      meta: {
        requestId,
        mode: isSingleQuestion ? "single" : "batch",
        questionCount: Array.isArray(result) ? result.length : 1,
      },
    });

    return Response.json(result);
  } catch (error) {
    if (error instanceof StudentExtractionError) {
      logger({
        stage: "request.failed",
        level: "error",
        message: "Student extraction failed with a controlled error.",
        durationMs: Date.now() - started,
        meta: {
          requestId,
          code: error.code,
          statusCode: error.statusCode,
          error: error.message,
          details: error.details,
        },
      });
      return Response.json(
        { error: error.message, code: error.code, details: error.details },
        { status: error.statusCode }
      );
    }

    logger({
      stage: "request.failed",
      level: "error",
      message: "Student extraction failed with an unexpected error.",
      durationMs: Date.now() - started,
      meta: {
        requestId,
        error: error instanceof Error ? error.message : String(error),
      },
    });

    return Response.json(
      { error: userFacingAIError(error) },
      { status: 500 }
    );
  }
}
