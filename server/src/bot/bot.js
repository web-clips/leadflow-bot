import "dotenv/config";
import { Bot, InlineKeyboard, Keyboard } from "grammy";
import { prisma } from "../lib/prisma.js";

const bot = new Bot(process.env.TELEGRAM_BOT_TOKEN);

const getActiveLead = async (telegramId) => {
  return prisma.lead.findFirst({
    where: {
      telegramId: String(telegramId),
      status: {
        not: "cancelled",
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  });
};

const users = new Map();

const bookingKeyboard = new InlineKeyboard().text(
  "❌ Отменить запись",
  "cancel_booking",
);

const timeKeyboard = new InlineKeyboard()
  .text("10:00", "time_10")
  .text("12:00", "time_12")
  .row()
  .text("15:00", "time_15")
  .text("18:00", "time_18");

const dateKeyboard = new InlineKeyboard()
  .text("Сегодня", "date_today")
  .text("Завтра", "date_tomorrow")
  .row()
  .text("Выбрать другую дату", "date_other");

const phoneKeyboard = new Keyboard()
  .requestContact("📱 Отправить номер телефона")
  .resized()
  .oneTime();

const servicesKeyboard = new InlineKeyboard()
  .text("🦷 Чистка", "cleaning")
  .text("😁 Брекеты", "braces")
  .row()
  .text("🦷 Имплантация", "implant")
  .text("💬 Другое", "other")
  .row()
  .text("🔄 Начать заново", "restart");

const formatDateForDb = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
};

const parseCustomDate = (value) => {
  const parts = value.split(".");

  if (parts.length !== 3) {
    return null;
  }

  const [day, month, year] = parts;

  if (day.length !== 2 || month.length !== 2 || year.length !== 4) {
    return null;
  }

  const date = new Date(`${year}-${month}-${day}`);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return `${year}-${month}-${day}`;
};

const createCalendar = (year, month) => {
  const keyboard = new InlineKeyboard();

  const monthNames = [
    "Январь",
    "Февраль",
    "Март",
    "Апрель",
    "Май",
    "Июнь",
    "Июль",
    "Август",
    "Сентябрь",
    "Октябрь",
    "Ноябрь",
    "Декабрь",
  ];

  // Заголовок
  keyboard.text(`${monthNames[month]} ${year}`, "calendar_ignore").row();

  // Дни недели
  const weekDays = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

  weekDays.forEach((day) => {
    keyboard.text(day, "calendar_ignore");
  });

  keyboard.row();

  const firstDay = new Date(year, month, 1);

  // Преобразуем:
  // JS: Вс = 0
  // Нам нужно: Пн = 0
  const startDay = (firstDay.getDay() + 6) % 7;

  const daysInMonth = new Date(year, month + 1, 0).getDate();

  // Пустые клетки перед первым числом
  for (let i = 0; i < startDay; i++) {
    keyboard.text(" ", "calendar_ignore");
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let position = startDay;

  for (let day = 1; day <= daysInMonth; day++) {
    const currentDate = new Date(year, month, day);

    const dateForDb = formatDateForDb(currentDate);

    // Прошедшие даты нельзя выбирать
    if (currentDate < today) {
      keyboard.text("·", "calendar_ignore");
    } else {
      keyboard.text(String(day), `calendar_date:${dateForDb}`);
    }

    position++;

    if (position % 7 === 0) {
      keyboard.row();
    }
  }

  // Если последняя строка неполная
  if (position % 7 !== 0) {
    keyboard.row();
  }

  // Кнопки переключения месяца
  const currentRealMonth = today.getFullYear() * 12 + today.getMonth();

  const displayedMonth = year * 12 + month;

  if (displayedMonth > currentRealMonth) {
    const previous = new Date(year, month - 1, 1);

    keyboard.text(
      "◀ Назад",
      `calendar_month:${previous.getFullYear()}-${previous.getMonth()}`,
    );
  }

  const next = new Date(year, month + 1, 1);

  keyboard.text(
    "Вперёд ▶",
    `calendar_month:${next.getFullYear()}-${next.getMonth()}`,
  );

  return keyboard;
};

const showMainMenu = async (ctx) => {
  await ctx.reply("Здравствуйте! 👋\n\nКакую услугу вы хотите выбрать?", {
    reply_markup: servicesKeyboard,
  });
};

const getDateForDb = (daysToAdd = 0) => {
  const date = new Date();

  date.setDate(date.getDate() + daysToAdd);

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
};

const formatDateForUser = (dateString) => {
  if (!dateString?.includes("-")) {
    return dateString;
  }

  const [year, month, day] = dateString.split("-");

  return `${day}.${month}.${year}`;
};

bot.command("start", async (ctx) => {
  const activeLead = await getActiveLead(ctx.from.id);

  if (activeLead) {
    await ctx.reply(
      `⚠️ У вас уже есть активная запись.

🦷 Услуга: ${activeLead.service}
👤 Имя: ${activeLead.name}
📅 Дата: ${activeLead.date}
🕐 Время: ${activeLead.time}`,
      {
        reply_markup: bookingKeyboard,
      },
    );

    return;
  }

  await showMainMenu(ctx);
});

bot.callbackQuery("cleaning", async (ctx) => {
  users.set(ctx.from.id, {
    service: "Чистка",
    step: "waiting_name",
  });

  await ctx.answerCallbackQuery();

  await ctx.reply("Вы выбрали: 🦷 Чистка\n\nКак вас зовут?");
});

bot.callbackQuery("restart", async (ctx) => {
  users.delete(ctx.from.id);

  await ctx.answerCallbackQuery();
  await showMainMenu(ctx);
});

bot.on("message:text", async (ctx) => {
  const user = users.get(ctx.from.id);

  if (!user) {
    await showMainMenu(ctx);
    return;
  }

  if (user.step === "waiting_name") {
    user.name = ctx.message.text;
    user.step = "waiting_phone";

    users.set(ctx.from.id, user);

    await ctx.reply(
      `Приятно познакомиться, ${user.name} 👋\n\nНажмите кнопку ниже, чтобы отправить номер телефона.`,
      {
        reply_markup: phoneKeyboard,
      },
    );

    return;
  }

  if (user.step === "waiting_custom_date") {
    const selectedDate = parseCustomDate(ctx.message.text);

    if (!selectedDate) {
      await ctx.reply(
        "❌ Неверный формат даты.\n\nВведите, например:\n15.10.2026",
      );

      return;
    }

    user.date = selectedDate;
    user.step = "waiting_time";

    users.set(ctx.from.id, user);

    await ctx.reply(
      `Дата выбрана: ${user.date} ✅\n\nТеперь выберите удобное время:`,
      {
        reply_markup: timeKeyboard,
      },
    );

    return;
  }
});

bot.catch((err) => {
  console.error("Ошибка Telegram:", err);
});

bot.on("message:contact", async (ctx) => {
  const user = users.get(ctx.from.id);

  if (!user) {
    return;
  }

  if (user.step === "waiting_phone") {
    user.phone = ctx.message.contact.phone_number;
    user.step = "waiting_date";

    users.set(ctx.from.id, user);

    // Сначала убираем нижнюю клавиатуру телефона
    await ctx.reply(`Спасибо ✅\nВаш номер: ${user.phone}`, {
      reply_markup: {
        remove_keyboard: true,
      },
    });

    // Потом отдельным сообщением показываем inline-кнопки даты
    await ctx.reply("Когда вам удобно прийти?", {
      reply_markup: dateKeyboard,
    });
  }
});

bot.callbackQuery("date_today", async (ctx) => {
  const user = users.get(ctx.from.id);

  if (!user) {
    return;
  }

  user.date = getDateForDb(0);
  user.step = "waiting_time";

  users.set(ctx.from.id, user);

  await ctx.answerCallbackQuery();

  await ctx.reply(
    `Вы выбрали дату: ${formatDateForUser(user.date)} ✅\n\nТеперь выберите удобное время:`,
    {
      reply_markup: timeKeyboard,
    },
  );
});

bot.callbackQuery("date_tomorrow", async (ctx) => {
  const user = users.get(ctx.from.id);

  if (!user) {
    return;
  }

  user.date = getDateForDb(1);
  user.step = "waiting_time";

  users.set(ctx.from.id, user);

  await ctx.answerCallbackQuery();

  await ctx.reply(
    `Вы выбрали дату: ${formatDateForUser(user.date)} ✅\n\nТеперь выберите удобное время:`,
    {
      reply_markup: timeKeyboard,
    },
  );
});

bot.callbackQuery("date_other", async (ctx) => {
  const user = users.get(ctx.from.id);

  if (!user) {
    return;
  }

  const today = new Date();

  await ctx.answerCallbackQuery();

  await ctx.reply("📅 Выберите удобную дату:", {
    reply_markup: createCalendar(today.getFullYear(), today.getMonth()),
  });
});

const saveTime = async (ctx, time) => {
  const user = users.get(ctx.from.id);

  if (!user) {
    return;
  }

  user.time = time;
  user.step = "completed";

  users.set(ctx.from.id, user);

  // Сразу убираем "часики" на нажатой inline-кнопке
  await ctx.answerCallbackQuery();

  // Показываем Telegram-анимацию "печатает..."
  await ctx.api.sendChatAction(ctx.chat.id, "typing");

  // Отправляем временное сообщение
  const loadingMessage = await ctx.reply(
    "⏳ Сохраняем вашу заявку...\nПожалуйста, подождите.",
  );

  try {
    const lead = await prisma.lead.create({
      data: {
        telegramId: String(ctx.from.id),
        name: user.name,
        phone: user.phone,
        service: user.service,
        date: user.date,
        time: user.time,
      },
    });

    console.log("Заявка сохранена:", lead);

    // Вместо нового сообщения меняем "Сохраняем..."
    await ctx.api.editMessageText(
      ctx.chat.id,
      loadingMessage.message_id,
      `✅ Заявка успешно создана!

🦷 Услуга: ${user.service}
👤 Имя: ${user.name}
📱 Телефон: ${user.phone}
📅 Дата: ${formatDateForUser(user.date)}
🕐 Время: ${user.time}

Администратор свяжется с вами для подтверждения.`,
      {
        reply_markup: bookingKeyboard,
      },
    );

    users.delete(ctx.from.id);
  } catch (error) {
    console.error("Ошибка сохранения заявки:", error);

    await ctx.api.editMessageText(
      ctx.chat.id,
      loadingMessage.message_id,
      "❌ Не удалось сохранить заявку.\nПопробуйте ещё раз позже.",
    );
  }
};

bot.callbackQuery("time_10", async (ctx) => {
  await saveTime(ctx, "10:00");
});

bot.callbackQuery("time_12", async (ctx) => {
  await saveTime(ctx, "12:00");
});

bot.callbackQuery("time_15", async (ctx) => {
  await saveTime(ctx, "15:00");
});

bot.callbackQuery("time_18", async (ctx) => {
  await saveTime(ctx, "18:00");
});

bot.callbackQuery(/^calendar_date:(.+)$/, async (ctx) => {
  const user = users.get(ctx.from.id);

  if (!user) {
    return;
  }

  const selectedDate = ctx.match[1];

  user.date = selectedDate;
  user.step = "waiting_time";

  users.set(ctx.from.id, user);

  await ctx.answerCallbackQuery();

  await ctx.editMessageText(`✅ Вы выбрали дату: ${selectedDate}`);

  await ctx.reply("Теперь выберите удобное время:", {
    reply_markup: timeKeyboard,
  });
});

bot.callbackQuery("cancel_booking", async (ctx) => {
  const activeLead = await getActiveLead(ctx.from.id);

  await ctx.answerCallbackQuery();

  if (!activeLead) {
    await ctx.reply("Активная запись не найдена.");
    return;
  }

  await prisma.lead.update({
    where: {
      id: activeLead.id,
    },
    data: {
      status: "cancelled",
    },
  });

  users.delete(ctx.from.id);

  await ctx.editMessageText(
    `❌ Запись отменена.

🦷 Услуга: ${activeLead.service}
📅 Дата: ${formatDateForUser(activeLead.date)}
🕐 Время: ${activeLead.time}`,
  );

  await ctx.reply("Теперь вы можете создать новую запись.", {
    reply_markup: servicesKeyboard,
  });
});

bot.start({
  onStart: () => {
    console.log("Telegram bot started");
  },
});
