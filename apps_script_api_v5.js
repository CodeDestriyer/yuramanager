// ============================================
// 🚀 YuraTransportation CRM - API v5
// З підтримкою статусів: archived, refused, transferred, deleted
// ============================================
const SPREADSHEET_ID = '1U1deQJvMPZ9fctIEoHCXr8cFQmgWLVe2VRhlzb5IpjI';
// Таблиця маршрутів пасажирів
const ROUTE_SPREADSHEET_ID = '1iKlD0Bj-5qB3Gc1d5ZBHscbRipcSe5xU7svqBfpB77Y';
// Маппінг авто → аркуш маршруту
const VEHICLE_TO_ROUTE = {
  'Авто 1': 'Пас. Маршрут 1',
  'Авто 2': 'Пас. Маршрут 2',
  'Авто 3': 'Пас. Маршрут 3'
};
const SHEET_UA_EU = 'Україна-єв';
const SHEET_EU_UA = 'Європа-ук';
// Google Maps API ключ
const API_KEY = 'AIzaSyCthPzhD6zDM9zR-re0R2ceohyhCRdawNc';
// Точка старту за замовчуванням
const DEFAULT_START = { name: 'Ужгород', lat: 48.6209, lng: 22.2879 };
// Макс точок в одному Google Maps URL
const MAX_POINTS_PER_MAP = 25;
// Колонки (0-based index)
// ⚠️ ВАЖЛИВО: Перевір що ці номери відповідають твоїй таблиці!
const COL = {
  DATE: 0,        // A - Дата виїзду
  FROM: 1,        // B - Адреса Відправки
  TO: 2,          // C - Адреса прибуття
  SEATS: 3,       // D - Кількість місць
  NAME: 4,        // E - ПіБ
  PHONE: 5,       // F - Телефон Пасажира
  MARK: 6,        // G - Відмітка
  PAYMENT: 7,     // H - Оплата
  PERCENT: 8,     // I - Відсоток
  DISPATCHER: 9,  // J - Диспечер
  ID: 10,         // K - ІД
  PHONE_REG: 11,  // L - Телефон Реєстратора
  WEIGHT: 12,     // M - Вага
  VEHICLE: 13,    // N - Автомобіль
  TIMING: 14,     // O - Таймінг
  DATE_REG: 15,   // P - Дата оформлення
  NOTE: 16,       // Q - Примітка
  STATUS: 17,     // R - Статус (archived, refused, transferred, deleted)
  STATUS_DATE: 18 // S - Дата статусу
};
// Кількість колонок для читання
const TOTAL_COLUMNS = 19;
// ============================================
// ГОЛОВНА ФУНКЦІЯ - POST ОБРОБКА
// ============================================
function doPost(e) {
  try {
    const params = JSON.parse(e.postData.contents);
    let response = {};
    switch (params.action) {
      case 'getAll':
        response = getAllPassengers();
        break;
      case 'getUaEu':
        response = getSheetPassengers(SHEET_UA_EU, 'ua-eu');
        break;
      case 'getEuUa':
        response = getSheetPassengers(SHEET_EU_UA, 'eu-ua');
        break;
      case 'addPassenger':
        response = addPassenger(params.payload);
        break;
      case 'updatePassenger':
        response = updatePassenger(params.payload);
        break;
      case 'updateMultiple':
        response = updateMultiplePassengers(params.payload.passengers);
        break;
      case 'optimize':
        response = optimizeRoute(params.payload);
        break;
      case 'copyToRoute':
        response = copyToRouteSheet(params.payload);
        break;
      case 'checkRouteSheets':
        response = checkRouteSheets(params.payload);
        break;
      case 'createRouteSheet':
        response = createRouteSheet(params.payload);
        break;
      case 'getRoutePassengers':
        response = getRoutePassengers(params.payload);
        break;
      case 'getAvailableRoutes':
        response = getAvailableRoutes();
        break;
      case 'getMailingStatus':
        response = getMailingStatus();
        break;
      case 'addMailingRecord':
        response = addMailingRecord(params.payload);
        break;
      case 'deleteRouteSheet':
        response = deleteRouteSheet(params.payload);
        break;
      case 'deleteRoutePassenger':
        response = deleteRoutePassenger(params.payload);
        break;
      // ✅ НОВІ ФУНКЦІЇ для статусів
      case 'archivePassengers':
        response = changePassengersStatus(params.payload, 'archived');
        break;
      case 'restorePassengers':
        response = changePassengersStatus(params.payload, 'new');
        break;
      case 'refusePassengers':
        response = changePassengersStatus(params.payload, 'refused');
        break;
      case 'transferPassengers':
        response = changePassengersStatus(params.payload, 'transferred');
        break;
      case 'deletePassengers':
        response = changePassengersStatus(params.payload, 'deleted');
        break;
      case 'deletePassengersPermanently':
        response = deletePassengersPermanently(params.payload);
        break;
      default:
        response = { success: false, error: 'Невідома дія: ' + params.action };
    }
    return ContentService.createTextOutput(JSON.stringify(response))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    return ContentService.createTextOutput(
      JSON.stringify({ success: false, error: error.toString() })
    ).setMimeType(ContentService.MimeType.JSON);
  }
}
function doGet(e) {
  return ContentService.createTextOutput(
    JSON.stringify({ success: true, message: 'YuraTransportation CRM API v5. Use POST requests.' })
  ).setMimeType(ContentService.MimeType.JSON);
}
// ============================================
// ✅ ЗМІНА СТАТУСУ ПАСАЖИРІВ (універсальна)
// ============================================
function changePassengersStatus(payload, newStatus) {
  try {
    const passengers = payload.passengers || [];
    const note = payload.note || ''; // Причина відмови/пересадки

    if (passengers.length === 0) {
      return { success: false, error: 'Немає пасажирів' };
    }

    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const today = Utilities.formatDate(new Date(), 'Europe/Kiev', 'yyyy-MM-dd');
    let changed = 0;

    for (const p of passengers) {
      const sheet = ss.getSheetByName(p.sheet);
      if (!sheet) continue;

      const row = parseInt(p.rowNum);
      if (!row || row < 2) continue;

      // Записуємо статус
      sheet.getRange(row, COL.STATUS + 1).setValue(newStatus);

      // Записуємо дату статусу
      sheet.getRange(row, COL.STATUS_DATE + 1).setValue(today);

      // Якщо є примітка (причина) — додаємо до існуючої
      if (note) {
        const currentNote = sheet.getRange(row, COL.NOTE + 1).getValue() || '';
        const newNote = note + (currentNote ? ' | ' + currentNote : '');
        sheet.getRange(row, COL.NOTE + 1).setValue(newNote);
      }

      changed++;
    }

    const statusNames = {
      'archived': 'архівовано',
      'new': 'відновлено',
      'refused': 'відмова',
      'transferred': 'пересадка',
      'deleted': 'видалено'
    };

    debugLog('✅ ' + (statusNames[newStatus] || newStatus) + ': ' + changed + ' записів');

    return {
      success: true,
      changed: changed,
      status: newStatus,
      // Для сумісності зі старим кодом
      archived: newStatus === 'archived' ? changed : 0,
      restored: newStatus === 'new' ? changed : 0
    };

  } catch (error) {
    debugLog('❌ changePassengersStatus: ' + error.toString());
    return { success: false, error: error.toString() };
  }
}
// ============================================
// ✅ ПОВНЕ ВИДАЛЕННЯ ПАСАЖИРІВ (назавжди)
// ============================================
function deletePassengersPermanently(payload) {
  try {
    const passengers = payload.passengers || [];

    if (passengers.length === 0) {
      return { success: false, error: 'Немає пасажирів' };
    }

    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    let deleted = 0;

    // Групуємо по аркушам
    const bySheet = {};
    for (const p of passengers) {
      if (!bySheet[p.sheet]) bySheet[p.sheet] = [];
      bySheet[p.sheet].push(parseInt(p.rowNum));
    }

    // Видаляємо рядки (з кінця, щоб не збити нумерацію)
    for (const sheetName in bySheet) {
      const sheet = ss.getSheetByName(sheetName);
      if (!sheet) continue;

      const rows = bySheet[sheetName].sort((a, b) => b - a); // Від більшого до меншого

      for (const row of rows) {
        if (row >= 2) {
          sheet.deleteRow(row);
          deleted++;
        }
      }
    }

    debugLog('✅ Видалено назавжди: ' + deleted + ' записів');

    return {
      success: true,
      deleted: deleted
    };

  } catch (error) {
    debugLog('❌ deletePassengersPermanently: ' + error.toString());
    return { success: false, error: error.toString() };
  }
}
// ============================================
// ✅ СПИСОК ДОСТУПНИХ МАРШРУТІВ
// ============================================
function getAvailableRoutes() {
  try {
    const routeSS = SpreadsheetApp.openById(ROUTE_SPREADSHEET_ID);
    const sheets = routeSS.getSheets();

    const routes = [];

    // ✅ СЛУЖБОВІ АРКУШІ — тільки ці два НЕ показуємо в YuraDrive
    const excludeSheets = [
      'Логи',
      'Провірка розсилки'
    ];

    for (const sheet of sheets) {
      const name = sheet.getName();

      // Пропускаємо тільки службові аркуші (точне співпадіння)
      if (excludeSheets.includes(name)) continue;

      // Рахуємо кількість записів
      const lastRow = sheet.getLastRow();
      const count = lastRow > 1 ? lastRow - 1 : 0;

      // ✅ Всі маршрути в цій таблиці — пасажирські
      routes.push({
        name: name,
        type: 'passenger',
        count: count,
        sheetId: sheet.getSheetId()
      });
    }

    debugLog('✅ getAvailableRoutes: ' + routes.length + ' маршрутів');

    return {
      success: true,
      routes: routes,
      count: routes.length
    };

  } catch (error) {
    debugLog('❌ getAvailableRoutes: ' + error.toString());
    return { success: false, error: error.toString() };
  }
}
// ============================================
// СТАТУС РОЗСИЛКИ - читає аркуш "Провірка розсилки"
// ============================================
function getMailingStatus() {
  try {
    const routeSS = SpreadsheetApp.openById(ROUTE_SPREADSHEET_ID);
    const sheet = routeSS.getSheetByName('Провірка розсилки');

    if (!sheet) {
      debugLog('⚠️ Аркуш "Провірка розсилки" не знайдено');
      return { success: true, mailingIds: [], count: 0 };
    }

    const lastRow = sheet.getLastRow();
    if (lastRow < 2) {
      return { success: true, mailingIds: [], count: 0 };
    }

    // Читаємо дані (A:B - Дата виїзду, ІД)
    const data = sheet.getRange(2, 1, lastRow - 1, 2).getValues();

    const mailingData = [];

    for (const row of data) {
      const date = row[0];
      const id = row[1];

      // Пропускаємо пусті рядки та шаблони
      if (!id || String(id).includes('dd.mm.yyyy')) continue;

      mailingData.push({
        date: date ? formatDate(date) : '',
        id: String(id).trim()
      });
    }

    // Повертаємо також просто список ІД для швидкої перевірки
    const mailingIds = mailingData.map(m => m.id);

    debugLog('✅ getMailingStatus: ' + mailingIds.length + ' записів');

    return {
      success: true,
      mailingData: mailingData,
      mailingIds: mailingIds,
      count: mailingIds.length
    };

  } catch (error) {
    debugLog('❌ getMailingStatus: ' + error.toString());
    return { success: false, error: error.toString() };
  }
}
// Форматування дати для розсилки
function formatMailingDate(date) {
  if (!date) return '';
  if (date instanceof Date) {
    const d = date.getDate().toString().padStart(2, '0');
    const m = (date.getMonth() + 1).toString().padStart(2, '0');
    const y = date.getFullYear();
    return d + '.' + m + '.' + y;
  }
  return String(date);
}
// ============================================
// ДОДАТИ ЗАПИС ПРО СПОВІЩЕННЯ
// ============================================
function addMailingRecord(payload) {
  try {
    const routeSS = SpreadsheetApp.openById(ROUTE_SPREADSHEET_ID);
    let sheet = routeSS.getSheetByName('Провірка розсилки');

    // Якщо аркуша немає — створюємо
    if (!sheet) {
      sheet = routeSS.insertSheet('Провірка розсилки');
      sheet.getRange(1, 1, 1, 2).setValues([['Дата виїзду', 'ІД']]);
    }

    const records = payload.records || [];
    const userName = payload.userName || 'Невідомий';

    if (records.length === 0) {
      return { success: false, error: 'Немає записів для додавання' };
    }

    // Додаємо записи
    const today = formatMailingDate(new Date());
    const rowsToAdd = records.map(record => [
      record.date || today,
      userName
    ]);

    const lastRow = sheet.getLastRow();
    sheet.getRange(lastRow + 1, 1, rowsToAdd.length, 2).setValues(rowsToAdd);

    debugLog('✅ addMailingRecord: додано ' + rowsToAdd.length + ' записів від ' + userName);

    return {
      success: true,
      added: rowsToAdd.length,
      userName: userName
    };

  } catch (error) {
    debugLog('❌ addMailingRecord: ' + error.toString());
    return { success: false, error: error.toString() };
  }
}
// ============================================
// ВИДАЛЕННЯ АРКУША МАРШРУТУ (АВТО)
// ============================================
function deleteRouteSheet(payload) {
  try {
    const vehicleName = payload.vehicleName;

    if (!vehicleName) {
      return { success: false, error: 'Не вказано назву авто' };
    }

    const routeSS = SpreadsheetApp.openById(ROUTE_SPREADSHEET_ID);

    let sheetName = VEHICLE_TO_ROUTE[vehicleName];
    if (!sheetName) {
      sheetName = vehicleName;
    }

    const sheet = routeSS.getSheetByName(sheetName);

    if (!sheet) {
      debugLog('⚠️ Аркуш не знайдено для видалення: ' + sheetName);
      return {
        success: true,
        message: 'Аркуш не існує',
        sheetName: sheetName,
        deleted: false
      };
    }

    const lastRow = sheet.getLastRow();
    const hasData = lastRow > 1;

    if (hasData && !payload.force) {
      return {
        success: false,
        error: 'Аркуш містить ' + (lastRow - 1) + ' записів. Використайте force: true для примусового видалення.',
        sheetName: sheetName,
        recordsCount: lastRow - 1
      };
    }

    routeSS.deleteSheet(sheet);

    debugLog('✅ Видалено аркуш: ' + sheetName);

    return {
      success: true,
      message: 'Аркуш видалено',
      sheetName: sheetName,
      deleted: true
    };

  } catch (error) {
    debugLog('❌ deleteRouteSheet: ' + error.toString());
    return { success: false, error: error.toString() };
  }
}
// ============================================
// ВИДАЛЕННЯ ПАСАЖИРА З МАРШРУТУ (по рядку)
// ============================================
function deleteRoutePassenger(payload) {
  try {
    const sheetName = payload.sheetName;
    const rowNum = parseInt(payload.rowNum);

    if (!sheetName) {
      return { success: false, error: 'Не вказано аркуш маршруту' };
    }
    if (!rowNum || rowNum < 2) {
      return { success: false, error: 'Невірний номер рядка: ' + payload.rowNum };
    }

    const routeSS = SpreadsheetApp.openById(ROUTE_SPREADSHEET_ID);
    const sheet = routeSS.getSheetByName(sheetName);

    if (!sheet) {
      return { success: false, error: 'Аркуш не знайдено: ' + sheetName };
    }

    const lastRow = sheet.getLastRow();
    if (rowNum > lastRow) {
      return { success: false, error: 'Рядок ' + rowNum + ' не існує (останній: ' + lastRow + ')' };
    }

    sheet.deleteRow(rowNum);

    debugLog('✅ deleteRoutePassenger: рядок ' + rowNum + ' з ' + sheetName);

    return { success: true, deleted: true, rowNum: rowNum, sheetName: sheetName };

  } catch (error) {
    debugLog('❌ deleteRoutePassenger: ' + error.toString());
    return { success: false, error: error.toString() };
  }
}
// ============================================
// ЧИТАННЯ МАРШРУТІВ
// ============================================
function getRoutePassengers(payload) {
  try {
    const vehicleName = payload.vehicleName;
    let sheetName = payload.sheetName;

    if (vehicleName && !sheetName) {
      sheetName = VEHICLE_TO_ROUTE[vehicleName];
      if (!sheetName) {
        sheetName = vehicleName;
      }
    }

    if (!sheetName) {
      return { success: false, error: 'Не вказано аркуш маршруту' };
    }

    const routeSS = SpreadsheetApp.openById(ROUTE_SPREADSHEET_ID);
    const sheet = routeSS.getSheetByName(sheetName);

    if (!sheet) {
      return { success: false, error: 'Аркуш не знайдено: ' + sheetName };
    }

    const lastRow = sheet.getLastRow();
    if (lastRow < 2) {
      return { success: true, passengers: [], count: 0, sheetName: sheetName };
    }

    const dataRange = sheet.getRange(2, 1, lastRow - 1, 17);
    const data = dataRange.getValues();
    const backgrounds = dataRange.getBackgrounds();

    const passengers = [];

    for (let i = 0; i < data.length; i++) {
      const row = data[i];

      if (!row[COL.NAME] && !row[COL.PHONE]) continue;

      let driverStatus = 'pending';
      const markValue = String(row[COL.MARK] || '').toLowerCase().trim();

      if (markValue === 'completed' || markValue === 'готово') {
        driverStatus = 'completed';
      } else if (markValue === 'in-progress' || markValue === 'в процесі') {
        driverStatus = 'in-progress';
      } else if (markValue === 'cancelled' || markValue === 'відмова' || markValue === 'скасовано') {
        driverStatus = 'cancelled';
      } else if (markValue === 'архів' || markValue === 'archived') {
        driverStatus = 'archived';
      }

      const rowColor = backgrounds[i][0];
      if (driverStatus === 'pending') {
        if (rowColor === '#00ff00' || rowColor === '#b6d7a8' || rowColor === '#93c47d') {
          driverStatus = 'completed';
        } else if (rowColor === '#6fa8dc' || rowColor === '#a4c2f4' || rowColor === '#3d85c6') {
          driverStatus = 'in-progress';
        } else if (rowColor === '#e06666' || rowColor === '#ea9999' || rowColor === '#cc0000') {
          driverStatus = 'cancelled';
        }
      }

      passengers.push({
        rowNum: i + 2,
        date: formatDate(row[COL.DATE]),
        from: row[COL.FROM] || '',
        to: row[COL.TO] || '',
        seats: parseInt(row[COL.SEATS]) || 1,
        name: row[COL.NAME] || '',
        phone: String(row[COL.PHONE] || ''),
        mark: row[COL.MARK] || '',
        payment: String(row[COL.PAYMENT] || ''),
        percent: row[COL.PERCENT] || '',
        dispatcher: row[COL.DISPATCHER] || '',
        id: row[COL.ID] || '',
        phoneReg: String(row[COL.PHONE_REG] || ''),
        weight: row[COL.WEIGHT] || '',
        vehicle: row[COL.VEHICLE] || '',
        timing: row[COL.TIMING] || '',
        note: row[COL.NOTE] || '',
        driverStatus: driverStatus,
        rowColor: rowColor
      });
    }

    const stats = {
      total: passengers.length,
      pending: passengers.filter(p => p.driverStatus === 'pending').length,
      inProgress: passengers.filter(p => p.driverStatus === 'in-progress').length,
      completed: passengers.filter(p => p.driverStatus === 'completed').length,
      cancelled: passengers.filter(p => p.driverStatus === 'cancelled').length,
      archived: passengers.filter(p => p.driverStatus === 'archived').length
    };

    debugLog('✅ getRoutePassengers: ' + sheetName + ' → ' + passengers.length + ' пасажирів');

    return {
      success: true,
      passengers: passengers,
      count: passengers.length,
      sheetName: sheetName,
      vehicleName: vehicleName || '',
      stats: stats
    };

  } catch (error) {
    debugLog('❌ getRoutePassengers: ' + error.toString());
    return { success: false, error: error.toString() };
  }
}
// ============================================
// ЧИТАННЯ ПАСАЖИРІВ
// ============================================
function getAllPassengers() {
  const uaEu = getSheetPassengers(SHEET_UA_EU, 'ua-eu');
  const euUa = getSheetPassengers(SHEET_EU_UA, 'eu-ua');

  return {
    success: true,
    passengers: [...uaEu.passengers, ...euUa.passengers],
    counts: {
      total: uaEu.passengers.length + euUa.passengers.length,
      uaEu: uaEu.passengers.length,
      euUa: euUa.passengers.length
    },
    timestamp: new Date().toISOString()
  };
}
function getSheetPassengers(sheetName, direction) {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = ss.getSheetByName(sheetName);

    if (!sheet) {
      return { success: false, passengers: [], error: 'Аркуш не знайдено: ' + sheetName };
    }

    const lastRow = sheet.getLastRow();
    if (lastRow < 2) {
      return { success: true, passengers: [], count: 0 };
    }

    // ✅ Читаємо всі 18 колонок (включаючи STATUS і STATUS_DATE)
    const data = sheet.getRange(2, 1, lastRow - 1, TOTAL_COLUMNS).getValues();
    const passengers = [];

    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      if (!row[COL.NAME] && !row[COL.PHONE]) continue;

      passengers.push({
        id: row[COL.ID] || '',
        rowNum: i + 2,
        sheet: sheetName,
        direction: direction,
        date: formatDate(row[COL.DATE]),
        from: row[COL.FROM] || '',
        to: row[COL.TO] || '',
        seats: parseInt(row[COL.SEATS]) || 1,
        name: row[COL.NAME] || '',
        phone: String(row[COL.PHONE] || ''),
        phoneReg: String(row[COL.PHONE_REG] || ''),
        mark: row[COL.MARK] || '',
        payment: String(row[COL.PAYMENT] || ''),
        percent: row[COL.PERCENT] || '',
        dispatcher: row[COL.DISPATCHER] || '',
        weight: row[COL.WEIGHT] || '',
        vehicle: row[COL.VEHICLE] || '',
        timing: row[COL.TIMING] || '',
        dateReg: formatDate(row[COL.DATE_REG]),  // ✅ P - Дата оформлення
        note: row[COL.NOTE] || '',               // ✅ Q - Примітка
        // ✅ Читаємо статус з окремої колонки
        status: getStatus(row),
        statusDate: formatDate(row[COL.STATUS_DATE]),
        isNew: isToday(row[COL.DATE_REG] || row[COL.DATE])
      });
    }

    return { success: true, passengers: passengers, count: passengers.length };
  } catch (error) {
    return { success: false, passengers: [], error: error.toString() };
  }
}
// ============================================
// ДОДАВАННЯ ПАСАЖИРА
// ============================================
function addPassenger(payload) {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheetName = payload.direction === 'ua-eu' ? SHEET_UA_EU : SHEET_EU_UA;
    const sheet = ss.getSheetByName(sheetName);

    if (!sheet) {
      return { success: false, error: 'Аркуш не знайдено' };
    }

    const initials = payload.initials || 'CRM';
    const newId = generateId(initials, sheet);
    const today = Utilities.formatDate(new Date(), 'Europe/Kiev', 'yyyy-MM-dd');

    const newRow = [
      payload.date || '',
      payload.from || '',
      payload.to || '',
      payload.seats || 1,
      payload.name || '',
      payload.phone || '',
      payload.mark || '',
      payload.payment || '',
      payload.percent || '',
      payload.dispatcher || 'CRM',
      newId,
      payload.phoneReg || '',
      payload.weight || '',
      payload.vehicle || '',
      payload.timing || '',
      payload.dateReg || today,  // P - Дата оформлення
      payload.note || '',
      'new',       // STATUS - новий
      today        // STATUS_DATE
    ];

    sheet.appendRow(newRow);

    return {
      success: true,
      message: 'Додано',
      id: newId,
      sheet: sheetName,
      rowNum: sheet.getLastRow()
    };
  } catch (error) {
    return { success: false, error: error.toString() };
  }
}
function generateId(initials, sheet) {
  const prefix = initials.toUpperCase().substring(0, 3);
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return prefix + '-001';

  const ids = sheet.getRange(2, COL.ID + 1, lastRow - 1, 1).getValues();
  let maxNum = 0;

  for (let i = 0; i < ids.length; i++) {
    const id = String(ids[i][0] || '');
    if (id.startsWith(prefix + '-')) {
      const num = parseInt(id.split('-')[1]) || 0;
      if (num > maxNum) maxNum = num;
    }
  }

  return prefix + '-' + String(maxNum + 1).padStart(3, '0');
}
// ============================================
// ОНОВЛЕННЯ ПАСАЖИРА
// ============================================
function updatePassenger(payload) {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = ss.getSheetByName(payload.sheet);

    if (!sheet) {
      return { success: false, error: 'Аркуш не знайдено: ' + payload.sheet };
    }

    if (!payload.rowNum) {
      return { success: false, error: 'Не вказано rowNum' };
    }

    const row = parseInt(payload.rowNum);

    if (payload.date !== undefined) sheet.getRange(row, COL.DATE + 1).setValue(payload.date);
    if (payload.from !== undefined) sheet.getRange(row, COL.FROM + 1).setValue(payload.from);
    if (payload.to !== undefined) sheet.getRange(row, COL.TO + 1).setValue(payload.to);
    if (payload.seats !== undefined) sheet.getRange(row, COL.SEATS + 1).setValue(payload.seats);
    if (payload.name !== undefined) sheet.getRange(row, COL.NAME + 1).setValue(payload.name);
    if (payload.phone !== undefined) sheet.getRange(row, COL.PHONE + 1).setValue(payload.phone);
    if (payload.mark !== undefined) sheet.getRange(row, COL.MARK + 1).setValue(payload.mark);
    if (payload.payment !== undefined) sheet.getRange(row, COL.PAYMENT + 1).setValue(payload.payment);
    if (payload.percent !== undefined) sheet.getRange(row, COL.PERCENT + 1).setValue(payload.percent);
    if (payload.dispatcher !== undefined) sheet.getRange(row, COL.DISPATCHER + 1).setValue(payload.dispatcher);
    if (payload.phoneReg !== undefined) sheet.getRange(row, COL.PHONE_REG + 1).setValue(payload.phoneReg);
    if (payload.weight !== undefined) sheet.getRange(row, COL.WEIGHT + 1).setValue(payload.weight);
    if (payload.vehicle !== undefined) sheet.getRange(row, COL.VEHICLE + 1).setValue(payload.vehicle);
    if (payload.timing !== undefined) sheet.getRange(row, COL.TIMING + 1).setValue(payload.timing);
    if (payload.note !== undefined) sheet.getRange(row, COL.NOTE + 1).setValue(payload.note);
    // ✅ Нові поля
    if (payload.status !== undefined) sheet.getRange(row, COL.STATUS + 1).setValue(payload.status);
    if (payload.statusDate !== undefined) sheet.getRange(row, COL.STATUS_DATE + 1).setValue(payload.statusDate);

    return { success: true, message: 'Оновлено', sheet: payload.sheet, rowNum: row };
  } catch (error) {
    return { success: false, error: error.toString() };
  }
}
function updateMultiplePassengers(passengers) {
  let updated = 0;
  let errors = [];

  for (const p of passengers) {
    const result = updatePassenger(p);
    if (result.success) {
      updated++;
    } else {
      errors.push((p.id || 'unknown') + ': ' + result.error);
    }
  }

  return { success: true, updated: updated, errors: errors.length > 0 ? errors : null };
}
// ============================================
// 🚀 ОПТИМІЗАЦІЯ МАРШРУТУ
// ============================================
function optimizeRoute(payload) {
  try {
    const passengersData = payload.passengers;
    const optimizeBy = payload.optimizeBy || 'from';
    const startAddress = payload.startAddress || '';
    const endAddress = payload.endAddress || '';

    if (!passengersData || passengersData.length === 0) {
      return { success: false, error: 'Немає пасажирів для оптимізації' };
    }

    debugLog('🚀 Оптимізація: ' + passengersData.length + ' пасажирів, по ' + optimizeBy);

    const addressField = (optimizeBy === 'to') ? 'to' : 'from';
    const optimizeLabel = (optimizeBy === 'to') ? 'Адреса ПРИБУТТЯ' : 'Адреса ВІДПРАВКИ';

    const passengers = [];
    for (let i = 0; i < passengersData.length; i++) {
      const p = passengersData[i];
      const rawAddress = p[addressField] || '';

      if (rawAddress && rawAddress.trim().length > 0) {
        const cleanAddress = rawAddress.replace(/\n/g, ' ').replace(/\r/g, ' ').replace(/\s+/g, ' ').trim();
        passengers.push({
          index: i,
          originalData: p,
          rawAddress: rawAddress,
          cleanAddress: cleanAddress,
          coords: null,
          id: p.id || 'N/A',
          name: p.name || '',
          uid: p._uid || null
        });
      }
    }

    if (passengers.length === 0) {
      return { success: false, error: 'Немає адрес для оптимізації' };
    }

    const notGeocodedList = [];
    let geocodedCount = 0;

    for (let i = 0; i < passengers.length; i++) {
      try {
        const coords = geocodeAddress(passengers[i].cleanAddress);
        if (coords) {
          passengers[i].coords = coords;
          geocodedCount++;
        } else {
          notGeocodedList.push({
            id: passengers[i].id,
            name: passengers[i].name,
            address: passengers[i].rawAddress,
            uid: passengers[i].uid
          });
        }
      } catch(e) {
        notGeocodedList.push({
          id: passengers[i].id,
          name: passengers[i].name,
          address: passengers[i].rawAddress,
          uid: passengers[i].uid
        });
      }
      Utilities.sleep(150);
    }

    let startCoords = { lat: DEFAULT_START.lat, lng: DEFAULT_START.lng, name: DEFAULT_START.name };
    if (startAddress && startAddress.length > 0) {
      const sc = geocodeAddress(startAddress);
      if (sc) startCoords = { lat: sc.lat, lng: sc.lng, name: startAddress };
    }

    let endCoords = null;
    if (endAddress && endAddress.length > 0) {
      const ec = geocodeAddress(endAddress);
      if (ec) endCoords = { lat: ec.lat, lng: ec.lng, name: endAddress };
    }

    const validPassengers = passengers.filter(p => p.coords !== null);
    const invalidPassengers = passengers.filter(p => p.coords === null);

    if (validPassengers.length === 0) {
      return { success: false, error: 'Жодну адресу не вдалось геокодувати!' };
    }

    let optimizedOrder = null;
    let method = 'Google Directions API (реальні дороги)';

    if (validPassengers.length <= 23) {
      optimizedOrder = optimizeWithDirectionsAPI(validPassengers, startCoords, endCoords);
    }

    if (!optimizedOrder || optimizedOrder.length === 0) {
      debugLog('⚠️ Fallback → Nearest Neighbor');
      optimizedOrder = optimizeNearestNeighbor(validPassengers, startCoords);
      method = 'Nearest Neighbor (по прямій)';
    }

    const orderedPassengers = [];
    const orderedForMap = [];

    for (const idx of optimizedOrder) {
      const p = validPassengers[idx];
      orderedPassengers.push(p.originalData);
      orderedForMap.push(p);
    }

    for (const p of invalidPassengers) {
      const data = p.originalData;
      data._notGeocoded = true;
      orderedPassengers.push(data);
    }

    const mapLinks = generateMapLinks(orderedForMap, startCoords, endCoords);

    debugLog('✅ Оптимізація завершена: ' + optimizedOrder.length + ' точок, ' + mapLinks.length + ' посилань');

    return {
      success: true,
      stats: {
        total: passengersData.length,
        geocoded: geocodedCount,
        optimized: optimizedOrder.length,
        notGeocoded: notGeocodedList.length
      },
      optimizeBy: optimizeLabel,
      start: startCoords.name,
      end: endCoords ? endCoords.name : 'остання точка маршруту',
      method: method,
      orderedPassengers: orderedPassengers,
      notGeocodedList: notGeocodedList,
      mapLinks: mapLinks
    };

  } catch(error) {
    debugLog('❌ Помилка оптимізації: ' + error.toString());
    return { success: false, error: error.toString() };
  }
}
// ============================================
// ГЕОКОДУВАННЯ
// ============================================
function geocodeAddress(address) {
  try {
    const url = 'https://maps.googleapis.com/maps/api/geocode/json'
      + '?address=' + encodeURIComponent(address)
      + '&key=' + API_KEY
      + '&language=uk';
    const response = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
    const json = JSON.parse(response.getContentText());
    if (json.status === 'OK' && json.results && json.results.length > 0) {
      const loc = json.results[0].geometry.location;
      return { lat: loc.lat, lng: loc.lng };
    }
    return null;
  } catch(e) {
    return null;
  }
}
// ============================================
// DIRECTIONS API ОПТИМІЗАЦІЯ
// ============================================
function optimizeWithDirectionsAPI(passengers, startCoords, endCoords) {
  try {
    const allCoords = passengers.map(p => p.coords.lat + ',' + p.coords.lng);
    if (allCoords.length === 0) return [];
    if (allCoords.length === 1) return [0];
    const origin = startCoords.lat + ',' + startCoords.lng;
    let destination;
    let waypoints;
    if (endCoords) {
      destination = endCoords.lat + ',' + endCoords.lng;
      waypoints = allCoords.slice();
    } else {
      waypoints = allCoords.slice(0, allCoords.length - 1);
      destination = allCoords[allCoords.length - 1];
    }
    let url = 'https://maps.googleapis.com/maps/api/directions/json'
      + '?origin=' + encodeURIComponent(origin)
      + '&destination=' + encodeURIComponent(destination)
      + '&key=' + API_KEY
      + '&language=uk';
    if (waypoints.length > 0) {
      url += '&waypoints=optimize:true|' + waypoints.join('|');
    }
    const response = UrlFetchApp.fetch(url);
    const json = JSON.parse(response.getContentText());
    if (json.status !== 'OK') {
      debugLog('⚠️ Directions: ' + json.status);
      return null;
    }
    const route = json.routes[0];
    const waypointOrder = route.waypoint_order;
    let result;
    if (endCoords) {
      result = waypointOrder;
    } else {
      result = waypointOrder.slice();
      result.push(passengers.length - 1);
    }
    return result;
  } catch(e) {
    debugLog('❌ Directions помилка: ' + e.message);
    return null;
  }
}
// ============================================
// FALLBACK: NEAREST NEIGHBOR
// ============================================
function optimizeNearestNeighbor(passengers, startCoords) {
  const n = passengers.length;
  if (n === 0) return [];
  if (n === 1) return [0];
  const distances = [];
  for (let i = 0; i < n; i++) {
    distances[i] = [];
    for (let j = 0; j < n; j++) {
      distances[i][j] = (i === j) ? 0 : haversine(passengers[i].coords, passengers[j].coords);
    }
  }
  let currentIdx = 0;
  let minDist = Infinity;
  for (let i = 0; i < n; i++) {
    const dist = haversine(startCoords, passengers[i].coords);
    if (dist < minDist) { minDist = dist; currentIdx = i; }
  }
  const visited = Array(n).fill(false);
  const tour = [currentIdx];
  visited[currentIdx] = true;
  for (let step = 1; step < n; step++) {
    let nearest = -1;
    let nearestDist = Infinity;
    for (let j = 0; j < n; j++) {
      if (!visited[j] && distances[currentIdx][j] < nearestDist) {
        nearestDist = distances[currentIdx][j];
        nearest = j;
      }
    }
    if (nearest === -1) break;
    tour.push(nearest);
    visited[nearest] = true;
    currentIdx = nearest;
  }
  return tour;
}
// ============================================
// ГЕНЕРАЦІЯ ПОСИЛАНЬ НА GOOGLE MAPS
// ============================================
function generateMapLinks(orderedPassengers, startCoords, endCoords) {
  const links = [];
  const totalPoints = orderedPassengers.length;
  if (totalPoints === 0) return links;
  const pointsPerChunk = MAX_POINTS_PER_MAP - 1;
  let chunkStart = 0;
  while (chunkStart < totalPoints) {
    const chunkEnd = Math.min(chunkStart + pointsPerChunk, totalPoints);
    const chunkItems = orderedPassengers.slice(chunkStart, chunkEnd);
    const origin = chunkStart === 0
      ? startCoords.name
      : orderedPassengers[chunkStart - 1].cleanAddress;
    let destination;
    let waypointItems;
    if (chunkEnd >= totalPoints && endCoords) {
      destination = endCoords.name;
      waypointItems = chunkItems;
    } else {
      destination = chunkItems[chunkItems.length - 1].cleanAddress;
      waypointItems = chunkItems.slice(0, chunkItems.length - 1);
    }
    let url = 'https://www.google.com/maps/dir/' + encodeURIComponent(origin);
    for (let i = 0; i < waypointItems.length; i++) {
      url += '/' + encodeURIComponent(waypointItems[i].cleanAddress);
    }
    url += '/' + encodeURIComponent(destination);
    links.push({
      url: url,
      from: chunkStart + 1,
      to: chunkEnd,
      total: totalPoints
    });
    chunkStart = chunkEnd;
  }
  return links;
}
// ============================================
// HAVERSINE
// ============================================
function haversine(coord1, coord2) {
  const R = 6371;
  const dLat = (coord2.lat - coord1.lat) * Math.PI / 180;
  const dLng = (coord2.lng - coord1.lng) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(coord1.lat * Math.PI / 180) * Math.cos(coord2.lat * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}
// ============================================
// ДОПОМІЖНІ ФУНКЦІЇ
// ============================================
function formatDate(value) {
  if (!value) return '';
  if (value instanceof Date) {
    return Utilities.formatDate(value, 'Europe/Kiev', 'yyyy-MM-dd');
  }
  return String(value);
}
// ✅ ОНОВЛЕНА ФУНКЦІЯ - читає з колонки STATUS
function getStatus(row) {
  // Спочатку перевіряємо колонку STATUS (Q)
  const statusValue = String(row[COL.STATUS] || '').toLowerCase().trim();

  if (statusValue === 'archived' || statusValue === 'архів') return 'archived';
  if (statusValue === 'refused' || statusValue === 'відмова') return 'refused';
  if (statusValue === 'transferred' || statusValue === 'пересадка') return 'transferred';
  if (statusValue === 'deleted' || statusValue === 'видалено') return 'deleted';
  if (statusValue === 'route' || statusValue === 'маршрут') return 'route';
  if (statusValue === 'optimize' || statusValue === 'оптимізація') return 'optimize';
  if (statusValue === 'work' || statusValue === 'в роботі') return 'work';
  if (statusValue === 'new' || statusValue === 'новий') return 'new';

  // Якщо колонка STATUS порожня — визначаємо по старій логіці (MARK + VEHICLE)
  const mark = String(row[COL.MARK] || '').toLowerCase();
  const vehicle = row[COL.VEHICLE];

  if (mark.includes('архів') || mark === 'archived') return 'archived';
  if (mark.includes('маршрут') || mark === 'route') return 'route';
  if (mark.includes('оптиміз')) return 'optimize';
  if (vehicle) return 'work';

  return 'new';
}
function isToday(dateValue) {
  if (!dateValue) return true;
  const today = new Date();
  const d = new Date(dateValue);
  return today.toDateString() === d.toDateString();
}
function debugLog(msg) {
  Logger.log('[CRM API v5] ' + msg);
}
// ============================================
// ПЕРЕВІРКА ІСНУЮЧИХ ЗАПИСІВ В МАРШРУТАХ
// ============================================
function checkRouteSheets(payload) {
  try {
    const vehicleNames = payload.vehicleNames || [];
    const routeSS = SpreadsheetApp.openById(ROUTE_SPREADSHEET_ID);
    const existing = [];

    for (const vehicleName of vehicleNames) {
      const routeSheetName = VEHICLE_TO_ROUTE[vehicleName];
      if (!routeSheetName) continue;

      const routeSheet = routeSS.getSheetByName(routeSheetName);
      if (!routeSheet) continue;

      const lastRow = routeSheet.getLastRow();
      if (lastRow > 1) {
        existing.push({
          vehicle: vehicleName,
          sheet: routeSheetName,
          count: lastRow - 1
        });
      }
    }

    return { success: true, existing: existing };

  } catch (error) {
    debugLog('❌ checkRouteSheets: ' + error.toString());
    return { success: false, error: error.toString() };
  }
}
// ============================================
// СТВОРЕННЯ НОВОГО АРКУША МАРШРУТУ
// ============================================
function createRouteSheet(payload) {
  try {
    const vehicleName = payload.vehicleName;
    if (!vehicleName) {
      return { success: false, error: 'Не вказано назву авто' };
    }

    const routeSS = SpreadsheetApp.openById(ROUTE_SPREADSHEET_ID);
    const newSheetName = vehicleName;

    const existingSheet = routeSS.getSheetByName(newSheetName);
    if (existingSheet) {
      debugLog('⚠️ Аркуш вже існує: ' + newSheetName);
      return {
        success: true,
        sheetName: newSheetName,
        vehicleName: vehicleName,
        existed: true
      };
    }

    const templateSheet = routeSS.getSheetByName('Пас. Маршрут 1') || routeSS.getSheetByName('Авто 1');
    if (templateSheet) {
      const newSheet = templateSheet.copyTo(routeSS);
      newSheet.setName(newSheetName);

      if (newSheet.getLastRow() > 1) {
        newSheet.deleteRows(2, newSheet.getLastRow() - 1);
      }
    } else {
      const newSheet = routeSS.insertSheet(newSheetName);
      const headers = ['Дата виїзду', 'Адреса Відправки', 'Адреса прибуття', 'Кількість місць',
                       'ПіБ', 'Телефон Пасажира', 'Відмітка', 'Оплата', 'Відсоток',
                       'Диспечер', 'ІД', 'Телефон Реєстратора', 'Вага', 'Автомобіль',
                       'Таймінг', 'Примітка', 'Статус', 'Дата статусу'];
      newSheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    }

    debugLog('✅ Створено аркуш маршруту: ' + newSheetName);

    return {
      success: true,
      sheetName: newSheetName,
      vehicleName: vehicleName
    };

  } catch (error) {
    debugLog('❌ createRouteSheet: ' + error.toString());
    return { success: false, error: error.toString() };
  }
}
// ============================================
// КОПІЮВАННЯ В ТАБЛИЦЮ МАРШРУТІВ
// ============================================
function copyToRouteSheet(payload) {
  try {
    const passengersByVehicle = payload.passengersByVehicle;
    const conflictAction = payload.conflictAction || 'add';

    if (!passengersByVehicle || Object.keys(passengersByVehicle).length === 0) {
      return { success: false, error: 'Немає пасажирів для копіювання' };
    }

    const routeSS = SpreadsheetApp.openById(ROUTE_SPREADSHEET_ID);
    let totalCopied = 0;
    let totalArchived = 0;
    let totalCleared = 0;
    const results = [];

    for (const vehicleName in passengersByVehicle) {
      const passengers = passengersByVehicle[vehicleName];
      let routeSheetName = VEHICLE_TO_ROUTE[vehicleName];

      if (!routeSheetName) {
        const allSheets = routeSS.getSheets().map(s => s.getName());
        routeSheetName = allSheets.find(name => name.toLowerCase().includes(vehicleName.toLowerCase()));
      }

      if (!routeSheetName) {
        results.push({ vehicle: vehicleName, error: 'Невідомий маршрут для авто' });
        continue;
      }

      const routeSheet = routeSS.getSheetByName(routeSheetName);
      if (!routeSheet) {
        results.push({ vehicle: vehicleName, error: 'Аркуш не знайдено: ' + routeSheetName });
        continue;
      }

      const lastRow = routeSheet.getLastRow();
      if (lastRow > 1 && conflictAction !== 'add') {
        if (conflictAction === 'clear') {
          totalCleared += lastRow - 1;
          routeSheet.deleteRows(2, lastRow - 1);
        } else if (conflictAction === 'archive') {
          const oldData = routeSheet.getRange(2, 1, lastRow - 1, 17).getValues();
          for (let i = 0; i < oldData.length; i++) {
            oldData[i][6] = 'Архів';
          }
          routeSheet.getRange(2, 1, lastRow - 1, 17).setValues(oldData);
          totalArchived += lastRow - 1;
        }
      }

      for (const p of passengers) {
        const row = [
          p.date || '',
          p.from || '',
          p.to || '',
          p.seats || 1,
          p.name || '',
          p.phone || '',
          p.mark || '',
          p.payment || '',
          p.percent || '',
          p.dispatcher || '',
          p.id || '',
          p.phoneReg || '',
          p.weight || '',
          vehicleName,
          p.timing || '',
          p.note || ''
        ];

        routeSheet.appendRow(row);
        totalCopied++;
      }

      results.push({ vehicle: vehicleName, sheet: routeSheetName, copied: passengers.length });
      debugLog('✅ ' + vehicleName + ' → ' + routeSheetName + ': ' + passengers.length + ' пасажирів');
    }

    return {
      success: true,
      copied: totalCopied,
      archived: totalArchived,
      cleared: totalCleared,
      details: results
    };

  } catch (error) {
    debugLog('❌ copyToRouteSheet: ' + error.toString());
    return { success: false, error: error.toString() };
  }
}
// ============================================
// МЕНЮ ДЛЯ ТЕСТУВАННЯ
// ============================================
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('🚀 CRM API v5')
    .addItem('📊 Тест: Всі пасажири', 'testGetAll')
    .addItem('🗺️ Тест: Оптимізація', 'testOptimize')
    .addItem('🚐 Тест: Маршрут 1', 'testGetRoute1')
    .addToUi();
}
function testGetAll() {
  const result = getAllPassengers();
  SpreadsheetApp.getUi().alert(
    '📊 Всі пасажири',
    'Всього: ' + result.counts.total + '\n' +
    '🇺🇦→🇪🇺: ' + result.counts.uaEu + '\n' +
    '🇪🇺→🇺🇦: ' + result.counts.euUa,
    SpreadsheetApp.getUi().ButtonSet.OK
  );
}
function testOptimize() {
  SpreadsheetApp.getUi().alert('🗺️ Оптимізація', 'Використовуйте CRM для запуску оптимізації', SpreadsheetApp.getUi().ButtonSet.OK);
}
function testGetRoute1() {
  const result = getRoutePassengers({ vehicleName: 'Авто 1' });
  if (result.success) {
    SpreadsheetApp.getUi().alert(
      '🚐 Маршрут: Авто 1',
      'Аркуш: ' + result.sheetName + '\n' +
      'Всього: ' + result.stats.total + '\n' +
      '⏳ Очікує: ' + result.stats.pending + '\n' +
      '🔄 В процесі: ' + result.stats.inProgress + '\n' +
      '✅ Готово: ' + result.stats.completed + '\n' +
      '❌ Скасовано: ' + result.stats.cancelled,
      SpreadsheetApp.getUi().ButtonSet.OK
    );
  } else {
    SpreadsheetApp.getUi().alert('❌ Помилка', result.error, SpreadsheetApp.getUi().ButtonSet.OK);
  }
}