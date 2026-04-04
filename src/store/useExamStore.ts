import { create } from "zustand";
import { distributeEqualAmongKeyPoints } from "@/lib/exam-keypoints-normalize";
import { defaultTotalGradeForType } from "@/lib/exam-type-defaults";

export type KeyPoint = { point: string; defaultGrade: number }
export type ExtractedQuestion = {
  question: string;
  modelAnswer: string;
  keyPoints: KeyPoint[];
  displayLabel?: string;
  groupNumber?: number;
  subIndex?: number;
  /** إجمالي درجة السؤال من الورقة (يُستخدم لضبط مجموع المحاور) */
  questionMaxPoints?: number;
  teacherNote?: string;
};

export interface ExamDetails {
  title: string;
  date: string;
  type: string;
  totalGrade: number;
  /** عنوان مقترح من الاستخراج (لا يُستبدل به عنوان المعلم) */
  aiSuggestedTitle?: string;
}

interface ExamState {
  step: number;
  /** When set, finalize calls PATCH to resubmit a rejected exam */
  editingExamId: string | null;
  examDetails: ExamDetails;
  extractedQuestions: ExtractedQuestion[];
  extractedStudentAnswers: any[];
  setStep: (step: number) => void;
  setEditingExamId: (id: string | null) => void;
  setExamDetails: (details: Partial<ExamDetails>) => void;
  setExtractedQuestions: (questions: ExtractedQuestion[]) => void;
  setExtractedStudentAnswers: (answers: any[]) => void;
  updateStudentAnswer: (index: number, answer: string) => void;
  updateStudentAnswerByQuestionNumber: (questionNumber: number, answer: string) => void;
  removeStudentAnswerByQuestionNumber: (questionNumber: number) => void;
  updateKeyPointGrade: (questionIndex: number, pointIndex: number, grade: number) => void;
  updateKeyPointText: (questionIndex: number, pointIndex: number, text: string) => void;
  addKeyPoint: (questionIndex: number) => void;
  removeKeyPoint: (questionIndex: number, pointIndex: number) => void;
  updateTeacherNote: (questionIndex: number, note: string) => void;
  updateQuestionMaxPoints: (questionIndex: number, max: number | undefined) => void;
  /** Sets question max and splits that score equally across key points */
  updateQuestionMaxPointsAndDistribute: (
    questionIndex: number,
    max: number | undefined
  ) => void;
  reset: () => void;
}

export const useExamStore = create<ExamState>((set) => ({
  step: 1,
  editingExamId: null,
  examDetails: {
    title: "",
    date: "",
    type: "MIDTERM",
    totalGrade: defaultTotalGradeForType("MIDTERM"),
  },
  extractedQuestions: [],
  extractedStudentAnswers: [],

  setStep: (step) => set({ step }),
  setEditingExamId: (id) => set({ editingExamId: id }),
  
  setExamDetails: (details) => 
    set((state) => ({ examDetails: { ...state.examDetails, ...details } })),
    
  setExtractedQuestions: (questions) => 
    set({ extractedQuestions: questions }),
    
  setExtractedStudentAnswers: (answers) => 
    set({ extractedStudentAnswers: answers }),

  updateStudentAnswer: (index, answer) => set((state) => {
    const newAnswers = [...state.extractedStudentAnswers];
    if (newAnswers[index]) {
      newAnswers[index].studentAnswer = answer;
    }
    return { extractedStudentAnswers: newAnswers };
  }),

  updateStudentAnswerByQuestionNumber: (questionNumber, answer) =>
    set((state) => ({
      extractedStudentAnswers: state.extractedStudentAnswers.map((a) =>
        a.questionNumber === questionNumber ? { ...a, studentAnswer: answer } : a
      ),
    })),

  removeStudentAnswerByQuestionNumber: (questionNumber) =>
    set((state) => ({
      extractedStudentAnswers: state.extractedStudentAnswers.filter(
        (a) => a.questionNumber !== questionNumber
      ),
    })),
  updateKeyPointGrade: (qIndex, pIndex, grade) => set((state) => {
    const newQuestions = [...state.extractedQuestions];
    newQuestions[qIndex].keyPoints[pIndex].defaultGrade = grade;
    return { extractedQuestions: newQuestions };
  }),

  updateKeyPointText: (qIndex, pIndex, text) => set((state) => {
    const newQuestions = [...state.extractedQuestions];
    newQuestions[qIndex].keyPoints[pIndex].point = text;
    return { extractedQuestions: newQuestions };
  }),

  addKeyPoint: (qIndex) =>
    set((state) => {
      const newQuestions = [...state.extractedQuestions];
      const q = newQuestions[qIndex];
      if (!q) return state;
      const nextKp = [...q.keyPoints, { point: "", defaultGrade: 1 }];
      const cap = q.questionMaxPoints;
      newQuestions[qIndex] = {
        ...q,
        keyPoints:
          cap != null && cap > 0 && nextKp.length > 0
            ? distributeEqualAmongKeyPoints(nextKp, cap)
            : nextKp,
      };
      return { extractedQuestions: newQuestions };
    }),

  removeKeyPoint: (qIndex, pIndex) =>
    set((state) => {
      const newQuestions = [...state.extractedQuestions];
      const q = newQuestions[qIndex];
      if (!q) return state;
      const nextKp = q.keyPoints.filter((_, i) => i !== pIndex);
      const cap = q.questionMaxPoints;
      newQuestions[qIndex] = {
        ...q,
        keyPoints:
          cap != null && cap > 0 && nextKp.length > 0
            ? distributeEqualAmongKeyPoints(nextKp, cap)
            : nextKp,
      };
      return { extractedQuestions: newQuestions };
    }),

  updateTeacherNote: (qIndex, note) =>
    set((state) => {
      const newQuestions = [...state.extractedQuestions];
      if (newQuestions[qIndex]) {
        newQuestions[qIndex] = {
          ...newQuestions[qIndex],
          teacherNote: note,
        };
      }
      return { extractedQuestions: newQuestions };
    }),

  updateQuestionMaxPoints: (qIndex, max) =>
    set((state) => {
      const newQuestions = [...state.extractedQuestions];
      if (newQuestions[qIndex]) {
        newQuestions[qIndex] = {
          ...newQuestions[qIndex],
          questionMaxPoints: max,
        };
      }
      return { extractedQuestions: newQuestions };
    }),

  updateQuestionMaxPointsAndDistribute: (qIndex, max) =>
    set((state) => {
      const newQuestions = [...state.extractedQuestions];
      const q = newQuestions[qIndex];
      if (!q) return state;
      const next: ExtractedQuestion = { ...q, questionMaxPoints: max };
      if (max != null && max > 0 && q.keyPoints.length > 0) {
        next.keyPoints = distributeEqualAmongKeyPoints(q.keyPoints, max);
      }
      newQuestions[qIndex] = next;
      return { extractedQuestions: newQuestions };
    }),

  reset: () =>
    set({
      step: 1,
      editingExamId: null,
      examDetails: {
        title: "",
        date: "",
        type: "MIDTERM",
        totalGrade: defaultTotalGradeForType("MIDTERM"),
      },
      extractedQuestions: [],
      extractedStudentAnswers: [],
    }),
}));
