const express = require('express');
const cors = require('cors');
const path = require('path');
const { initDatabase, getMessages, insertMessage } = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const distPath = path.join(__dirname, '..', 'frontend', 'dist');
const fs = require('fs');
if (fs.existsSync(distPath)) {
  console.log('检测到前端构建产物，启用静态文件托管');
  app.use(express.static(distPath));
}

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

if (fs.existsSync(distPath)) {
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api/')) {
      return next();
    }
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

try {
  initDatabase();

  const server = app.listen(PORT, () => {
    console.log(`服务器运行在 http://localhost:${PORT}`);
    console.log(`API 地址: http://localhost:${PORT}/api/messages`);
    if (fs.existsSync(distPath)) {
      console.log(`前端页面: http://localhost:${PORT}`);
    }
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`❌ 端口 ${PORT} 已被占用，请关闭占用该端口的程序或修改 PORT 环境变量`);
      console.error('提示：在 Windows 上可使用以下命令查找占用进程：');
      console.error(`  netstat -ano | findstr :${PORT}`);
      console.error('  taskkill /F /PID <进程ID>');
    } else {
      console.error('服务器启动失败:', err.message);
    }
    process.exit(1);
  });
} catch (err) {
  console.error('数据库初始化失败:', err);
  process.exit(1);
}

module.exports = app;
