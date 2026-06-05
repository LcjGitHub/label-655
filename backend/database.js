const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

let db;

const dbPath = path.join(__dirname, 'messages.db');

const sampleMessages = [
  { username: '张三', content: '这是一个很棒的留言板系统！' },
  { username: '李四', content: '大家好，很高兴来到这里。' },
  { username: '王五', content: '技术分享，共同进步！' },
  { username: '赵六', content: '今天天气真好，适合编程。' },
  { username: '孙七', content: '学习 Vue 3 和 Express 的最佳实践。' },
  { username: '周八', content: 'SQLite 真的很轻量好用。' },
  { username: '吴九', content: '前后端分离开发效率真高！' },
  { username: '郑十', content: '希望这个系统越来越完善。' },
  { username: '陈一', content: '分页功能做得不错。' },
  { username: '林二', content: '接口响应速度很快！' },
  { username: '黄三', content: 'UI 设计简洁大方。' },
  { username: '刘四', content: '推荐给我的朋友们使用。' }
];

async function initDatabase() {
  const SQL = await initSqlJs();

  if (fs.existsSync(dbPath)) {
    const fileBuffer = fs.readFileSync(dbPath);
    db = new SQL.Database(fileBuffer);
    console.log('已连接到 SQLite 数据库');
  } else {
    db = new SQL.Database();
    console.log('已创建新的 SQLite 数据库');
    createTables();
    insertSampleData();
    saveDatabase();
  }

  console.log('messages 表已就绪');
}

function createTables() {
  db.run(`
    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
}

function insertSampleData() {
  const countResult = db.exec('SELECT COUNT(*) as count FROM messages');
  const count = countResult[0]?.values[0]?.[0] || 0;

  if (count === 0) {
    const stmt = db.prepare('INSERT INTO messages (username, content) VALUES (?, ?)');
    sampleMessages.forEach(msg => {
      stmt.run([msg.username, msg.content]);
    });
    stmt.free();
    console.log('已插入示例数据');
  }
}

function saveDatabase() {
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(dbPath, buffer);
}

function getMessages(page, pageSize) {
  const offset = (page - 1) * pageSize;

  const countResult = db.exec('SELECT COUNT(*) as total FROM messages');
  const total = countResult[0].values[0][0];
  const totalPages = Math.ceil(total / pageSize);

  const stmt = db.prepare('SELECT * FROM messages ORDER BY created_at DESC LIMIT ? OFFSET ?');
  stmt.bind([pageSize, offset]);
  
  const messages = [];
  const columns = stmt.getColumnNames();
  
  while (stmt.step()) {
    const row = stmt.getAsObject();
    messages.push(row);
  }
  stmt.free();

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
  stmt.run([username, content, createdAt]);
  stmt.free();

  saveDatabase();

  const getStmt = db.prepare('SELECT * FROM messages ORDER BY id DESC LIMIT 1');
  getStmt.step();
  const message = getStmt.getAsObject();
  getStmt.free();

  return message;
}

module.exports = {
  initDatabase,
  getMessages,
  insertMessage
};
