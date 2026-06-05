# 留言板系统

基于 Node.js (Express) + Vue 3 + SQLite 的全栈留言板应用。

## 功能特性

- ✍️ 发表留言（用户名 + 内容）
- 💬 留言列表展示（按时间倒序）
- 📄 分页功能（支持首页、上一页、下一页、末页）
- 🎨 现代化 UI 设计
- 📱 响应式布局
- ⚡ 前后端分离架构

## 技术栈

### 后端
- Node.js
- Express 4
- SQLite3
- CORS 跨域支持

### 前端
- Vue 3 (Composition API)
- Vue Router 4
- Axios
- Vite 5

## 项目结构

```
label-655/
├── backend/                 # 后端服务
│   ├── package.json
│   ├── server.js           # Express 服务器入口
│   ├── database.js         # SQLite 数据库配置
│   └── messages.db         # SQLite 数据库文件（自动创建）
└── frontend/               # 前端应用
    ├── package.json
    ├── vite.config.js      # Vite 配置
    ├── index.html
    └── src/
        ├── main.js         # 应用入口
        ├── App.vue         # 根组件
        ├── style.css       # 全局样式
        ├── router/         # 路由配置
        │   └── index.js
        ├── utils/          # 工具函数
        │   └── api.js      # API 封装
        ├── views/          # 页面组件
        │   └── Home.vue
        └── components/     # 可复用组件
            ├── MessageForm.vue    # 留言表单
            ├── MessageList.vue    # 留言列表
            └── Pagination.vue     # 分页组件
```

## 快速开始

### 1. 安装后端依赖

```bash
cd backend
npm install
```

### 2. 启动后端服务

```bash
npm start
```

后端服务运行在 http://localhost:3001

### 3. 安装前端依赖

```bash
cd ../frontend
npm install
```

### 4. 启动前端开发服务器

```bash
npm run dev
```

前端服务运行在 http://localhost:5173

## API 接口

### 获取留言列表（分页）

```
GET /api/messages?page=1&pageSize=5
```

**响应示例：**
```json
{
  "messages": [
    {
      "id": 1,
      "username": "张三",
      "content": "这是一条留言",
      "created_at": "2024-01-01T12:00:00.000Z"
    }
  ],
  "pagination": {
    "currentPage": 1,
    "pageSize": 5,
    "total": 12,
    "totalPages": 3,
    "hasNext": true,
    "hasPrev": false
  }
}
```

### 提交留言

```
POST /api/messages
Content-Type: application/json

{
  "username": "昵称",
  "content": "留言内容"
}
```

**响应示例：**
```json
{
  "message": {
    "id": 13,
    "username": "昵称",
    "content": "留言内容",
    "created_at": "2024-01-01T12:00:00.000Z"
  }
}
```

### 健康检查

```
GET /api/health
```

## 数据库说明

- 数据库文件：`backend/messages.db`
- 首次启动时自动创建 `messages` 表
- 自动插入 12 条示例数据用于测试

**messages 表结构：**

| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER | 主键，自增 |
| username | TEXT | 用户名 |
| content | TEXT | 留言内容 |
| created_at | DATETIME | 创建时间，默认当前时间 |

## 开发说明

### 前端代理配置

前端开发服务器已配置代理，`/api` 请求会自动转发到 `http://localhost:3001`，无需手动处理跨域问题。

### 生产部署

```bash
# 构建前端
cd frontend
npm run build

# 将 dist 目录部署到静态服务器
# 后端使用 pm2 等进程管理器运行
```

## 许可证

MIT
