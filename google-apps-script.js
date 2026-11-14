/**
 * ATL CardVault — Google Apps Script Backend (Drive + Sheets)
 * 支援 中英文姓名、兩層部門結構、CORS 與 JSONP 雙向同步
 */

const SHEET_NAME = 'Namecards';
const FOLDER_NAME = 'ATL_Namecards_Photos';

const HEADERS = [
  'ID',
  'NameZh (中文姓名)',
  'NameEn (英文姓名)',
  'Title (職稱)',
  'Company (公司)',
  'Division (一級部門/處)',
  'Department (二級部門/組)',
  'Role (角色)',
  'Sentiment (關係)',
  'Email',
  'Phone',
  'Address (地址)',
  'TechInterests (技術標籤)',
  'Notes (備註)',
  'LastMet (最近拜訪)',
  'PhotoDriveUrl (照片連結)',
  'CreatedAt (建立時間)'
];

function setupSheetAndFolder() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    sheet.appendRow(HEADERS);
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, HEADERS.length).setFontWeight('bold').setBackground('#1e293b').setFontColor('#ffffff');
  } else {
    // 檢查舊版表頭是否需要升級欄位
    const firstRow = sheet.getRange(1, 1, 1, Math.max(sheet.getLastColumn(), 1)).getValues()[0];
    if (firstRow.length < 17 || !String(firstRow[1]).includes('NameZh')) {
      // 舊版表頭自動平滑升級
      sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]).setFontWeight('bold').setBackground('#1e293b').setFontColor('#ffffff');
    }
  }

  const folders = DriveApp.getFoldersByName(FOLDER_NAME);
  let folder = folders.hasNext() ? folders.next() : DriveApp.createFolder(FOLDER_NAME);
  folder.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  return { sheet: sheet, folder: folder };
}

// 接收前端手機/電腦送來的名片資料 (POST)
function doPost(e) {
  try {
    const setup = setupSheetAndFolder();
    const sheet = setup.sheet;
    const folder = setup.folder;

    const data = JSON.parse(e.postData.contents);

    // 處理刪除名片 (Action: Delete)
    if (data.action === 'delete') {
      const values = sheet.getDataRange().getValues();
      for (let i = values.length - 1; i >= 1; i--) {
        const rowId = String(values[i][0]).trim();
        const rowNameZh = String(values[i][1]).trim();
        const rowNameEn = String(values[i][2]).trim();
        if ((data.id && rowId === String(data.id).trim()) || 
            (data.nameZh && rowNameZh.toLowerCase() === String(data.nameZh).trim().toLowerCase()) ||
            (data.name && (rowNameZh === String(data.name).trim() || rowNameEn.toLowerCase() === String(data.name).trim().toLowerCase()))) {
          sheet.deleteRow(i + 1);
        }
      }
      return ContentService.createTextOutput(JSON.stringify({ status: 'success', message: 'Card deleted from Sheet' })).setMimeType(ContentService.MimeType.JSON);
    }

    let photoUrl = data.cardFrontImage || '';

    // 如果前端有傳送 Base64 格式的名片照片，自動轉存進 Google Drive
    if (data.cardFrontImage && data.cardFrontImage.startsWith('data:image')) {
      try {
        const parts = data.cardFrontImage.split(',');
        const contentType = parts[0].split(';')[0].replace('data:', '');
        const decoded = Utilities.base64Decode(parts[1]);
        const namePart = data.nameZh || data.nameEn || data.name || 'Contact';
        const fileName = (data.company || 'Card') + '_' + namePart + '_' + new Date().getTime() + '.jpg';
        const blob = Utilities.newBlob(decoded, contentType, fileName);
        const file = folder.createFile(blob);
        file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
        photoUrl = 'https://drive.google.com/uc?export=view&id=' + file.getId();
      } catch (imgErr) {
        photoUrl = 'Upload error: ' + imgErr.toString();
      }
    }

    // 寫入 Google 試算表（包含中英文姓名、兩層部門結構）
    sheet.appendRow([
      data.id || ('card-' + new Date().getTime()),
      data.nameZh || '',
      data.nameEn || '',
      data.title || '',
      data.company || '',
      data.division || '',
      data.department || '',
      data.stakeholderRole || 'Technical Champion',
      data.sentiment || 'Champion',
      data.email || '',
      data.phone ? "'" + String(data.phone).trim() : '',
      data.address || '',
      Array.isArray(data.techInterests) ? data.techInterests.join(', ') : (data.techInterests || ''),
      data.notes || '',
      data.lastMet || new Date().toISOString().split('T')[0],
      photoUrl,
      new Date().toISOString()
    ]);

    return ContentService.createTextOutput(JSON.stringify({ status: 'success', message: 'Card stored in Google Sheet & Drive', photoUrl: photoUrl })).setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: err.toString() })).setMimeType(ContentService.MimeType.JSON);
  }
}

// 供手機與電腦隨時拉取最新所有名片資料 (GET，支援標準 JSON 與 JSONP)
function doGet(e) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName(SHEET_NAME);
    if (!sheet) {
      sheet = ss.getSheets()[0];
    }
    const values = sheet.getDataRange().getValues();
    const cards = [];

    if (values.length > 1) {
      for (let i = 1; i < values.length; i++) {
        const row = values[i];
        if (!row[0] && !row[1] && !row[2]) continue;

        let lastMetStr = '';
        if (row[14]) {
          try {
            lastMetStr = row[14] instanceof Date ? Utilities.formatDate(row[14], Session.getScriptTimeZone() || 'GMT', 'yyyy-MM-dd') : String(row[14]).substring(0, 10);
          } catch(dErr) {
            lastMetStr = String(row[14]);
          }
        }

        // 兼容舊版與新版欄位格式
        const isNewFormat = values[0].length >= 17 && String(values[0][1]).includes('NameZh');

        const card = isNewFormat ? {
          id: String(row[0] || 'card-' + i),
          nameZh: String(row[1] || ''),
          nameEn: String(row[2] || ''),
          name: (String(row[1] || '') && String(row[2] || '')) ? `${row[1]} (${row[2]})` : String(row[1] || row[2] || 'Unnamed'),
          title: String(row[3] || ''),
          company: String(row[4] || ''),
          account: String(row[4] || ''),
          division: String(row[5] || ''),
          department: String(row[6] || ''),
          stakeholderRole: String(row[7] || 'Technical Champion'),
          sentiment: String(row[8] || 'Champion'),
          email: String(row[9] || ''),
          phone: String(row[10] || '').replace(/^#ERROR!/, ''),
          mobile: String(row[10] || '').replace(/^#ERROR!/, ''),
          address: String(row[11] || ''),
          techInterests: String(row[12] || '').split(',').map(s => s.trim()).filter(Boolean),
          notes: String(row[13] || ''),
          lastMet: lastMetStr,
          cardFrontImage: String(row[15] || ''),
          theme: 'executive-navy',
          favorite: false
        } : {
          // 舊版 15 欄位相容轉換
          id: String(row[0] || 'card-' + i),
          nameZh: String(row[1] || '').match(/[\u4e00-\u9fa5]/) ? String(row[1] || '') : '',
          nameEn: !String(row[1] || '').match(/[\u4e00-\u9fa5]/) ? String(row[1] || '') : '',
          name: String(row[1] || ''),
          title: String(row[2] || ''),
          company: String(row[3] || ''),
          account: String(row[3] || ''),
          division: '',
          department: String(row[4] || ''),
          stakeholderRole: String(row[5] || 'Technical Champion'),
          sentiment: String(row[6] || 'Champion'),
          email: String(row[7] || ''),
          phone: String(row[8] || '').replace(/^#ERROR!/, ''),
          mobile: String(row[8] || '').replace(/^#ERROR!/, ''),
          address: String(row[9] || ''),
          techInterests: String(row[10] || '').split(',').map(s => s.trim()).filter(Boolean),
          notes: String(row[11] || ''),
          lastMet: row[12] ? (row[12] instanceof Date ? Utilities.formatDate(row[12], Session.getScriptTimeZone() || 'GMT', 'yyyy-MM-dd') : String(row[12]).substring(0, 10)) : '',
          cardFrontImage: String(row[13] || ''),
          theme: 'executive-navy',
          favorite: false
        };

        cards.push(card);
      }
    }

    const payload = JSON.stringify({ status: 'success', cards: cards });
    const callback = e && e.parameter && e.parameter.callback;

    if (callback) {
      return ContentService.createTextOutput(callback + '(' + payload + ')')
        .setMimeType(ContentService.MimeType.JAVASCRIPT);
    } else {
      return ContentService.createTextOutput(payload)
        .setMimeType(ContentService.MimeType.JSON);
    }

  } catch (err) {
    const errPayload = JSON.stringify({ status: 'error', message: err.toString() });
    const callback = e && e.parameter && e.parameter.callback;
    if (callback) {
      return ContentService.createTextOutput(callback + '(' + errPayload + ')')
        .setMimeType(ContentService.MimeType.JAVASCRIPT);
    } else {
      return ContentService.createTextOutput(errPayload)
        .setMimeType(ContentService.MimeType.JSON);
    }
  }
}
