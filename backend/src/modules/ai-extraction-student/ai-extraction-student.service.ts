import { handleExtractStudent as handleExtractStudentImpl } from "./student-extraction/student-extraction.handler";

export async function handleExtractStudent(req: Request): Promise<Response> {
  return handleExtractStudentImpl(req);
}
