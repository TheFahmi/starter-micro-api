const axios = require("axios");
const TelegramBot = require("node-telegram-bot-api");

// Ganti dengan token bot Telegram Anda
const botToken = "5148879266:AAH4K-TbR6G-QAOJCuZIwHkaeDAE6tfCp4E";

// Inisialisasi bot Telegram
const bot = new TelegramBot(botToken, {
  polling: true,
});

// Daftar untuk menyimpan ID pengguna yang akan ditambahkan
const userIds = [];

// URL API yang ingin Anda monitor
const apiUrl = "https://apicomtest.kcic.co.id/public/routes";

// Inisialisasi tanggal akhir dengan nilai default
let endDate = "2023-10-09";

// Hitung tanggal awal dari endDate - 1 hari
const endDateObj = new Date(endDate);
endDateObj.setDate(endDateObj.getDate() - 1);
let startDate = endDateObj.toISOString().split("T")[0];

// Variabel untuk mengontrol pemantauan
let isMonitoringActive = true;

// Fungsi untuk mengirim pesan ke Telegram
function sendTelegramMessage(chatId, message, keyboard) {
  const options = {
    reply_markup: {
      inline_keyboard: keyboard,
    },
  };

  bot
    .sendMessage(chatId, message, options)
    .then(() => {
      console.log(`Pemberitahuan berhasil dikirim ke ID obrolan: ${chatId}`);
    })
    .catch((error) => {
      console.error(
        `Error saat mengirim pemberitahuan ke ID obrolan: ${chatId}`,
        error
      );
    });
}

// Fungsi untuk memformat waktu
function formatTime(hours, minutes) {
  return `${hours.toString().padStart(2, "0")}:${minutes
    .toString()
    .padStart(2, "0")}`;
}

// Membuat keyboard inline untuk menu
function createMenuKeyboard(chatId) {
  let menuKeyboard = [
    [
      {
        text: "Tambahkan Saya",
        callback_data: "add_me",
      },
    ],
    [
      {
        text: "Atur Tanggal",
        callback_data: "set_date",
      },
      {
        text: "Berhenti",
        callback_data: "stop",
      },
    ],
  ];

  // Menambahkan menu "Daftar Pengguna" khusus untuk pengguna dengan ID 871965179
  if (chatId === 871965179) {
    menuKeyboard.unshift([
      {
        text: "Daftar Pengguna",
        callback_data: "list_users",
      },
    ]);
  }

  return menuKeyboard;
}

// Membuat keyboard inline untuk perintah /stop saja
function createStopKeyboard() {
  return [
    [
      {
        text: "Berhenti",
        callback_data: "stop",
      },
    ],
  ];
}

// Mendengarkan pesan yang diterima oleh bot
bot.on("message", (msg) => {
  const chatId = msg.chat.id;
  const messageText = msg.text;

  // Memanggil fungsi untuk mengirim pesan dengan keyboard menu
  const keyboard = createMenuKeyboard(chatId);
  sendTelegramMessage(
    chatId,
    "Halo! Silakan pilih perintah di bawah ini:",
    keyboard
  );
});

// Menangani aksi dari tombol menu
bot.on("callback_query", (query) => {
  const chatId = query.message.chat.id;
  const data = query.data;

  // Menambahkan kondisi untuk memeriksa ID pengguna sebelum mengeksekusi perintah "Tambahkan Saya"
  if (data === "add_me") {
    if (!userIds.includes(chatId)) {
      userIds.push(chatId);
      sendTelegramMessage(
        chatId,
        "Anda telah ditambahkan ke daftar pengguna.",
        createMenuKeyboard(chatId)
      );
    } else {
      sendTelegramMessage(
        chatId,
        "Anda sudah ada dalam daftar pengguna.",
        createMenuKeyboard(chatId)
      );
    }
  } else if (data === "list_users") {
    if (chatId === 871965179) {
      sendTelegramMessage(
        chatId,
        `Daftar pengguna: ${userIds.join(", ")}`,
        createMenuKeyboard(chatId)
      );
    } else {
      sendTelegramMessage(
        chatId,
        "Maaf, Anda tidak memiliki izin untuk mengakses menu ini.",
        createMenuKeyboard(chatId)
      );
    }
  } else if (data === "set_date") {
    // Memproses perintah untuk mengatur tanggal
    sendTelegramMessage(chatId, "Kirimkan tanggal akhir dalam format DD:");
    bot.once("message", (msg) => {
      const day = msg.text;

      if (day && /^\d{2}$/.test(day)) {
        endDate = `2023-10-${day}`;
        const endDateObj = new Date(endDate);
        endDateObj.setDate(endDateObj.getDate() - 1);
        startDate = endDateObj.toISOString().split("T")[0];

        sendTelegramMessage(
          chatId,
          `Tanggal telah diatur ke: ${endDate}`,
          createMenuKeyboard(chatId)
        );
        // Aktifkan kembali pemantauan setelah mengubah tanggal
        isMonitoringActive = true;
        monitorApiChanges();
      } else {
        sendTelegramMessage(
          chatId,
          "Format tanggal akhir tidak valid. Pengaturan tanggal akhir dibatalkan.",
          createMenuKeyboard(chatId)
        );
      }
    });
  } else if (data === "stop") {
    // Memproses perintah untuk menghentikan pemantauan
    isMonitoringActive = false;
    sendTelegramMessage(
      chatId,
      "Pemantauan telah dihentikan.",
      createMenuKeyboard(chatId)
    );
  }
});

// Menjalankan bot
console.log("Bot sedang berjalan...");

// Fungsi untuk memantau perubahan pada API sesuai tanggal
async function monitorApiChanges() {
  while (isMonitoringActive) {
    try {
      // Membuat parameter filter berdasarkan tanggal
      const params = {
        filter: {
          date: {
            $gte: startDate + "T17:00:00.000Z",
            $lte: endDate + "T16:59:59.999Z",
          },
        },
      };

      const response = await axios.get(apiUrl, {
        params,
      });

      if (response?.data?.data?.length) {
        let isQuotaAvailable = false; // Menentukan apakah ada kuota yang tersedia
        for (const data of response.data.data) {
          // Memformat waktu mulai dan selesai
          // const startTime = formatTime(data.from.hours, data.from.minutes);
          // const endTime = formatTime(data.to.hours, data.to.minutes);
          if (data.available_quota > 0) {
            isQuotaAvailable = true;
          }
        }
        if (isQuotaAvailable) {
          // Jika ada kuota yang tersedia, kirim pesan ke pengguna
          for (const data of response.data.data) {
            if (data.available_quota > 0) {
              // Jika ada kuota yang tersedia, kirim pesan ke pengguna
              userIds.forEach((chatId) => {
                sendTelegramMessage(
                  chatId,
                  `Kuota tersedia untuk tanggal ${endDate} Jam ${startTime}`,
                  createStopKeyboard()
                );
              });
              console.log(`Kuota tersedia untuk tanggal ${endDate} Jam ${startTime}`);
            }
          }
        } else {
          console.log("tidak ada kuota");
        }
      } else {
        console.log("tidak ada jadwal");
      }
    } catch (error) {
      console.error("Error saat memantau API:", error);
    }

    // Atur interval pemantauan (misalnya, setiap 5 menit)
    if (isMonitoringActive) {
      await new Promise((resolve) => setTimeout(resolve, 1000)); // 1000ms = 1 detik
    }
  }
}

// Memulai pemantauan API
monitorApiChanges();
