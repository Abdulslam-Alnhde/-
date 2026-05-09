
const { PrismaClient } = require('@prisma/client');
const fs = require('fs');

async function main() {
  const prisma = new PrismaClient({
    datasources: {
      db: {
        url: process.env.DATABASE_URL
      }
    }
  });

  const data = {};
  
  const models = [
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

  for (const model of models) {
    console.log(`Exporting ${model}...`);
    data[model] = await prisma[model].findMany();
  }

  fs.writeFileSync('migration_data.json', JSON.stringify(data, null, 2));
  console.log('Export complete! saved to migration_data.json');
  await prisma.$disconnect();
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
