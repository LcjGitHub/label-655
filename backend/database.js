const { DatabaseSync } = require('node:sqlite');
const path = require('path');
const bcrypt = require('bcrypt');

const dbPath = path.join(__dirname, 'messages.db');
let db;

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
      created_at DATETIME NOT NULL
    );

    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      username TEXT NOT NULL,
      content TEXT NOT NULL,
      likes INTEGER NOT NULL DEFAULT 0,
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
      content TEXT NOT NULL,
      created_at DATETIME NOT NULL,
      parent_reply_id INTEGER,
      FOREIGN KEY (message_id) REFERENCES messages (id),
      FOREIGN KEY (parent_reply_id) REFERENCES replies (id)
    )
  `);

  migrateDatabase();
}

function migrateDatabase() {
  try {
    const msgColumns = db.prepare("PRAGMA table_info(messages)").all();
    const hasLikesColumn = msgColumns.some(col => col.name === 'likes');

    if (!hasLikesColumn) {
      db.exec('ALTER TABLE messages ADD COLUMN likes INTEGER NOT NULL DEFAULT 0');
      console.log('已迁移 messages 表，添加 likes 字段');
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
  } catch (err) {
    console.error('数据库迁移失败:', err);
  }
}

function createUser(username, password, email) {
  const createdAt = new Date().toISOString();
  const hashedPassword = bcrypt.hashSync(password, 10);

  const stmt = db.prepare('INSERT INTO users (username, password, email, created_at) VALUES (?, ?, ?, ?)');
  const result = stmt.run(username, hashedPassword, email, createdAt);

  const getStmt = db.prepare('SELECT id, username, email, created_at FROM users WHERE id = ?');
  const user = getStmt.get(result.lastInsertRowid);

  return user;
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
  const stmt = db.prepare('SELECT id, username, email, created_at FROM users WHERE id = ?');
  return stmt.get(id);
}

function getMessages(page, pageSize) {
  if (pageSize < 1) pageSize = 5;
  if (pageSize > 100) pageSize = 100;

  const countStmt = db.prepare('SELECT COUNT(*) as total FROM messages');
  const { total } = countStmt.get();
  const totalPages = Math.ceil(total / pageSize);

  if (page < 1) {
    page = 1;
  }
  if (totalPages > 0 && page > totalPages) {
    page = totalPages;
  }

  const offset = (page - 1) * pageSize;
  const stmt = db.prepare('SELECT * FROM messages ORDER BY created_at DESC LIMIT ? OFFSET ?');
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

function insertMessage(userId, username, content) {
  const createdAt = new Date().toISOString();

  const stmt = db.prepare('INSERT INTO messages (user_id, username, content, created_at) VALUES (?, ?, ?, ?)');
  const result = stmt.run(userId, username, content, createdAt);

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

function insertReply(messageId, username, content, parentReplyId = null) {
  const createdAt = new Date().toISOString();

  const stmt = db.prepare('INSERT INTO replies (message_id, username, content, created_at, parent_reply_id) VALUES (?, ?, ?, ?, ?)');
  const result = stmt.run(messageId, username, content, createdAt, parentReplyId);

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

  const countStmt = db.prepare('SELECT COUNT(*) as total FROM messages');
  const { total } = countStmt.get();
  const totalPages = Math.ceil(total / pageSize);

  if (page < 1) {
    page = 1;
  }
  if (totalPages > 0 && page > totalPages) {
    page = totalPages;
  }

  const offset = (page - 1) * pageSize;
  const stmt = db.prepare('SELECT * FROM messages ORDER BY created_at DESC LIMIT ? OFFSET ?');
  const messages = stmt.all(pageSize, offset);

  let likedMessageIds = [];
  if (userId) {
    const likeStmt = db.prepare('SELECT message_id FROM likes WHERE user_id = ?');
    likedMessageIds = likeStmt.all(userId).map(row => row.message_id);
  } else if (ipAddress) {
    const likeStmt = db.prepare('SELECT message_id FROM likes WHERE ip_address = ?');
    likedMessageIds = likeStmt.all(ipAddress).map(row => row.message_id);
  }

  messages.forEach(msg => {
    msg.is_liked = likedMessageIds.includes(msg.id);
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

  try {
    db.exec('BEGIN TRANSACTION');

    if (existingLike) {
      db.prepare(`DELETE FROM likes WHERE ${whereClause}`).run(...whereParams);
      db.prepare('UPDATE messages SET likes = likes - 1 WHERE id = ?').run(messageId);
      result = { liked: false, likes: message.likes - 1 };
    } else {
      db.prepare(`INSERT INTO likes (${insertFields}) VALUES (?, ?, ?)`).run(...insertValues, createdAt);
      db.prepare('UPDATE messages SET likes = likes + 1 WHERE id = ?').run(messageId);
      result = { liked: true, likes: message.likes + 1 };
    }

    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }

  return result;
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
  getRepliesByMessageId,
  insertReply,
  getMessageById,
  getReplyById,
  getLikeStatus,
  toggleLike
};
