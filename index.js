/**
 * Apex Academy - 24/7 Cloud Runner (Render, Railway, Koyeb, VPS)
 * Bir vaqtning o'zida Web App serverini va Telegram Botni bitta jarayonda yurgizadi.
 */
const https = require('https');
const fs = require('fs');
const path = require('path');

console.log('🚀 Apex Academy 24/7 Cloud Runner ishga tushmoqda...');

const configPath = path.join(__dirname, 'bot_config.json');
let config = {};
if (fs.existsSync(configPath)) {
  try {
    config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  } catch (e) {}
}

// Environment variables or existing config
const botToken = process.env.BOT_TOKEN || config.bot_token || '';
const publicUrl = process.env.WEB_APP_URL || 
                  (process.env.RENDER_EXTERNAL_URL ? process.env.RENDER_EXTERNAL_URL : null) ||
                  (process.env.RAILWAY_STATIC_URL ? `https://${process.env.RAILWAY_STATIC_URL}` : null) ||
                  config.web_app_url;

if (botToken) config.bot_token = botToken;
if (publicUrl) config.web_app_url = publicUrl.replace(/\/$/, '');
config.admin_chat_id = process.env.ADMIN_CHAT_ID ? Number(process.env.ADMIN_CHAT_ID) : (config.admin_chat_id || 5565743745);
config.google_sheet_url = process.env.GOOGLE_SHEET_URL || config.google_sheet_url || 'https://script.google.com/macros/s/AKfycbzgm2zwOCtb-WakWg2vSPTUQrHGrHdFMTgi9QYVsHtSHMvCVn9CgXdgX3HiG3fAwS5J2Q/exec';

try {
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8');
} catch (e) {}

// Telegram Bot Menu Button ni avtomatik yangilash
if (botToken && publicUrl) {
  const cleanUrl = publicUrl.replace(/\/$/, '');
  console.log(`🌐 Doimiy Web App URL aniqlandi: ${cleanUrl}`);
  const payload = JSON.stringify({
    menu_button: {
      type: 'web_app',
      text: '📱 Apex Ilova',
      web_app: { url: cleanUrl }
    }
  });
  const req = https.request({
    hostname: 'api.telegram.org',
    port: 443,
    path: `/bot${botToken}/setChatMenuButton`,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(payload)
    }
  }, (res) => {
    console.log(`⚡ Telegram Bot Menu Button muvaffaqiyatli bog'landi! (Status: ${res.statusCode})`);
  });
  req.on('error', (err) => console.error('Telegram menu yangilashda xato:', err.message));
  req.write(payload);
  req.end();
}

// 1. Web App Serverini ishga tushirish (server.js)
require('./server.js');

// 2. Telegram Bot Controllerini ishga tushirish (bot.js)
require('./bot.js');

console.log('✅ Apex Academy Web App va Telegram Bot 24/7 rejimda muvaffaqiyatli ishga tushdi!');
