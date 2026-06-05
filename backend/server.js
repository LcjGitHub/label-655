const express = require('express');
const cors = require('cors');
const path = require('path');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { initDatabase, getMessages, getMessagesWithLikeStatus, insertMessage, createUser, getUserByUsername, getUserByEmail, getUserById, getAdminByUsername, getAdminById, getAllMessagesForAdmin, reviewMessage, softDeleteMessage, batchReviewMessages, batchSoftDeleteMessages, getRepliesByMessageId, insertReply, getMessageById, getReplyById, toggleLike } = require('./database');

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.substring(7) : null;

  if (!token) {
    return res.status(401).json({ error: '未登录，请先登录' });
  }

  try {
    const user = jwt.verify(token, JWT_SECRET);
    req.user = user;
    next();
  } catch (err) {
    return res.status(403).json({ error: '登录已过期，请重新登录' });
  }
}

function authenticateAdmin(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.substring(7) : null;

  if (!token) {
    return res.status(401).json({ error: '未登录，请先登录' });
  }

  try {
    const admin = jwt.verify(token, JWT_SECRET);
    if (!admin.isAdmin) {
      return res.status(403).json({ error: '无权限访问，需要管理员权限' });
    }
    req.admin = admin;
    next();
  } catch (err) {
    return res.status(403).json({ error: '登录已过期，请重新登录' });
  }
}

function validatePassword(password) {
  if (password.length < 8) {
    return '密码长度至少8位';
  }
  if (!/[a-zA-Z]/.test(password)) {
    return '密码必须包含字母';
  }
  if (!/[0-9]/.test(password)) {
    return '密码必须包含数字';
  }
  return null;
}

function validateEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

function getClientIp(req) {
  const xForwardedFor = req.headers['x-forwarded-for'];
  if (xForwardedFor) {
    return xForwardedFor.split(',')[0].trim();
  }
  const xRealIp = req.headers['x-real-ip'];
  if (xRealIp) {
    return xRealIp.trim();
  }
  return req.ip || req.socket.remoteAddress || '';
}

const app = express();
const PORT = process.env.PORT || 3000;
const fs = require('fs');
const distPath = path.join(__dirname, '..', 'frontend', 'dist');

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.post('/api/auth/register', (req, res) => {
  const { username, email, password } = req.body;

  if (!username || !email || !password) {
    return res.status(400).json({ error: '用户名、邮箱和密码不能为空' });
  }

  const trimmedUsername = username.trim();
  const trimmedEmail = email.trim();

  if (trimmedUsername.length === 0 || trimmedEmail.length === 0) {
    return res.status(400).json({ error: '用户名和邮箱不能为空' });
  }

  if (trimmedUsername.length > 20) {
    return res.status(400).json({ error: '用户名不能超过20个字符' });
  }

  if (!validateEmail(trimmedEmail)) {
    return res.status(400).json({ error: '邮箱格式不正确' });
  }

  const passwordError = validatePassword(password);
  if (passwordError) {
    return res.status(400).json({ error: passwordError });
  }

  try {
    const existingUser = getUserByUsername(trimmedUsername);
    if (existingUser) {
      return res.status(400).json({ error: '用户名已被注册' });
    }

    const existingEmail = getUserByEmail(trimmedEmail);
    if (existingEmail) {
      return res.status(400).json({ error: '邮箱已被注册' });
    }

    const user = createUser(trimmedUsername, password, trimmedEmail);

    const token = jwt.sign(
      { id: user.id, username: user.username },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.status(201).json({
      message: '注册成功',
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '注册失败，请稍后重试' });
  }
});

app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: '用户名和密码不能为空' });
  }

  const trimmedUsername = username.trim();

  try {
    const user = getUserByUsername(trimmedUsername);
    if (!user) {
      return res.status(401).json({ error: '用户名或密码错误' });
    }

    const isPasswordValid = bcrypt.compareSync(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({ error: '用户名或密码错误' });
    }

    const token = jwt.sign(
      { id: user.id, username: user.username },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      message: '登录成功',
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '登录失败，请稍后重试' });
  }
});

app.get('/api/auth/user', authenticateToken, (req, res) => {
  try {
    const user = getUserById(req.user.id);
    if (!user) {
      return res.status(404).json({ error: '用户不存在' });
    }
    res.json({ user });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '获取用户信息失败' });
  }
});

app.get('/api/messages', (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const pageSize = parseInt(req.query.pageSize) || 5;

  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.substring(7) : null;
    let userId = null;
    let ipAddress = null;

    if (token) {
      try {
        const user = jwt.verify(token, JWT_SECRET);
        userId = user.id;
      } catch (err) {
        // Token 无效，继续使用 IP 判断
      }
    }

    if (!userId) {
      ipAddress = getClientIp(req);
    }

    const result = getMessagesWithLikeStatus(page, pageSize, userId, ipAddress);
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '获取留言列表失败' });
  }
});

app.post('/api/messages', authenticateToken, (req, res) => {
  const { content } = req.body;

  if (!content) {
    return res.status(400).json({ error: '留言内容不能为空' });
  }

  const trimmedContent = content.trim();

  if (trimmedContent.length === 0) {
    return res.status(400).json({ error: '留言内容不能为空' });
  }

  if (trimmedContent.length > 500) {
    return res.status(400).json({ error: '留言内容不能超过500个字符' });
  }

  try {
    const message = insertMessage(req.user.id, req.user.username, trimmedContent);
    res.status(201).json({ message });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '提交留言失败' });
  }
});

app.get('/api/messages/:messageId/replies', (req, res) => {
  const messageId = parseInt(req.params.messageId);

  if (isNaN(messageId) || messageId <= 0) {
    return res.status(400).json({ error: '无效的留言ID' });
  }

  try {
    const message = getMessageById(messageId);
    if (!message) {
      return res.status(404).json({ error: '留言不存在' });
    }

    const replies = getRepliesByMessageId(messageId);

    const nestedReplies = replies.reduce((acc, reply) => {
      if (!reply.parent_reply_id) {
        acc.push({
          ...reply,
          children: replies.filter(r => r.parent_reply_id === reply.id)
        });
      }
      return acc;
    }, []);

    res.json({ replies: nestedReplies, total: nestedReplies.length });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '获取回复列表失败' });
  }
});

app.post('/api/messages/:messageId/replies', authenticateToken, (req, res) => {
  const messageId = parseInt(req.params.messageId);
  const { content, parentReplyId } = req.body;

  if (isNaN(messageId) || messageId <= 0) {
    return res.status(400).json({ error: '无效的留言ID' });
  }

  if (!content) {
    return res.status(400).json({ error: '回复内容不能为空' });
  }

  const trimmedContent = content.trim();

  if (trimmedContent.length === 0) {
    return res.status(400).json({ error: '回复内容不能为空' });
  }

  if (trimmedContent.length > 300) {
    return res.status(400).json({ error: '回复内容不能超过300个字符' });
  }

  try {
    const message = getMessageById(messageId);
    if (!message) {
      return res.status(404).json({ error: '留言不存在' });
    }

    let validParentReplyId = null;
    if (parentReplyId !== undefined && parentReplyId !== null) {
      validParentReplyId = parseInt(parentReplyId);
      if (isNaN(validParentReplyId) || validParentReplyId <= 0) {
        return res.status(400).json({ error: '无效的父回复ID' });
      }
      const parentReply = getReplyById(validParentReplyId);
      if (!parentReply) {
        return res.status(404).json({ error: '父回复不存在' });
      }
      if (parentReply.message_id !== messageId) {
        return res.status(400).json({ error: '父回复不属于该留言' });
      }
      if (parentReply.parent_reply_id !== null) {
        return res.status(400).json({ error: '只能回复一级回复，不支持第三级回复' });
      }
    }

    const reply = insertReply(messageId, req.user.username, trimmedContent, validParentReplyId);
    res.status(201).json({ reply });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '提交回复失败' });
  }
});

app.post('/api/messages/:messageId/like', (req, res) => {
  const messageId = parseInt(req.params.messageId);

  if (isNaN(messageId) || messageId <= 0) {
    return res.status(400).json({ error: '无效的留言ID' });
  }

  try {
    const message = getMessageById(messageId);
    if (!message) {
      return res.status(404).json({ error: '留言不存在' });
    }

    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.substring(7) : null;
    let userId = null;
    let ipAddress = null;

    if (token) {
      try {
        const user = jwt.verify(token, JWT_SECRET);
        userId = user.id;
      } catch (err) {
        // Token 无效，使用 IP 作为身份标识
      }
    }

    if (!userId) {
      ipAddress = getClientIp(req);
      if (!ipAddress) {
        return res.status(400).json({ error: '无法识别访客身份' });
      }
    }

    const result = toggleLike(userId, ipAddress, messageId);
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '操作失败，请稍后重试' });
  }
});

app.post('/api/admin/login', (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: '用户名和密码不能为空' });
  }

  const trimmedUsername = username.trim();

  try {
    const admin = getAdminByUsername(trimmedUsername);
    if (!admin) {
      return res.status(401).json({ error: '用户名或密码错误' });
    }

    const isPasswordValid = bcrypt.compareSync(password, admin.password);
    if (!isPasswordValid) {
      return res.status(401).json({ error: '用户名或密码错误' });
    }

    const token = jwt.sign(
      { id: admin.id, username: admin.username, isAdmin: true },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      message: '登录成功',
      token,
      admin: {
        id: admin.id,
        username: admin.username
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '登录失败，请稍后重试' });
  }
});

app.get('/api/admin/me', authenticateAdmin, (req, res) => {
  try {
    const admin = getAdminById(req.admin.id);
    if (!admin) {
      return res.status(404).json({ error: '管理员不存在' });
    }
    res.json({ admin });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '获取管理员信息失败' });
  }
});

app.get('/api/admin/messages', authenticateAdmin, (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const pageSize = parseInt(req.query.pageSize) || 10;
  const status = req.query.status || null;

  try {
    const result = getAllMessagesForAdmin(page, pageSize, status, true);
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '获取留言列表失败' });
  }
});

app.put('/api/admin/messages/:id/review', authenticateAdmin, (req, res) => {
  const messageId = parseInt(req.params.id);
  const { status } = req.body;

  if (isNaN(messageId) || messageId <= 0) {
    return res.status(400).json({ error: '无效的留言ID' });
  }

  if (!['approved', 'rejected'].includes(status)) {
    return res.status(400).json({ error: '无效的审核状态' });
  }

  try {
    const message = reviewMessage(messageId, status);
    res.json({ message: '审核成功', data: message });
  } catch (err) {
    console.error(err);
    if (err.message === '留言不存在') {
      return res.status(404).json({ error: err.message });
    }
    res.status(500).json({ error: err.message || '审核失败' });
  }
});

app.delete('/api/admin/messages/:id', authenticateAdmin, (req, res) => {
  const messageId = parseInt(req.params.id);

  if (isNaN(messageId) || messageId <= 0) {
    return res.status(400).json({ error: '无效的留言ID' });
  }

  try {
    softDeleteMessage(messageId);
    res.json({ message: '删除成功' });
  } catch (err) {
    console.error(err);
    if (err.message === '留言不存在') {
      return res.status(404).json({ error: err.message });
    }
    res.status(500).json({ error: err.message || '删除失败' });
  }
});

app.post('/api/admin/messages/batch-review', authenticateAdmin, (req, res) => {
  const { ids, status } = req.body;

  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: '请选择要审核的留言' });
  }

  if (!['approved', 'rejected'].includes(status)) {
    return res.status(400).json({ error: '无效的审核状态' });
  }

  try {
    const count = batchReviewMessages(ids, status);
    res.json({ message: `已成功审核 ${count} 条留言`, count });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || '批量审核失败' });
  }
});

app.post('/api/admin/messages/batch-delete', authenticateAdmin, (req, res) => {
  const { ids } = req.body;

  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: '请选择要删除的留言' });
  }

  try {
    const count = batchSoftDeleteMessages(ids);
    res.json({ message: `已成功删除 ${count} 条留言`, count });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || '批量删除失败' });
  }
});

if (fs.existsSync(distPath)) {
  console.log('检测到前端构建产物，启用静态文件托管');
  app.use(express.static(distPath));

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
