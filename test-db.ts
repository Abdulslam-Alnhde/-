import { PrismaClient } from '@prisma/client';
import { Pool, neonConfig } from '@neondatabase/serverless';
import { PrismaNeon } from '@prisma/adapter-neon';
import ws from 'ws';

neonConfig.webSocketConstructor = ws;
const connectionString = (process.env.DATABASE_URL || '').split('?')[0];
console.log('Connecting to:', connectionString);

const pool = new Pool({ connectionString });
const adapter = new PrismaNeon(pool);
const prisma = new PrismaClient({ adapter });

async function check() {
  try {
    const users = await prisma.user.findMany();
    console.log('Users found:', users.length);
    if(users.length > 0) {
      console.log('Admin email:', users[0].email);
      console.log('Admin hash:', users[0].passwordHash);
    } else {
      console.log('NO USERS FOUND. The DB is empty!');
    }
  } catch(e) {
    console.error('DB ERROR:', e);
  } finally {
    await prisma.$disconnect();
    process.exit(0);
  }
}
check();
