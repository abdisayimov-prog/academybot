/**
 * Apex Academy — Yagona Doimiy Xotira va Google Sheets Sinxronizatsiya Moduli
 * Ma'lumotlarni tezkor lokal JSON faylda saqlaydi hamda Google Sheets bilan sinxronlaydi.
 * Render qayta yonganda barcha ma'lumotlar Google Sheets dan avtomatik tiklanadi.
 */
const fs = require('fs');
const path = require('path');

const DEFAULT_GOOGLE_SHEET_URL = 'https://script.google.com/macros/s/AKfycbzgm2zwOCtb-WakWg2vSPTUQrHGrHdFMTgi9QYVsHtSHMvCVn9CgXdgX3HiG3fAwS5J2Q/exec';
const CONFIG_PATH = path.join(__dirname, 'bot_config.json');

const STATE_FILES = {
  groups: 'groups.json',
  teachers: 'teachers.json',
  users: 'users.json',
  leads: 'leads.json',
  receipts: 'receipts.json',
  attendance: 'attendance.json',
  mock_config: 'mock_config.json',
  mock_tests: 'mock_tests.json'
};

let lastCoursesSyncAt = 0;
let lastSyncStatus = { ok: null, error: null, at: null, coursesCount: 0 };

function getConfig() {
  let fileCfg = {};
  if (fs.existsSync(CONFIG_PATH)) {
    try {
      fileCfg = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
    } catch (e) {}
  }
  return {
    bot_token: process.env.BOT_TOKEN || fileCfg.bot_token || '',
    bot_username: process.env.BOT_USERNAME || fileCfg.bot_username || 'eduwithn8n_bot',
    web_app_url: process.env.WEB_APP_URL || (process.env.RENDER_EXTERNAL_URL ? process.env.RENDER_EXTERNAL_URL : null) || fileCfg.web_app_url || '',
    admin_chat_id: process.env.ADMIN_CHAT_ID ? Number(process.env.ADMIN_CHAT_ID) : (fileCfg.admin_chat_id || 5565743745),
    channel_username: process.env.CHANNEL_USERNAME || fileCfg.channel_username || '',
    google_sheet_url: process.env.GOOGLE_SHEET_URL || fileCfg.google_sheet_url || DEFAULT_GOOGLE_SHEET_URL
  };
}

function saveConfig(updates = {}) {
  let fileCfg = {};
  if (fs.existsSync(CONFIG_PATH)) {
    try {
      fileCfg = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
    } catch (e) {}
  }
  const merged = { ...fileCfg, ...updates };
  try {
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(merged, null, 2), 'utf8');
  } catch (e) {}
  if (updates.channel_username !== undefined) {
    pushStateToSheets('settings', { channel_username: merged.channel_username || '' });
  }
  return merged;
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

function pushToSheets(payload) {
  const sheetUrl = getConfig().google_sheet_url;
  if (!sheetUrl) return Promise.resolve(false);
  return fetch(sheetUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  })
    .then(r => r.ok)
    .catch(() => false);
}

function pushStateToSheets(key, value) {
  return pushToSheets({ action: 'sync_state', key, value });
}

function saveJSON(filePath, data, syncKey = null) {
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
  } catch (e) {}
  if (syncKey) {
    pushStateToSheets(syncKey, data);
  }
}

async function syncAllFromSheets(force = false) {
  const now = Date.now();
  if (!force && now - lastCoursesSyncAt < 15000) return false;
  lastCoursesSyncAt = now;

  const sheetUrl = getConfig().google_sheet_url;
  if (!sheetUrl) return false;

  try {
    const res = await fetch(`${sheetUrl}?action=sync_all`, {
      redirect: 'follow',
      signal: AbortSignal.timeout(15000)
    });
    const text = await res.text();
    if (!text.trim().startsWith('{')) {
      lastSyncStatus = { ok: false, error: `Non-JSON (${res.status}): ${text.slice(0, 80)}`, at: new Date().toISOString(), coursesCount: 0 };
      return false; // Eski Apps Script HTML qaytarsa tizimni to'xtatmaslik
    }
    const data = JSON.parse(text);
    if (!data.success) {
      lastSyncStatus = { ok: false, error: 'data.success is false', at: new Date().toISOString(), coursesCount: 0 };
      return false;
    }

    // 1. Kurslar varag'idan kurslarni yangilash
    if (Array.isArray(data.courses)) {
      const coursesPath = path.join(__dirname, 'courses.json');
      fs.writeFileSync(coursesPath, JSON.stringify(data.courses, null, 2), 'utf8');
    }

    // 2. Barcha qolgan holatlarni tiklash
    if (data.state && typeof data.state === 'object') {
      for (const [key, filename] of Object.entries(STATE_FILES)) {
        if (data.state[key] !== undefined) {
          const targetPath = path.join(__dirname, filename);
          fs.writeFileSync(targetPath, JSON.stringify(data.state[key], null, 2), 'utf8');
        }
      }
      if (data.state.settings && data.state.settings.channel_username) {
        const cfg = getConfig();
        if (!cfg.channel_username) {
          let fileCfg = {};
          if (fs.existsSync(CONFIG_PATH)) {
            try { fileCfg = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8')); } catch (e) {}
          }
          fileCfg.channel_username = data.state.settings.channel_username;
          fs.writeFileSync(CONFIG_PATH, JSON.stringify(fileCfg, null, 2), 'utf8');
        }
      }
    }

    lastSyncStatus = { ok: true, error: null, at: new Date().toISOString(), coursesCount: (data.courses || []).length };
    console.log(`☁️ Google Sheets dan ma'lumotlar muvaffaqiyatli sinxronlandi (${(data.courses || []).length} ta kurs)`);
    return true;
  } catch (e) {
    lastSyncStatus = { ok: false, error: e.message, at: new Date().toISOString(), coursesCount: 0 };
    console.error('❌ syncAllFromSheets xato:', e.message);
    return false;
  }
}

async function syncCoursesOnly(force = false) {
  const now = Date.now();
  if (!force && now - lastCoursesSyncAt < 10000) return null;
  lastCoursesSyncAt = now;

  const sheetUrl = getConfig().google_sheet_url;
  if (!sheetUrl) return null;

  try {
    const res = await fetch(`${sheetUrl}?action=get_courses`, {
      redirect: 'follow',
      signal: AbortSignal.timeout(15000)
    });
    const text = await res.text();
    if (!text.trim().startsWith('{')) {
      lastSyncStatus = { ok: false, error: `get_courses non-JSON (${res.status}): ${text.slice(0, 80)}`, at: new Date().toISOString(), coursesCount: 0 };
      return null;
    }
    const data = JSON.parse(text);
    if (data.success && Array.isArray(data.courses)) {
      fs.writeFileSync(path.join(__dirname, 'courses.json'), JSON.stringify(data.courses, null, 2), 'utf8');
      lastSyncStatus = { ok: true, error: null, at: new Date().toISOString(), coursesCount: data.courses.length };
      return data.courses;
    }
  } catch (e) {
    lastSyncStatus = { ok: false, error: e.message, at: new Date().toISOString(), coursesCount: 0 };
    console.error('❌ syncCoursesOnly xato:', e.message);
  }
  return null;
}

function getSyncStatus() {
  return lastSyncStatus;
}

module.exports = {
  DEFAULT_GOOGLE_SHEET_URL,
  getConfig,
  saveConfig,
  cleanPhone,
  loadJSON,
  saveJSON,
  pushToSheets,
  pushStateToSheets,
  syncAllFromSheets,
  syncCoursesOnly,
  getSyncStatus
};
