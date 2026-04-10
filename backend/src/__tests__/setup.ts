import prisma from '../utils/prisma';

afterAll(async () => {
  await prisma.$disconnect();
});
