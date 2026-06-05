const { DatabaseSync } = require('node:sqlite');
const path = require('path');

const dbPath = path.join(__dirname, 'messages.db');
let db;

function initDatabase() {
  db = new DatabaseSync(dbPath);
  console.log('已连接到 SQLite 数据库');

  createTables();
  console.log('messages 表已就绪');
}

function createTables() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at DATETIME NOT NULL
    )
  `);
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

function insertMessage(username, content) {
  const createdAt = new Date().toISOString();

  const stmt = db.prepare('INSERT INTO messages (username, content, created_at) VALUES (?, ?, ?)');
  const result = stmt.run(username, content, createdAt);

  const getStmt = db.prepare('SELECT * FROM messages WHERE id = ?');
  const message = getStmt.get(result.lastInsertRowid);

  return message;
}

module.exports = {
  initDatabase,
  getMessages,
  insertMessage
};
