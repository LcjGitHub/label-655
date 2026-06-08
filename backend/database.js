const { DatabaseSync } = require('node:sqlite');
const path = require('path');
const bcrypt = require('bcrypt');

const dbPath = path.join(__dirname, 'messages.db');
let db;

const POINT_RULES = {
  POST_MESSAGE: 5,
  LIKE_RECEIVED: 1,
  DAILY_CHECKIN: 2,
  DAILY_POST_LIMIT: 50
};

const LEVELS = [
  { name: '新手', minPoints: 0, icon: '🌱', color: '#95a5a6' },
  { name: '活跃用户', minPoints: 50, icon: '🌿', color: '#27ae60' },
  { name: '达人', minPoints: 200, icon: '🌳', color: '#f39c12' },
  { name: '专家', minPoints: 500, icon: '⭐', color: '#e74c3c' }
];

function getLevelByPoints(points) {
  let level = LEVELS[0];
  for (let i = LEVELS.length - 1; i >= 0; i--) {
    if (points >= LEVELS[i].minPoints) {
      level = LEVELS[i];
      break;
    }
  }
  return { ...level, nextLevel: LEVELS[LEVELS.indexOf(level) + 1] || null };
}

function getLevelConfig() {
  return LEVELS.map(level => ({
    name: level.name,
    minPoints: level.minPoints,
    icon: level.icon
  }));
}

function initDatabase() {
  db = new DatabaseSync(dbPath);
  console.log('已连接到 SQLite 数据库');

  createTables();
  console.log('数据库表已就绪');
}

function createTables() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      password TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      points INTEGER NOT NULL DEFAULT 0,
      level TEXT NOT NULL DEFAULT '新手',
      last_checkin_date TEXT,
      created_at DATETIME NOT NULL
    );

    CREATE TABLE IF NOT EXISTS point_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      points INTEGER NOT NULL,
      reason TEXT NOT NULL,
      related_id INTEGER,
      created_at DATETIME NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users (id)
    );

    CREATE TABLE IF NOT EXISTS admins (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      password TEXT NOT NULL,
      created_at DATETIME NOT NULL
    );

    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      username TEXT NOT NULL,
      avatar TEXT,
      content TEXT NOT NULL,
      likes INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'pending',
      is_deleted INTEGER NOT NULL DEFAULT 0,
      is_pinned INTEGER NOT NULL DEFAULT 0,
      pinned_at DATETIME,
      created_at DATETIME NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users (id)
    );

    CREATE TABLE IF NOT EXISTS likes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      ip_address TEXT,
      message_id INTEGER NOT NULL,
      created_at DATETIME NOT NULL,
      UNIQUE(user_id, message_id),
      UNIQUE(ip_address, message_id),
      FOREIGN KEY (user_id) REFERENCES users (id),
      FOREIGN KEY (message_id) REFERENCES messages (id)
    );

    CREATE TABLE IF NOT EXISTS replies (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      message_id INTEGER NOT NULL,
      username TEXT NOT NULL,
      avatar TEXT,
      content TEXT NOT NULL,
      created_at DATETIME NOT NULL,
      parent_reply_id INTEGER,
      FOREIGN KEY (message_id) REFERENCES messages (id),
      FOREIGN KEY (parent_reply_id) REFERENCES replies (id)
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL DEFAULT 'new_message',
      content TEXT NOT NULL,
      message_id INTEGER,
      is_read INTEGER NOT NULL DEFAULT 0,
      created_at DATETIME NOT NULL,
      FOREIGN KEY (message_id) REFERENCES messages (id)
    )
  `);

  seedDefaultAdmin();
  migrateDatabase();
}

function seedDefaultAdmin() {
  try {
    const stmt = db.prepare('SELECT COUNT(*) as count FROM admins');
    const { count } = stmt.get();
    if (count === 0) {
      const createdAt = new Date().toISOString();
      const hashedPassword = bcrypt.hashSync('admin123', 10);
      const insertStmt = db.prepare('INSERT INTO admins (username, password, created_at) VALUES (?, ?, ?)');
      insertStmt.run('admin', hashedPassword, createdAt);
      console.log('已创建默认管理员账号: admin / admin123');
    }
  } catch (err) {
    console.error('创建默认管理员失败:', err);
  }
}

function migrateDatabase() {
  try {
    const msgColumns = db.prepare("PRAGMA table_info(messages)").all();
    const hasLikesColumn = msgColumns.some(col => col.name === 'likes');
    const hasStatusColumn = msgColumns.some(col => col.name === 'status');
    const hasIsDeletedColumn = msgColumns.some(col => col.name === 'is_deleted');

    if (!hasLikesColumn) {
      db.exec('ALTER TABLE messages ADD COLUMN likes INTEGER NOT NULL DEFAULT 0');
      console.log('已迁移 messages 表，添加 likes 字段');
    }

    if (!hasStatusColumn) {
      db.exec("ALTER TABLE messages ADD COLUMN status TEXT NOT NULL DEFAULT 'approved'");
      console.log('已迁移 messages 表，添加 status 字段');
    }

    if (!hasIsDeletedColumn) {
      db.exec('ALTER TABLE messages ADD COLUMN is_deleted INTEGER NOT NULL DEFAULT 0');
      console.log('已迁移 messages 表，添加 is_deleted 字段');
    }

    const hasUpdatedAtColumn = msgColumns.some(col => col.name === 'updated_at');
    if (!hasUpdatedAtColumn) {
      db.exec('ALTER TABLE messages ADD COLUMN updated_at DATETIME');
      console.log('已迁移 messages 表，添加 updated_at 字段');
    }

    const hasAvatarColumn = msgColumns.some(col => col.name === 'avatar');
    if (!hasAvatarColumn) {
      db.exec('ALTER TABLE messages ADD COLUMN avatar TEXT');
      console.log('已迁移 messages 表，添加 avatar 字段');
    }

    const likesColumns = db.prepare("PRAGMA table_info(likes)").all();
    const hasIpColumn = likesColumns.some(col => col.name === 'ip_address');
    const userIdCol = likesColumns.find(col => col.name === 'user_id');
    const userIdNullable = userIdCol ? userIdCol.notnull === 0 : true;

    if (!hasIpColumn || !userIdNullable) {
      db.exec(`
        CREATE TABLE IF NOT EXISTS likes_new (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER,
          ip_address TEXT,
          message_id INTEGER NOT NULL,
          created_at DATETIME NOT NULL,
          UNIQUE(user_id, message_id),
          UNIQUE(ip_address, message_id),
          FOREIGN KEY (user_id) REFERENCES users (id),
          FOREIGN KEY (message_id) REFERENCES messages (id)
        );
        INSERT INTO likes_new (id, user_id, message_id, created_at)
          SELECT id, user_id, message_id, created_at FROM likes;
        DROP TABLE IF EXISTS likes;
        ALTER TABLE likes_new RENAME TO likes;
      `);
      console.log('已迁移 likes 表，添加 ip_address 字段');
    }

    const replyColumns = db.prepare("PRAGMA table_info(replies)").all();
    const hasReplyAvatarColumn = replyColumns.some(col => col.name === 'avatar');
    if (!hasReplyAvatarColumn) {
      db.exec('ALTER TABLE replies ADD COLUMN avatar TEXT');
      console.log('已迁移 replies 表，添加 avatar 字段');
    }

    const hasIsPinnedColumn = msgColumns.some(col => col.name === 'is_pinned');
    if (!hasIsPinnedColumn) {
      db.exec('ALTER TABLE messages ADD COLUMN is_pinned INTEGER NOT NULL DEFAULT 0');
      console.log('已迁移 messages 表，添加 is_pinned 字段');
    }

    const hasPinnedAtColumn = msgColumns.some(col => col.name === 'pinned_at');
    if (!hasPinnedAtColumn) {
      db.exec('ALTER TABLE messages ADD COLUMN pinned_at DATETIME');
      console.log('已迁移 messages 表，添加 pinned_at 字段');
    }

    const userColumns = db.prepare("PRAGMA table_info(users)").all();
    const hasPointsColumn = userColumns.some(col => col.name === 'points');
    const hasLevelColumn = userColumns.some(col => col.name === 'level');
    const hasLastCheckinColumn = userColumns.some(col => col.name === 'last_checkin_date');

    if (!hasPointsColumn) {
      db.exec('ALTER TABLE users ADD COLUMN points INTEGER NOT NULL DEFAULT 0');
      console.log('已迁移 users 表，添加 points 字段');
    }
    if (!hasLevelColumn) {
      db.exec("ALTER TABLE users ADD COLUMN level TEXT NOT NULL DEFAULT '新手'");
      console.log('已迁移 users 表，添加 level 字段');
    }
    if (!hasLastCheckinColumn) {
      db.exec('ALTER TABLE users ADD COLUMN last_checkin_date TEXT');
      console.log('已迁移 users 表，添加 last_checkin_date 字段');
    }
  } catch (err) {
    console.error('数据库迁移失败:', err);
  }
}

function getAdminByUsername(username) {
  const stmt = db.prepare('SELECT * FROM admins WHERE username = ?');
  return stmt.get(username);
}

function getAdminById(id) {
  const stmt = db.prepare('SELECT id, username, created_at FROM admins WHERE id = ?');
  return stmt.get(id);
}

function createUser(username, password, email) {
  const createdAt = new Date().toISOString();
  const hashedPassword = bcrypt.hashSync(password, 10);
  const initialPoints = 0;
  const initialLevel = '新手';

  const stmt = db.prepare('INSERT INTO users (username, password, email, points, level, created_at) VALUES (?, ?, ?, ?, ?, ?)');
  const result = stmt.run(username, hashedPassword, email, initialPoints, initialLevel, createdAt);

  return getUserById(result.lastInsertRowid);
}

function getUserByUsername(username) {
  const stmt = db.prepare('SELECT * FROM users WHERE username = ?');
  return stmt.get(username);
}

function getUserByEmail(email) {
  const stmt = db.prepare('SELECT * FROM users WHERE email = ?');
  return stmt.get(email);
}

function getUserById(id) {
  const stmt = db.prepare('SELECT id, username, email, points, level, last_checkin_date, created_at FROM users WHERE id = ?');
  const user = stmt.get(id);
  if (user) {
    const levelInfo = getLevelByPoints(user.points);
    user.level_info = levelInfo;
  }
  return user;
}

function getUserWithFullInfo(id) {
  const user = getUserById(id);
  if (!user) return null;
  return user;
}

function addPoints(userId, points, reason, relatedId = null) {
  const user = getUserById(userId);
  if (!user) {
    throw new Error('用户不存在');
  }

  const newPoints = user.points + points;
  const levelInfo = getLevelByPoints(newPoints);
  const createdAt = new Date().toISOString();

  try {
    db.exec('BEGIN TRANSACTION');

    db.prepare('UPDATE users SET points = ?, level = ? WHERE id = ?').run(newPoints, levelInfo.name, userId);
    db.prepare('INSERT INTO point_logs (user_id, points, reason, related_id, created_at) VALUES (?, ?, ?, ?, ?)')
      .run(userId, points, reason, relatedId, createdAt);

    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }

  return { points: newPoints, level: levelInfo.name, levelInfo };
}

function getTodayDateKey() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function getTodayPostPoints(userId) {
  const todayKey = getTodayDateKey();
  const startOfDay = new Date(todayKey + 'T00:00:00.000Z').toISOString();
  const nextDay = new Date(todayKey + 'T23:59:59.999Z').toISOString();

  const stmt = db.prepare(`
    SELECT COALESCE(SUM(points), 0) as total
    FROM point_logs
    WHERE user_id = ? AND reason = 'post_message' AND created_at >= ? AND created_at <= ?
  `);
  const result = stmt.get(userId, startOfDay, nextDay);
  return result.total;
}

function dailyCheckIn(userId) {
  const user = getUserById(userId);
  if (!user) {
    throw new Error('用户不存在');
  }

  const todayKey = getTodayDateKey();
  if (user.last_checkin_date === todayKey) {
    return { checkedIn: false, message: '今日已签到', points: user.points, level: user.level };
  }

  try {
    db.exec('BEGIN TRANSACTION');

    db.prepare('UPDATE users SET last_checkin_date = ? WHERE id = ?').run(todayKey, userId);
    const result = addPoints(userId, POINT_RULES.DAILY_CHECKIN, 'daily_checkin');

    db.exec('COMMIT');

    return { checkedIn: true, message: '签到成功', points: result.points, level: result.level, levelInfo: result.levelInfo, earnedPoints: POINT_RULES.DAILY_CHECKIN };
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}

function addPostMessagePoints(userId, messageId) {
  const todayPoints = getTodayPostPoints(userId);
  if (todayPoints >= POINT_RULES.DAILY_POST_LIMIT) {
    return { awarded: false, message: `每日留言积分已达上限 ${POINT_RULES.DAILY_POST_LIMIT} 分` };
  }

  const availablePoints = POINT_RULES.DAILY_POST_LIMIT - todayPoints;
  const actualPoints = Math.min(POINT_RULES.POST_MESSAGE, availablePoints);

  if (actualPoints <= 0) {
    return { awarded: false, message: `每日留言积分已达上限 ${POINT_RULES.DAILY_POST_LIMIT} 分` };
  }

  const result = addPoints(userId, actualPoints, 'post_message', messageId);
  return { awarded: true, points: actualPoints, totalPoints: result.points, level: result.level, levelInfo: result.levelInfo };
}

function addLikePoints(messageOwnerId, messageId) {
  if (!messageOwnerId) {
    return { awarded: false };
  }
  const result = addPoints(messageOwnerId, POINT_RULES.LIKE_RECEIVED, 'like_received', messageId);
  return { awarded: true, points: POINT_RULES.LIKE_RECEIVED, totalPoints: result.points, level: result.level };
}

function deductLikePoints(messageOwnerId, messageId) {
  if (!messageOwnerId) {
    return { awarded: false };
  }
  const result = addPoints(messageOwnerId, -POINT_RULES.LIKE_RECEIVED, 'like_canceled', messageId);
  return { awarded: true, points: -POINT_RULES.LIKE_RECEIVED, totalPoints: result.points, level: result.level };
}

function getPointLogs(userId, page = 1, pageSize = 20) {
  if (pageSize < 1) pageSize = 10;
  if (pageSize > 100) pageSize = 100;
  if (page < 1) page = 1;

  const countStmt = db.prepare('SELECT COUNT(*) as total FROM point_logs WHERE user_id = ?');
  const { total } = countStmt.get(userId);
  const totalPages = Math.ceil(total / pageSize);
  if (totalPages > 0 && page > totalPages) page = totalPages;

  const offset = (page - 1) * pageSize;
  const stmt = db.prepare('SELECT * FROM point_logs WHERE user_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?');
  const logs = stmt.all(userId, pageSize, offset);

  return {
    logs,
    pagination: {
      currentPage: page,
      pageSize,
      total,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1
    }
  };
}

function getMessages(page, pageSize) {
  if (pageSize < 1) pageSize = 5;
  if (pageSize > 100) pageSize = 100;

  const countStmt = db.prepare("SELECT COUNT(*) as total FROM messages WHERE is_deleted = 0 AND status = 'approved'");
  const { total } = countStmt.get();
  const totalPages = Math.ceil(total / pageSize);

  if (page < 1) {
    page = 1;
  }
  if (totalPages > 0 && page > totalPages) {
    page = totalPages;
  }

  const offset = (page - 1) * pageSize;
  const stmt = db.prepare("SELECT * FROM messages WHERE is_deleted = 0 AND status = 'approved' ORDER BY is_pinned DESC, pinned_at DESC, created_at DESC LIMIT ? OFFSET ?");
  const messages = stmt.all(pageSize, offset);

  return {
    messages,
    pagination: {
      currentPage: page,
      pageSize: pageSize,
      total: total,
      totalPages: totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1
    }
  };
}

function getAllMessagesForAdmin(page, pageSize, status = null) {
  if (pageSize < 1) pageSize = 10;
  if (pageSize > 200) pageSize = 200;

  let whereClauses = [];
  let params = [];

  if (status === 'deleted') {
    whereClauses.push('is_deleted = 1');
  } else {
    whereClauses.push('is_deleted = 0');
    if (status && ['pending', 'approved', 'rejected'].includes(status)) {
      whereClauses.push('status = ?');
      params.push(status);
    }
  }

  const whereSql = whereClauses.length > 0 ? 'WHERE ' + whereClauses.join(' AND ') : '';

  const countStmt = db.prepare(`SELECT COUNT(*) as total FROM messages ${whereSql}`);
  const { total } = countStmt.get(...params);
  const totalPages = Math.ceil(total / pageSize);

  if (page < 1) {
    page = 1;
  }
  if (totalPages > 0 && page > totalPages) {
    page = totalPages;
  }

  const offset = (page - 1) * pageSize;
  const stmt = db.prepare(`SELECT * FROM messages ${whereSql} ORDER BY is_pinned DESC, pinned_at DESC, created_at DESC LIMIT ? OFFSET ?`);
  const messages = stmt.all(...params, pageSize, offset);

  return {
    messages,
    pagination: {
      currentPage: page,
      pageSize: pageSize,
      total: total,
      totalPages: totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1
    }
  };
}

function getMessageStats() {
  const pendingStmt = db.prepare("SELECT COUNT(*) as count FROM messages WHERE is_deleted = 0 AND status = 'pending'");
  const approvedStmt = db.prepare("SELECT COUNT(*) as count FROM messages WHERE is_deleted = 0 AND status = 'approved'");
  const rejectedStmt = db.prepare("SELECT COUNT(*) as count FROM messages WHERE is_deleted = 0 AND status = 'rejected'");
  const deletedStmt = db.prepare('SELECT COUNT(*) as count FROM messages WHERE is_deleted = 1');

  return {
    pending: pendingStmt.get().count,
    approved: approvedStmt.get().count,
    rejected: rejectedStmt.get().count,
    deleted: deletedStmt.get().count
  };
}

function reviewMessage(messageId, status) {
  if (!['approved', 'rejected'].includes(status)) {
    throw new Error('无效的审核状态');
  }
  const message = db.prepare('SELECT * FROM messages WHERE id = ?').get(messageId);
  if (!message) {
    throw new Error('留言不存在');
  }
  db.prepare('UPDATE messages SET status = ? WHERE id = ?').run(status, messageId);
  return db.prepare('SELECT * FROM messages WHERE id = ?').get(messageId);
}

function softDeleteMessage(messageId) {
  const message = db.prepare('SELECT * FROM messages WHERE id = ?').get(messageId);
  if (!message) {
    throw new Error('留言不存在');
  }
  db.prepare('UPDATE messages SET is_deleted = 1 WHERE id = ?').run(messageId);
  return true;
}

function batchReviewMessages(messageIds, status) {
  if (!['approved', 'rejected'].includes(status)) {
    throw new Error('无效的审核状态');
  }
  if (!Array.isArray(messageIds) || messageIds.length === 0) {
    return 0;
  }
  const placeholders = messageIds.map(() => '?').join(',');
  const stmt = db.prepare(`UPDATE messages SET status = ? WHERE id IN (${placeholders})`);
  const result = stmt.run(status, ...messageIds);
  return result.changes;
}

function batchSoftDeleteMessages(messageIds) {
  if (!Array.isArray(messageIds) || messageIds.length === 0) {
    return 0;
  }
  const placeholders = messageIds.map(() => '?').join(',');
  const stmt = db.prepare(`UPDATE messages SET is_deleted = 1 WHERE id IN (${placeholders})`);
  const result = stmt.run(...messageIds);
  return result.changes;
}

function pinMessage(messageId) {
  const message = db.prepare('SELECT * FROM messages WHERE id = ?').get(messageId);
  if (!message) {
    throw new Error('留言不存在');
  }
  const pinnedAt = new Date().toISOString();
  db.prepare('UPDATE messages SET is_pinned = 1, pinned_at = ? WHERE id = ?').run(pinnedAt, messageId);
  return db.prepare('SELECT * FROM messages WHERE id = ?').get(messageId);
}

function unpinMessage(messageId) {
  const message = db.prepare('SELECT * FROM messages WHERE id = ?').get(messageId);
  if (!message) {
    throw new Error('留言不存在');
  }
  db.prepare('UPDATE messages SET is_pinned = 0, pinned_at = NULL WHERE id = ?').run(messageId);
  return db.prepare('SELECT * FROM messages WHERE id = ?').get(messageId);
}

function insertMessage(userId, username, content, avatar = null) {
  const createdAt = new Date().toISOString();

  const stmt = db.prepare('INSERT INTO messages (user_id, username, avatar, content, created_at, status) VALUES (?, ?, ?, ?, ?, ?)');
  const result = stmt.run(userId, username, avatar, content, createdAt, 'pending');

  const getStmt = db.prepare('SELECT * FROM messages WHERE id = ?');
  const message = getStmt.get(result.lastInsertRowid);

  return message;
}

function getRepliesByMessageId(messageId) {
  const stmt = db.prepare(`
    SELECT r1.*, r2.username as parent_username
    FROM replies r1
    LEFT JOIN replies r2 ON r1.parent_reply_id = r2.id
    WHERE r1.message_id = ?
    ORDER BY r1.created_at ASC
  `);
  const replies = stmt.all(messageId);
  return replies;
}

function insertReply(messageId, username, content, parentReplyId = null, avatar = null) {
  const createdAt = new Date().toISOString();

  const stmt = db.prepare('INSERT INTO replies (message_id, username, avatar, content, created_at, parent_reply_id) VALUES (?, ?, ?, ?, ?, ?)');
  const result = stmt.run(messageId, username, avatar, content, createdAt, parentReplyId);

  const getStmt = db.prepare(`
    SELECT r1.*, r2.username as parent_username
    FROM replies r1
    LEFT JOIN replies r2 ON r1.parent_reply_id = r2.id
    WHERE r1.id = ?
  `);
  const reply = getStmt.get(result.lastInsertRowid);

  return reply;
}

function getMessageById(messageId) {
  const stmt = db.prepare('SELECT * FROM messages WHERE id = ?');
  return stmt.get(messageId);
}

function getReplyById(replyId) {
  const stmt = db.prepare('SELECT * FROM replies WHERE id = ?');
  return stmt.get(replyId);
}

function getLikeStatus(userId, ipAddress, messageId) {
  let stmt;
  let params;
  if (userId) {
    stmt = db.prepare('SELECT * FROM likes WHERE user_id = ? AND message_id = ?');
    params = [userId, messageId];
  } else if (ipAddress) {
    stmt = db.prepare('SELECT * FROM likes WHERE ip_address = ? AND message_id = ?');
    params = [ipAddress, messageId];
  } else {
    return false;
  }
  return stmt.get(...params) !== undefined;
}

function getMessagesWithLikeStatus(page, pageSize, userId, ipAddress) {
  if (pageSize < 1) pageSize = 5;
  if (pageSize > 100) pageSize = 100;

  const countStmt = db.prepare("SELECT COUNT(*) as total FROM messages WHERE is_deleted = 0 AND status = 'approved'");
  const { total } = countStmt.get();
  const totalPages = Math.ceil(total / pageSize);

  if (page < 1) {
    page = 1;
  }
  if (totalPages > 0 && page > totalPages) {
    page = totalPages;
  }

  const offset = (page - 1) * pageSize;
  const stmt = db.prepare("SELECT * FROM messages WHERE is_deleted = 0 AND status = 'approved' ORDER BY is_pinned DESC, pinned_at DESC, created_at DESC LIMIT ? OFFSET ?");
  const messages = stmt.all(pageSize, offset);

  let likedMessageIds = [];
  if (userId) {
    const likeStmt = db.prepare('SELECT message_id FROM likes WHERE user_id = ?');
    likedMessageIds = likeStmt.all(userId).map(row => row.message_id);
  } else if (ipAddress) {
    const likeStmt = db.prepare('SELECT message_id FROM likes WHERE ip_address = ?');
    likedMessageIds = likeStmt.all(ipAddress).map(row => row.message_id);
  }

  const userStmt = db.prepare('SELECT id, username, points, level FROM users WHERE id = ?');
  messages.forEach(msg => {
    msg.is_liked = likedMessageIds.includes(msg.id);
    if (msg.user_id) {
      const author = userStmt.get(msg.user_id);
      if (author) {
        msg.author_points = author.points;
        msg.author_level = author.level;
        const levelInfo = getLevelByPoints(author.points);
        msg.author_level_icon = levelInfo.icon;
        msg.author_level_color = levelInfo.color;
      }
    }
  });

  return {
    messages,
    pagination: {
      currentPage: page,
      pageSize: pageSize,
      total: total,
      totalPages: totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1
    }
  };
}

function updateMessage(messageId, content) {
  const message = db.prepare('SELECT * FROM messages WHERE id = ?').get(messageId);
  if (!message) {
    throw new Error('留言不存在');
  }
  const updatedAt = new Date().toISOString();
  db.prepare('UPDATE messages SET content = ?, updated_at = ? WHERE id = ?').run(content, updatedAt, messageId);
  return db.prepare('SELECT * FROM messages WHERE id = ?').get(messageId);
}

function toggleLike(userId, ipAddress, messageId) {
  if (!userId && !ipAddress) {
    throw new Error('无法识别用户身份');
  }

  let whereClause;
  let whereParams;
  let insertFields;
  let insertValues;

  if (userId) {
    whereClause = 'user_id = ? AND message_id = ?';
    whereParams = [userId, messageId];
    insertFields = 'user_id, message_id, created_at';
    insertValues = [userId, messageId];
  } else {
    whereClause = 'ip_address = ? AND message_id = ?';
    whereParams = [ipAddress, messageId];
    insertFields = 'ip_address, message_id, created_at';
    insertValues = [ipAddress, messageId];
  }

  const message = db.prepare('SELECT * FROM messages WHERE id = ?').get(messageId);
  if (!message) {
    throw new Error('留言不存在');
  }

  const existingLike = db.prepare(`SELECT * FROM likes WHERE ${whereClause}`).get(...whereParams);
  const createdAt = new Date().toISOString();
  let result;

  const messageOwnerId = message.user_id;
  const isSelfLike = userId && messageOwnerId && userId === messageOwnerId;

  try {
    db.exec('BEGIN TRANSACTION');

    if (existingLike) {
      db.prepare(`DELETE FROM likes WHERE ${whereClause}`).run(...whereParams);
      db.prepare('UPDATE messages SET likes = likes - 1 WHERE id = ?').run(messageId);
      result = { liked: false, likes: message.likes - 1 };
      if (userId && !isSelfLike && messageOwnerId) {
        deductLikePoints(messageOwnerId, messageId);
      }
    } else {
      db.prepare(`INSERT INTO likes (${insertFields}) VALUES (?, ?, ?)`).run(...insertValues, createdAt);
      db.prepare('UPDATE messages SET likes = likes + 1 WHERE id = ?').run(messageId);
      result = { liked: true, likes: message.likes + 1 };
      if (userId && !isSelfLike && messageOwnerId) {
        addLikePoints(messageOwnerId, messageId);
      }
    }

    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }

  return result;
}

function insertNotification(type, content, messageId = null) {
  const createdAt = new Date().toISOString();
  const stmt = db.prepare('INSERT INTO notifications (type, content, message_id, is_read, created_at) VALUES (?, ?, ?, 0, ?)');
  const result = stmt.run(type, content, messageId, createdAt);

  const getStmt = db.prepare('SELECT * FROM notifications WHERE id = ?');
  return getStmt.get(result.lastInsertRowid);
}

function getNotifications(page = 1, pageSize = 10, isRead = null) {
  if (pageSize < 1) pageSize = 10;
  if (pageSize > 200) pageSize = 200;

  let whereClauses = [];
  let params = [];

  if (isRead !== null) {
    whereClauses.push('is_read = ?');
    params.push(isRead ? 1 : 0);
  }

  const whereSql = whereClauses.length > 0 ? 'WHERE ' + whereClauses.join(' AND ') : '';

  const countStmt = db.prepare(`SELECT COUNT(*) as total FROM notifications ${whereSql}`);
  const { total } = countStmt.get(...params);
  const totalPages = Math.ceil(total / pageSize);

  if (page < 1) page = 1;
  if (totalPages > 0 && page > totalPages) page = totalPages;

  const offset = (page - 1) * pageSize;
  const stmt = db.prepare(`SELECT * FROM notifications ${whereSql} ORDER BY created_at DESC LIMIT ? OFFSET ?`);
  const notifications = stmt.all(...params, pageSize, offset);

  return {
    notifications,
    pagination: {
      currentPage: page,
      pageSize: pageSize,
      total: total,
      totalPages: totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1
    }
  };
}

function getUnreadNotificationCount() {
  const stmt = db.prepare('SELECT COUNT(*) as count FROM notifications WHERE is_read = 0');
  return stmt.get().count;
}

function markNotificationAsRead(notificationId) {
  const notification = db.prepare('SELECT * FROM notifications WHERE id = ?').get(notificationId);
  if (!notification) {
    throw new Error('通知不存在');
  }
  db.prepare('UPDATE notifications SET is_read = 1 WHERE id = ?').run(notificationId);
  return db.prepare('SELECT * FROM notifications WHERE id = ?').get(notificationId);
}

function markAllNotificationsAsRead() {
  const result = db.prepare('UPDATE notifications SET is_read = 1 WHERE is_read = 0').run();
  return result.changes;
}

function getNotificationById(notificationId) {
  const stmt = db.prepare('SELECT * FROM notifications WHERE id = ?');
  return stmt.get(notificationId);
}

function getTotalMessageCount() {
  const stmt = db.prepare("SELECT COUNT(*) as count FROM messages WHERE is_deleted = 0 AND status = 'approved'");
  return stmt.get().count;
}

function getLocalDateKey(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function getLocalStartOfDayISO(d) {
  const local = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
  return local.toISOString();
}

function getTodayMessageCount() {
  const today = new Date();
  const startOfDay = getLocalStartOfDayISO(today);
  const stmt = db.prepare("SELECT COUNT(*) as count FROM messages WHERE is_deleted = 0 AND status = 'approved' AND created_at >= ?");
  return stmt.get(startOfDay).count;
}

function getLast7DaysTrend() {
  const result = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (let i = 6; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    const dateStr = getLocalDateKey(date);
    const nextDate = new Date(date);
    nextDate.setDate(nextDate.getDate() + 1);

    const startISO = getLocalStartOfDayISO(date);
    const endISO = getLocalStartOfDayISO(nextDate);

    const stmt = db.prepare("SELECT COUNT(*) as count FROM messages WHERE is_deleted = 0 AND status = 'approved' AND created_at >= ? AND created_at < ?");
    const { count } = stmt.get(startISO, endISO);
    result.push({
      date: dateStr,
      label: `${date.getMonth() + 1}/${date.getDate()}`,
      count
    });
  }
  return result;
}

function getTopActiveUsers(limit = 5) {
  const stmt = db.prepare(`
    SELECT username, COUNT(*) as count
    FROM messages
    WHERE is_deleted = 0 AND status = 'approved'
    GROUP BY username
    ORDER BY count DESC
    LIMIT ?
  `);
  return stmt.all(limit);
}

function getHourlyDistribution() {
  const result = new Array(24).fill(0);
  const stmt = db.prepare(`
    SELECT created_at
    FROM messages
    WHERE is_deleted = 0 AND status = 'approved'
  `);
  const rows = stmt.all();
  rows.forEach(row => {
    const d = new Date(row.created_at);
    const localHour = d.getHours();
    result[localHour] += 1;
  });
  return result;
}

function getPublicStats() {
  return {
    totalMessages: getTotalMessageCount(),
    todayMessages: getTodayMessageCount(),
    last7Days: getLast7DaysTrend(),
    topUsers: getTopActiveUsers(5),
    hourlyDistribution: getHourlyDistribution()
  };
}

function getMessagesByIds(ids) {
  if (!Array.isArray(ids) || ids.length === 0) return [];
  const placeholders = ids.map(() => '?').join(',');
  const stmt = db.prepare(`SELECT id, user_id, username, status FROM messages WHERE id IN (${placeholders})`);
  return stmt.all(...ids);
}

module.exports = {
  initDatabase,
  getMessages,
  getMessagesWithLikeStatus,
  insertMessage,
  createUser,
  getUserByUsername,
  getUserByEmail,
  getUserById,
  getUserWithFullInfo,
  getAdminByUsername,
  getAdminById,
  getAllMessagesForAdmin,
  getMessageStats,
  reviewMessage,
  softDeleteMessage,
  batchReviewMessages,
  batchSoftDeleteMessages,
  pinMessage,
  unpinMessage,
  getRepliesByMessageId,
  insertReply,
  getMessageById,
  getReplyById,
  getLikeStatus,
  toggleLike,
  updateMessage,
  insertNotification,
  getNotifications,
  getUnreadNotificationCount,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  getNotificationById,
  getPublicStats,
  getTotalMessageCount,
  getTodayMessageCount,
  getLast7DaysTrend,
  getTopActiveUsers,
  getHourlyDistribution,
  getMessagesByIds,
  addPoints,
  dailyCheckIn,
  addPostMessagePoints,
  addLikePoints,
  deductLikePoints,
  getPointLogs,
  getLevelByPoints,
  getLevelConfig,
  POINT_RULES,
  LEVELS
};
