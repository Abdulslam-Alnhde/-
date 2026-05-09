import { PrismaClient } from '@prisma/client';

async function main() {
  const prisma = new PrismaClient();
  try {
    const colleges = await prisma.college.findMany({
      orderBy: { sortOrder: 'asc' }
    });
    console.log('--- قائمة الكليات في قاعدة البيانات ---');
    if (colleges.length === 0) {
      console.log('لا يوجد كليات حالياً.');
    } else {
      colleges.forEach((c, i) => {
        console.log(`${i + 1}. ${c.name} (ID: ${c.id})`);
      });
    }
  } catch (e) {
    console.error(e);
  } finally {
    await prisma.$disconnect();
  }
}

main();
