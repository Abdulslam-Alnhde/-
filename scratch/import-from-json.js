
const { PrismaClient } = require('@prisma/client');
const fs = require('fs');

async function main() {
  const prisma = new PrismaClient();
  const data = JSON.parse(fs.readFileSync('migration_data.json', 'utf8'));

  console.log('Starting import...');

  // Disabling triggers or doing it in order
  // Order: college, user, supportTicket, profileChangeRequest, notification, exam, question, keyPoint, studentResult

  const modelsOrder = [
    'college', 
    'user', 
    'supportTicket', 
    'profileChangeRequest', 
    'notification', 
    'exam', 
    'question', 
    'keyPoint', 
    'studentResult'
  ];

  for (const model of modelsOrder) {
    console.log(`Importing ${model} (${data[model].length} items)...`);
    
    // We can't use createMany easily if we want to preserve IDs and satisfy FKs check
    // But since we are recreating everything, it should be fine.
    // We use a loop to handle potential errors and reporting.
    for (const item of data[model]) {
      try {
        await prisma[model].create({ data: item });
      } catch (e) {
        console.warn(`Failed to import ${model} item:`, e.message);
      }
    }
  }

  console.log('Import complete!');
  await prisma.$disconnect();
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
