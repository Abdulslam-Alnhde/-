import assert from "node:assert";
import fs from "node:fs";
import { parsePossiblyWrappedJson } from "../src/app/api/grade/route";
import { extractStudentAnswersInBatches } from "../src/lib/extract-student-core";
import { shouldAcceptFastPdfExtraction } from "../src/lib/extract-fast-path";
import {
  normalizeExtractedTextForAI,
  shouldUseExtractedPdfTextAsPrimarySource,
} from "../src/lib/ai-file-parts";
import { hasAnswerLanguageMismatch } from "../src/lib/grading-language";

async function testGradeJsonParsing() {
  const wrapped =
    'Some explanation above.\n```json\n{\n  "totalScore": 9,\n  "breakdown": [{"questionNumber": 1, "studentAnswer": "A"}]\n}\n```\nAdditional commentary below.';

  const parsed = parsePossiblyWrappedJson(wrapped);
  assert.deepStrictEqual(parsed, {
    totalScore: 9,
    breakdown: [{ questionNumber: 1, studentAnswer: "A" }],
  });

  const proseWrapped = `
Analysis: the student showed good reasoning.
<analysis>ignore this</analysis>
Final output:
{"totalScore": 7, "breakdown": []}
`;

  const parsed2 = parsePossiblyWrappedJson(proseWrapped);
  assert.deepStrictEqual(parsed2, {
    totalScore: 7,
    breakdown: [],
  });

  const malformedWrapped = `
Here is some noisy header text.
*** debug info ***
{"totalScore": 5, "breakdown": [{"questionNumber": 2, "studentAnswer": "B"}]}
Some footer text.
`;

  const parsed3 = parsePossiblyWrappedJson(malformedWrapped);
  assert.deepStrictEqual(parsed3, {
    totalScore: 5,
    breakdown: [{ questionNumber: 2, studentAnswer: "B" }],
  });

  let invalidError = null;
  try {
    parsePossiblyWrappedJson("no json here, just text");
  } catch (error) {
    invalidError = error;
  }

  assert(invalidError instanceof Error, "Expected invalid output to throw an Error");
  assert.strictEqual(
    (invalidError as Error).message,
    "فشل في استخراج نتائج التصحيح بتنسيق JSON صحيح."
  );

  console.log("PASS: grade JSON parsing tests");
}

async function testExtractStudentProviderFallback() {
  const file = new File(["answer text"], "answers.txt", { type: "text/plain" });
  const questions = [{ id: 1, label: "Q1", text: "What is 1+1?" }];

  const providers = [
    {
      label: "fail",
      provider: {
        name: "__TEST_FAIL_BUILD",
        generateContent: async () => {
          throw new Error("should not be called");
        },
      },
      models: ["fail-model"],
    },
    {
      label: "second",
      provider: {
        name: "second",
        generateContent: async () => ({
          text: JSON.stringify({
            answers: [
              {
                questionNumber: 1,
                questionText: "What is 1+1?",
                studentAnswer: "2",
              },
            ],
          }),
        }),
      },
      models: ["second-model"],
    },
  ];

  const result = await extractStudentAnswersInBatches({
    file,
    questions,
    providers,
  });

  assert.deepStrictEqual(result, [
    { questionNumber: 1, questionText: "What is 1+1?", studentAnswer: "2" },
  ]);

  console.log("PASS: extract-student provider fallback tests");
}

function testFastPdfExtractionConfidenceGate() {
  const normalizedText = `
Ø§Ù„Ø³Ø¤Ø§Ù„Ø§Ù„Ø£ÙˆÙ„:Ø§Ø®ØªØ±Ø§Ù„Ø¥Ø¬Ø§Ø¨Ø©Ø§Ù„ØµØ­ÙŠØ­Ø©
1. What type of cable is known for its twisted pairs of wires?
â— Ø§Ù„Ø¥Ø¬Ø§Ø¨Ø© : Twisted-Pair Cable
2. Which type of twisted pair cable is not shielded?
â— Ø§Ù„Ø¥Ø¬Ø§Ø¨Ø© : Unshielded Twisted Pair (UTP)
3. What is the main characteristic of Shielded Twisted Pair (STP) cables?
â— Ø§Ù„Ø¥Ø¬Ø§Ø¨Ø© : They have shielding to reduce interference
4. What is the function of a crimper tool in networking?
â— Ø§Ù„Ø¥Ø¬Ø§Ø¨Ø© : To attach connectors to cables
5. What type of cable would you use to connect a PC to another PC?
â— Ø§Ù„Ø¥Ø¬Ø§Ø¨Ø© : Crossover cable
6. What is the primary function of a Network Interface Card (NIC)?
â— Ø§Ù„Ø¥Ø¬Ø§Ø¨Ø© : To connect a computer to a network
7. Which of the following is a type of Local Area Network (LAN)?
â— Ø§Ù„Ø¥Ø¬Ø§Ø¨Ø© : Ethernet
8. Which of the following is a characteristic of a Domain network model?
â— Ø§Ù„Ø¥Ø¬Ø§Ø¨Ø© : Centralized administration
Ø§Ù„Ø³Ø¤Ø§Ù„Ø§Ù„Ø«Ø§Ù†ÙŠ:Ø§Ø´Ø±Ø­6Ù…Ù†Ø§Ù„Ù…ØµØ·Ù„Ø­Ø§ØªØ§Ù„ØªØ§Ù„ÙŠØ©
1. Twisted Pair Cables: ...
2. Security Goals: ...
3. NIC error: ...
4. Computer security: ...
5. Proxy servers: ...
6. Firewall: ...
7. Security Services: ...
8. IDS: ...
`.trim();

  const incompleteFastPathResult = Array.from({ length: 8 }, (_, index) => ({
    groupNumber: 2,
    subIndex: index + 1,
    question: `Concept ${index + 1}`,
    modelAnswer: `Answer ${index + 1}`,
  }));

  const completeFastPathResult = Array.from({ length: 16 }, (_, index) => ({
    groupNumber: index < 8 ? 1 : 2,
    subIndex: (index % 8) + 1,
    question: `Question ${index + 1}`,
    modelAnswer: `Answer ${index + 1}`,
  }));

  assert.strictEqual(
    shouldAcceptFastPdfExtraction({
      normalizedText,
      parsedQuestions: incompleteFastPathResult,
    }),
    false
  );

  assert.strictEqual(
    shouldAcceptFastPdfExtraction({
      normalizedText,
      parsedQuestions: completeFastPathResult,
    }),
    true
  );

  console.log("PASS: fast PDF extraction confidence gate");
}

function testArabicExtractionNormalization() {
  const raw =
    "\u0623\u0646\u0648\u0627\u0639\t\u0627\u0644\u062c\u062f\u0631\u0627\u0646\t\u0627\u0644\u0646\u0627\u0631\u064a\u0629\nFirewall\tTypes";
  const normalized = normalizeExtractedTextForAI(raw);

  assert.strictEqual(
    normalized,
    "\u0623\u0646\u0648\u0627\u0639 \u0627\u0644\u062c\u062f\u0631\u0627\u0646 \u0627\u0644\u0646\u0627\u0631\u064a\u0629\nFirewall Types"
  );
  console.log("PASS: Arabic extraction normalization");
}

function testArabicNormalizationPreservesReadableBreaks() {
  const raw =
    "\u0627\u0644\u0633\u0637\u0631 \u0627\u0644\u0623\u0648\u0644\n\n\n\u0627\u0644\u0633\u0637\u0631 \u0627\u0644\u062b\u0627\u0646\u064a   \n   \u0627\u0644\u0633\u0637\u0631 \u0627\u0644\u062b\u0627\u0644\u062b";
  const normalized = normalizeExtractedTextForAI(raw);

  assert.strictEqual(
    normalized,
    "\u0627\u0644\u0633\u0637\u0631 \u0627\u0644\u0623\u0648\u0644\n\n\u0627\u0644\u0633\u0637\u0631 \u0627\u0644\u062b\u0627\u0646\u064a\n\u0627\u0644\u0633\u0637\u0631 \u0627\u0644\u062b\u0627\u0644\u062b"
  );
  console.log("PASS: Arabic normalization preserves readable line breaks");
}

function testFragmentedArabicPdfTextFallsBackSafely() {
  const pdfText =
    "\u0646 \u0645 \u0648 \u0630 \u062c \u0625 \u062c \u0627 \u0628 \u0629";
  assert.strictEqual(
    shouldUseExtractedPdfTextAsPrimarySource({
      providerName: "ollama",
      pdfText,
      preferTextOnlyForPdf: true,
    }),
    true
  );
  console.log("PASS: PDF text path remains enabled for non-empty extracted text");
}

function testLanguageAgnosticGradingRulesPresent() {
  const gradeRouteSource = fs.readFileSync(
    new URL("../src/app/api/grade/route.ts", import.meta.url),
    "utf8"
  );

  assert(
    gradeRouteSource.includes(
      "Language mismatch alone must never reduce the score."
    )
  );
  assert.strictEqual(
    hasAnswerLanguageMismatch(
      "\u0625\u062c\u0627\u0628\u0629 \u0628\u0627\u0644\u0639\u0631\u0628\u064a\u0629",
      "Answer in English"
    ),
    true
  );
  assert.strictEqual(
    hasAnswerLanguageMismatch(
      "Answer in English",
      "\u0625\u062c\u0627\u0628\u0629 \u0628\u0627\u0644\u0639\u0631\u0628\u064a\u0629"
    ),
    true
  );
  assert.strictEqual(
    hasAnswerLanguageMismatch("English answer", "English model"),
    false
  );
  assert.strictEqual(
    hasAnswerLanguageMismatch(
      "\u0645\u0632\u064a\u062c Arabic and English",
      "Answer in English"
    ),
    true
  );

  console.log("PASS: language-agnostic grading and extraction rules are present");
}

(async () => {
  await testGradeJsonParsing();
  await testExtractStudentProviderFallback();
  testFastPdfExtractionConfidenceGate();
  testArabicExtractionNormalization();
  testArabicNormalizationPreservesReadableBreaks();
  testFragmentedArabicPdfTextFallsBackSafely();
  testLanguageAgnosticGradingRulesPresent();
  console.log("All focused route fix tests passed.");
})();
