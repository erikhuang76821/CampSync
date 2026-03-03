/**
 * 處理資料讀取 (GET)
 * 參數: roomId, pw, authOnly (可選)
 * 回傳: { status, data?, lastUpdated?, message? }
 * 注意: 密碼在後端比對，不回傳明文密碼
 */
function doGet(e) {
  var roomId = e.parameter.roomId;
  var pw = e.parameter.pw;
  var authOnly = e.parameter.authOnly === 'true';
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  var data = sheet.getDataRange().getValues();
  
  for (var i = 1; i < data.length; i++) {
    if (data[i][0] == roomId) {
      // 後端密碼比對
      if (String(data[i][2]) !== String(pw)) {
        return json({ status: "wrong_password", message: "密碼錯誤，無法登入" });
      }
      // 僅驗證模式：不回傳資料，減少傳輸量
      if (authOnly) {
        return json({ status: "success" });
      }
      return json({
        status: "success",
        data: data[i][1],
        lastUpdated: data[i][3]
      });
    }
  }
  
  return json({ status: "not_found" });
}

/**
 * 處理資料寫入 (POST)
 * 傳入內容: { roomId, pw, data }
 */
function doPost(e) {
  var params = JSON.parse(e.postData.contents);
  var roomId = params.roomId;
  var pw = params.pw;
  var content = params.data;
  var now = new Date();
  
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  var data = sheet.getDataRange().getValues();
  var found = false;
  
  for (var i = 1; i < data.length; i++) {
    if (data[i][0] == roomId) {
      sheet.getRange(i + 1, 2).setValue(content);
      sheet.getRange(i + 1, 3).setValue(pw);
      sheet.getRange(i + 1, 4).setValue(now);
      found = true;
      break;
    }
  }
  
  if (!found) {
    sheet.appendRow([roomId, content, pw, now]);
  }
  
  return json({ status: "success" });
}

/** 工具函式：回傳 JSON */
function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
