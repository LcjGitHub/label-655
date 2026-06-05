const express = require('express');
const cors = require('cors');
const { initDatabase, getMessages, insertMessage } = require('./database');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/api/messages', (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const pageSize = parseInt(req.query.pageSize) || 5;

  try {
    const result = getMessages(page, pageSize);
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '获取留言列表失败' });
  }
});

app.post('/api/messages', (req, res) => {
  const { username, content } = req.body;

  if (!username || !content) {
    return res.status(400).json({ error: '用户名和留言内容不能为空' });
  }

  const trimmedUsername = username.trim();
  const trimmedContent = content.trim();

  if (trimmedUsername.length === 0 || trimmedContent.length === 0) {
    return res.status(400).json({ error: '用户名和留言内容不能为空' });
  }

  if (trimmedUsername.length > 50) {
    return res.status(400).json({ error: '用户名不能超过50个字符' });
  }

  if (trimmedContent.length > 500) {
    return res.status(400).json({ error: '留言内容不能超过500个字符' });
  }

  try {
    const message = insertMessage(trimmedUsername, trimmedContent);
    res.status(201).json({ message });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '提交留言失败' });
  }
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

initDatabase().then(() => {
  app.listen(PORT, () => {
    console.log(`服务器运行在 http://localhost:${PORT}`);
  console.log(`API 地址: http://localhost:${PORT}/api/messages`);
  console.log(`健康检查: http://localhost:${PORT}/api/health`);
  });
}).catch(err => {
  console.error('数据库初始化失败:', err);
  process.exit(1);
});

module.exports = app;
