/**
 * ATL CardVault — Google Apps Script Backend (Drive + Sheets)
 * 
 * 部署說明：
 * 1. 在 Google 試算表中，點擊上方選單【擴充功能】->【Apps Script】。
 * 2. 清空原本的程式碼，將本檔案全部複製貼上。
 * 3. 點擊右上角【部署】(Deploy) ->【新增部署】(New deployment)。
 * 4. 種類選擇【網頁應用程式】(Web app)。
 * 5. 設定：
 *    - 執行身分：【我】(Me)
 *    - 誰可以存取：【所有人】(Anyone)
 * 6. 點擊【部署】，複製產生的【網頁應用程式網址】(Web App URL)，貼回 CardVault 設定中即可！
 */

// 試算表分頁名稱與 Drive 資料夾名稱
const SHEET_NAME = 'Namecards';
const FOLDER_NAME = 'ATL_Namecards_Photos';

function setupSheetAndFolder() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    // 建立表頭
    sheet.appendRow([
      'ID',
      'Name',
      'Title',
      'Company',
      'Department',
      'Role',
      'Sentiment',
      'Email',
      'Phone',
      'Address',
      'TechInterests',
      'Notes',
      'LastMet',
      'PhotoDriveUrl',
      'CreatedAt'
    ]);
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, 15).setFontWeight('bold').setBackground('#1e293b').setFontColor('#ffffff');
  }

  // 檢查或建立 Google Drive 名片相片資料夾
  const folders = DriveApp.getFoldersByName(FOLDER_NAME);
  let folder;
  if (folders.hasNext()) {
    folder = folders.next();
  } else {
    folder = DriveApp.createFolder(FOLDER_NAME);
    folder.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  }
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
      for (let i = 1; i < values.length; i++) {
        if (String(values[i][0]) === String(data.id) || (String(values[i][1]) === String(data.name) && String(values[i][3]) === String(data.company))) {
          sheet.deleteRow(i + 1);
          break;
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
        const fileName = (data.company || 'Card') + '_' + (data.name || 'Contact') + '_' + new Date().getTime() + '.jpg';
        const blob = Utilities.newBlob(decoded, contentType, fileName);
        const file = folder.createFile(blob);
        file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
        photoUrl = 'https://drive.google.com/uc?export=view&id=' + file.getId();
      } catch (imgErr) {
        photoUrl = 'Upload error: ' + imgErr.toString();
      }
    }

    // 寫入 Google 試算表
    sheet.appendRow([
      data.id || ('card-' + new Date().getTime()),
      data.name || '',
      data.title || '',
      data.company || '',
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

    return ContentService.createTextOutput(JSON.stringify({
      status: 'success',
      message: 'Card and photo successfully stored in Google Drive & Sheets',
      photoUrl: photoUrl
    })).setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({
      status: 'error',
      message: err.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

// 供手機與電腦隨時拉取最新所有名片資料 (GET)
function doGet(e) {
  try {
    const setup = setupSheetAndFolder();
    const sheet = setup.sheet;
    const dataRange = sheet.getDataRange();
    const values = dataRange.getValues();

    if (values.length <= 1) {
      return ContentService.createTextOutput(JSON.stringify({
        status: 'success',
        cards: []
      })).setMimeType(ContentService.MimeType.JSON);
    }

    const headers = values[0];
    const cards = [];

    for (let i = 1; i < values.length; i++) {
      const row = values[i];
      if (!row[0] && !row[1]) continue; // 跳過空行

      cards.push({
        id: String(row[0] || 'card-' + i),
        name: String(row[1] || ''),
        title: String(row[2] || ''),
        company: String(row[3] || ''),
        account: String(row[3] || ''),
        department: String(row[4] || ''),
        stakeholderRole: String(row[5] || 'Technical Champion'),
        sentiment: String(row[6] || 'Champion'),
        email: String(row[7] || ''),
        phone: String(row[8] || '').replace(/^#ERROR!/, ''),
        mobile: String(row[8] || '').replace(/^#ERROR!/, ''),
        address: String(row[9] || ''),
        techInterests: String(row[10] || '').split(',').map(s => s.trim()).filter(Boolean),
        notes: String(row[11] || ''),
        lastMet: row[12] ? (row[12] instanceof Date ? Utilities.formatDate(row[12], 'GMT+8', 'yyyy-MM-dd') : String(row[12])) : '',
        cardFrontImage: String(row[13] || ''),
        theme: 'executive-navy',
        favorite: false
      });
    }

    return ContentService.createTextOutput(JSON.stringify({
      status: 'success',
      cards: cards
    })).setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({
      status: 'error',
      message: err.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}
