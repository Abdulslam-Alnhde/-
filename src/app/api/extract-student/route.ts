import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-server";
import { userFacingAIError } from "@/lib/ai-helpers";
import {
  buildSingleQuestionPrompt,
  createStudentExtractionProviderRuntimes,
  extractSingleStudentAnswer,
  extractStudentAnswersInBatches,
  StudentExtractionError,
  type StudentExtractionLogger,
} from "@/lib/extract-student-core";

export const dynamic = "force-dynamic";

const STUDENT_REQUEST_TIMEOUT_MS = Math.max(
  30000,
  Math.min(
    600000,
    Number(process.env.STUDENT_EXTRACT_TIMEOUT_MS) ||
      Number(process.env.AI_REQUEST_TIMEOUT_MS) ||
      180000
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

    if (level === "error") {
      console.error(prefix, payload);
      return;
    }
    if (level === "warn") {
      console.warn(prefix, payload);
      return;
    }
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
    timer = setTimeout(() => {
      reject(
        new StudentExtractionError(
          `${label} timed out after ${timeoutMs}ms.`,
          504,
          "REQUEST_TIMEOUT",
          { timeoutMs, label }
        )
      );
    }, timeoutMs);
  });

  try {
    return await Promise.race([task, timeoutPromise]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export async function POST(req: NextRequest) {
  const requestId = randomUUID();
  const logger = createRequestLogger(requestId);
  const started = Date.now();

  try {
    logger({
      stage: "request.start",
      message: "Student extraction request received.",
      meta: {
        method: req.method,
        url: req.nextUrl.pathname,
      },
    });

    const auth = await requireAuth();
    if (auth.error) {
      logger({
        stage: "auth.failed",
        level: "warn",
        message: "Authentication failed before student extraction.",
      });
      return auth.error;
    }

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
      return NextResponse.json(
        { error: "لم يتم العثور على ملف ورقة الطالب المرفوع." },
        { status: 400 }
      );
    }

    let questions: Array<{ id: number; label?: string; text?: string }> = [];
    if (examQuestionsRaw) {
      try {
        const parsed = JSON.parse(String(examQuestionsRaw));
        questions = Array.isArray(parsed) ? parsed : [];
        logger({
          stage: "form.questions.parsed",
          message: "Exam questions parsed from request payload.",
          meta: { questionCount: questions.length },
        });
      } catch (error) {
        logger({
          stage: "form.questions.parse_failed",
          level: "warn",
          message: "Exam questions payload could not be parsed.",
          meta: {
            error: error instanceof Error ? error.message : String(error),
          },
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
        providers: providers.map((runtime) => ({
          name: runtime.provider.name,
          models: runtime.models,
        })),
      },
    });

    const targetQuestionNumber =
      targetQuestionNumberRaw !== null && targetQuestionNumberRaw !== undefined
        ? Number(targetQuestionNumberRaw)
        : NaN;
    const isSingleQuestion = Number.isFinite(targetQuestionNumber) && targetQuestionNumber > 0;

    if (!isSingleQuestion && questions.length === 0) {
      logger({
        stage: "request.invalid",
        level: "warn",
        message: "Request rejected because no target question or exam question list was provided.",
      });
      return NextResponse.json(
        { error: "بيانات السؤال المطلوب إعادة استخراجه غير مكتملة." },
        { status: 400 }
      );
    }

    const extractionTask: Promise<unknown> = isSingleQuestion
      ? (async () =>
          extractSingleStudentAnswer({
            prompt: buildSingleQuestionPrompt({
              questionNumber: targetQuestionNumber,
              questionText: targetQuestionText,
              questionLabel: targetQuestionLabel,
            }),
            file,
            providers,
            questionNumber: targetQuestionNumber,
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

    return NextResponse.json(result);
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
      return NextResponse.json(
        {
          error: error.message,
          code: error.code,
          details: error.details,
        },
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

    return NextResponse.json(
      { error: userFacingAIError(error) },
      { status: 500 }
    );
  }
}
