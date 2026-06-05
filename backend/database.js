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
      created_at DATETIME NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users (id)
    )
  `);
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

module.exports = {
  initDatabase,
  getMessages,
  insertMessage,
  createUser,
  getUserByUsername,
  getUserByEmail,
  getUserById
};
