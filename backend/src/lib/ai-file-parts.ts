import "server-only";

import type { AIContentPart } from "@/lib/ai/types";

export type FilePreparationTrace = (event: {
  stage: string;
  message: string;
  meta?: Record<string, unknown>;
}) => void;

type PdfParseCtor = new (options: {
  data: Uint8Array | Buffer;
}) => {
  getText: (options?: unknown) => Promise<{ text?: string }>;
  destroy?: () => Promise<void>;
};

let PDFParseClass: PdfParseCtor | null = null;

try {
  const pdfParseModule = require("pdf-parse");
  PDFParseClass = pdfParseModule.PDFParse ?? null;
} catch {
  console.warn("[ai-file-parts] pdf-parse not found; PDF text fallback disabled.");
}

const PDF_TEXT_MAX_CHARS = Math.max(
  4000,
  Math.min(120000, Number(process.env.PDF_TEXT_MAX_CHARS) || 36000)
);
const TEXT_PART_MAX_CHARS = Math.max(
  1500,
  Math.min(12000, Number(process.env.AI_TEXT_PART_MAX_CHARS) || 6000)
);
const TEXT_PART_OVERLAP_CHARS = Math.max(
  0,
  Math.min(1000, Number(process.env.AI_TEXT_PART_OVERLAP_CHARS) || 250)
);
const PDF_RENDER_MAX_PAGES = Math.max(
  1,
  Math.min(4, Number(process.env.PDF_RENDER_MAX_PAGES) || 2)
);
const PDF_RENDER_MAX_EDGE = Math.max(
  1024,
  Math.min(2400, Number(process.env.PDF_RENDER_MAX_EDGE) || 1600)
);

const importRuntimeModule = new Function(
  "specifier",
  "return import(specifier)"
) as <T = any>(specifier: string) => Promise<T>;

export function detectMimeType(file: File): string {
  const fromType = file.type?.trim();
  if (fromType && fromType !== "application/octet-stream") return fromType;

  const name = file.name?.toLowerCase() || "";
  if (name.endsWith(".pdf")) return "application/pdf";
  if (name.endsWith(".png")) return "image/png";
  if (name.endsWith(".jpg") || name.endsWith(".jpeg")) return "image/jpeg";
  if (name.endsWith(".webp")) return "image/webp";
  if (name.endsWith(".gif")) return "image/gif";
  if (name.endsWith(".txt") || name.endsWith(".md")) return "text/plain";
  return "application/octet-stream";
}

export function isImageMime(mimeType: string): boolean {
  return /^image\/(png|jpeg|jpg|webp|gif)$/i.test(mimeType);
}

export function isPdfMime(mimeType: string): boolean {
  return mimeType === "application/pdf";
}

function trimLargeText(text: string, maxChars = PDF_TEXT_MAX_CHARS): string {
  if (text.length <= maxChars) return text;
  return `${text.slice(0, maxChars)}\n\n[TRUNCATED ${text.length - maxChars} CHARS]`;
}

export function normalizeExtractedTextForAI(text: string): string {
  return String(text ?? "")
    .normalize("NFKC")
    .replace(/\r\n?/g, "\n")
    .replace(/[\u200e\u200f\u202a-\u202e]/g, "")
    .replace(/\t+/g, " ")
    .replace(/[ \u00a0]+\n/g, "\n")
    .replace(/\n[ \u00a0]+/g, "\n")
    .replace(/[ \u00a0]{3,}/g, "  ")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/\s+([:؛،,؟?])/g, "$1")
    .trim();
}

export function shouldUseExtractedPdfTextAsPrimarySource(params: {
  providerName: string;
  pdfText: string;
  preferTextOnlyForPdf?: boolean;
}): boolean {
  return params.preferTextOnlyForPdf === true;
}

function splitLargeText(
  text: string,
  maxChars = TEXT_PART_MAX_CHARS,
  overlapChars = TEXT_PART_OVERLAP_CHARS
): string[] {
  const normalized = String(text ?? "").trim();
  if (!normalized) return [];
  if (normalized.length <= maxChars) return [normalized];

  const chunks: string[] = [];
  let cursor = 0;

  while (cursor < normalized.length) {
    const remaining = normalized.length - cursor;
    if (remaining <= maxChars) {
      chunks.push(normalized.slice(cursor).trim());
      break;
    }

    const rawEnd = cursor + maxChars;
    const window = normalized.slice(cursor, rawEnd);
    const breakCandidates = [
      window.lastIndexOf("\n\n"),
      window.lastIndexOf("\n"),
      window.lastIndexOf(". "),
      window.lastIndexOf("، "),
      window.lastIndexOf(" "),
    ].filter((index) => index >= Math.floor(maxChars * 0.55));

    const bestBreak = breakCandidates.length
      ? Math.max(...breakCandidates)
      : maxChars;
    const end = cursor + bestBreak;
    const chunk = normalized.slice(cursor, end).trim();

    if (chunk) chunks.push(chunk);
    cursor = Math.max(cursor + 1, end - overlapChars);
  }

  return chunks;
}

function buildChunkedTextParts(params: {
  roleLabel: string;
  fileName: string;
  introLine?: string;
  text: string;
  maxChars?: number;
  overlapChars?: number;
}): AIContentPart[] {
  const { roleLabel, fileName, introLine, text, maxChars, overlapChars } =
    params;
  const chunks = splitLargeText(text, maxChars, overlapChars);
  if (chunks.length === 0) return [];

  return chunks.map((chunk, index) => {
    const header =
      chunks.length === 1
        ? `[${roleLabel}] ${fileName}`
        : `[${roleLabel}] ${fileName} (part ${index + 1}/${chunks.length})`;

    const intro =
      index === 0 && introLine
        ? `${introLine}\nThe following parts are ordered and belong to the same file.\n`
        : "";

    return {
      text: `${header}\n${intro}${chunk}`.trim(),
    };
  });
}

export async function extractPdfText(
  buffer: Buffer,
  trace?: FilePreparationTrace
): Promise<string> {
  if (!PDFParseClass) return "";
  trace?.({
    stage: "pdf.text.extract.start",
    message: "Extracting PDF text locally.",
    meta: { sizeBytes: buffer.length },
  });
  const parser = new PDFParseClass({ data: new Uint8Array(buffer) });
  try {
    const data = await parser.getText();
    const text = normalizeExtractedTextForAI(String(data?.text || ""));
    trace?.({
      stage: "pdf.text.extract.done",
      message: "Finished extracting PDF text locally.",
      meta: { charCount: text.length },
    });
    return text;
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    if (!msg.toLowerCase().includes("fake worker")) {
      console.warn("[ai-file-parts] pdf-parse failed:", error);
    }
    trace?.({
      stage: "pdf.text.extract.error",
      message: "Local PDF text extraction failed.",
      meta: { error: msg },
    });
    return "";
  } finally {
    try {
      await parser.destroy?.();
    } catch {
      // ignore cleanup failure
    }
  }
}

async function renderPdfToImages(
  buffer: Buffer,
  maxPages = PDF_RENDER_MAX_PAGES,
  trace?: FilePreparationTrace
) {
  const pdfjs = await importRuntimeModule<any>("pdfjs-dist/legacy/build/pdf.mjs");
  const canvasLib = await importRuntimeModule<any>("@napi-rs/canvas");
  const { createCanvas } = canvasLib;

  const loadingTask = pdfjs.getDocument({
    data: new Uint8Array(buffer),
    useWorkerFetch: false,
    isEvalSupported: false,
    useSystemFonts: true,
  });

  const document = await loadingTask.promise;
  try {
    const parts: AIContentPart[] = [];
    const totalPages = Math.min(document.numPages, maxPages);
    trace?.({
      stage: "pdf.render.document",
      message: "PDF document loaded for rendering.",
      meta: { totalPages, maxPages },
    });

    for (let pageNumber = 1; pageNumber <= totalPages; pageNumber += 1) {
      trace?.({
        stage: "pdf.render.page.start",
        message: "Rendering PDF page.",
        meta: { pageNumber, totalPages },
      });
      const page = await document.getPage(pageNumber);
      try {
        const baseViewport = page.getViewport({ scale: 1 });
        const largestEdge = Math.max(baseViewport.width, baseViewport.height) || 1;
        const scale = Math.max(1.2, PDF_RENDER_MAX_EDGE / largestEdge);
        const viewport = page.getViewport({ scale });

        const canvas = createCanvas(
          Math.ceil(viewport.width),
          Math.ceil(viewport.height)
        );
        const context = canvas.getContext("2d");
        await page.render({
          canvasContext: context as never,
          viewport,
        }).promise;

        const png = canvas.toBuffer("image/png");
        parts.push({
          image: {
            base64: png.toString("base64"),
            mimeType: "image/png",
          },
        });
        trace?.({
          stage: "pdf.render.page.done",
          message: "Finished rendering PDF page.",
          meta: {
            pageNumber,
            totalPages,
            imageBytes: png.length,
          },
        });
      } finally {
        page.cleanup();
      }
    }

    trace?.({
      stage: "pdf.render.complete",
      message: "Completed rendering PDF to image parts.",
      meta: { renderedPages: parts.length },
    });
    return parts;
  } finally {
    await loadingTask.destroy();
  }
}

function decodeTextFile(buffer: Buffer): string {
  return normalizeExtractedTextForAI(
    buffer.toString("utf8").replace(/\u0000/g, "")
  );
}

export type PrepareFileForAIOptions = {
  providerName: string;
  roleLabel?: string;
  includePdfText?: boolean;
  maxPdfPages?: number;
  preferTextOnlyForPdf?: boolean;
  trace?: FilePreparationTrace;
};

export async function prepareFileForAI(
  file: File,
  options: PrepareFileForAIOptions
): Promise<AIContentPart[]> {
  const mimeType = detectMimeType(file);
  const trace = options.trace;
  const providerName = options.providerName;

  trace?.({
    stage: "prepare.start",
    message: "Preparing file for AI provider.",
    meta: {
      fileName: file.name,
      mimeType,
      providerName,
    },
  });

  trace?.({
    stage: "prepare.read.start",
    message: "Reading file bytes for AI preparation.",
    meta: {
      fileName: file.name,
      mimeType,
      providerName: options.providerName,
    },
  });

  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);
  const roleLabel = options.roleLabel || "file";

  trace?.({
    stage: "prepare.read.done",
    message: "File bytes read for AI preparation.",
    meta: {
      fileName: file.name,
      mimeType,
      providerName,
      sizeBytes: buffer.length,
    },
  });

  if (isImageMime(mimeType)) {
    return [
      { text: `[${roleLabel}] ${file.name}` },
      {
        image: {
          base64: buffer.toString("base64"),
          mimeType,
        },
      },
    ];
  }

  if (isPdfMime(mimeType)) {
    trace?.({
      stage: "pdf.detected",
      message: "PDF input detected.",
      meta: {
        fileName: file.name,
        providerName,
        includePdfText: options.includePdfText !== false,
      },
    });

    const pdfText =
      options.includePdfText === false
        ? ""
        : await extractPdfText(buffer, trace);
    const canUseTextOnly = shouldUseExtractedPdfTextAsPrimarySource({
      providerName,
      pdfText,
      preferTextOnlyForPdf: options.preferTextOnlyForPdf,
    });

    if (providerName === "google") {
      const parts: AIContentPart[] = [];
      if (pdfText) {
        trace?.({
          stage: "pdf.text.available",
          message: "Extracted PDF text is available for Google provider.",
          meta: { fileName: file.name, charCount: pdfText.length },
        });
        parts.push({
          text: `[${roleLabel}] ${file.name}\nExtracted PDF text:\n${trimLargeText(pdfText)}`,
        });
      } else {
        trace?.({
          stage: "pdf.text.skipped",
          message: "Skipping extracted PDF text for Google provider.",
          meta: { fileName: file.name },
        });
        parts.push({
          text: `[${roleLabel}] ${file.name}\nThe following input is a PDF document.`,
        });
      }
      parts.push({
        pdf: {
          base64: buffer.toString("base64"),
          mimeType: "application/pdf",
        },
      });
      return parts;
    }

    if (canUseTextOnly) {
      trace?.({
        stage: "pdf.text.primary",
        message: "Using extracted PDF text as the primary source.",
        meta: {
          fileName: file.name,
          providerName,
          charCount: pdfText.length,
        },
      });
      return buildChunkedTextParts({
        roleLabel,
        fileName: file.name,
        introLine:
          "Use the extracted PDF text below as the primary source.",
        text: trimLargeText(pdfText),
        maxChars: undefined,
        overlapChars: undefined,
      });
    }

    trace?.({
      stage: "pdf.render.start",
      message: "Rendering PDF pages to images for the model.",
      meta: {
        fileName: file.name,
        providerName,
        maxPages: options.maxPdfPages ?? PDF_RENDER_MAX_PAGES,
      },
    });
    const renderedPages = await renderPdfToImages(
      buffer,
      options.maxPdfPages ?? PDF_RENDER_MAX_PAGES,
      trace
    );

    if (renderedPages.length > 0) {
      trace?.({
        stage: "pdf.render.done",
        message: "Rendered PDF pages prepared for the model.",
        meta: {
          fileName: file.name,
          providerName,
          renderedPages: renderedPages.length,
        },
      });
      const intro = {
        text: `[${roleLabel}] ${file.name}\nRendered PDF pages are attached in order.`,
      };
      return [intro, ...renderedPages];
    }

    if (pdfText) {
      trace?.({
        stage: "pdf.text.fallback",
        message: "Using extracted PDF text as a fallback source.",
        meta: { fileName: file.name, charCount: pdfText.length },
      });
      return [
        {
          text: `[${roleLabel}] ${file.name}\nExtracted PDF text:\n${trimLargeText(pdfText)}`,
        },
      ];
    }

    throw new Error(
      `تعذر قراءة ملف PDF "${file.name}". جرّب نسخة أوضح أو PDF نصي قابل للقراءة.`
    );
  }

  if (mimeType.startsWith("text/")) {
    const text = decodeTextFile(buffer);
    if (!text) {
      throw new Error(`الملف النصي "${file.name}" فارغ أو غير قابل للقراءة.`);
    }
    trace?.({
      stage: "text.detected",
      message: "Text file prepared for the model.",
      meta: {
        fileName: file.name,
        providerName,
        charCount: text.length,
      },
    });
    return buildChunkedTextParts({
      roleLabel,
      fileName: file.name,
      text: trimLargeText(text),
      maxChars: undefined,
      overlapChars: undefined,
    });
  }

  throw new Error(
    `نوع الملف "${file.name}" غير مدعوم حالياً. الصيغ المدعومة: PDF، صور، TXT.`
  );
}
