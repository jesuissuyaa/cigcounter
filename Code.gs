// TODO: insert your own LINE acccess token
var CHANNEL_ACCESS_TOKEN = '';

var line_endpoint = 'https://api.line.me/v2/bot/message/reply';
var line_endpoint_profile = 'https://api.line.me/v2/bot/profile';

function getUserDisplayName(user_id) {
  var res = UrlFetchApp.fetch(line_endpoint_profile + '/' + user_id, {
    'headers': {
      'Content-Type': 'application/json; charset=UTF-8',
      'Authorization': 'Bearer ' + CHANNEL_ACCESS_TOKEN,
    },
    'method': 'get',
  });
  return JSON.parse(res).displayName;
}

function createSpreadSheet(user_id) {
  var spreadSheet = SpreadsheetApp.create("smokes(" + getUserDisplayName(user_id) + ")");
  var sheet = spreadSheet.getSheets()[0];
  sheet.appendRow(['date', 'message']);
  PropertiesService.getScriptProperties().setProperty(user_id, spreadSheet.getId());
  var file = DriveApp.getFileById(spreadSheet.getId());
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  sheet.setColumnWidth(1, 130);
  sheet.setColumnWidth(2, 300);
  return spreadSheet;
}

function getSpreadSheet(user_id) {
  var sid = PropertiesService.getScriptProperties().getProperty(user_id);
  if (sid == null) {
    return createSpreadSheet(user_id);
  } else {
    try {
      return SpreadsheetApp.openById(sid);
    } catch(e) {
      return createSpreadSheet(user_id);
    }
  }
}

function addToSpreadSheet(user_id, message) {
  var now = new Date(); // timestamp at message send
  var spreadSheet = getSpreadSheet(user_id);
  var sheet = spreadSheet.getSheets()[0];
  sheet.appendRow([now, message]);
}

// return # of cigs smoked for current date
function countSmokes(spreadSheet, date) {
  var sheet = spreadSheet.getSheets()[0];
  var count = 0;

  // set date variables
  var startDay = new Date(date);
  var nextDay = new Date(date);
  startDay.setHours(0,0,0,0);
  nextDay.setDate(date.getDate() + 1);
  nextDay.setHours(0,0,0,0);

  // set sheet variables
  var numRows = sheet.getLastRow();
  var col = 1;
  var firstRow = 0; // first row within range

  // set flag
  var found = false;

  // PREMISE: sheet is sorted by date (ASC)
  var i; // iterate over rows
  for (i = 2; i <= numRows && !found; i++) {
    var val = sheet.getRange(i, col).getValue();
    if (val >= startDay && val < nextDay) {
      firstRow = i;
      found = true;
    }
  }

  if (firstRow == 0) { // no entry for date query
    count = 0;
  } else { // look for last row for date query
    i = firstRow;
    while (sheet.getRange(i, col).getValue() < nextDay
           && i <= numRows) {
      count++;
      i++;
    }
  }

  return count;
}

function doPost(e) {
  var json = JSON.parse(e.postData.contents);

  var reply_token= json.events[0].replyToken;
  if (typeof reply_token === 'undefined') {
    return;
  }

  var user_id = json.events[0].source.userId;
  var user_message = json.events[0].message.text;

  var reply_messages;
  var spreadSheet;
  if (user_message == 'ヘルプ' || user_message == 'へるぷ') {
    reply_messages = ["「煙草」「タバコ」「たばこ」: 吸った記録を追加\n\n「今日」で今日吸った本数を表示\n\n「ヘルプ」「へるぷ」: このメッセージを表示"];
  } else if (user_message == '煙草' || user_message == 'タバコ' || user_message == 'たばこ') {
    addToSpreadSheet(user_id, user_message);
    reply_messages = ['記録したよ'];
  } else if (user_message　== '今日') {
    try {
      spreadSheet = getSpreadSheet(user_id);
      var now = new Date();
      var res = countSmokes(spreadSheet, now);
      reply_messages = ["今日の本数: " + res];
      //reply_messages = ["今日の本数: " + 10];
    } catch (ex) {
      Logger.log(ex);
    }
  } else if (user_message　== '昨日') {
    try {
      spreadSheet = getSpreadSheet(user_id);
      var now = new Date();
      var yesterday = new Date();
      yesterday.setDate(now.getDate() - 1);
      var res = countSmokes(spreadSheet, yesterday);
      reply_messages = ["昨日の本数: " + res];
    } catch (ex) {
      Logger.log(ex);
    }
  } else if (typeof user_message === 'undefined') { // not text message
    reply_messages = ["テキストで送ってね\n\n「へるぷ」でコマンド一覧が出るよ"];
  } else {
    reply_messages = ["ひまか？"];
  }

  var messages = reply_messages.map(function (v) {
    return {'type': 'text', 'text': v};
  });
  UrlFetchApp.fetch(line_endpoint, {
    'headers': {
      'Content-Type': 'application/json; charset=UTF-8',
      'Authorization': 'Bearer ' + CHANNEL_ACCESS_TOKEN,
    },
    'method': 'post',
    'payload': JSON.stringify({
      'replyToken': reply_token,
      'messages': messages,
    }),
  });
  return ContentService.createTextOutput(JSON.stringify({'content': 'post ok'})).setMimeType(ContentService.MimeType.JSON);
}
