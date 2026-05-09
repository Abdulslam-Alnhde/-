import type { Context } from "hono";
import { requireRoles } from "@/common/guards";
import { jsonError } from "@/common/http";
import type { ApiActor } from "@/common/types";
import { actingSubject } from "@/common/types";
import * as examService from "./exams.service";

type Ctx = Context<{ Variables: { actor: ApiActor } }>;

export async function listTeacherExams(c: Ctx) {
  const actor = c.get("actor");
  const gate = requireRoles(c, actor, ["TEACHER"]);
  if (gate) return gate;
  try {
    const list = await examService.listTeacherExamsSorted(actor.userId);
    return c.json(list);
  } catch (error) {
    console.error("Fetch Teacher Exams Error:", error);
    return jsonError(c, "Failed to fetch teacher exams", 500);
  }
}

export async function listPendingExams(c: Ctx) {
  const actor = c.get("actor");
  const gate = requireRoles(c, actor, ["COMMITTEE"]);
  if (gate) return gate;
  try {
    const pending = await examService.listPendingExams();
    return c.json(pending);
  } catch (error) {
    console.error("Fetch Exams Error:", error);
    return jsonError(c, "Failed to fetch exams", 500);
  }
}

export async function getTeacherExam(c: Ctx) {
  const actor = c.get("actor");
  const gate = requireRoles(c, actor, ["TEACHER"]);
  if (gate) return gate;
  const id = c.req.param("id");
  if (!id) return jsonError(c, "معرّف غير صالح", 400);
  try {
    const exam = await examService.getTeacherExamSorted(id, actor.userId);
    if (!exam) return jsonError(c, "الاختبار غير موجود", 404);
    return c.json(exam);
  } catch (e) {
    console.error("GET exam:", e);
    return jsonError(c, "فشل جلب الاختبار", 500);
  }
}

export async function patchTeacherExamResubmit(c: Ctx) {
  const actor = c.get("actor");
  const gate = requireRoles(c, actor, ["TEACHER"]);
  if (gate) return gate;
  const id = c.req.param("id");
  if (!id) return jsonError(c, "معرّف غير صالح", 400);
  try {
    const body = await c.req.json();
    const { title, date, type, extractedQuestions, declaredMaxGrade } = body;
    const result = await examService.resubmitRejectedExam({
      examId: id,
      teacherId: actor.userId,
      title,
      date,
      type,
      extractedQuestions,
      declaredMaxGrade,
    });
    if (!result.ok) return jsonError(c, result.error, result.status);
    return c.json({ success: true, exam: result.exam });
  } catch (error: unknown) {
    console.error("PATCH exam resubmit:", error);
    return c.json(
      { error: (error as Error)?.message || "فشل تحديث الاختبار" },
      500
    );
  }
}

export async function finalizeExam(c: Ctx) {
  const actor = c.get("actor");
  const gate = requireRoles(c, actor, ["TEACHER"]);
  if (gate) return gate;
  try {
    const body = await c.req.json();
    const { title, date, type, extractedQuestions, declaredMaxGrade } = body;
    if (!title || !extractedQuestions || !Array.isArray(extractedQuestions)) {
      return jsonError(c, "الحقول المطلوبة مفقودة", 400);
    }
    const result = await examService.finalizeNewExam({
      teacherId: actor.userId,
      title,
      date,
      type,
      extractedQuestions,
      declaredMaxGrade,
    });
    if (!result.ok) return jsonError(c, result.error, result.status);
    return c.json({ success: true, exam: result.exam });
  } catch (error: unknown) {
    console.error("Database Save Error:", error);
    return jsonError(
      c,
      (error as { message?: string })?.message || "فشل حفظ الاختبار",
      500
    );
  }
}

export async function approveExam(c: Ctx) {
  const actor = c.get("actor");
  const gate = requireRoles(c, actor, ["COMMITTEE"]);
  if (gate) return gate;
  const reviewer = actingSubject(actor);
  if (!examService.canCommitteeApprove(reviewer)) {
    return jsonError(c, "ليس لديك صلاحية اعتماد أو رفض الاختبارات", 403);
  }
  try {
    const body = await c.req.json();
    const examId = body.examId as string | undefined;
    const status = body.status as "APPROVED" | "REJECTED" | undefined;
    const feedbackRaw = body.feedback;
    const feedback = typeof feedbackRaw === "string" ? feedbackRaw.trim() : "";
    const result = await examService.committeeSetExamStatus({
      examId,
      status,
      feedback,
    });
    if (!result.ok) return jsonError(c, result.error, result.status);
    return c.json({ success: true, exam: result.exam });
  } catch (error) {
    console.error("Approve Exam Error:", error);
    return jsonError(c, "فشل في تحديث حالة الاختبار", 500);
  }
}
