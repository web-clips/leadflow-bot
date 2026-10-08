import { prisma } from "./lib/prisma.js";

const testDatabase = async () => {
  try {
    const leads = await prisma.lead.findMany();

    console.log("Подключение к базе работает ✅");
    console.log("Заявки:", leads);
  } catch (error) {
    console.error("Ошибка базы данных ❌");
    console.error(error);
  } finally {
    await prisma.$disconnect();
  }
};

testDatabase();