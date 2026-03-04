/**
 * 處理資料讀寫 (POST) — 統一入口
 * 支援兩種 action:
 *   - auth_read: 驗證密碼 + 回傳資料
 *   - (預設): 寫入資料
 * 密碼全程以 SHA-256 hash 形式傳輸/存放
 */
function doPost(e) {
  var params = JSON.parse(e.postData.contents);
  var roomId = params.roomId;
  var pw = params.pw; // 前端傳來的 SHA-256 hash
  var action = params.action || 'write';
  
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  var data = sheet.getDataRange().getValues();
  
  if (action === 'auth_read') {
    // === 驗證 + 讀取 ===
    for (var i = 1; i < data.length; i++) {
      if (data[i][0] == roomId) {
        var storedPw = String(data[i][2]);
        
        // 遷移邏輯：舊明文密碼（長度 ≠ 64）自動轉 hash
        if (storedPw.length !== 64) {
          var migrated = sha256(storedPw);
          sheet.getRange(i + 1, 3).setValue(migrated);
          storedPw = migrated;
        }
        
        if (storedPw !== String(pw)) {
          return json({ status: "wrong_password", message: "密碼錯誤，無法登入" });
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
  
  // === 寫入資料 ===
  var content = params.data;
  var now = new Date();
  var found = false;
  
  for (var i = 1; i < data.length; i++) {
    if (data[i][0] == roomId) {
      var storedPw = String(data[i][2]);
      
      // 遷移邏輯
      if (storedPw.length !== 64) {
        var migrated = sha256(storedPw);
        sheet.getRange(i + 1, 3).setValue(migrated);
        storedPw = migrated;
      }
      
      // V-05 fix: 寫入前驗證密碼
      if (storedPw !== String(pw)) {
        return json({ status: "wrong_password", message: "密碼驗證失敗，拒絕寫入" });
      }
      
      sheet.getRange(i + 1, 2).setValue(content);
      sheet.getRange(i + 1, 4).setValue(now);
      found = true;
      break;
    }
  }
  
  if (!found) {
    // 新房間：直接存 hash
    sheet.appendRow([roomId, content, pw, now]);
  }
  
  return json({ status: "success" });
}

/**
 * doGet — 保留向後相容，但建議前端全面使用 doPost
 */
function doGet(e) {
  var roomId = e.parameter.roomId;
  var pw = e.parameter.pw;
  var authOnly = e.parameter.authOnly === 'true';
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  var data = sheet.getDataRange().getValues();
  
  for (var i = 1; i < data.length; i++) {
    if (data[i][0] == roomId) {
      var storedPw = String(data[i][2]);
      
      // 遷移邏輯
      if (storedPw.length !== 64) {
        var migrated = sha256(storedPw);
        sheet.getRange(i + 1, 3).setValue(migrated);
        storedPw = migrated;
      }
      
      if (storedPw !== String(pw)) {
        return json({ status: "wrong_password", message: "密碼錯誤，無法登入" });
      }
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

/** SHA-256 hash (GAS 內建) */
function sha256(input) {
  var rawHash = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, input);
  return rawHash.map(function(b) {
    return ('0' + ((b < 0 ? b + 256 : b).toString(16))).slice(-2);
  }).join('');
}

/** 工具函式：回傳 JSON */
function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
