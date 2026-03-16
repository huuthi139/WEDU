/**
 * Wepower Edu App - Google Apps Script
 * =====================================
 *
 * HƯỚNG DẪN CÀI ĐẶT:
 * 1. Vào https://script.google.com → New project
 * 2. Xóa code mặc định, paste toàn bộ file này vào
 * 3. Nhấn Save (Ctrl+S)
 * 4. Chạy hàm "setup" 1 lần (chọn setup từ dropdown → Run)
 *    → Cấp quyền khi được hỏi
 * 5. Deploy → New deployment → Web app
 *    - Execute as: Me
 *    - Who has access: Anyone
 *    → Deploy → Copy URL
 * 6. Paste URL vào Vercel Environment Variables:
 *    GOOGLE_SCRIPT_URL = <URL vừa copy>
 * 7. Redeploy trên Vercel
 *
 * SHEET ID: 1KOuhPurnWcHOayeRn7r-hNgVl13Zf7Q0z0r4d1-K0JY
 *
 * CẤU TRÚC TABS:
 * - Users:   Email | Password | Role | Tên | Level | Enrolled | Completed | Phone
 * - Orders:  Thời gian | Mã đơn hàng | Tên khách hàng | Email | SĐT | Khóa học | Mã khóa học | Tổng tiền | PTTT | Trạng thái | Mã GD
 * - Courses: ID | Title | Description | Thumbnail | Instructor | Price | OriginalPrice | Rating | ReviewsCount | EnrollmentsCount | Duration | LessonsCount | Badge | Category | MemberLevel
 * - Chapters: CourseId | ChaptersJSON
 * - Enrollments: enrollmentId | userId | courseId | enrolledAt | progress | completedLessons | lastAccessedAt | status
 * - Reviews: reviewId | userId | userEmail | userName | courseId | rating | content | createdAt
 */

var SPREADSHEET_ID = '1KOuhPurnWcHOayeRn7r-hNgVl13Zf7Q0z0r4d1-K0JY';

// ==========================================
// AUTO-SYNC CONFIG
// ==========================================
var WEBAPP_URL = 'https://wepower.vn'; // URL của web app (Vercel)
var SYNC_SECRET = '56ec5986c1bcefd4f8f42439b2007600fbb8f72b0ba42aa6eb9c124d24bcd0b2'; // Phải khớp với SYNC_SECRET trong Vercel env

// ==========================================
// CUSTOM MENU - Hiện trên Google Sheets khi mở
// ==========================================
function onOpen() {
  var ui = SpreadsheetApp.getUi();
  ui.createMenu('⚡ Wepower Admin')
    .addItem('⚙️ Setup Sheet (lần đầu)', 'setup')
    .addItem('📚 Seed 15 khóa học', 'seedCourses')
    .addSeparator()
    .addItem('🔗 Test kết nối', 'testConnection')
    .addSeparator()
    .addItem('🔧 Cài Auto Sync', 'setupAutoSync')
    .addItem('🗑️ Gỡ Auto Sync', 'removeAutoSync')
    .addSeparator()
    .addItem('🔄 Sync tất cả Users ngay', 'syncAllUsersToWebApp')
    .addToUi();
}

// ==========================================
// REMOVE AUTO-SYNC TRIGGERS
// ==========================================
function removeAutoSync() {
  var triggers = ScriptApp.getProjectTriggers();
  var count = 0;
  for (var i = 0; i < triggers.length; i++) {
    ScriptApp.deleteTrigger(triggers[i]);
    count++;
  }
  SpreadsheetApp.getUi().alert('Đã gỡ ' + count + ' trigger(s). Auto Sync đã tắt.');
}

// ==========================================
// SETUP - Chạy 1 lần để tạo các tab
// ==========================================
function setup() {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);

  // Tab Users
  var users = ss.getSheetByName('Users');
  if (!users) {
    users = ss.insertSheet('Users');
    users.appendRow(['Email', 'Password', 'Role', 'Tên', 'Level', 'Enrolled', 'Completed', 'Phone']);
    formatHeader_(users, 8, '#4a86e8');
    // Tạo admin mặc định
    users.appendRow(['admin@wepower.vn', '123456', 'Admin', 'Admin WePower', 'VIP', '', '', '']);
    Logger.log('Tab Users đã tạo + admin mặc định: admin@wepower.vn / 123456');
  }

  // Tab Orders
  var orders = ss.getSheetByName('Orders');
  if (!orders) {
    orders = ss.insertSheet('Orders');
    orders.appendRow(['Thời gian', 'Mã đơn hàng', 'Tên khách hàng', 'Email', 'Số điện thoại', 'Khóa học', 'Mã khóa học', 'Tổng tiền', 'Phương thức thanh toán', 'Trạng thái', 'Mã giao dịch']);
    formatHeader_(orders, 11, '#e84a4a');
    Logger.log('Tab Orders đã tạo');
  }

  // Tab Courses (nếu chưa có)
  var courses = ss.getSheetByName('Courses');
  if (!courses) {
    courses = ss.insertSheet('Courses');
    courses.appendRow(['ID', 'Title', 'Description', 'Thumbnail', 'Instructor', 'Price', 'OriginalPrice', 'Rating', 'ReviewsCount', 'EnrollmentsCount', 'Duration', 'LessonsCount', 'Badge', 'Category', 'MemberLevel']);
    formatHeader_(courses, 15, '#4a9e4a');
    Logger.log('Tab Courses đã tạo');
  }

  // Tab Chapters (nếu chưa có)
  var chapters = ss.getSheetByName('Chapters');
  if (!chapters) {
    chapters = ss.insertSheet('Chapters');
    chapters.appendRow(['CourseId', 'ChaptersJSON']);
    formatHeader_(chapters, 2, '#e8a84a');
    Logger.log('Tab Chapters đã tạo');
  }

  Logger.log('Setup hoàn tất!');
}

// ==========================================
// MAIN HANDLER - Tất cả request đều qua GET
// ==========================================
function doGet(e) {
  try {
    var action = (e.parameter.action || '').trim();

    if (!action) {
      return jsonResponse_({ success: true, message: 'Wepower Edu App API is running', actions: ['ping', 'login', 'register', 'getCourses', 'appendOrder', 'getUsers', 'getUsersForSync', 'updateUserLevel', 'updatePassword', 'deleteUser', 'saveChapters', 'getChapters', 'getAllChapters', 'enrollCourse', 'getEnrollments', 'updateProgress', 'saveReview', 'getReviews'] });
    }

    switch (action) {
      case 'ping':
        return jsonResponse_({ success: true, status: 'ok', app: 'Wepower Edu App' });

      case 'login':
        return jsonResponse_(handleLogin_(e.parameter));

      case 'register':
        return jsonResponse_(handleRegister_(e.parameter));

      case 'getCourses':
        return jsonResponse_(handleGetCourses_());

      case 'appendOrder':
        return jsonResponse_(handleAppendOrder_(e.parameter));

      case 'getUsers':
        return jsonResponse_(handleGetUsers_());

      case 'getUsersForSync':
        return jsonResponse_(handleGetUsersForSync_());

      case 'updateUserLevel':
        return jsonResponse_(handleUpdateUserLevel_(e.parameter));

      case 'updatePassword':
        return jsonResponse_(handleUpdatePassword_(e.parameter));

      case 'deleteUser':
        return jsonResponse_(handleDeleteUser_(e.parameter));

      case 'saveChapters':
        return jsonResponse_(handleSaveChapters_(e.parameter));

      case 'getChapters':
        return jsonResponse_(handleGetChapters_(e.parameter));

      case 'getAllChapters':
        return jsonResponse_(handleGetAllChapters_());

      case 'enrollCourse':
        return jsonResponse_(handleEnrollCourse_(e.parameter));

      case 'getEnrollments':
        return jsonResponse_(handleGetEnrollments_(e.parameter));

      case 'updateProgress':
        return jsonResponse_(handleUpdateProgress_(e.parameter));

      case 'saveReview':
        return jsonResponse_(handleSaveReview_(e.parameter));

      case 'getReviews':
        return jsonResponse_(handleGetReviews_(e.parameter));

      default:
        return jsonResponse_({ success: false, error: 'Unknown action: ' + action });
    }
  } catch (err) {
    Logger.log('ERROR: ' + err.toString());
    return jsonResponse_({ success: false, error: err.toString() });
  }
}

// doPost cũng hỗ trợ (fallback)
function doPost(e) {
  try {
    if (!e.postData) return jsonResponse_({ success: false, error: 'No data' });

    var data = JSON.parse(e.postData.contents);
    var action = data.action || '';

    switch (action) {
      case 'login':       return jsonResponse_(handleLogin_(data));
      case 'register':    return jsonResponse_(handleRegister_(data));
      case 'appendOrder': return jsonResponse_(handleAppendOrder_(data));
      case 'getCourses':  return jsonResponse_(handleGetCourses_());
      case 'getUsers':    return jsonResponse_(handleGetUsers_());
      case 'getUsersForSync': return jsonResponse_(handleGetUsersForSync_());
      case 'updateUserLevel': return jsonResponse_(handleUpdateUserLevel_(data));
      case 'updatePassword': return jsonResponse_(handleUpdatePassword_(data));
      case 'deleteUser':  return jsonResponse_(handleDeleteUser_(data));
      case 'saveChapters': return jsonResponse_(handleSaveChapters_(data));
      case 'getChapters': return jsonResponse_(handleGetChapters_(data));
      case 'getAllChapters': return jsonResponse_(handleGetAllChapters_());
      case 'enrollCourse': return jsonResponse_(handleEnrollCourse_(data));
      case 'getEnrollments': return jsonResponse_(handleGetEnrollments_(data));
      case 'updateProgress': return jsonResponse_(handleUpdateProgress_(data));
      case 'saveReview': return jsonResponse_(handleSaveReview_(data));
      case 'getReviews': return jsonResponse_(handleGetReviews_(data));
      case 'setup':       setup(); return jsonResponse_({ success: true, message: 'Setup done' });
      default: return jsonResponse_({ success: false, error: 'Unknown action: ' + action });
    }
  } catch (err) {
    Logger.log('POST ERROR: ' + err.toString());
    return jsonResponse_({ success: false, error: err.toString() });
  }
}

// ==========================================
// LOGIN
// ==========================================
function handleLogin_(data) {
  var email = (data.email || '').toLowerCase().trim();

  if (!email) {
    return { success: false, error: 'Email không được để trống' };
  }

  var sheet = getSheet_('Users');
  if (!sheet) return { success: false, error: 'Tab Users chưa tồn tại. Chạy setup() trước.' };

  var rows = sheet.getDataRange().getValues();
  if (rows.length < 2) return { success: false, error: 'Chưa có dữ liệu người dùng' };

  var h = headerIndex_(rows[0]);

  for (var i = 1; i < rows.length; i++) {
    var row = rows[i];
    var rowEmail = (row[h.Email] || '').toString().toLowerCase().trim();

    if (rowEmail === email) {
      var role = (row[h.Role] || 'user').toString().trim();
      var level = (row[h.Level] || 'Free').toString().trim();
      if (['Free', 'Premium', 'VIP'].indexOf(level) === -1) level = 'Free';

      return {
        success: true,
        user: {
          name: (row[h['Tên']] || '').toString().trim(),
          email: rowEmail,
          passwordHash: (row[h.Password] || '').toString().trim(),
          phone: (row[h.Phone] || '').toString().trim(),
          role: isAdmin_(role) ? 'admin' : 'user',
          memberLevel: level
        }
      };
    }
  }

  return { success: false, error: 'User not found' };
}

// ==========================================
// REGISTER
// ==========================================
function handleRegister_(data) {
  var name = (data.name || '').trim();
  var email = (data.email || '').toLowerCase().trim();
  var passwordHash = (data.passwordHash || '').trim(); // Already hashed by Next.js
  var phone = (data.phone || '').trim();

  if (!name || !email || !passwordHash) {
    return { success: false, error: 'Vui lòng điền đầy đủ thông tin' };
  }

  var sheet = getSheet_('Users');
  if (!sheet) {
    setup();
    sheet = getSheet_('Users');
  }

  // Kiểm tra email trùng
  var rows = sheet.getDataRange().getValues();
  var h = headerIndex_(rows[0]);

  for (var i = 1; i < rows.length; i++) {
    var rowEmail = (rows[i][h.Email] || '').toString().toLowerCase().trim();
    if (rowEmail === email) {
      return { success: false, error: 'Email đã được sử dụng. Vui lòng dùng email khác.' };
    }
  }

  // Thêm user: Email | Password (hashed) | Role | Tên | Level | Enrolled | Completed | Phone
  sheet.appendRow([email, passwordHash, 'user', name, 'Free', '', '', phone]);
  Logger.log('New user: ' + email);

  return {
    success: true,
    user: {
      name: name,
      email: email,
      phone: phone,
      role: 'user',
      memberLevel: 'Free'
    }
  };
}

// ==========================================
// APPEND ORDER (nhận rowData array từ Vercel)
// ==========================================
function handleAppendOrder_(data) {
  var rowData = data.rowData;

  // Nếu là string (từ GET query), parse JSON
  if (typeof rowData === 'string') {
    try {
      rowData = JSON.parse(rowData);
    } catch (err) {
      return { success: false, error: 'Invalid rowData JSON: ' + err.toString() };
    }
  }

  if (!rowData || !Array.isArray(rowData)) {
    return { success: false, error: 'Thiếu rowData hoặc không phải array' };
  }

  var sheet = getSheet_('Orders');
  if (!sheet) {
    setup();
    sheet = getSheet_('Orders');
  }

  sheet.appendRow(rowData);
  Logger.log('Order added: ' + (rowData[1] || 'unknown'));

  return { success: true };
}

// ==========================================
// GET USERS (không trả password)
// ==========================================
function handleGetUsers_() {
  var sheet = getSheet_('Users');
  if (!sheet) return { success: true, users: [] };

  var rows = sheet.getDataRange().getValues();
  if (rows.length < 2) return { success: true, users: [] };

  var headers = rows[0].map(function(h) { return h.toString().trim(); });
  var users = [];

  for (var i = 1; i < rows.length; i++) {
    var user = {};
    for (var j = 0; j < headers.length; j++) {
      if (headers[j] !== 'Password') {
        user[headers[j]] = rows[i][j] ? rows[i][j].toString().trim() : '';
      }
    }
    users.push(user);
  }

  return { success: true, users: users };
}

// ==========================================
// GET COURSES
// ==========================================
function handleGetCourses_() {
  var sheet = getSheet_('Courses');
  if (!sheet) return { success: true, courses: [] };

  var rows = sheet.getDataRange().getValues();
  if (rows.length < 2) return { success: true, courses: [] };

  var headers = rows[0].map(function(h) { return h.toString().trim(); });
  var courses = [];

  for (var i = 1; i < rows.length; i++) {
    var course = {};
    for (var j = 0; j < headers.length; j++) {
      course[headers[j]] = rows[i][j] !== undefined && rows[i][j] !== null ? rows[i][j] : '';
    }
    courses.push(course);
  }

  return { success: true, courses: courses };
}

// ==========================================
// UPDATE USER LEVEL
// ==========================================
function handleUpdateUserLevel_(data) {
  var email = (data.email || '').toLowerCase().trim();
  var newLevel = (data.memberLevel || '').trim();

  if (!email || !newLevel) return { success: false, error: 'Thiếu email hoặc level' };
  if (['Free', 'Premium', 'VIP'].indexOf(newLevel) === -1) {
    return { success: false, error: 'Level không hợp lệ (Free/Premium/VIP)' };
  }

  var sheet = getSheet_('Users');
  if (!sheet) return { success: false, error: 'Tab Users không tồn tại' };

  var rows = sheet.getDataRange().getValues();
  var h = headerIndex_(rows[0]);

  for (var i = 1; i < rows.length; i++) {
    if ((rows[i][h.Email] || '').toString().toLowerCase().trim() === email) {
      sheet.getRange(i + 1, h.Level + 1).setValue(newLevel);
      return { success: true, message: 'Đã cập nhật level: ' + newLevel };
    }
  }

  return { success: false, error: 'Không tìm thấy user: ' + email };
}

// ==========================================
// UPDATE PASSWORD (migration from plaintext to bcrypt hash)
// ==========================================
function handleUpdatePassword_(data) {
  var email = (data.email || '').toLowerCase().trim();
  var newHash = (data.passwordHash || '').trim();

  if (!email || !newHash) return { success: false, error: 'Thiếu email hoặc passwordHash' };

  var sheet = getSheet_('Users');
  if (!sheet) return { success: false, error: 'Tab Users không tồn tại' };

  var rows = sheet.getDataRange().getValues();
  var h = headerIndex_(rows[0]);

  for (var j = 1; j < rows.length; j++) {
    if ((rows[j][h.Email] || '').toString().toLowerCase().trim() === email) {
      sheet.getRange(j + 1, h.Password + 1).setValue(newHash);
      Logger.log('Password migrated for: ' + email);
      return { success: true };
    }
  }

  return { success: false, error: 'Không tìm thấy user: ' + email };
}

// ==========================================
// DELETE USER
// ==========================================
function handleDeleteUser_(data) {
  var email = (data.email || '').toLowerCase().trim();
  if (!email) return { success: false, error: 'Thiếu email' };

  var sheet = getSheet_('Users');
  if (!sheet) return { success: false, error: 'Tab Users không tồn tại' };

  var rows = sheet.getDataRange().getValues();
  var h = headerIndex_(rows[0]);

  for (var i = 1; i < rows.length; i++) {
    if ((rows[i][h.Email] || '').toString().toLowerCase().trim() === email) {
      sheet.deleteRow(i + 1);
      return { success: true, message: 'Đã xóa user: ' + email };
    }
  }

  return { success: false, error: 'Không tìm thấy user: ' + email };
}

// ==========================================
// SAVE CHAPTERS (lưu chapters JSON cho 1 khóa học)
// ==========================================
function handleSaveChapters_(data) {
  var courseId = (data.courseId || '').toString().trim();
  var chaptersJson = data.chaptersJson || '[]';

  if (!courseId) return { success: false, error: 'Thiếu courseId' };

  // Nếu chaptersJson là object/array thì stringify
  if (typeof chaptersJson !== 'string') {
    chaptersJson = JSON.stringify(chaptersJson);
  }

  var sheet = getSheet_('Chapters');
  if (!sheet) {
    // Tạo tab nếu chưa có
    var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    sheet = ss.insertSheet('Chapters');
    sheet.appendRow(['CourseId', 'ChaptersJSON']);
    formatHeader_(sheet, 2, '#e8a84a');
  }

  var rows = sheet.getDataRange().getValues();

  // Tìm row có courseId trùng để update
  for (var i = 1; i < rows.length; i++) {
    if ((rows[i][0] || '').toString().trim() === courseId) {
      sheet.getRange(i + 1, 2).setValue(chaptersJson);
      return { success: true, message: 'Đã cập nhật chapters cho khóa học ' + courseId };
    }
  }

  // Chưa có → thêm mới
  sheet.appendRow([courseId, chaptersJson]);
  return { success: true, message: 'Đã lưu chapters cho khóa học ' + courseId };
}

// ==========================================
// GET CHAPTERS (lấy chapters JSON cho 1 khóa học)
// ==========================================
function handleGetChapters_(data) {
  var courseId = (data.courseId || '').toString().trim();
  if (!courseId) return { success: false, error: 'Thiếu courseId' };

  var sheet = getSheet_('Chapters');
  if (!sheet) return { success: true, chapters: [] };

  var rows = sheet.getDataRange().getValues();

  for (var i = 1; i < rows.length; i++) {
    if ((rows[i][0] || '').toString().trim() === courseId) {
      try {
        var chapters = JSON.parse(rows[i][1] || '[]');
        return { success: true, chapters: chapters };
      } catch (err) {
        return { success: true, chapters: [] };
      }
    }
  }

  return { success: true, chapters: [] };
}

// ==========================================
// GET ALL CHAPTERS (lấy tất cả chapters - cho tính stats)
// ==========================================
function handleGetAllChapters_() {
  var sheet = getSheet_('Chapters');
  if (!sheet) return { success: true, data: {} };

  var rows = sheet.getDataRange().getValues();
  var result = {};

  for (var i = 1; i < rows.length; i++) {
    var courseId = (rows[i][0] || '').toString().trim();
    if (courseId) {
      try {
        result[courseId] = JSON.parse(rows[i][1] || '[]');
      } catch (err) {
        result[courseId] = [];
      }
    }
  }

  return { success: true, data: result };
}

// ==========================================
// HELPER: Ensure sheet exists with headers
// ==========================================
function ensureSheetExists(ss, sheetName, headers) {
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
  }
  return sheet;
}

// ==========================================
// ENROLLMENT HANDLERS
// ==========================================
function handleEnrollCourse_(data) {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var enrollSheet = ensureSheetExists(ss, 'Enrollments',
    ['enrollmentId','userId','courseId','enrolledAt','progress','completedLessons','lastAccessedAt','status']);
  var userId = (data.userId || '').toLowerCase().trim();
  var courseId = (data.courseId || '').trim();
  if (!userId || !courseId) return { success: false, error: 'Missing userId or courseId' };

  var enrollData = enrollSheet.getDataRange().getValues();
  for (var i = 1; i < enrollData.length; i++) {
    if (enrollData[i][1] === userId && enrollData[i][2] === courseId) {
      return { success: true, enrollmentId: enrollData[i][0], alreadyEnrolled: true };
    }
  }
  var enrollId = Utilities.getUuid();
  var now = new Date().toISOString();
  enrollSheet.appendRow([enrollId, userId, courseId, now, 0, '[]', now, 'active']);
  return { success: true, enrollmentId: enrollId };
}

function handleGetEnrollments_(data) {
  var userId = (data.userId || '').toLowerCase().trim();
  if (!userId) return { success: false, error: 'Missing userId' };

  var sheet = getSheet_('Enrollments');
  if (!sheet) return { success: true, enrollments: [] };

  var allEnroll = sheet.getDataRange().getValues();
  var userEnrollments = [];
  for (var ei = 1; ei < allEnroll.length; ei++) {
    if (allEnroll[ei][1] === userId) {
      userEnrollments.push({
        enrollmentId: allEnroll[ei][0],
        courseId: allEnroll[ei][2],
        enrolledAt: allEnroll[ei][3],
        progress: allEnroll[ei][4],
        completedLessons: JSON.parse(allEnroll[ei][5] || '[]'),
        lastAccessedAt: allEnroll[ei][6],
        status: allEnroll[ei][7]
      });
    }
  }
  return { success: true, enrollments: userEnrollments };
}

function handleUpdateProgress_(data) {
  var userId = (data.userId || '').toLowerCase().trim();
  var courseId = (data.courseId || '').trim();
  if (!userId || !courseId) return { success: false, error: 'Missing userId or courseId' };

  var progSheet = getSheet_('Enrollments');
  if (!progSheet) return { success: false, error: 'Enrollment not found' };

  var progData = progSheet.getDataRange().getValues();
  for (var pi = 1; pi < progData.length; pi++) {
    if (progData[pi][1] === userId && progData[pi][2] === courseId) {
      var completedArr = JSON.parse(progData[pi][5] || '[]');
      var lessonId = (data.lessonId || '').trim();
      if (lessonId && completedArr.indexOf(lessonId) === -1) {
        completedArr.push(lessonId);
      }
      var progress = parseFloat(data.progress) || progData[pi][4];
      progSheet.getRange(pi + 1, 5).setValue(progress);
      progSheet.getRange(pi + 1, 6).setValue(JSON.stringify(completedArr));
      progSheet.getRange(pi + 1, 7).setValue(new Date().toISOString());
      return { success: true };
    }
  }
  return { success: false, error: 'Enrollment not found' };
}

// ==========================================
// REVIEW HANDLERS
// ==========================================
function handleSaveReview_(data) {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var reviewSheet = ensureSheetExists(ss, 'Reviews',
    ['reviewId','userId','userEmail','userName','courseId','rating','content','createdAt']);
  var userId = (data.userId || '').toLowerCase().trim();
  var courseId = (data.courseId || '').trim();
  if (!userId || !courseId) return { success: false, error: 'Missing userId or courseId' };

  var reviewData = reviewSheet.getDataRange().getValues();
  for (var ri = 1; ri < reviewData.length; ri++) {
    if (reviewData[ri][1] === userId && reviewData[ri][4] === courseId) {
      reviewSheet.getRange(ri + 1, 6).setValue(parseFloat(data.rating));
      reviewSheet.getRange(ri + 1, 7).setValue(data.content || '');
      return { success: true, updated: true };
    }
  }
  var reviewId = Utilities.getUuid();
  reviewSheet.appendRow([reviewId, userId, data.userEmail || '', data.userName || '',
    courseId, parseFloat(data.rating), data.content || '', new Date().toISOString()]);
  return { success: true, reviewId: reviewId };
}

function handleGetReviews_(data) {
  var courseId = (data.courseId || '').trim();
  if (!courseId) return { success: false, error: 'Missing courseId' };

  var sheet = getSheet_('Reviews');
  if (!sheet) return { success: true, reviews: [] };

  var allReviews = sheet.getDataRange().getValues();
  var courseReviews = [];
  for (var rvi = 1; rvi < allReviews.length; rvi++) {
    if (allReviews[rvi][4] === courseId) {
      courseReviews.push({
        reviewId: allReviews[rvi][0],
        userId: allReviews[rvi][1],
        userEmail: allReviews[rvi][2],
        userName: allReviews[rvi][3],
        rating: allReviews[rvi][5],
        content: allReviews[rvi][6],
        createdAt: allReviews[rvi][7]
      });
    }
  }
  return { success: true, reviews: courseReviews };
}

// ==========================================
// GET USERS FOR SYNC (trả cả password hash cho sync)
// ==========================================
function handleGetUsersForSync_() {
  var sheet = getSheet_('Users');
  if (!sheet) return { success: true, users: [] };

  var rows = sheet.getDataRange().getValues();
  if (rows.length < 2) return { success: true, users: [] };

  var headers = rows[0].map(function(h) { return h.toString().trim(); });
  var users = [];

  for (var i = 1; i < rows.length; i++) {
    var user = {};
    for (var j = 0; j < headers.length; j++) {
      user[headers[j]] = rows[i][j] ? rows[i][j].toString().trim() : '';
    }
    users.push(user);
  }

  return { success: true, users: users };
}

// ==========================================
// AUTO-SYNC: onEdit trigger
// Tự động đồng bộ khi chỉnh sửa trên Google Sheet
// ==========================================
function onEditSync(e) {
  try {
    var sheet = e.source.getActiveSheet();
    var sheetName = sheet.getName();

    // Chỉ sync khi edit tab Users
    if (sheetName !== 'Users') return;

    var row = e.range.getRow();
    // Bỏ qua header row
    if (row <= 1) return;

    // Lấy dữ liệu user từ row vừa edit
    var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    var rowData = sheet.getRange(row, 1, 1, sheet.getLastColumn()).getValues()[0];

    var h = {};
    for (var i = 0; i < headers.length; i++) {
      h[headers[i].toString().trim()] = i;
    }

    var email = (rowData[h['Email']] || '').toString().toLowerCase().trim();
    if (!email) return; // Bỏ qua nếu không có email

    var userData = {
      email: email,
      name: (rowData[h['Tên']] || '').toString().trim(),
      phone: (rowData[h['Phone']] || '').toString().trim(),
      role: mapRoleForSync_(rowData[h['Role']] || ''),
      memberLevel: (rowData[h['Level']] || 'Free').toString().trim(),
      passwordHash: (rowData[h['Password']] || '').toString().trim()
    };

    // Gọi webhook để sync user này lên Supabase
    syncUserToWebApp_(userData);

  } catch (err) {
    Logger.log('onEditSync ERROR: ' + err.toString());
  }
}

// ==========================================
// AUTO-SYNC: Sync toàn bộ users (chạy theo schedule)
// ==========================================
function syncAllUsersToWebApp() {
  try {
    var url = WEBAPP_URL + '/api/webhook/sheet-sync';
    var options = {
      method: 'post',
      contentType: 'application/json',
      headers: {
        'X-Sync-Secret': SYNC_SECRET
      },
      payload: JSON.stringify({ action: 'syncAll' }),
      muteHttpExceptions: true
    };

    var response = UrlFetchApp.fetch(url, options);
    var result = JSON.parse(response.getContentText());
    Logger.log('Full sync result: ' + JSON.stringify(result));
    return result;
  } catch (err) {
    Logger.log('syncAllUsersToWebApp ERROR: ' + err.toString());
    return { success: false, error: err.toString() };
  }
}

// ==========================================
// AUTO-SYNC: Sync 1 user (gọi từ onEdit)
// ==========================================
function syncUserToWebApp_(userData) {
  try {
    var url = WEBAPP_URL + '/api/webhook/sheet-sync';
    var options = {
      method: 'post',
      contentType: 'application/json',
      headers: {
        'X-Sync-Secret': SYNC_SECRET
      },
      payload: JSON.stringify({
        action: 'syncOne',
        user: userData
      }),
      muteHttpExceptions: true
    };

    var response = UrlFetchApp.fetch(url, options);
    var result = JSON.parse(response.getContentText());
    Logger.log('Sync user ' + userData.email + ': ' + JSON.stringify(result));
    return result;
  } catch (err) {
    Logger.log('syncUserToWebApp_ ERROR: ' + err.toString());
  }
}

// ==========================================
// AUTO-SYNC: Xóa user khỏi Supabase
// ==========================================
function deleteUserFromWebApp_(email) {
  try {
    var url = WEBAPP_URL + '/api/webhook/sheet-sync';
    var options = {
      method: 'post',
      contentType: 'application/json',
      headers: {
        'X-Sync-Secret': SYNC_SECRET
      },
      payload: JSON.stringify({
        action: 'deleteOne',
        email: email
      }),
      muteHttpExceptions: true
    };

    var response = UrlFetchApp.fetch(url, options);
    var result = JSON.parse(response.getContentText());
    Logger.log('Delete user ' + email + ': ' + JSON.stringify(result));
    return result;
  } catch (err) {
    Logger.log('deleteUserFromWebApp_ ERROR: ' + err.toString());
  }
}

// ==========================================
// SETUP TRIGGERS - Chạy 1 lần để cài đặt auto-sync
// ==========================================
function setupAutoSync() {
  // Xóa tất cả triggers cũ
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    ScriptApp.deleteTrigger(triggers[i]);
  }

  // Trigger 1: onEdit - mỗi khi edit sheet → sync ngay
  ScriptApp.newTrigger('onEditSync')
    .forSpreadsheet(SPREADSHEET_ID)
    .onEdit()
    .create();

  // Trigger 2: Time-driven - sync toàn bộ mỗi 5 phút (backup)
  ScriptApp.newTrigger('syncAllUsersToWebApp')
    .timeBased()
    .everyMinutes(5)
    .create();

  Logger.log('Auto-sync triggers đã được cài đặt!');
  Logger.log('1. onEdit: Sync ngay khi chỉnh sửa tab Users');
  Logger.log('2. Time-driven: Full sync mỗi 5 phút');

  try {
    SpreadsheetApp.getUi().alert(
      '✅ Auto Sync đã cài đặt!\n\n' +
      '1. onEdit: Sync ngay khi chỉnh sửa tab Users\n' +
      '2. Time-driven: Full sync mỗi 5 phút'
    );
  } catch (e) {
    // Bỏ qua nếu không có UI (chạy từ trigger)
  }
}

// ==========================================
// HELPER: Map role for sync
// ==========================================
function mapRoleForSync_(role) {
  var r = (role || '').toString().toLowerCase().trim();
  if (r === 'admin' || r === 'administrator' || r.indexOf('quản trị') !== -1 || r === 'qtv') return 'admin';
  if (r === 'sub_admin' || r === 'sub admin') return 'sub_admin';
  if (r === 'instructor' || r.indexOf('giảng viên') !== -1) return 'instructor';
  return 'user';
}

// ==========================================
// HELPER FUNCTIONS
// ==========================================
function getSheet_(name) {
  return SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(name);
}

function headerIndex_(headerRow) {
  var map = {};
  for (var i = 0; i < headerRow.length; i++) {
    map[headerRow[i].toString().trim()] = i;
  }
  return map;
}

function isAdmin_(role) {
  var r = (role || '').toLowerCase().trim();
  return r === 'admin' || r === 'administrator' || r.indexOf('quản trị') !== -1 || r === 'qtv';
}

function formatHeader_(sheet, cols, color) {
  var range = sheet.getRange(1, 1, 1, cols);
  range.setBackground(color);
  range.setFontColor('#FFFFFF');
  range.setFontWeight('bold');
  sheet.setFrozenRows(1);
  sheet.autoResizeColumns(1, cols);
}

function jsonResponse_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

// ==========================================
// SEED COURSES - Chạy 1 lần để thêm 15 khóa học
// ==========================================
function seedCourses() {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName('Courses');

  if (!sheet) {
    sheet = ss.insertSheet('Courses');
  }

  // Xóa TOÀN BỘ sheet (kể cả header cũ) rồi tạo lại
  sheet.clear();
  sheet.appendRow(['ID', 'Title', 'Description', 'Thumbnail', 'Instructor', 'Price', 'OriginalPrice', 'Rating', 'ReviewsCount', 'EnrollmentsCount', 'Duration', 'LessonsCount', 'Badge', 'Category', 'MemberLevel']);
  formatHeader_(sheet, 15, '#4a9e4a');

  // Dữ liệu: [ID, Title, Description, Thumbnail, Instructor, Price, OriginalPrice, Rating, ReviewsCount, EnrollmentsCount, Duration, LessonsCount, Badge, Category, MemberLevel]
  var courses = [
    [
      '1',
      'Thiết kế website với Wordpress',
      'Từ con số 0 đến website chuyên nghiệp chỉ trong 30 ngày! Khóa học giúp bạn tự tay xây dựng website bán hàng, landing page, blog cá nhân mà KHÔNG cần biết code. Bạn sẽ học cách chọn hosting, cài đặt Wordpress, thiết kế giao diện đẹp mắt với Elementor, tối ưu SEO và tăng tốc độ website. Hơn 1,500 học viên đã tạo website riêng sau khóa học này.',
      'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=800&h=450&fit=crop',
      'Wepower Edu App',
      868000, 1500000, 4.8, 234, 1543, 14400, 32, 'BESTSELLER', 'Web Dev', 'Free'
    ],
    [
      '2',
      'Khởi nghiệp kiếm tiền online với AI',
      'Khám phá cách tận dụng sức mạnh AI để xây dựng nguồn thu nhập thụ động! Từ ChatGPT, MidJourney đến các công cụ AI tự động - bạn sẽ học cách tạo content, viết copy bán hàng, thiết kế hình ảnh và xây dựng funnel kiếm tiền hoàn toàn bằng AI. Đã có hàng trăm học viên tạo thu nhập từ 10-50 triệu/tháng sau khóa học.',
      'https://images.unsplash.com/photo-1677442136019-21780ecad995?w=800&h=450&fit=crop',
      'Wepower Edu App',
      1868000, 3500000, 4.9, 456, 2871, 18000, 45, 'BESTSELLER', 'AI', 'Free'
    ],
    [
      '3',
      'Xây dựng hệ thống Automation với N8N',
      'Tự động hóa mọi quy trình kinh doanh - tiết kiệm 80% thời gian! Học cách sử dụng N8N (công cụ automation miễn phí) để tự động gửi email, đồng bộ dữ liệu, quản lý đơn hàng, chăm sóc khách hàng tự động. Không cần biết lập trình - chỉ cần kéo thả. Phù hợp cho chủ shop online, freelancer và doanh nghiệp nhỏ.',
      'https://images.unsplash.com/photo-1518432031352-d6fc5c10da5a?w=800&h=450&fit=crop',
      'Wepower Edu App',
      1868000, 3000000, 4.7, 189, 1205, 16200, 38, 'NEW', 'Automation', 'Free'
    ],
    [
      '4',
      'Thiết kế hệ thống chatbot AI',
      'Xây dựng chatbot AI thông minh - phục vụ khách hàng 24/7 không cần nhân viên! Bạn sẽ học cách tạo chatbot tư vấn sản phẩm, hỗ trợ khách hàng, chốt đơn tự động trên Website, Facebook Messenger và Zalo. Tích hợp ChatGPT để chatbot hiểu và trả lời tự nhiên như người thật. Giảm 70% chi phí nhân sự CSKH.',
      'https://images.unsplash.com/photo-1531746790095-e5cb157f3086?w=800&h=450&fit=crop',
      'Wepower Edu App',
      1868000, 2800000, 4.8, 312, 1876, 14400, 35, '', 'AI', 'Free'
    ],
    [
      '5',
      'Xây dựng hệ thống thu hút 1000 khách hàng tự động',
      'Hệ thống marketing tự động giúp bạn có 1000 khách hàng tiềm năng mỗi tháng! Khóa học bật mí bí quyết xây dựng phễu marketing (funnel), chạy quảng cáo Facebook/Google hiệu quả, tạo lead magnet hấp dẫn và nuôi dưỡng khách hàng bằng email automation. Đã được kiểm chứng bởi hơn 200 doanh nghiệp.',
      'https://images.unsplash.com/photo-1533750349088-cd871a92f312?w=800&h=450&fit=crop',
      'Wepower Edu App',
      2868000, 5000000, 4.9, 567, 2341, 21600, 52, 'BESTSELLER', 'Marketing', 'Premium'
    ],
    [
      '6',
      'Khởi nghiệp kiếm tiền với Youtube',
      'Biến Youtube thành cỗ máy in tiền - từ 0 đến 100K subscribers! Học trọn bộ kỹ năng: lên ý tưởng content viral, quay dựng video chuyên nghiệp bằng điện thoại, tối ưu SEO Youtube, xây dựng thương hiệu cá nhân và kiếm tiền từ nhiều nguồn (Adsense, affiliate, tài trợ, bán khóa học). Phù hợp mọi lĩnh vực.',
      'https://images.unsplash.com/photo-1611162616475-46b635cb6868?w=800&h=450&fit=crop',
      'Wepower Edu App',
      1868000, 3200000, 4.6, 278, 1654, 16200, 40, '', 'Marketing', 'Free'
    ],
    [
      '7',
      'Tạo ứng dụng với AI',
      'Không biết code vẫn tạo được app! Khóa học hướng dẫn bạn sử dụng AI (Cursor, V0, Bolt) để xây dựng ứng dụng web và mobile từ A-Z. Từ ý tưởng đến sản phẩm hoàn chỉnh chỉ trong vài giờ. Bạn sẽ tạo được app quản lý, SaaS tool, marketplace... và có thể kiếm tiền ngay từ sản phẩm của mình.',
      'https://images.unsplash.com/photo-1555949963-aa79dcee981c?w=800&h=450&fit=crop',
      'Wepower Edu App',
      868000, 1800000, 4.7, 198, 1432, 10800, 28, 'NEW', 'AI', 'Free'
    ],
    [
      '8',
      'Map To Success',
      'Bản đồ chiến lược dành cho người muốn thành công trong kinh doanh online! Khóa học VIP giúp bạn xây dựng tư duy kinh doanh đúng đắn, lập kế hoạch chiến lược, phân tích thị trường, xây dựng đội nhóm và scale business lên 7 con số. Bao gồm mentoring 1-1 và cộng đồng mastermind độc quyền.',
      'https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?w=800&h=450&fit=crop',
      'Wepower Edu App',
      38868000, 58000000, 4.9, 89, 342, 36000, 65, 'PREMIUM', 'Business', 'VIP'
    ],
    [
      '9',
      'Business Automation Mystery',
      'Bí mật tự động hóa kinh doanh triệu đô - dành riêng cho CEO và founders! Khóa học cao cấp nhất giúp bạn xây dựng hệ thống kinh doanh chạy tự động 24/7: từ marketing, bán hàng, chăm sóc khách hàng đến quản lý tài chính. Bao gồm 12 buổi coaching riêng, templates hệ thống trị giá 100 triệu và lifetime access.',
      'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=800&h=450&fit=crop',
      'Wepower Edu App',
      168868000, 250000000, 5.0, 45, 128, 54000, 85, 'PREMIUM', 'Business', 'VIP'
    ],
    [
      '10',
      'Bản Đồ Kinh Doanh Triệu Đô',
      'Lộ trình chi tiết từ 0 đến doanh thu 1 triệu USD! Đây là khóa học flagship của Wepower Edu App - tổng hợp 10 năm kinh nghiệm kinh doanh online. Bạn sẽ học cách chọn ngách, xây brand, tạo sản phẩm, marketing đa kênh, tối ưu vận hành và mở rộng quy mô. Kèm theo bộ công cụ và template business plan hoàn chỉnh.',
      'https://images.unsplash.com/photo-1553729459-afe8f2e2882d?w=800&h=450&fit=crop',
      'Wepower Edu App',
      68868000, 99000000, 4.9, 67, 215, 43200, 72, 'PREMIUM', 'Business', 'VIP'
    ],
    [
      '11',
      'Business Internet System',
      'Xây dựng hệ thống kinh doanh internet bài bản từ A đến Z! Khóa học hướng dẫn chi tiết cách tạo dựng business online hoàn chỉnh: website bán hàng, hệ thống email marketing, social media, quảng cáo trả phí, affiliate marketing và passive income. Phù hợp cho người mới bắt đầu muốn có thu nhập online ổn định.',
      'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=800&h=450&fit=crop',
      'Wepower Edu App',
      8868000, 15000000, 4.8, 156, 876, 28800, 58, '', 'Business', 'Premium'
    ],
    [
      '12',
      'Wellness To Wealth',
      'Biến đam mê sức khỏe thành nguồn thu nhập bền vững! Khóa học dành cho ai yêu thích lĩnh vực wellness, fitness, dinh dưỡng muốn xây dựng thương hiệu cá nhân và kinh doanh online. Học cách tạo chương trình coaching, bán khóa học online, xây community và tạo passive income từ kiến thức wellness của bạn.',
      'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=800&h=450&fit=crop',
      'Wepower Edu App',
      18868000, 28000000, 4.7, 98, 543, 25200, 48, '', 'Lifestyle', 'Premium'
    ],
    [
      '13',
      'Unlock Your Power',
      'Khai phá tiềm năng vô hạn bên trong bạn! Khóa học phát triển bản thân giúp bạn vượt qua rào cản tâm lý, xây dựng tư duy triệu phú, quản lý thời gian hiệu quả và phát triển kỹ năng lãnh đạo. Kết hợp NLP, coaching và mindfulness - đã thay đổi cuộc sống hàng ngàn người. Bắt đầu hành trình thay đổi ngay hôm nay!',
      'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=800&h=450&fit=crop',
      'Wepower Edu App',
      1868000, 3500000, 4.8, 345, 2156, 14400, 36, 'NEW', 'Lifestyle', 'Free'
    ],
    [
      '14',
      'Design With AI',
      'Thiết kế đồ họa chuyên nghiệp với AI - nhanh gấp 10 lần! Không cần học Photoshop phức tạp - với MidJourney, DALL-E, Canva AI và các công cụ AI mới nhất, bạn có thể tạo logo, banner, social media post, ảnh sản phẩm chất lượng cao trong vài phút. Phù hợp cho marketer, chủ shop và freelancer thiết kế.',
      'https://images.unsplash.com/photo-1561070791-2526d30994b5?w=800&h=450&fit=crop',
      'Wepower Edu App',
      1868000, 2800000, 4.6, 213, 1789, 12600, 30, '', 'AI', 'Free'
    ],
    [
      '15',
      'Master Video AI',
      'Tạo video chuyên nghiệp bằng AI - không cần quay phim, không cần studio! Học cách sử dụng Runway, HeyGen, D-ID, CapCut AI để tạo video marketing, video bán hàng, video giáo dục chất lượng cao. Từ kịch bản AI, giọng đọc AI đến hình ảnh AI - tất cả trong một khóa học. Tiết kiệm hàng trăm triệu chi phí sản xuất video.',
      'https://images.unsplash.com/photo-1574717024653-61fd2cf4d44d?w=800&h=450&fit=crop',
      'Wepower Edu App',
      868000, 1500000, 4.7, 167, 1098, 10800, 26, 'NEW', 'AI', 'Free'
    ]
  ];

  for (var i = 0; i < courses.length; i++) {
    sheet.appendRow(courses[i]);
  }

  sheet.autoResizeColumns(1, 15);
  Logger.log('Đã thêm ' + courses.length + ' khóa học vào tab Courses!');
}

// ==========================================
// TEST - Chạy để kiểm tra kết nối
// ==========================================
function testConnection() {
  var sheet = getSheet_('Users');
  if (!sheet) {
    Logger.log('Tab Users chưa tồn tại! Chạy setup() trước.');
    return;
  }
  var rows = sheet.getLastRow();
  Logger.log('Kết nối OK! Tab Users có ' + rows + ' dòng (kể cả header).');

  // Test login
  var loginResult = handleLogin_({ email: 'admin@wepower.vn', password: '123456' });
  Logger.log('Test login: ' + JSON.stringify(loginResult));
}
