# Takiyu Blog Admin V2

这是为 `Takiyu0928/Takiyu-blog` 从零重写的图形化管理后台。它直接读写博客仓库中的配置、文章和图片，不依赖 `Takiyu-wiki-contents`，主要面向不熟悉 TypeScript、Markdown 与 Git 操作的使用者。

## 功能

- 文章：新建、编辑、阅读预览和删除；Markdown 源码默认折叠在高级功能中。
- About 页面：单独编辑并避免误删后造成 Astro 构建失败。
- 相册：编辑相册信息、从电脑批量上传图片、删除图片和相册。
- 日记：编辑文字、时间、心情、地点、标签和图片路径。
- 网站信息：标题、副标题、网址、语言、主题色和顶栏名称。
- 个人资料：名称、简介、头像本地上传、Bilibili UID、Bangumi ID 和社交链接。
- 首页横幅：分别管理电脑端与手机端图片、裁切位置、轮播、水波和首页标题。
- 顶栏：管理一级菜单以及点击后出现的二级菜单。
- 侧栏：控制组件在左栏、右栏和手机抽屉中的开关与顺序。
- 音乐：管理网易云歌单、Meting 设置、本地歌曲资料和播放器开关。
- 其他页面：友链、项目、技能、时间线和设备展示。
- 支持日间、夜间模式以及手机端布局。

点击“保存并提交”后，后台会通过 GitHub API 创建一次提交。连接该博客仓库的 Vercel 项目随后会自动重新部署。

## 本地运行

需要 Node.js 20 或更高版本。

```powershell
cd "C:\Users\Takiyu's rog\Documents\Codex\Takiyu-blog-admin-v2"
Copy-Item .env.example .env
notepad .env
npm install
npm run dev
```

浏览器打开：

```text
http://127.0.0.1:3000
```

本地运行时会自动免密码进入后台；该行为仅接受 `127.0.0.1`、`localhost` 或 `[::1]` 请求，不会关闭 Vercel 线上部署的密码验证。若希望本地也显示登录页，可在 `.env` 中设置 `LOCAL_NO_AUTH=0`。

没有 `.env` 或 GitHub Token 时，本地仍可通过 GitHub 的公开接口读取并预览公开博客仓库，但处于只读模式。保存、上传和删除内容前仍需在 `.env` 中配置 `GITHUB_TOKEN`。

如果 3000 端口已被占用，请先结束占用该端口的旧 Node 进程，或修改 `scripts/dev.mjs` 中的端口。

## 环境变量

最简单的方式是使用 Fine-grained GitHub Token：

```env
ADMIN_PASSWORD=后台登录密码
SESSION_SECRET=至少32个字符的随机字符串
GITHUB_OWNER=Takiyu0928
GITHUB_REPO=Takiyu-blog
GITHUB_BRANCH=main
GITHUB_TOKEN=github_pat_xxx
```

- `ADMIN_PASSWORD`：后台登录密码。
- `SESSION_SECRET`：用于签名登录 Cookie，建议至少 32 个字符；更换后，已经登录的设备会退出。
- `GITHUB_OWNER`：GitHub 用户名或组织名。
- `GITHUB_REPO`：需要管理的博客仓库名，不是后台仓库名。
- `GITHUB_BRANCH`：博客正在使用的分支。
- `GITHUB_TOKEN`：只能放在本地 `.env` 或 Vercel 环境变量中，绝不能提交到 GitHub。

### Fine-grained Token 权限

只允许 Token 访问 `Takiyu-blog` 仓库，并设置：

- Repository permissions → Contents：`Read and write`
- Repository permissions → Metadata：`Read-only`（GitHub 自动包含）

不需要额外授予 Workflows 权限。后台创建普通 Git 提交后，由 Vercel 的 Git 集成触发博客部署。

### 可选：GitHub App

不配置 `GITHUB_TOKEN` 时，也可以使用：

```env
GITHUB_APP_ID=你的App ID
GITHUB_INSTALLATION_ID=安装ID
GITHUB_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----"
```

GitHub App 必须安装到 `Takiyu-blog` 仓库，并拥有 Contents 读写权限。Vercel 私钥可以保留真实换行，也可以用 `\n` 表示换行。

## 部署到 Vercel

1. 把本后台放入独立的私有 GitHub 仓库，例如 `Takiyu-blog-admin-v2`。
2. 在 Vercel 新建项目并导入后台仓库，不要导入博客仓库。
3. Framework Preset 选择 `Other`；构建命令与输出目录会从 `vercel.json` 读取。
4. 在 Settings → Environment Variables 添加上述变量。
5. 至少为变量勾选 Production；需要预览部署时再勾选 Preview。
6. 保存变量后重新部署后台项目。
7. 打开后台域名并输入 `ADMIN_PASSWORD`。

如果显示 `ADMIN_PASSWORD is not configured in Vercel`，通常是变量加到了错误的 Vercel 项目、没有勾选当前部署环境，或添加变量后没有重新部署。

## 图片上传

- 单张图片限制为 4 MB，建议上传前转换为 WebP 或压缩 JPEG/PNG。
- 头像上传到 `public/assets/images/`。
- 电脑横幅上传到 `public/assets/desktop-banner/`。
- 手机横幅上传到 `public/assets/mobile-banner/`。
- 相册图片上传到 `public/images/albums/<相册ID>/`。
- 横幅中的“移除”只移除配置引用，不直接删除仓库图片，以降低误删风险。

## 安全

- 不要提交 `.env`；仓库只保留不含真实秘密的 `.env.example`。
- 后台仓库建议设为 Private。
- GitHub Token 只授权 `Takiyu-blog` 一个仓库。
- Token、密码或私钥如果出现在聊天、截图或公开提交中，应立即撤销并重新生成。
- 登录 Cookie 的有效期为 12 小时。

## 修改后的检查

```powershell
npm run check
npm run build
npm audit --omit=dev
```

构建输出位于 `dist`，该目录不需要提交。

## 当前限制

- 图形化保存 TypeScript 配置时，目标变量内部的格式和注释可能被重新整理，但变量外代码和 import 会保留。
- 本地歌曲可编辑现有条目的名称、歌手、封面变量、音频变量和时长；新增文件 import 仍需使用页面内的高级功能。
- 删除内容会直接创建 GitHub 提交；需要恢复时可在博客仓库的 Commits 中回退对应提交。
