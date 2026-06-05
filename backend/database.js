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
      user_id INTEGER NOT NULL,
      message_id INTEGER NOT NULL,
      created_at DATETIME NOT NULL,
      UNIQUE(user_id, message_id),
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
    const checkColumn = db.prepare("PRAGMA table_info(messages)");
    const columns = checkColumn.all();
    const hasLikesColumn = columns.some(col => col.name === 'likes');

    if (!hasLikesColumn) {
      db.exec('ALTER TABLE messages ADD COLUMN likes INTEGER NOT NULL DEFAULT 0');
      console.log('已迁移 messages 表，添加 likes 字段');
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

function getLikeStatus(userId, messageId) {
  const stmt = db.prepare('SELECT * FROM likes WHERE user_id = ? AND message_id = ?');
  return stmt.get(userId, messageId) !== undefined;
}

function getMessagesWithLikeStatus(page, pageSize, userId) {
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

  if (userId) {
    const likeStmt = db.prepare('SELECT message_id FROM likes WHERE user_id = ?');
    const likedMessageIds = likeStmt.all(userId).map(row => row.message_id);
    messages.forEach(msg => {
      msg.is_liked = likedMessageIds.includes(msg.id);
    });
  } else {
    messages.forEach(msg => {
      msg.is_liked = false;
    });
  }

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

function toggleLike(userId, messageId) {
  const existingLike = db.prepare('SELECT * FROM likes WHERE user_id = ? AND message_id = ?').get(userId, messageId);
  const message = db.prepare('SELECT * FROM messages WHERE id = ?').get(messageId);

  if (!message) {
    throw new Error('留言不存在');
  }

  if (existingLike) {
    db.prepare('DELETE FROM likes WHERE user_id = ? AND message_id = ?').run(userId, messageId);
    db.prepare('UPDATE messages SET likes = likes - 1 WHERE id = ?').run(messageId);
    return { liked: false, likes: message.likes - 1 };
  } else {
    const createdAt = new Date().toISOString();
    db.prepare('INSERT INTO likes (user_id, message_id, created_at) VALUES (?, ?, ?)').run(userId, messageId, createdAt);
    db.prepare('UPDATE messages SET likes = likes + 1 WHERE id = ?').run(messageId);
    return { liked: true, likes: message.likes + 1 };
  }
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
