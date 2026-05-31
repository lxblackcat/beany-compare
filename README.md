# Beany 性格对比 · 正印 vs 食神

Beany 模拟系统的对比展示前端。同一背景（林小姐·木·幼年）不同十神（正印 vs 食神）的 Beany 响应对比，支持观众投票选择更喜欢哪个 Beany。

## 功能

- 📊 **概览仪表盘**：终局人格、5-axis 折线图、健康分变化、权重演化
- ⚖️ **节点对比**：6 个可比节点左右对比，展开可看完整 Beany 对话和环境
- 📈 **投票统计**：观众投票实时统计，可视化结果

## 部署到 Vercel

### 前提条件

1. [GitHub](https://github.com) 账号
2. [Vercel](https://vercel.com) 账号（GitHub 登录即可）
3. Node.js 18+（本地开发用）

### 步骤

#### 1. 上传到 GitHub

```bash
# 在本地创建一个仓库
cd beany-compare
git init
git add .
git commit -m "Initial commit: Beany comparison viewer"

# 推送到 GitHub（替换你的仓库地址）
git remote add origin https://github.com/你的用户名/beany-compare.git
git push -u origin main
```

#### 2. 部署到 Vercel

1. 打开 https://vercel.com
2. 点击 **Add New → Project**
3. Import 你的 `beany-compare` 仓库
4. 保持默认设置，点击 **Deploy**
5. 等待部署完成 → 得到网址 `https://beany-compare.vercel.app`

#### 3. （可选）设置 Vercel KV 持久化投票数据

不设置 KV 的话，投票数据只在内存中，服务器重启会丢失。

1. 在 Vercel Dashboard 中进入你的项目
2. 点击 **Storage → Create Database → KV**
3. 选择 **Hobby 计划**（免费）
4. 创建后，点击 **Connect → 选择你的项目**
5. Vercel 会自动设置环境变量 `KV_URL`、`KV_REST_API_URL` 等

### 更新数据

当有新的 run 数据时：

1. 确保 `beany-sim-data` 目录有最新数据
2. 运行提取脚本：
   ```bash
   cd beany-compare
   python3 extract_data.py
   ```
3. 提交并推送：
   ```bash
   git add public/data.js
   git commit -m "Update run data"
   git push
   ```
4. Vercel 自动重新部署

## 本地开发

```bash
# 需要 Node.js 18+
npm install -g vercel
npm install
vercel dev
```

打开 http://localhost:3000

## 项目结构

```
beany-compare/
├── public/           # 静态文件
│   ├── index.html    # 主页面
│   ├── app.js        # 前端逻辑
│   ├── data.js       # 运行数据（自动生成）
│   └── style.css     # 样式
├── api/              # Serverless Functions
│   ├── vote.js       # POST /api/vote
│   └── stats.js      # GET /api/stats
├── extract_data.py   # 数据提取脚本
├── package.json
├── vercel.json
└── README.md
```
