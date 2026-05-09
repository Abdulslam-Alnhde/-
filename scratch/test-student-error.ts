import { createStudentExtractionProviderRuntimes, extractStudentAnswersInBatches } from '../src/lib/extract-student-core.ts';

async function main() {
  const file = new File([Buffer.from('fake image bytes')], 'student.png', { type: 'image/png' });
  try {
    await extractStudentAnswersInBatches({
      file,
      questions: [{ id: 1, text: 'Q1' }],
      providers: createStudentExtractionProviderRuntimes(),
    });
  } catch (error) {
    console.log('NAME=' + (error instanceof Error ? error.name : typeof error));
    console.log('MESSAGE=' + (error instanceof Error ? error.message : String(error)));
    console.log('DETAILS=' + JSON.stringify((error as any)?.details || null));
  }
}

main();

