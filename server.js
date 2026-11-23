const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');
const https = require('https');

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = __dirname;
const CONFIG_PATH = path.join(__dirname, 'bot_config.json');
const TEACHERS_PATH = path.join(__dirname, 'teachers.json');
const GROUPS_PATH = path.join(__dirname, 'groups.json');
const LEADS_PATH = path.join(__dirname, 'leads.json');
const ATTENDANCE_PATH = path.join(__dirname, 'attendance.json');
const RECEIPTS_DIR = path.join(__dirname, 'receipts');
const MOCK_PATH = path.join(__dirname, 'mock_tests.json');
const COURSES_PATH = path.join(__dirname, 'courses.json');
const MOCK_CONFIG_PATH = path.join(__dirname, 'mock_config.json');

if (!fs.existsSync(RECEIPTS_DIR)) {
  fs.mkdirSync(RECEIPTS_DIR, { recursive: true });
}

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

function getConfig() {
  let fileCfg = {};
  if (fs.existsSync(CONFIG_PATH)) {
    try {
      fileCfg = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
    } catch (e) {}
  }
  return {
    bot_token: process.env.BOT_TOKEN || fileCfg.bot_token || '',
    web_app_url: process.env.WEB_APP_URL || (process.env.RENDER_EXTERNAL_URL ? process.env.RENDER_EXTERNAL_URL : null) || fileCfg.web_app_url || '',
    admin_chat_id: process.env.ADMIN_CHAT_ID ? Number(process.env.ADMIN_CHAT_ID) : (fileCfg.admin_chat_id || null),
    google_sheet_url: process.env.GOOGLE_SHEET_URL || fileCfg.google_sheet_url || ''
  };
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
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
}

// Telegram Bot API orqali xabar yuborish yordamchisi
function sendTelegramMessage(chatId, text, replyMarkup = null) {
  const cfg = getConfig();
  if (!cfg.bot_token || !chatId) return Promise.resolve(null);

  const payload = JSON.stringify({
    chat_id: chatId,
    text: text,
    parse_mode: 'HTML',
    reply_markup: replyMarkup || undefined
  });

  return new Promise((resolve) => {
    const req = https.request({
      hostname: 'api.telegram.org',
      port: 443,
      path: `/bot${cfg.bot_token}/sendMessage`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      }
    }, res => {
      let b = '';
      res.on('data', c => b += c);
      res.on('end', () => {
        try { resolve(JSON.parse(b)); } catch (e) { resolve(null); }
      });
    });
    req.on('error', () => resolve(null));
    req.write(payload);
    req.end();
  });
}

// Telegram Bot API orqali rasm yuborish (multipart/form-data)
function sendTelegramPhoto(chatId, imageBuffer, caption, replyMarkup = null) {
  const cfg = getConfig();
  if (!cfg.bot_token || !chatId) return Promise.resolve(null);

  const boundary = '----WebKitFormBoundary' + Math.random().toString(36).substring(2);
  const crlf = '\r\n';
  const parts = [];

  // chat_id
  parts.push(Buffer.from(`--${boundary}${crlf}Content-Disposition: form-data; name="chat_id"${crlf}${crlf}${chatId}${crlf}`));

  // caption
  if (caption) {
    parts.push(Buffer.from(`--${boundary}${crlf}Content-Disposition: form-data; name="caption"${crlf}${crlf}${caption}${crlf}`));
    parts.push(Buffer.from(`--${boundary}${crlf}Content-Disposition: form-data; name="parse_mode"${crlf}${crlf}HTML${crlf}`));
  }

  // reply_markup
  if (replyMarkup) {
    parts.push(Buffer.from(`--${boundary}${crlf}Content-Disposition: form-data; name="reply_markup"${crlf}${crlf}${JSON.stringify(replyMarkup)}${crlf}`));
  }

  // photo (binary file)
  parts.push(Buffer.from(`--${boundary}${crlf}Content-Disposition: form-data; name="photo"; filename="receipt.jpg"${crlf}Content-Type: image/jpeg${crlf}${crlf}`));
  parts.push(imageBuffer);
  parts.push(Buffer.from(`${crlf}--${boundary}--${crlf}`));

  const fullPayload = Buffer.concat(parts);

  return new Promise((resolve) => {
    const req = https.request({
      hostname: 'api.telegram.org',
      port: 443,
      path: `/bot${cfg.bot_token}/sendPhoto`,
      method: 'POST',
      headers: {
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Content-Length': fullPayload.length
      }
    }, res => {
      let b = '';
      res.on('data', c => b += c);
      res.on('end', () => {
        try { resolve(JSON.parse(b)); } catch (e) { resolve(null); }
      });
    });
    req.on('error', () => resolve(null));
    req.write(fullPayload);
    req.end();
  });
}

// Bosh adminga bildirishnoma yuborish
function notifyAdmin(text, replyMarkup = null) {
  const cfg = getConfig();
  let adminChatId = cfg.admin_chat_id || cfg.last_admin_chat_id;
  if (!adminChatId) {
    const users = loadJSON(path.join(__dirname, 'users.json'), {});
    for (const p in users) {
      if (p.includes('959011445') || (users[p].role && users[p].role.toLowerCase().includes('admin'))) {
        adminChatId = users[p].chatId;
        break;
      }
    }
  }
  if (adminChatId) {
    return sendTelegramMessage(adminChatId, text, replyMarkup);
  }
  return Promise.resolve(null);
}

// Bosh adminga rasmli bildirishnoma yuborish
function notifyAdminPhoto(imageBuffer, caption, replyMarkup = null) {
  const cfg = getConfig();
  let adminChatId = cfg.admin_chat_id || cfg.last_admin_chat_id;
  if (!adminChatId) {
    const users = loadJSON(path.join(__dirname, 'users.json'), {});
    for (const p in users) {
      if (p.includes('959011445') || (users[p].role && users[p].role.toLowerCase().includes('admin'))) {
        adminChatId = users[p].chatId;
        break;
      }
    }
  }
  if (adminChatId) {
    if (imageBuffer) {
      return sendTelegramPhoto(adminChatId, imageBuffer, caption, replyMarkup);
    }
    return sendTelegramMessage(adminChatId, caption, replyMarkup);
  }
  return Promise.resolve(null);
}

const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;

  // 1. Rolni tekshirish: GET /api/check-role?phone=...
  if (req.method === 'GET' && pathname === '/api/check-role') {
    const rawPhone = parsedUrl.query.phone || '';
    const phoneClean = cleanPhone(rawPhone);
    const teachers = loadJSON(TEACHERS_PATH);
    const found = teachers.find(t => cleanPhone(t.phone) === phoneClean);

    res.writeHead(200, { 'Content-Type': 'application/json' });
    if (found) {
      const isAdmin = found.role.toLowerCase().includes('admin') || cleanPhone(found.phone).includes('959011445');
      res.end(JSON.stringify({
        success: true,
        isTeacher: true,
        isAdmin: isAdmin,
        teacher: {
          id: found.id,
          name: found.name,
          phone: found.phone,
          role: found.role,
          assignedCourse: found.assignedCourse || 'IELTS Intensive',
          group: found.group
        }
      }));
    } else {
      res.end(JSON.stringify({ success: true, isTeacher: false, role: 'student' }));
    }
    return;
  }

  // 2. Guruhlar ro'yxati: GET /api/groups?phone=...
  if (req.method === 'GET' && pathname === '/api/groups') {
    const rawPhone = parsedUrl.query.phone || '';
    const phoneClean = cleanPhone(rawPhone);
    const teachers = loadJSON(TEACHERS_PATH);
    const currentTeacher = teachers.find(t => cleanPhone(t.phone) === phoneClean);

    let allGroups = loadJSON(GROUPS_PATH);
    if (currentTeacher && !currentTeacher.role.toLowerCase().includes('admin') && !phoneClean.includes('959011445')) {
      allGroups = allGroups.filter(g => cleanPhone(g.teacherPhone) === phoneClean);
    }

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, groups: allGroups }));
    return;
  }

  // 3. Yangi Guruh Ochish: POST /api/groups/add
  if (req.method === 'POST' && pathname === '/api/groups/add') {
    let body = '';
    req.on('data', chunk => body += chunk.toString());
    req.on('end', () => {
      try {
        const { name, course, days, time, teacherPhone, teacherName } = JSON.parse(body);
        if (!name) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, message: 'Guruh nomi talab qilinadi' }));
          return;
        }

        const groups = loadJSON(GROUPS_PATH);
        const newGroup = {
          id: Date.now(),
          name: name.trim(),
          course: course || 'IELTS Intensive',
          teacherPhone: teacherPhone || '',
          teacherName: teacherName || 'Ustoz',
          days: days || 'Dush-Chor-Jum',
          time: time || '18:30 - 20:30',
          students: []
        };

        groups.push(newGroup);
        saveJSON(GROUPS_PATH, groups);

        console.log('👥 Yangi guruh ochildi:', newGroup.name, `(${newGroup.teacherName})`);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, group: newGroup }));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: err.message }));
      }
    });
    return;
  }

  // 4. Guruhni o'chirish: DELETE /api/groups/:id
  if (req.method === 'DELETE' && pathname.startsWith('/api/groups/')) {
    const id = parseInt(pathname.split('/').pop());
    let groups = loadJSON(GROUPS_PATH);
    groups = groups.filter(g => g.id !== id);
    saveJSON(GROUPS_PATH, groups);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, message: 'Guruh o\'chirildi' }));
    return;
  }

  // 5. O'qituvchilar ro'yxati: GET /api/teachers
  if (req.method === 'GET' && pathname === '/api/teachers') {
    const teachers = loadJSON(TEACHERS_PATH);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, teachers }));
    return;
  }

  // 6. Yangi o'qituvchi qo'shish: POST /api/teachers/add
  if (req.method === 'POST' && pathname === '/api/teachers/add') {
    let body = '';
    req.on('data', chunk => body += chunk.toString());
    req.on('end', () => {
      try {
        const { name, phone, role, assignedCourse, group } = JSON.parse(body);
        if (!name || !phone) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, message: 'Ism va telefon raqam talab qilinadi' }));
          return;
        }

        const teachers = loadJSON(TEACHERS_PATH);
        const cleanNewPhone = cleanPhone(phone);
        const existing = teachers.find(t => cleanPhone(t.phone) === cleanNewPhone);

        if (existing) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, message: 'Bu telefon raqamli o\'qituvchi allaqachon mavjud!' }));
          return;
        }

        let formattedPhone = phone.trim();
        if (!formattedPhone.startsWith('+')) {
          formattedPhone = '+' + formattedPhone;
        }

        const newTeacher = {
          id: Date.now(),
          name: name.trim(),
          phone: formattedPhone,
          role: role?.trim() || 'Ustoz',
          assignedCourse: assignedCourse?.trim() || 'IELTS Intensive',
          group: group?.trim() || 'Yangi guruh'
        };

        teachers.push(newTeacher);
        saveJSON(TEACHERS_PATH, teachers);

        console.log('👨‍🏫 Yangi o\'qituvchi qo\'shildi:', newTeacher);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, teacher: newTeacher }));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: err.message }));
      }
    });
    return;
  }

  // 7. O'qituvchini o'chirish: DELETE /api/teachers/:id
  if (req.method === 'DELETE' && pathname.startsWith('/api/teachers/')) {
    const id = parseInt(pathname.split('/').pop());
    let teachers = loadJSON(TEACHERS_PATH);
    teachers = teachers.filter(t => t.id !== id);
    saveJSON(TEACHERS_PATH, teachers);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, message: 'O\'qituvchi o\'chirildi' }));
    return;
  }

  // 8. Yangi Arizalarni olish: GET /api/leads?phone=...
  if (req.method === 'GET' && pathname === '/api/leads') {
    const rawPhone = parsedUrl.query.phone || '';
    const phoneClean = cleanPhone(rawPhone);
    const teachers = loadJSON(TEACHERS_PATH);
    const currentTeacher = teachers.find(t => cleanPhone(t.phone) === phoneClean);

    let leads = loadJSON(LEADS_PATH).reverse();

    if (currentTeacher && !currentTeacher.role.toLowerCase().includes('admin') && !phoneClean.includes('959011445')) {
      const assigned = (currentTeacher.assignedCourse || '').toLowerCase();
      leads = leads.filter(l => {
        const leadCourse = (l.course || '').toLowerCase();
        if (assigned.includes('ielts') && (leadCourse.includes('ielts') || leadCourse.includes('sinov'))) return true;
        if (assigned.includes('english') && (leadCourse.includes('english') || leadCourse.includes('ingliz'))) return true;
        if (assigned.includes('front') && (leadCourse.includes('front') || leadCourse.includes('react') || leadCourse.includes('it'))) return true;
        if (assigned.includes('matem') && leadCourse.includes('matem')) return true;
        return leadCourse.includes(assigned);
      });
    }

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, leads }));
    return;
  }

  // 9. Davomatni saqlash va Telegram orqali Ota-onaga Xabar Yuborish (Masterplan 1 & 2-bandlar): POST /api/attendance
  if (req.method === 'POST' && pathname === '/api/attendance') {
    let body = '';
    req.on('data', chunk => body += chunk.toString());
    req.on('end', async () => {
      try {
        const record = JSON.parse(body);
        let records = loadJSON(ATTENDANCE_PATH);
        records.push({ ...record, savedAt: new Date().toISOString() });
        saveJSON(ATTENDANCE_PATH, records);

        // Darsga kelmagan (absent) o'quvchilar ota-onasiga Telegram xabarnoma (0 so'm, SMS siz!)
        if (record.absentStudents && Array.isArray(record.absentStudents)) {
          const users = loadJSON(path.join(__dirname, 'users.json'), {});
          for (const s of record.absentStudents) {
            const studentPhoneClean = cleanPhone(s.phone);
            const targetChatId = s.chatId || (users[studentPhoneClean] ? users[studentPhoneClean].chatId : null);
            console.log(`⚠️ Davomat xabarnomasi: ${s.name} (${record.groupName}) darsga kelmadi.`);
            if (targetChatId) {
              const alertMsg = `
⚠️ <b>Darsga qatnashmadi xabarnomasi</b>

Hurmatli ota-ona!
Farzandingiz <b>${s.name}</b> bugun <b>${record.groupName || 'dars'}</b> mashg'ulotiga kelmadi.

<i>Ma'lumot uchun markaz ma'muriyati bilan bog'lanishingiz mumkin: +998 95 901 14 45
— Apex Academy</i>
              `.trim();
              await sendTelegramMessage(targetChatId, alertMsg);
            }
          }
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, message: 'Davomat saqlandi va xabarnomalar yuborildi' }));
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: e.message }));
      }
    });
    return;
  }

  // 10. To'lov chekini yuklash va Adminga yuborish (Masterplan 4-band): POST /api/receipts/upload
  if (req.method === 'POST' && pathname === '/api/receipts/upload') {
    let body = '';
    req.on('data', chunk => body += chunk.toString());
    req.on('end', async () => {
      try {
        const { studentName, studentPhone, course, amount, receiptImage, chatId } = JSON.parse(body);
        
        const receiptId = 'CHK-' + Date.now().toString().slice(-6);
        let imageBuffer = null;
        let imageUrl = null;

        // Base64 rasmni faylga va Bufferga aylantirish
        if (receiptImage && receiptImage.includes('base64,')) {
          try {
            const base64Data = receiptImage.split('base64,')[1];
            imageBuffer = Buffer.from(base64Data, 'base64');
            const fileName = `${receiptId}.jpg`;
            const filePath = path.join(RECEIPTS_DIR, fileName);
            fs.writeFileSync(filePath, imageBuffer);
            imageUrl = `/receipts/${fileName}`;
          } catch (imgErr) {
            console.error('Rasm saqlashda xato:', imgErr);
          }
        }

        const receiptData = {
          receiptId,
          studentName: studentName || 'Noma\'lum o\'quvchi',
          studentPhone: studentPhone || '',
          course: course || 'IELTS Intensive',
          amount: amount || '850 000 so\'m',
          imageUrl: imageUrl || null,
          chatId: chatId || null,
          status: 'Kutilmoqda',
          createdAt: new Date().toISOString()
        };

        const receiptsFile = path.join(__dirname, 'receipts.json');
        let receipts = loadJSON(receiptsFile);
        receipts.push(receiptData);
        saveJSON(receiptsFile, receipts);

        console.log(`🧾 Yangi to'lov cheki keldi: ${receiptId} (${receiptData.studentName})`);

        // Bosh Adminga bildirishnoma va tasdiqlash tugmalarini yuborish
        const adminText = `
🧾 <b>Yangi To'lov Cheki Keldi!</b> (#${receiptId})

👤 <b>O'quvchi:</b> ${receiptData.studentName}
📞 <b>Telefon:</b> ${receiptData.studentPhone}
📚 <b>Kurs:</b> ${receiptData.course}
💰 <b>Summa:</b> ${receiptData.amount}
⏰ <b>Sana:</b> ${new Date().toLocaleDateString('uz-UZ')} ${new Date().toLocaleTimeString('uz-UZ')}

<i>Admin, iltimos chekni tekshirib tasdiqlang yoki rad eting:</i>
        `.trim();

        const cfg = getConfig();
        const inlineKeyboard = [];

        if (imageUrl && cfg.web_app_url) {
          inlineKeyboard.push([
            { text: '🔍 Chekni To\'liq Ko\'rish (Veb)', url: `${cfg.web_app_url}${imageUrl}` }
          ]);
        }

        inlineKeyboard.push([
          { text: 'Tasdiqlash ✅', callback_data: `approve_receipt_${receiptId}` },
          { text: 'Rad etish ❌', callback_data: `reject_receipt_${receiptId}` }
        ]);

        const replyMarkup = { inline_keyboard: inlineKeyboard };

        if (imageBuffer) {
          await notifyAdminPhoto(imageBuffer, adminText, replyMarkup);
        } else {
          await notifyAdmin(adminText, replyMarkup);
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, receiptId, message: 'Chek adminga tekshirish uchun yuborildi' }));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: err.message }));
      }
    });
    return;
  }

  // 11. Mock Test Avtomatizatsiyasi (Masterplan 9-band): POST /api/mock/register
  if (req.method === 'POST' && pathname === '/api/mock/register') {
    let body = '';
    req.on('data', chunk => body += chunk.toString());
    req.on('end', async () => {
      try {
        const { studentName, studentPhone, shift, date } = JSON.parse(body);
        if (!studentName || !studentPhone) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, message: 'Ism va telefon kerak' }));
          return;
        }

        let mockRegistrations = loadJSON(MOCK_PATH);
        const ticketNumber = '#MOCK-' + (mockRegistrations.length + 1).toString().padStart(3, '0');

        const newReg = {
          ticketNumber,
          studentName,
          studentPhone,
          shift: shift || '1-smena (10:00 - 13:00)',
          date: date || 'Har shanba',
          status: 'Tasdiqlandi',
          registeredAt: new Date().toISOString()
        };

        mockRegistrations.push(newReg);
        saveJSON(MOCK_PATH, mockRegistrations);

        // Google Sheets ga yuborish
        const sheetUrl = getConfig().google_sheet_url;
        if (sheetUrl) {
          fetch(sheetUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              name: studentName,
              phone: studentPhone,
              course: `Mock Exam (${ticketNumber})`,
              preferredTime: shift
            })
          }).catch(() => {});
        }

        console.log(`🎟 Mock Test chiptasi berildi: ${ticketNumber} (${studentName})`);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          success: true,
          ticketNumber,
          message: 'Mock testga muvaffaqiyatli yozildingiz!'
        }));
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: e.message }));
      }
    });
    return;
  }

  // 12. Mock Test Bandlik ko'rsatkichlari & Holati: GET /api/mock/slots
  if (req.method === 'GET' && pathname === '/api/mock/slots') {
    const mockConfig = loadJSON(MOCK_CONFIG_PATH) || { isOpen: false, shift1Slots: 15, shift2Slots: 10 };
    const mockRegistrations = loadJSON(MOCK_PATH);
    const shift1Slots = mockConfig.shift1Slots || 15;
    const shift2Slots = mockConfig.shift2Slots || 10;
    const shift1Count = mockRegistrations.filter(r => r.shift && r.shift.includes('1-smena')).length;
    const shift2Count = mockRegistrations.filter(r => r.shift && r.shift.includes('2-smena')).length;

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      success: true,
      isOpen: !!mockConfig.isOpen,
      title: mockConfig.title || "Rasmiy IELTS Mock Imtihoni",
      date: mockConfig.date || "Har shanba",
      price: mockConfig.price || "50 000 so'm",
      description: mockConfig.description || "Har shanba xalqaro standartda 4 ta bo'lim (L, R, W, S) bo'yicha imtihon va tezkor baholash.",
      shift1: { name: mockConfig.shift1Name || '1-smena (10:00 - 13:00)', total: shift1Slots, booked: shift1Count, remaining: Math.max(0, shift1Slots - shift1Count) },
      shift2: { name: mockConfig.shift2Name || '2-smena (14:00 - 17:00)', total: shift2Slots, booked: shift2Count, remaining: Math.max(0, shift2Slots - shift2Count) }
    }));
    return;
  }

  // 12.1 Mock Test E'lon Berish & Ochish (Oyna orqali): POST /api/mock/publish
  if (req.method === 'POST' && pathname === '/api/mock/publish') {
    let body = '';
    req.on('data', chunk => body += chunk.toString());
    req.on('end', async () => {
      try {
        const data = JSON.parse(body);
        let mockConfig = loadJSON(MOCK_CONFIG_PATH) || {};
        mockConfig.isOpen = true;
        mockConfig.title = data.title || "Rasmiy IELTS Mock Imtihoni";
        mockConfig.date = data.date || "Har shanba";
        mockConfig.price = data.price || "50 000 so'm";
        mockConfig.description = data.description || "Har shanba 4 ta bo'lim bo'yicha imtihon.";
        mockConfig.shift1Name = data.shift1Name || "1-smena (10:00 - 13:00)";
        mockConfig.shift1Slots = parseInt(data.shift1Slots, 10) || 15;
        mockConfig.shift2Name = data.shift2Name || "2-smena (14:00 - 17:00)";
        mockConfig.shift2Slots = parseInt(data.shift2Slots, 10) || 10;
        mockConfig.publishedAt = new Date().toISOString();
        saveJSON(MOCK_CONFIG_PATH, mockConfig);

        console.log(`📢 Yangi Mock Test e'lon qilindi: ${mockConfig.title} (${mockConfig.date})`);

        // Telegram kanalga marketing e'lonini yuborish
        if (data.sendTelegram) {
          const cfg = getConfig();
          const targetChannel = cfg.channel_username || '@Apex_Academy_Official';
          const postText = `
🎯 <b>DIQQAT, NAVBATDAGI RASMIY MOCK EXAM E'LON QILINDI!</b> 🚀

📚 <b>Imtihon:</b> ${mockConfig.title}
📅 <b>Sana:</b> ${mockConfig.date}
💰 <b>To'lov:</b> ${mockConfig.price}
📝 <b>Tavsif:</b> ${mockConfig.description}

⏰ <b>1-smena:</b> ${mockConfig.shift1Name} (${mockConfig.shift1Slots} ta o'rin)
⏰ <b>2-smena:</b> ${mockConfig.shift2Name} (${mockConfig.shift2Slots} ta o'rin)

⚡ <i>Joylar soni cheklangan! Chipta olish uchun quyidagi tugmani bosing:</i>
          `.trim();

          const replyMarkup = {
            inline_keyboard: [
              [{ text: '🎟 Mock Testga Yozilish (Chipta Olish)', url: `https://t.me/${cfg.bot_username || 'eduwithn8n_bot'}?start=mock` }]
            ]
          };

          try {
            await sendTelegramMessage(targetChannel, postText, replyMarkup);
          } catch (te) {
            console.error('Kanalga post yuborishda xato:', te);
          }
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, message: 'Mock test muvaffaqiyatli e\'lon qilindi!', mockConfig }));
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, message: e.message }));
      }
    });
    return;
  }

  // 12.2 Mock Test Holatini boshqarish (Ochish / Yopish): POST /api/mock/toggle
  if (req.method === 'POST' && pathname === '/api/mock/toggle') {
    let body = '';
    req.on('data', chunk => body += chunk.toString());
    req.on('end', () => {
      try {
        const data = JSON.parse(body);
        let mockConfig = loadJSON(MOCK_CONFIG_PATH) || {};
        mockConfig.isOpen = !!data.isOpen;
        if (data.title) mockConfig.title = data.title;
        if (data.description) mockConfig.description = data.description;
        if (data.date) mockConfig.date = data.date;
        if (data.shift1Slots) mockConfig.shift1Slots = parseInt(data.shift1Slots, 10);
        if (data.shift2Slots) mockConfig.shift2Slots = parseInt(data.shift2Slots, 10);
        saveJSON(MOCK_CONFIG_PATH, mockConfig);
        console.log(`🎯 Mock Test holati o'zgartirildi: ${mockConfig.isOpen ? "OCHIQ (Faol)" : "YOPIQ (Yashirin)"}`);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, mockConfig }));
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, message: 'Xatolik yuz berdi' }));
      }
    });
    return;
  }

  // 12.2 Kurslar ro'yxati: GET /api/courses
  if (req.method === 'GET' && pathname === '/api/courses') {
    const courses = loadJSON(COURSES_PATH) || [];
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, courses }));
    return;
  }

  // 12.3 Yangi kurs qo'shish: POST /api/courses/add
  if (req.method === 'POST' && pathname === '/api/courses/add') {
    let body = '';
    req.on('data', chunk => body += chunk.toString());
    req.on('end', () => {
      try {
        const newCourse = JSON.parse(body);
        let courses = loadJSON(COURSES_PATH) || [];
        newCourse.id = Date.now();
        newCourse.createdAt = new Date().toISOString();
        courses.push(newCourse);
        saveJSON(COURSES_PATH, courses);
        console.log(`📚 Yangi kurs qo'shildi: ${newCourse.name}`);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, course: newCourse }));
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, message: 'Kurs qo\'shishda xatolik' }));
      }
    });
    return;
  }

  // 12.4 Kursni o'chirish: POST /api/courses/delete
  if (req.method === 'POST' && pathname === '/api/courses/delete') {
    let body = '';
    req.on('data', chunk => body += chunk.toString());
    req.on('end', () => {
      try {
        const { id } = JSON.parse(body);
        let courses = loadJSON(COURSES_PATH) || [];
        courses = courses.filter(c => c.id != id);
        saveJSON(COURSES_PATH, courses);
        console.log(`🗑 Kurs o'chirildi (ID: ${id})`);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true }));
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, message: 'O\'chirishda xatolik' }));
      }
    });
    return;
  }

  // 13. Auto-SMM: AI Marketing Posti Generator (Masterplan 8-band): POST /api/smm/generate
  if (req.method === 'POST' && pathname === '/api/smm/generate') {
    let body = '';
    req.on('data', chunk => body += chunk.toString());
    req.on('end', () => {
      try {
        const { topic, course, teacher, days, time, discount } = JSON.parse(body);
        
        // Jozibali marketing post shabloni
        const marketingPost = `
🔥 <b>DIQQAT, YANGI GURUH OCHILMOQDA!</b> 🚀

<b>Apex Academy</b>da yangi <b>${course || 'IELTS Intensive'}</b> guruhi uchun qabul boshlandi!

👨‍🏫 <b>Ustoz:</b> ${teacher || 'Malakali ustoz'}
📅 <b>Dars kunlari:</b> ${days || 'Dushanba, Chorshanba, Juma'}
⏰ <b>Vaqti:</b> ${time || '18:30 - 20:30'}
🎁 <b>Maxsus taklif:</b> ${discount || 'Dastlabki 5 ta o\'quvchiga 15% chegirma!'}

⚡ <i>Birinchi sinov darsi — MUTLAQO BEPUL!</i>
Shoshiling, guruhda faqat 10 ta joy bor!

👉 Bepul joy band qilish uchun quyidagi tugmani bosing:
        `;

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, postText: marketingPost.trim() }));
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: e.message }));
      }
    });
    return;
  }

  // 14. Kanalga Post Chiqarish (Masterplan 8-band): POST /api/smm/post
  if (req.method === 'POST' && pathname === '/api/smm/post') {
    let body = '';
    req.on('data', chunk => body += chunk.toString());
    req.on('end', async () => {
      try {
        const { postText, channelUsername } = JSON.parse(body);
        const cfg = getConfig();
        const targetChannel = channelUsername || cfg.channel_username || '@apex_academy_news';

        const replyMarkup = {
          inline_keyboard: [
            [{ text: '✍️ Kursga Bepul Yozilish', url: `https://t.me/${cfg.bot_username || 'eduwithn8n_bot'}?start=enroll` }]
          ]
        };

        const result = await sendTelegramMessage(targetChannel, postText, replyMarkup);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, result, message: 'Post kanalga yuborildi!' }));
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: e.message }));
      }
    });
    return;
  }

  // 15. Direktor uchun Haqiqiy Oylik Hisobot (Masterplan 7-band): GET /api/director/report
  if (req.method === 'GET' && pathname === '/api/director/report') {
    const leads = loadJSON(LEADS_PATH) || [];
    const groups = loadJSON(GROUPS_PATH) || [];
    const mock = loadJSON(MOCK_PATH) || [];
    const receipts = loadJSON(path.join(__dirname, 'receipts.json')) || [];

    const approvedReceipts = receipts.filter(r => r.status === 'Tasdiqlandi');
    let totalRevenue = 0;
    approvedReceipts.forEach(r => {
      const amt = parseInt(String(r.amount).replace(/\D/g, ''), 10);
      if (!isNaN(amt)) totalRevenue += amt;
    });

    const hasData = (leads.length > 0 || groups.length > 0 || approvedReceipts.length > 0 || mock.length > 0);
    let summaryText = '';
    if (!hasData) {
      summaryText = `📊 <b>O'quv Markazi Boshqaruv Hisoboti:</b>\nHozircha tizimda faol o'zgarishlar mavjud emas. Yangi arizalar kelib tushganda yoki guruhlar ochilganda haqiqiy ko'rsatkichlar shu yerda aks etadi.`;
    } else {
      summaryText = `
📊 <b>O'quv Markazi Haqiqiy Ko'rsatkichlari:</b>
1. <b>Arizalar (Lidlar):</b> Jami ${leads.length} ta ariza qabul qilindi.
2. <b>Moliya:</b> ${approvedReceipts.length} ta to'lov tasdiqlandi (Jami tushum: ${totalRevenue.toLocaleString('uz-UZ')} so'm).
3. <b>Faol Guruhlar:</b> ${groups.length} ta guruh shakllantirildi.
4. <b>Mock Imtihonlar:</b> ${mock.length} ta nomzod ro'yxatdan o'tdi.
      `.trim();
    }

    const report = {
      period: 'Joriy oy',
      totalLeads: leads.length,
      activeGroups: groups.length,
      mockAttendees: mock.length,
      paidStudents: approvedReceipts.length,
      estimatedRevenue: `${totalRevenue.toLocaleString('uz-UZ')} so'm`,
      aiSummary: summaryText
    };

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, report }));
    return;
  }

  // 16. Sinov darsiga yozilish: POST /api/enroll
  if (req.method === 'POST' && pathname === '/api/enroll') {
    let body = '';
    req.on('data', chunk => body += chunk.toString());
    req.on('end', async () => {
      try {
        const data = JSON.parse(body);
        console.log('📌 Yangi ariza keldi:', data);

        let leads = loadJSON(LEADS_PATH);
        leads.push({ ...data, receivedAt: new Date().toISOString() });
        saveJSON(LEADS_PATH, leads);

        const sheetUrl = getConfig().google_sheet_url;
        if (sheetUrl) {
          try {
            await fetch(sheetUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(data)
            });
          } catch (sheetErr) {}
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, message: 'Ariza muvaffaqiyatli qabul qilindi' }));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: err.message }));
      }
    });
    return;
  }

  // 17. Statik fayllar
  let reqPath = pathname;
  if (reqPath === '/' || reqPath === '') {
    reqPath = '/index.html';
  }

  const filePath = path.join(PUBLIC_DIR, reqPath);
  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, content) => {
    if (err) {
      if (err.code === 'ENOENT') {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('404 Sahifa topilmadi');
      } else {
        res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('500 Server xatosi');
      }
      return;
    }

    res.writeHead(200, { 'Content-Type': contentType });
    res.end(content);
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`===============================================`);
  console.log(`🚀 Apex Academy Master Tizim Serveri Ishga Tushdi!`);
  console.log(`👉 Lokal manzil: http://localhost:${PORT}`);
  console.log(`===============================================`);
});
