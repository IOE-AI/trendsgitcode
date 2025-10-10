# Trendsgit – 历史趋势仓库（中文文档）

Trendsgit 是一个历史归档平台，帮助你探索不同时间段内开源仓库的趋势变化与人气走势。你可以使用站点页面进行浏览，也可以通过提供的 API 获取数据并集成到自己的应用中。

站点地址：<https://trendsgit.vercel.app>

---

## 运行环境要求

- Node.js：建议 `>=18`（GitHub Actions 与 Docker 使用 `22`）
- 包管理器：`npm`
- 数据库：本项目使用 `SQLite`（数据库文件位于 `prisma/trendsgit.db`）
- 可选：Docker（用于容器化构建与部署）

---

## 快速开始（本地开发）

1) 克隆与安装依赖

- `git clone <your-repo-url>`
- `cd trendsgitcode`
- `npm install --legacy-peer-deps`
  - 安装过程中会执行 `postinstall` 脚本并生成 Prisma Client

2) 初始化数据库（开发环境）

- 初次运行前，应用 Prisma 迁移到本地 SQLite：
  - `npx prisma migrate dev`
  - 或者使用：`npx prisma db push`（将当前 schema 推送到数据库，不创建迁移）
- 数据库文件默认在 `prisma/trendsgit.db`，代码中通过 `lib/db.ts` 动态定位，无需额外配置 `DATABASE_URL`

3) 启动开发服务

- `npm run dev`
- 打开浏览器访问：`http://localhost:3000`

---

## 数据填充（GitHub / GitCode 可选）

项目提供了一个采集接口，用于读取每日趋势仓库并写入本地数据库。你可以通过环境变量在 GitHub 与 GitCode 之间切换数据源。

- 入口：`GET /api/seed`
- 数据源选择：
  - 设置 `GIT_PROVIDER=github`（默认）或 `GIT_PROVIDER=gitcode`
  - 可选令牌：`GITHUB_TOKEN` 或 `GITCODE_TOKEN`（若对应平台有 API 限速或权限需求）
- 行为：
  - 当 `GIT_PROVIDER=github`：
    - 抓取 `https://github.com/trending?since=daily` 页面中的仓库列表
    - 调用 `https://api.github.com/repos/{owner}/{repo}` 获取详情
  - 当 `GIT_PROVIDER=gitcode`：
    - 初版实现尝试从 `https://gitcode.com/explore` 等页面解析仓库链接，并最小化填充字段（描述、语言等解析为占位）。
    - 你可根据 GitCode 的官方 API 替换当前实现，使数据更加完整稳定。
- 调用方式：
  - 启动开发服务后，直接在浏览器打开 `http://localhost:3000/api/seed`
  - 或在命令行执行：`curl http://localhost:3000/api/seed`
- 注意：
  - 已加入每次 1 秒延迟以降低触发速率限制的可能性。
  - 若使用 GitHub，建议配置 `GITHUB_TOKEN` 以提高速率配额；若使用 GitCode，可在未来接入其官方 API 并配置 `GITCODE_TOKEN`。

可选辅助接口：

- `GET /api/reduce`：将数据库中所有记录的 `created_at` 时间整体回退 1 天（用于模拟历史分布与分组显示）。请谨慎使用。

---

## 构建与生产运行

1) 本地构建与启动

- 构建：`npm run build`
  - 在构建阶段会执行 `npx prisma generate`
- 启动：`npm run start`
  - 默认监听 `http://localhost:3000`

2) 使用 Docker

- 构建镜像：
  - `docker build -t trendsgit .`
- 运行容器：
  - 最简运行：`docker run --rm -p 3000:3000 trendsgit`
  - 挂载本地 `prisma` 目录以持久化 SQLite 数据：
    - `docker run --rm -p 3000:3000 -v "$(pwd)/prisma:/app/prisma" trendsgit`
  - 如需覆盖前端 API 地址：`-e NEXT_PUBLIC_API_URL="http://localhost:3000"`
  - 在容器中，`DATABASE_URL` 已默认设置为 `file:/app/prisma/trendsgit.db`

---

## 环境变量说明

- `NEXT_PUBLIC_API_URL`
  - 前端使用的公开 API 地址。开发环境默认 `http://localhost:3000`。
  - 可在本地创建 `.env.local`，添加：`NEXT_PUBLIC_API_URL=http://localhost:3000`
- `DATABASE_URL`
  - 在本仓库的开发环境中一般不需要显式设置，`lib/db.ts` 会直接定位 `prisma/trendsgit.db`。
  - 在 Docker/生产环境，镜像内已设置为 `file:/app/prisma/trendsgit.db`。
- `GIT_PROVIDER`
  - 采集数据源选择：`github`（默认）或 `gitcode`
- `GITHUB_TOKEN`（可选）
  - GitHub 模式下用于提升 API 速率额度：`Authorization: token <GITHUB_TOKEN>`
- `GITCODE_TOKEN`（可选）
  - GitCode 模式下保留的令牌位（未来接入官方 API 时使用）

---

## API 使用

### 1) 获取最近一周的仓库分组

- `GET /api/repos`
- 可选参数：`created_at`（ISO 时间字符串，作为窗口上界）
- 返回：按 `daysAgo`（距今的天数）分组的仓库列表，最近一周的数据。

示例：

```
GET http://localhost:3000/api/repos
```

返回结构示例：

```json
{
  "data": [
    { "daysAgo": 0, "repos": [ /* ... */ ] },
    { "daysAgo": 1, "repos": [ /* ... */ ] }
  ]
}
```

### 2) 获取单个仓库详情

- `GET /api/repos/[id]`
- 参数：`id`（数据库自增整型主键）

示例：

```
GET http://localhost:3000/api/repos/123
```

### 3) 搜索仓库

- `GET /api/repos/search`
- 可选参数：
  - `name`：匹配 `full_name` 字段的包含关系
  - `language`：匹配语言的包含关系

示例：

```
GET http://localhost:3000/api/repos/search?language=TypeScript&name=vercel
```

### 4) 获取支持的语言列表

- `GET /api/languages`
- 返回：语言数组

示例：

```
GET http://localhost:3000/api/languages
```

返回结构示例：

```json
{ "data": ["TypeScript", "JavaScript", "Python", /* ... */] }
```

---

## 常见问题与排错

- Prisma Client 未生成或类型报错：
  - 运行：`npx prisma generate`
  - 检查 `node` 版本与 `npm install` 是否成功执行。
- 迁移失败或数据库未创建：
  - 运行：`npx prisma migrate dev`
  - 或：`npx prisma db push`
- GitHub API 速率限制：
  - 在 `pages/api/seed.ts` 中添加 `Authorization: token <YOUR_GITHUB_TOKEN>`，或降低采集频率。

---

## 部署参考

- Vercel/Netlify：本项目为 Next.js 应用，可直接部署。确保构建阶段可用 `prisma generate`，并在运行时能读写 `SQLite` 文件（如通过持久化卷或内置文件）。
- GitHub Actions（定时采集）：
  - `.github/workflows/scheduled-seed.yml` 每日定时：
    - 构建并启动应用
    - 调用 `GET /api/seed`
    - 将变更（包含 `prisma/trendsgit.db`）提交回仓库
  - 如需使用该工作流，需配置 `PAT`（个人访问令牌）用于推送变更。

---

## 许可与致谢

- 感谢开源社区与 GitHub 提供的公共数据与 API。
- 代码与文档风格遵循项目现有规范，欢迎 Issue 与 PR。