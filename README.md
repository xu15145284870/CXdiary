# 🧅💛🧄 葱蒜的考研日记 — Web 版

两个人的考研陪伴小工具。打开网页就能用，手机 / 电脑都行。

## 🚀 10 分钟上线（只需 GitHub 账号）

### 第 1 步：创建 Supabase 后端（免费）

1. 打开 [supabase.com](https://supabase.com) → 用 GitHub 登录
2. 点击 **New Project** → 起个名如 `cong-suan-diary`
3. 密码随便设一个（记不记都行，以后还能重置）
4. Region 选 **Asia Pacific** 最近的节点
5. 等 1 分钟数据库创建完成

### 第 2 步：建表

1. 在 Supabase 后台左侧点 **SQL Editor**
2. 把 `supabase/schema.sql` 的内容全部粘贴进去
3. 点 **Run** 执行

### 第 3 步：创建图片存储桶

1. 左侧点 **Storage** → **New bucket**
2. 名称填 `journals`，勾选 **Public bucket**
3. 创建后在 Policies 里添加策略：允许所有人 INSERT / SELECT

### 第 4 步：配置连接信息

1. 在 Supabase 后台点 **Settings** → **API**
2. 复制 **Project URL** 和 **anon public key**
3. 打开 `js/app.js` 第 6-7 行，替换：
   ```js
   const SUPABASE_URL = 'https://xxxxx.supabase.co';  // 你的 Project URL
   const SUPABASE_KEY = 'eyJhbG...';                   // 你的 anon key
   ```

### 第 5 步：部署到 Vercel（免费）

1. 把这个项目文件夹上传到你的 GitHub：
   ```bash
   cd ~/Desktop/cong-suan-diary-web
   git init
   git add .
   git commit -m "init"
   # 在 GitHub 上创建仓库后：
   git remote add origin https://github.com/你的用户名/cong-suan-diary.git
   git push -u origin main
   ```
2. 打开 [vercel.com](https://vercel.com) → 用 GitHub 登录
3. 点 **New Project** → 选择 `cong-suan-diary` 仓库
4. 直接点 **Deploy**（无需任何配置）
5. 等 30 秒部署完成，你会得到一个网址如：
   ```
   https://cong-suan-diary.vercel.app
   ```

### 第 6 步：开始使用！

1. 手机浏览器打开上面的网址
2. 点浏览器菜单 → **添加到主屏幕**（就会像一个独立 App）
3. 你和女朋友各选一个身份（🧅 葱 / 🧄 蒜）
4. 一人把配对码发给对方 → 配对成功！

## 📱 使用方式

| 操作 | 说明 |
|------|------|
| 📅 **签到** | 首页点"签到"→选心情 emoji → 确认 |
| 🍅 **番茄钟** | 调好时长 → 开始专注 → 计时完成会震动 |
| 📝 **日记** | 点右下角 ✏️ → 写文字/传图片 → 发布 |
| 👥 **配对** | "我的"页面选身份 → 分享配对码 → 对方输入 |

## 🛠 技术栈

- 纯 HTML/CSS/JS（零框架，零构建）
- [Supabase](https://supabase.com) — Postgres 数据库 + 图片存储
- [Vercel](https://vercel.com) — 免费部署 + 自动 HTTPS
- PWA — 可添加到手机主屏幕

## ⚠️ 注意

- 这是双人私密工具，安全性基于配对码。不要分享给陌生人。
- Supabase 免费额度：500MB 数据库、1GB 存储，两人用完全够。
- Vercel 免费额度：100GB 月流量，绰绰有余。

---

Made with 💛 for two people studying together.
