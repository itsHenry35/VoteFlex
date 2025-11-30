# VoteFlex

一个灵活的投票系统，支持多种投票类型（文本，图片，音频，视频等）。

## 功能特点

- **灵活的投票访问**: 通过 UUID 或短链接访问投票页面（用户只能看到自己创建的投票）
- **多种内容类型**: 每个选项支持混合文本、图片、音频、视频
- **投票限制配置**:
  - **身份验证方式**: 无限制 / 钉钉登录 / IP限制
  - **频率限制**: 总共N次 / 每N小时N次 / 每N天N次
  - **选项限制**: 最少/最多选择几项
  - **时间限制**: 开始时间和结束时间
- **结果展示**: 可配置是否公开展示投票结果（按票数从高到低排序）
- **下次投票时间提示**: 若当前不可投票，显示下次可投票时间
- **钉钉登录弹窗**: 若需要钉钉登录，显示弹窗提示
- **角色管理**: 简化的两种角色（admin 管理员 / user 普通用户）

## 技术栈

### 后端

- Go 1.24+
- Gin Web Framework
- GORM + SQLite
- JWT 认证

### 前端

- React
- TypeScript
- Ant Design
- Vite

## 快速开始

### 开发模式

```bash
# 后端
go run main.go

# 前端
cd web
npm install
npm run dev
```

### 构建生产版本

```bash
# 构建前端
cd web
npm run build
cd ..

# 构建后端（嵌入前端静态文件）
go build -o voteflex
./voteflex
```

## 配置

首次运行会自动创建 `config.json` 配置文件和管理员账户（控制台输出密码）。

## API 接口

### 公开接口（投票）

| 方法 | 路径                                 | 说明                           |
| ---- | ------------------------------------ | ------------------------------ |
| GET  | `/api/public/website_info`         | 获取网站信息                   |
| GET  | `/api/public/v/:uuid`              | 通过UUID获取投票详情           |
| GET  | `/api/public/s/:code`              | 通过短链接获取投票详情         |
| GET  | `/api/public/v/:uuid/status`       | 检查投票状态（含下次投票时间） |
| GET  | `/api/public/v/:uuid/results`      | 获取投票结果（按票数排序）     |
| POST | `/api/public/v/:uuid/vote`         | 进行投票                       |
| POST | `/api/public/dingtalk/get_user_id` | 获取钉钉用户ID                 |

### 认证接口

| 方法 | 路径                    | 说明           |
| ---- | ----------------------- | -------------- |
| POST | `/api/login`          | 用户名密码登录 |
| POST | `/api/dingtalk/login` | 钉钉登录       |

### 用户接口（需登录）

| 方法   | 路径                            | 说明               |
| ------ | ------------------------------- | ------------------ |
| GET    | `/api/user/polls`             | 获取自己创建的投票 |
| POST   | `/api/user/polls`             | 创建投票           |
| PUT    | `/api/user/polls/:id`         | 更新投票           |
| DELETE | `/api/user/polls/:id`         | 删除投票           |
| POST   | `/api/user/polls/:id/end`     | 提前结束投票       |
| GET    | `/api/user/polls/:id/records` | 获取投票记录       |

### 管理员接口（需admin角色）

| 方法   | 路径                     | 说明         |
| ------ | ------------------------ | ------------ |
| GET    | `/api/admin/polls`     | 获取所有投票 |
| GET    | `/api/admin/users`     | 获取所有用户 |
| POST   | `/api/admin/users`     | 创建用户     |
| PUT    | `/api/admin/users/:id` | 更新用户     |
| DELETE | `/api/admin/users/:id` | 删除用户     |
| GET    | `/api/admin/settings`  | 获取设置     |
| PUT    | `/api/admin/settings`  | 更新设置     |

## 投票创建请求示例

```json
{
  "title": "最佳设计投票",
  "description": "请选择您最喜欢的设计方案",
  "identity_type": "dingtalk",
  "frequency_type": "daily",
  "frequency_n": 1,
  "frequency_max": 1,
  "min_votes": 1,
  "max_votes": 3,
  "show_results": true,
  "start_time": "2024-01-01T00:00:00Z",
  "end_time": "2024-01-31T23:59:59Z",
  "options": [
    {"text": "方案A", "image_url": "https://example.com/a.jpg"},
    {"text": "方案B", "video_url": "https://example.com/b.mp4"},
    {"text": "方案C"}
  ]
}
```

## 许可证

MIT License
