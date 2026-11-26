/**
 * Apex Academy — Google Sheets Yagona Doimiy Baza (Apps Script)
 * Ushbu kodni Google Sheets -> Extensions -> Apps Script ichiga qo'ying
 * va Deploy -> Manage deployments -> Edit -> New version -> Deploy qiling.
 */

const SHEET_KURSLAR = "Kurslar";
const SHEET_LIDLAR = "Apex lidlar";
const SHEET_TOLOVLAR = "O'quvchilar va to'lovlar";
const SHEET_MOCK = "Mock test";
const SHEET_USTOZLAR = "O'qituvchilar";
const SHEET_STATE = "_AppState";

function getOrCreateSheet(ss, name, headers) {
  var sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    if (headers && headers.length > 0) {
      sheet.appendRow(headers);
    }
  }
  return sheet;
}

function categoryFromSubject(fan) {
  var lower = String(fan || "").toLowerCase();
  if (lower.indexOf("ingliz") !== -1 || lower.indexOf("english") !== -1 || lower.indexOf("ielts") !== -1) return "english";
  if (lower.indexOf("it") !== -1 || lower.indexOf("dastur") !== -1 || lower.indexOf("front") !== -1 || lower.indexOf("python") !== -1) return "it";
  if (lower.indexOf("matem") !== -1 || lower.indexOf("fizik") !== -1 || lower.indexOf("serfikat") !== -1) return "exact";
  return "other";
}

function subjectFromCategory(cat) {
  if (cat === "english") return "Ingliz tili";
  if (cat === "it") return "IT & Dasturlash";
  if (cat === "exact") return "Matematika";
  return "Boshqa yo'nalish";
}

function readCoursesFromSheet(ss) {
  var sheet = ss.getSheetByName(SHEET_KURSLAR);
  if (!sheet) return [];
  var values = sheet.getDataRange().getValues();
  if (values.length <= 1) return [];

  var headers = values[0].map(function(h) { return String(h).trim().toLowerCase(); });
  var courses = [];

  for (var i = 1; i < values.length; i++) {
    var row = values[i];
    var fan = String(row[0] || "").trim();
    var name = String(row[1] || "").trim();
    var price = String(row[2] || "").trim();
    var schedule = String(row[3] || "").trim();
    var holat = String(row[4] || "Ochiq").trim();
    var desc = String(row[5] || "").trim();
    var badge = String(row[6] || "").trim();
    var rawId = row[7] ? Number(row[7]) : (100000 + i);

    if (!name) continue;
    if (holat.toLowerCase() === "yopiq") continue;

    courses.push({
      id: rawId,
      name: name,
      category: categoryFromSubject(fan || name),
      price: price,
      schedule: schedule,
      badge: badge || fan || "",
      description: desc || ((fan ? fan + " yo'nalishi" : "O'quv kursi") + (schedule ? " • " + schedule : ""))
    });
  }
  return courses;
}

function readAppState(ss) {
  var sheet = ss.getSheetByName(SHEET_STATE);
  if (!sheet) return {};
  var values = sheet.getDataRange().getValues();
  var state = {};
  for (var i = 1; i < values.length; i++) {
    var k = String(values[i][0] || "").trim();
    var v = String(values[i][1] || "");
    if (!k) continue;
    try {
      state[k] = JSON.parse(v);
    } catch (e) {}
  }
  return state;
}

function writeAppStateKey(ss, key, value) {
  var sheet = getOrCreateSheet(ss, SHEET_STATE, ["Key", "JSON_Value", "UpdatedAt"]);
  var values = sheet.getDataRange().getValues();
  var jsonStr = JSON.stringify(value);
  var nowStr = new Date().toISOString();

  for (var i = 1; i < values.length; i++) {
    if (String(values[i][0]).trim() === key) {
      sheet.getRange(i + 1, 2).setValue(jsonStr);
      sheet.getRange(i + 1, 3).setValue(nowStr);
      return;
    }
  }
  sheet.appendRow([key, jsonStr, nowStr]);
}

function doGet(e) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var action = (e && e.parameter && e.parameter.action) ? e.parameter.action : "sync_all";

  if (action === "get_courses") {
    return ContentService
      .createTextOutput(JSON.stringify({ success: true, courses: readCoursesFromSheet(ss) }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  var state = readAppState(ss);
  var courses = readCoursesFromSheet(ss);

  return ContentService
    .createTextOutput(JSON.stringify({
      success: true,
      courses: courses,
      state: state
    }))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var data = {};
  try {
    data = JSON.parse(e.postData.contents);
  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ status: "error", message: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  var action = data.action || "enrollment";
  var now = Utilities.formatDate(new Date(), "Asia/Tashkent", "dd.MM.yyyy HH:mm");

  // 1. State kalitini doimiy saqlash (groups, teachers, users, leads, receipts, attendance, mock_config, mock_tests, settings)
  if (action === "sync_state" && data.key) {
    writeAppStateKey(ss, data.key, data.value);

    // Agar ustozlar ro'yxati bo'lsa, O'qituvchilar varag'ini ham yangilab qo'yamiz
    if (data.key === "teachers" && Array.isArray(data.value)) {
      var tSheet = getOrCreateSheet(ss, SHEET_USTOZLAR, ["ID", "Ism", "Telefon", "Lavozim", "Yo'nalish", "Guruh"]);
      if (tSheet.getLastRow() > 1) {
        tSheet.getRange(2, 1, tSheet.getLastRow() - 1, 6).clearContent();
      }
      data.value.forEach(function(t, idx) {
        tSheet.getRange(idx + 2, 1, 1, 6).setValues([[t.id || idx + 1, t.name || "", t.phone || "", t.role || "", t.assignedCourse || "", t.group || ""]]);
      });
    }

    return ContentService
      .createTextOutput(JSON.stringify({ status: "success", synced: data.key }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  // 2. Kurs qo'shish (Mini App -> Kurslar varag'i)
  if (action === "sync_course_add" && data.course) {
    var c = data.course;
    var kSheet = getOrCreateSheet(ss, SHEET_KURSLAR, ["Fan", "Kurs nomi", "Oylik narxi", "Ustoz (dars vaqti)", "Holat", "Tavsif", "Belgi", "ID"]);
    kSheet.appendRow([
      subjectFromCategory(c.category),
      c.name || "",
      c.price || "",
      c.schedule || "",
      "Ochiq",
      c.description || "",
      c.badge || "",
      c.id || Date.now()
    ]);
    return ContentService
      .createTextOutput(JSON.stringify({ status: "success" }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  // 3. Kurs o'chirish (Mini App -> Kurslar varag'i)
  if (action === "sync_course_delete") {
    var kSheetDel = ss.getSheetByName(SHEET_KURSLAR);
    if (kSheetDel) {
      var rows = kSheetDel.getDataRange().getValues();
      for (var r = rows.length - 1; r >= 1; r--) {
        var rowName = String(rows[r][1] || "").trim();
        var rowId = String(rows[r][7] || "").trim();
        if ((data.id && rowId && rowId === String(data.id)) || (data.name && rowName === String(data.name))) {
          kSheetDel.deleteRow(r + 1);
          break;
        }
      }
    }
    return ContentService
      .createTextOutput(JSON.stringify({ status: "success" }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  // 4. To'lov tasdiqlanganda -> O'quvchilar va to'lovlar varag'i
  if (action === "payment_verified") {
    var pSheet = getOrCreateSheet(ss, SHEET_TOLOVLAR, ["Sana", "Ism", "Telefon", "Kurs", "Summa", "Holat"]);
    pSheet.appendRow([now, data.name || "", data.phone || "", data.course || "", data.amount || "", data.status || "To'landi"]);
    return ContentService
      .createTextOutput(JSON.stringify({ status: "success" }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  // 5. Mock test chiptasi -> Mock test varag'i
  if (data.course && String(data.course).indexOf("Mock Exam") !== -1) {
    var mSheet = getOrCreateSheet(ss, SHEET_MOCK, ["Sana", "Ism", "Telefon", "Chipta / Kurs", "Smena"]);
    mSheet.appendRow([now, data.name || "", data.phone || "", data.course || "", data.preferredTime || ""]);
    return ContentService
      .createTextOutput(JSON.stringify({ status: "success" }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  // 6. Oddiy ariza / Lid -> Apex lidlar varag'i
  var lSheet = getOrCreateSheet(ss, SHEET_LIDLAR, ["Sana", "Ism", "Telefon", "Kurs", "Qulay vaqt", "Manba"]);
  lSheet.appendRow([now, data.name || "", data.phone || "", data.course || "", data.preferredTime || "", action]);

  return ContentService
    .createTextOutput(JSON.stringify({ status: "success" }))
    .setMimeType(ContentService.MimeType.JSON);
}
