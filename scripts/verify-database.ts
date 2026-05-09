import { PrismaClient } from '@prisma/client';

async function verifyDatabase() {
  const prisma = new PrismaClient();
  const testName = `اختبار_اتصال_${Date.now()}`;
  
  console.log('--- بدئ اختبار قاعدة البيانات ---');
  
  try {
    // 1. اختبار الاتصال
    console.log('1. اختبار الاتصال...');
    await prisma.$connect();
    console.log('✅ تم الاتصال بنجاح.');

    // 2. اختبار القراءة
    console.log('2. اختبار القراءة (جلب عدد المستخدمين)...');
    const userCount = await prisma.user.count();
    console.log(`✅ عدد المستخدمين حالياً: ${userCount}`);

    // 3. اختبار الكتابة (إضافة كلية تجريبية)
    console.log('3. اختبار الكتابة (إضافة سجل تجريبي)...');
    const newCollege = await prisma.college.create({
      data: {
        name: testName,
        sortOrder: 999,
      },
    });
    console.log(`✅ تم إنشاء كلية تجريبية بنجاح. المعرف: ${newCollege.id}`);

    // 4. اختبار التخزين والاسترجاع
    console.log('4. التأكد من حفظ البيانات واسترجاعها...');
    const fetchedCollege = await prisma.college.findUnique({
      where: { id: newCollege.id },
    });

    if (fetchedCollege && fetchedCollege.name === testName) {
      console.log('✅ تم استرجاع البيانات بنجاح والتأكد من مطابقتها.');
    } else {
      throw new Error('فشل استرجاع البيانات أو البيانات غير متطابقة!');
    }

    // 5. التنظيف (حذف السجل التجريبي)
    console.log('5. تنظيف البيانات التجريبية...');
    await prisma.college.delete({
      where: { id: newCollege.id },
    });
    console.log('✅ تم حذف السجل التجريبي بنجاح.');

    console.log('\n--- نتيجة الاختبار: قاعدة البيانات تعمل بشكل ممتاز! ✅ ---');

  } catch (error) {
    console.error('\n❌ حدث خطأ أثناء اختبار قاعدة البيانات:');
    console.error(error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

verifyDatabase();
