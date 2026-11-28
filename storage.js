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

function normalizeCourseCategory(c) {
  const cat = String(c?.category || '').trim().toLowerCase();
  if (cat === 'english' || cat === 'it' || cat === 'exact') return cat;
  const hay = [c?.category, c?.badge, c?.name, c?.description].filter(Boolean).join(' ').toLowerCase();
  if (/ingliz|engl|english|ielts|cefr|beginner|elementary|pre-inter|intermediate|general/.test(hay)) return 'english';
  if (/\bit\b|dastur|front|back|python|react|web|java|kompyuter|smm|dizayn|cyber/.test(hay)) return 'it';
  if (/matem|fizik|exact|hisob|serfikat|sertifikat|kimyo|biolog|dtm/.test(hay)) return 'exact';
  return 'other';
}

function normalizeCourseList(list) {
  if (!Array.isArray(list)) return [];
  return list
    .map(c => ({ ...c, category: normalizeCourseCategory(c) }))
    .sort((a, b) => (Number(b.id) || 0) - (Number(a.id) || 0));
}

function normalizeChannelTarget(raw) {
  let ch = String(raw || '').trim();
  if (!ch) return '';
  ch = ch
    .replace(/^@?https?:\/\/(t\.me|telegram\.me)\//i, '')
    .replace(/^@?(t\.me|telegram\.me)\//i, '')
    .split(/[?#\s]/)[0]
    .replace(/\/+$/, '');
  if (!ch) return '';
  if (/^-?\d+$/.test(ch)) return ch;
  return ch.startsWith('@') ? ch : '@' + ch;
}

function getConfig() {
  let fileCfg = {};
  if (fs.existsSync(CONFIG_PATH)) {
    try {
      fileCfg = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
    } catch (e) {}
  }
  return {
    bot_token: (process.env.BOT_TOKEN || fileCfg.bot_token || '').trim(),
    bot_username: (process.env.BOT_USERNAME || fileCfg.bot_username || 'eduwithn8n_bot').trim(),
    web_app_url: (process.env.WEB_APP_URL || (process.env.RENDER_EXTERNAL_URL ? process.env.RENDER_EXTERNAL_URL : null) || fileCfg.web_app_url || '').trim(),
    admin_chat_id: process.env.ADMIN_CHAT_ID ? Number(process.env.ADMIN_CHAT_ID) : (fileCfg.admin_chat_id || 5565743745),
    channel_username: normalizeChannelTarget(process.env.CHANNEL_USERNAME || fileCfg.channel_username || ''),
    google_sheet_url: (process.env.GOOGLE_SHEET_URL || fileCfg.google_sheet_url || DEFAULT_GOOGLE_SHEET_URL).trim(),
    last_payment_reminder_date: fileCfg.last_payment_reminder_date || '',
    last_director_report_month: fileCfg.last_director_report_month || ''
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

async function pushToSheets(payload) {
  const sheetUrl = getConfig().google_sheet_url;
  const candidates = [sheetUrl];
  if (DEFAULT_GOOGLE_SHEET_URL && sheetUrl !== DEFAULT_GOOGLE_SHEET_URL) {
    candidates.push(DEFAULT_GOOGLE_SHEET_URL);
  }
  for (const base of candidates) {
    if (!base) continue;
    try {
      const r = await fetch(base, {
        method: 'POST',
        redirect: 'follow',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (r.ok) return true;
    } catch (e) {}
  }
  return false;
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

async function fetchTextWithFallback(querySuffix) {
  const sheetUrl = getConfig().google_sheet_url;
  const candidates = [sheetUrl];
  if (DEFAULT_GOOGLE_SHEET_URL && sheetUrl !== DEFAULT_GOOGLE_SHEET_URL) {
    candidates.push(DEFAULT_GOOGLE_SHEET_URL);
  }

  let lastResInfo = { status: 0, text: '', url: sheetUrl || '' };
  for (const base of candidates) {
    if (!base) continue;
    const res = await fetch(`${base}${querySuffix}`, {
      redirect: 'follow',
      headers: {
        'Accept': 'application/json, text/plain, */*',
        'User-Agent': 'ApexAcademy/1.0'
      },
      signal: AbortSignal.timeout(15000)
    });
    const text = await res.text();
    lastResInfo = { status: res.status, text, url: base };
    if (res.ok && text.trim().startsWith('{')) {
      return lastResInfo;
    }
  }
  return lastResInfo;
}

async function syncAllFromSheets(force = false) {
  const now = Date.now();
  if (!force && now - lastCoursesSyncAt < 15000) return false;
  lastCoursesSyncAt = now;

  const sheetUrl = getConfig().google_sheet_url;
  if (!sheetUrl) return false;

  try {
    const { status, text, url: usedUrl } = await fetchTextWithFallback('?action=sync_all');
    if (!text.trim().startsWith('{')) {
      lastSyncStatus = {
        ok: false,
        error: `Non-JSON (${status})`,
        isDefault: usedUrl === DEFAULT_GOOGLE_SHEET_URL,
        urlLen: usedUrl.length,
        urlTail: usedUrl.slice(-24),
        at: new Date().toISOString(),
        coursesCount: 0
      };
      return false; // Eski Apps Script HTML qaytarsa tizimni to'xtatmaslik
    }
    const data = JSON.parse(text);
    if (!data.success) {
      lastSyncStatus = { ok: false, error: 'data.success is false', at: new Date().toISOString(), coursesCount: 0 };
      return false;
    }

    // 1. Kurslar varag'idan kurslarni yangilash
    if (Array.isArray(data.courses)) {
      const normalized = normalizeCourseList(data.courses);
      const coursesPath = path.join(__dirname, 'courses.json');
      fs.writeFileSync(coursesPath, JSON.stringify(normalized, null, 2), 'utf8');
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

    lastSyncStatus = { ok: true, error: null, isDefault: usedUrl === DEFAULT_GOOGLE_SHEET_URL, at: new Date().toISOString(), coursesCount: (data.courses || []).length };
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
    const { status, text, url: usedUrl } = await fetchTextWithFallback('?action=get_courses');
    if (!text.trim().startsWith('{')) {
      lastSyncStatus = {
        ok: false,
        error: `get_courses non-JSON (${status})`,
        isDefault: usedUrl === DEFAULT_GOOGLE_SHEET_URL,
        urlLen: usedUrl.length,
        urlTail: usedUrl.slice(-24),
        at: new Date().toISOString(),
        coursesCount: 0
      };
      return null;
    }
    const data = JSON.parse(text);
    if (data.success && Array.isArray(data.courses)) {
      const normalized = normalizeCourseList(data.courses);
      fs.writeFileSync(path.join(__dirname, 'courses.json'), JSON.stringify(normalized, null, 2), 'utf8');
      lastSyncStatus = { ok: true, error: null, isDefault: usedUrl === DEFAULT_GOOGLE_SHEET_URL, at: new Date().toISOString(), coursesCount: normalized.length };
      return normalized;
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

function markCoursesFresh() {
  lastCoursesSyncAt = Date.now();
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
  getSyncStatus,
  markCoursesFresh,
  normalizeChannelTarget,
  normalizeCourseList
};
