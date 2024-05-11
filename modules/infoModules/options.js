module.exports = {
  menu: {
    reply_markup: {
      keyboard: [
        [
          { text: `💸 платежи`, callback_data: "/payment" },
          { text: `📋 показаний`, callback_data: "/cheap" },
        ],
        [{ text: `🔍 поиск`, callback_data: "/start" }],
      ],
      resize_keyboard: true,
    },
  },
  reportKb: {
    reply_markup: {
      keyboard: [[{ text: `повторить поиск`, callback_data: "/report" }]],
      resize_keyboard: true,
    },
  },
  search: {
    reply_markup: {
      keyboard: [
        [
          { text: `🔍 по л/с`, callback_data: "/search" },
          { text: `🔍 по вм`, callback_data: "/searchbywm" },
        ],
        [{ text: `🔍 по фио`, callback_data: "/searchuser" }],
      ],
      resize_keyboard: true,
    },
  },
};
