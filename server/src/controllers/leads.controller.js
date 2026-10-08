import { prisma } from "../lib/prisma.js";

export const getLeads = async (req, res) => {
  try {
    const leads = await prisma.lead.findMany({
      orderBy: {
        createdAt: "desc",
      },
    });

    res.json(leads);
  } catch (error) {
    console.error("Ошибка получения заявок:", error);

    res.status(500).json({
      message: "Не удалось получить заявки",
    });
  }
};