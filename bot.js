/**
 * Apex Academy Telegram Bot Controller (Masterplan 2.0)
 * 1. /start bosilganda kontakt (telefon raqam) so'raydi
 * 2. Raqam bo'yicha O'qituvchi yoki O'quvchini avtomatik aniqlaydi (0 token, xavfsiz)
 * 3. O'qituvchini darhol Ustoz Paneliga, o'quvchini O'quvchi Ilovasiga yo'naltiradi
 * 4. To'lov cheklarini tasdiqlash / rad etish (Human-in-the-loop callback queries)
 * 5. Foydalanuvchi chatId xaritasini saqlash (Davomat xabarnomalari uchun)
 */
const https = require('https');
const fs = require('fs');
const path = require('path');

const CONFIG_PATH = path.join(__dirname, 'bot_config.json');
const TEACHERS_PATH = path.join(__dirname, 'teachers.json');
const RECEIPTS_PATH = path.join(__dirname, 'receipts.json');
const USERS_PATH = path.join(__dirname, 'users.json');
const N8N_CHAT_WEBHOOK = 'https://abdisayimov.app.n8n.cloud/webhook/apex-chat';

// Ro'yxatdan o'tgan foydalanuvchilar chat_id lari (tezkor xotira sessiyasi)
const authorizedUsers = new Set();

let config = {
  bot_token: '',
  web_app_url: 'http://localhost:3000',
  admin_chat_id: null,
  google_sheet_url: ''
};

function loadConfig() {
  let fileCfg = {};
  if (fs.existsSync(CONFIG_PATH)) {
    try {
      fileCfg = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
    } catch (e) {}
  }
  config = {
    bot_token: process.env.BOT_TOKEN || fileCfg.bot_token || config.bot_token || '',
    web_app_url: process.env.WEB_APP_URL || (process.env.RENDER_EXTERNAL_URL ? process.env.RENDER_EXTERNAL_URL : null) || fileCfg.web_app_url || config.web_app_url || 'http://localhost:3000',
    admin_chat_id: process.env.ADMIN_CHAT_ID ? Number(process.env.ADMIN_CHAT_ID) : (fileCfg.admin_chat_id || config.admin_chat_id || 5565743745),
    google_sheet_url: process.env.GOOGLE_SHEET_URL || fileCfg.google_sheet_url || config.google_sheet_url || 'https://script.google.com/macros/s/AKfycbzgm2zwOCtb-WakWg2vSPTUQrHGrHdFMTgi9QYVsHtSHMvCVn9CgXdgX3HiG3fAwS5J2Q/exec'
  };
}
loadConfig();

function saveConfig() {
  try {
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), 'utf8');
  } catch (e) {}
}

function cleanPhone(p) {
  return String(p || '').replace(/\D/g, '');
}

function loadJSON(filePath, def = []) {
  if (fs.existsSync(filePath)) {
    try {
      return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch (e) {}
  }
  return def;
}

function saveJSON(filePath, data) {
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
  } catch (e) {}
}

function loadTeachers() {
  return loadJSON(TEACHERS_PATH, []);
}

// Ro'yxatdan o'tgan foydalanuvchilarni xotiraga yuklash
function loadAuthorizedUsers() {
  if (config.admin_chat_id) {
    authorizedUsers.add(Number(config.admin_chat_id));
  }
  const users = loadJSON(USERS_PATH, {});
  for (const phone in users) {
    if (users[phone]?.chatId) {
      authorizedUsers.add(Number(users[phone].chatId));
    }
  }
}
loadAuthorizedUsers();

// Foydalanuvchi avval telefon berganmi yoki yo'qligini tekshirish
function getAuthorizedUser(chatId) {
  const numId = Number(chatId);
  const users = loadJSON(USERS_PATH, {});
  for (const phone in users) {
    if (Number(users[phone]?.chatId) === numId) {
      authorizedUsers.add(numId);
      return users[phone];
    }
  }
  if (config.admin_chat_id && numId === Number(config.admin_chat_id)) {
    authorizedUsers.add(numId);
    return { chatId: numId, name: 'Admin', rawPhone: '', role: 'teacher' };
  }
  if (authorizedUsers.has(numId)) {
    return { chatId: numId, name: 'Foydalanuvchi', rawPhone: '', role: 'student' };
  }
  return null;
}

// Savolni to'g'ridan-to'g'ri n8n apex-chat Webhookiga uzatish
async function forwardToN8n(question, chatId, user = {}) {
  const response = await fetch(N8N_CHAT_WEBHOOK, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      question,
      message: question,
      user_id: String(chatId),
      chat_id: chatId,
      name: user.name || '',
      phone: user.rawPhone || ''
    })
  });

  if (!response.ok) {
    throw new Error(`n8n HTTP ${response.status}`);
  }

  const rawText = await response.text();
  try {
    const data = JSON.parse(rawText);
    const item = Array.isArray(data) ? data[0] : data;
    return item?.answer || item?.output || item?.text || item?.message || rawText;
  } catch (e) {
    return rawText;
  }
}

function telegramRequest(method, data = {}) {
  loadConfig();
  return new Promise((resolve, reject) => {
    if (!config.bot_token) {
      return reject(new Error('Bot token kiritilmagan!'));
    }

    const payload = JSON.stringify(data);
    const options = {
      hostname: 'api.telegram.org',
      port: 443,
      path: `/bot${config.bot_token}/${method}`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      }
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', c => body += c);
      res.on('end', () => {
        try {
          resolve(JSON.parse(body));
        } catch (e) {
          resolve({ ok: false, error: body });
        }
      });
    });

    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

// Xabar yuborish (HTML xato bersa oddiy matn sifatida qayta yuboradi)
async function sendMessage(chatId, text, replyMarkup = null) {
  const data = {
    chat_id: chatId,
    text: text,
    parse_mode: 'HTML'
  };
  if (replyMarkup) {
    data.reply_markup = replyMarkup;
  }
  const res = await telegramRequest('sendMessage', data);
  if (!res.ok && res.description && res.description.includes('parse entities')) {
    delete data.parse_mode;
    return telegramRequest('sendMessage', data);
  }
  return res;
}

// Xabarni tahrirlash (Edit message)
async function editMessageText(chatId, messageId, text, replyMarkup = null) {
  const data = {
    chat_id: chatId,
    message_id: messageId,
    text: text,
    parse_mode: 'HTML'
  };
  if (replyMarkup) {
    data.reply_markup = replyMarkup;
  }
  return telegramRequest('editMessageText', data);
}

// Callback Query ga javob berish (Popup bildirishnoma)
async function answerCallbackQuery(callbackQueryId, text = '', showAlert = false) {
  return telegramRequest('answerCallbackQuery', {
    callback_query_id: callbackQueryId,
    text: text,
    show_alert: showAlert
  });
}

// Long Polling orqali yangi xabarlarni qabul qilish
let offset = 0;
async function pollUpdates() {
  try {
    const res = await telegramRequest('getUpdates', {
      offset: offset,
      timeout: 25,
      allowed_updates: ['message', 'callback_query']
    });

    if (res.ok && res.result && res.result.length > 0) {
      for (const update of res.result) {
        offset = update.update_id + 1;
        await handleUpdate(update);
      }
    }
  } catch (err) {
    await new Promise(r => setTimeout(r, 3000));
  }
  setImmediate(pollUpdates);
}

// Xabarlar va Callback Query larni boshqarish
async function handleUpdate(update) {
  loadConfig(); // Har safar eng so'nggi konfiguratsiyani o'qish

  // ========================================================
  // 1. INLINE TUGMALAR (CALLBACK QUERY) — TO'LOV CHEKLARINI TASDIQLASH
  // ========================================================
  if (update.callback_query) {
    const cq = update.callback_query;
    const data = cq.data || '';
    const adminUser = cq.from.first_name || 'Admin';
    const message = cq.message;

    // A) To'lov chekini TASDIQLASH
    if (data.startsWith('approve_receipt_')) {
      const receiptId = data.replace('approve_receipt_', '');
      let receipts = loadJSON(RECEIPTS_PATH, []);
      const receipt = receipts.find(r => r.receiptId === receiptId);

      if (receipt) {
        receipt.status = 'Tasdiqlandi';
        receipt.approvedBy = adminUser;
        receipt.approvedAt = new Date().toISOString();
        saveJSON(RECEIPTS_PATH, receipts);

        await answerCallbackQuery(cq.id, `✅ Chek #${receiptId} muvaffaqiyatli TASDIQLANDI!`, false);

        // Admindagi xabarni yangilash (Tugmalarni olib tashlash)
        const baseText = message.caption || message.text || '';
        const updatedAdminText = `
${baseText}

━━━━━━━━━━━━━━━━━━━━━━
✅ <b>TASDIQLANDI!</b>
👤 <b>Tasdiqladi:</b> ${adminUser}
⏰ <b>Vaqti:</b> ${new Date().toLocaleTimeString('uz-UZ')}
📊 <b>Holati:</b> To'landi (Jadval yangilandi)
        `.trim();

        if (message.caption !== undefined) {
          await telegramRequest('editMessageCaption', {
            chat_id: message.chat.id,
            message_id: message.message_id,
            caption: updatedAdminText,
            parse_mode: 'HTML'
          });
        } else {
          await editMessageText(message.chat.id, message.message_id, updatedAdminText);
        }

        // O'quvchiga xushxabar yuborish
        const studentChatId = receipt.chatId;
        if (studentChatId) {
          const studentAlert = `
🎉 <b>To'lovingiz Muvaffaqiyatli Tasdiqlandi!</b>

Hurmatli <b>${receipt.studentName}</b>!
Siz taqdim etgan <b>${receipt.amount}</b> miqdoridagi to'lov cheki ma'muriyat tomonidan tekshirildi va tasdiqlandi.

🏷 <b>Kvitansiya raqami:</b> #${receipt.receiptId}
📚 <b>Kurs:</b> ${receipt.course}
✅ <b>To'lov holati:</b> TO'LANDI

Darslaringizda omad tilaymiz! 🚀
<i>— Apex Academy Ma'muriyati</i>
          `;
          await sendMessage(studentChatId, studentAlert);
        }

        // Google Sheets ga "To'landi" statusini yuborish
        if (config.google_sheet_url) {
          try {
            fetch(config.google_sheet_url, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                action: 'payment_verified',
                name: receipt.studentName,
                phone: receipt.studentPhone,
                course: receipt.course,
                amount: receipt.amount,
                status: "To'landi"
              })
            }).catch(() => {});
          } catch (e) {}
        }
      }
      return;
    }

    // B) To'lov chekini RAD ETISH
    if (data.startsWith('reject_receipt_')) {
      const receiptId = data.replace('reject_receipt_', '');
      let receipts = loadJSON(RECEIPTS_PATH, []);
      const receipt = receipts.find(r => r.receiptId === receiptId);

      if (receipt) {
        receipt.status = 'Rad etildi';
        receipt.rejectedBy = adminUser;
        receipt.rejectedAt = new Date().toISOString();
        saveJSON(RECEIPTS_PATH, receipts);

        await answerCallbackQuery(cq.id, `❌ Chek #${receiptId} RAD ETILDI!`, true);

        const baseText = message.caption || message.text || '';
        const updatedAdminText = `
${baseText}

━━━━━━━━━━━━━━━━━━━━━━
❌ <b>RAD ETILDI!</b>
👤 <b>Mas'ul:</b> ${adminUser}
⏰ <b>Vaqti:</b> ${new Date().toLocaleTimeString('uz-UZ')}
        `.trim();

        if (message.caption !== undefined) {
          await telegramRequest('editMessageCaption', {
            chat_id: message.chat.id,
            message_id: message.message_id,
            caption: updatedAdminText,
            parse_mode: 'HTML'
          });
        } else {
          await editMessageText(message.chat.id, message.message_id, updatedAdminText);
        }

        // O'quvchiga xabar yuborish
        const studentChatId = receipt.chatId;
        if (studentChatId) {
          const rejectAlert = `
⚠️ <b>To'lov Cheki Tasdiqlanmadi!</b>

Hurmatli <b>${receipt.studentName}</b>!
Siz yuklagan to'lov chekida noaniqlik aniqlandi va ma'muriyat tomonidan qabul qilinmadi.

Iltimos, haqiqiy to'lov skrinshotini (Click / Payme kvitansiyasini) ilovamiz orqali qaytadan yuklang yoki ma'muriyat bilan bog'laning:
📞 <b>Telefon:</b> +998 95 901 14 45

<i>— Apex Academy</i>
          `;
          await sendMessage(studentChatId, rejectAlert);
        }
      }
      return;
    }

    return;
  }

  // ========================================================
  // 2. TEXT VA KONTAKT XABARLARI
  // ========================================================
  if (!update.message) return;
  const msg = update.message;
  const chatId = msg.chat.id;
  const text = msg.text || '';
  const firstName = msg.from.first_name || 'Hurmatli foydalanuvchi';

  // 1. Foydalanuvchi KONTAKT yuborganida (request_contact orqali)
  if (msg.contact) {
    const rawPhone = msg.contact.phone_number;
    const phone = cleanPhone(rawPhone);
    const teachers = loadTeachers();

    const teacher = teachers.find(t => cleanPhone(t.phone) === phone);
    const isAdmin = teacher && (teacher.role.toLowerCase().includes('admin') || phone.includes('959011445'));

    // Admin chatId ni saqlash
    if (isAdmin || phone.includes('959011445')) {
      config.admin_chat_id = chatId;
      saveConfig();
      console.log(`👑 Bosh Admin aniqlandi: ${teacher?.name || firstName} (ChatID: ${chatId})`);
    }

    // Foydalanuvchilar xaritasini va tezkor sessiyani saqlash
    authorizedUsers.add(Number(chatId));
    let users = loadJSON(USERS_PATH, {});
    users[phone] = {
      chatId,
      name: teacher ? teacher.name : firstName,
      rawPhone,
      role: teacher ? 'teacher' : 'student',
      updatedAt: new Date().toISOString()
    };
    saveJSON(USERS_PATH, users);

    if (teacher) {
      // Bu O'QITUVCHI yoki ADMIN!
      console.log(`👨‍🏫 O'qituvchi kirdi: ${teacher.name} (${teacher.phone})`);
      const teacherAppUrl = `${config.web_app_url}?role=teacher&phone=${encodeURIComponent(teacher.phone)}&name=${encodeURIComponent(teacher.name)}`;

      // O'qituvchining shaxsiy Menu tugmasini ham Ustoz Paneliga ulaymiz
      try {
        await telegramRequest('setChatMenuButton', {
          chat_id: chatId,
          menu_button: {
            type: 'web_app',
            text: '🔐 Ustoz Paneli',
            web_app: { url: teacherAppUrl }
          }
        });
      } catch (e) {}

      const teacherMsg = `
Assalomu alaykum, hurmatli ustoz <b>${teacher.name}</b>! 👨‍🏫

Siz muvaffaqiyatli tasdiqlandingiz:
🏷 <b>Lavozim:</b> ${teacher.role}
👥 <b>Biriktirilgan yo'nalish:</b> ${teacher.assignedCourse || teacher.group}

Siz uchun maxsus <b>Boshqaruv Paneli</b> tayyor. Quyidagi tugmani bosib, yangi lidlarni ko'rishingiz, guruh ochishingiz va davomat qilishingiz mumkin: 👇
      `;

      await sendMessage(chatId, teacherMsg, {
        inline_keyboard: [
          [{ text: '🔐 Ustoz Boshqaruv Panelini Ochish', web_app: { url: teacherAppUrl } }]
        ]
      });

      await sendMessage(chatId, '✅ Xavfsiz kirish tasdiqlandi.', {
        remove_keyboard: true
      });
      return;
    } else {
      // Bu O'QUVCHI yoki OTA-ONA!
      console.log(`🎓 O'quvchi kirdi: ${firstName} (${rawPhone})`);
      const studentAppUrl = `${config.web_app_url}?role=student&phone=${encodeURIComponent(rawPhone)}&name=${encodeURIComponent(firstName)}`;

      try {
        await telegramRequest('setChatMenuButton', {
          chat_id: chatId,
          menu_button: {
            type: 'web_app',
            text: '📱 Apex Ilova',
            web_app: { url: studentAppUrl }
          }
        });
      } catch (e) {}

      const studentMsg = `
Xush kelibsiz, <b>${firstName}</b>! 🎓

Telefon raqamingiz muvaffaqiyatli saqlandi.
Endi siz <b>Apex Academy</b> ilovasi orqali barcha kurslar, narxlar, haftalik Mock imtihonlar va oylik to'lov chekini yuklash imkoniyatidan foydalanishingiz mumkin: 👇
      `;

      await sendMessage(chatId, studentMsg, {
        inline_keyboard: [
          [{ text: '🚀 Apex Ilovani Ochish', web_app: { url: studentAppUrl } }]
        ]
      });

      await sendMessage(chatId, '✅ Profilingiz faollashtirildi.', {
        remove_keyboard: true
      });
      return;
    }
  }

  // 2. /start buyrug'i bosilganda
  if (text.startsWith('/start')) {
    const welcomeText = `
Assalomu alaykum, <b>${firstName}</b>! 🎓

<b>Apex Academy</b> rasmiy tizimiga xush kelibsiz!

Xavfsizlik va tizim sizga mos bo'limni (<b>O'qituvchilar Paneli</b> yoki <b>O'quvchi Kabineti</b>) ochib berishi uchun, iltimos pastdagi tugmani bosing: 👇
    `;

    const contactKeyboard = {
      keyboard: [
        [
          {
            text: '📱 Telefon raqamni yuborish (Kirish)',
            request_contact: true
          }
        ]
      ],
      resize_keyboard: true,
      one_time_keyboard: true
    };

    await sendMessage(chatId, welcomeText, contactKeyboard);
    return;
  }

  // 3. /setadmin buyrug'i
  if (text === '/setadmin') {
    config.admin_chat_id = chatId;
    saveConfig();
    await sendMessage(chatId, `✅ <b>Siz bosh administrator sifatida muvaffaqiyatli biriktirildingiz!</b>\nChat ID: <code>${chatId}</code>\n\nEndi barcha to'lov cheklari va muhim hisobotlar aynan shu profilingizga yuboriladi.`);
    return;
  }

  // 4. Boshqa har qanday matnli xabar uchun
  const authorizedUser = getAuthorizedUser(chatId);
  if (authorizedUser) {
    if (!text) return;
    try {
      await telegramRequest('sendChatAction', { chat_id: chatId, action: 'typing' }).catch(() => {});
      const aiReply = await forwardToN8n(text, chatId, authorizedUser);
      await sendMessage(chatId, aiReply || 'Savolingiz qabul qilindi.');
    } catch (err) {
      console.error('❌ n8n apex-chat xatosi:', err.message);
      await sendMessage(chatId, '⚠️ AI maslahatchi hozircha band yoki n8n <code>apex-chat</code> webhook hali faollashtirilmagan. Iltimos, birozdan so\'ng qayta yozing yoki pastdagi ilovadan foydalaning.');
    }
    return;
  }

  // Agar yangi foydalanuvchi bo'lsa -> birinchi marta telefon raqamini so'rash
  await sendMessage(chatId, `Iltimos, tizimga kirish uchun pastdagi <b>"📱 Telefon raqamni yuborish"</b> tugmasini bosing:`, {
    keyboard: [
      [{ text: '📱 Telefon raqamni yuborish (Kirish)', request_contact: true }]
    ],
    resize_keyboard: true,
    one_time_keyboard: true
  });
}

async function start() {
  loadConfig();
  console.log('🤖 Apex Academy Xavfsiz Bot Controller ishga tushmoqda...');
  if (!config.bot_token) {
    console.error('❌ bot_config.json da bot_token topilmadi.');
    return;
  }

  try {
    await telegramRequest('deleteWebhook');
  } catch (e) {}

  const me = await telegramRequest('getMe');
  if (me.ok) {
    console.log(`✅ Bot faol: @${me.result.username} (${me.result.first_name})`);
    console.log('🚀 Xavfsiz kontakt va To\'lov cheklarini tasdiqlash tizimi ishlamoqda...');
    pollUpdates();
  } else {
    console.error('❌ Bot token noto\'g\'ri:', me.description);
  }
}

start();
