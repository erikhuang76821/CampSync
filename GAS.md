/**
 * 處理資料讀取 (GET)
 * 參數: roomId
 * 回傳: { status, data, pw, lastUpdated }
 */
function doGet(e) {
  var roomId = e.parameter.roomId;
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  var data = sheet.getDataRange().getValues();
  
  for (var i = 1; i < data.length; i++) {
    if (data[i][0] == roomId) {
      return ContentService.createTextOutput(JSON.stringify({
        status: "success",
        data: data[i][1],        // 資料內容
        pw: data[i][2],          // 獨立密碼欄位 (C 欄)
        lastUpdated: data[i][3]  // 最後更新時間 (D 欄)
      })).setMimeType(ContentService.MimeType.JSON);
    }
  }
  
  return ContentService.createTextOutput(JSON.stringify({
    status: "not_found"
  })).setMimeType(ContentService.MimeType.JSON);
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
  var now = new Date(); // 取得當前時間
  
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  var data = sheet.getDataRange().getValues();
  var found = false;
  
  // 尋找現有房間進行更新
  for (var i = 1; i < data.length; i++) {
    if (data[i][0] == roomId) {
      sheet.getRange(i + 1, 2).setValue(content); // 更新 Data (B)
      sheet.getRange(i + 1, 3).setValue(pw);      // 更新 PW (C)
      sheet.getRange(i + 1, 4).setValue(now);     // 更新 Last Updated (D)
      found = true;
      break;
    }
  }
  
  // 若沒找到，則新增一行
  if (!found) {
    sheet.appendRow([roomId, content, pw, now]);
  }
  
  return ContentService.createTextOutput(JSON.stringify({ status: "success" }))
    .setMimeType(ContentService.MimeType.JSON);
}
