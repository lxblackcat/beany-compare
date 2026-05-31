# beany-compare 项目笔记

## 项目位置
`/home/blackcat/.openclaw/workspace/beany-compare/`

## 前端设计思路

### 架构
- 纯前端 HTML+CSS+JS，部署到 Vercel
- API: Serverless Functions (`api/vote.js`, `api/stats.js`)
- 数据: `
public/data.js`（由 `extract_data.py` 自动生成）
- 投票持久化: Upstash Redis（Vercel KV）

### 三屏 SPA
1. **📊 概览** — 左右两列终局人格卡片 + 5-axis 折线图（左正印/右食神） + 五行权重演化图
2. **⚖️ 节点对比** — 按节点展开，顶部场景信息，逐轮 Beany 反应左右对比，每轮独立投票
3. **🏆 点赞榜** — Top 10 最受欢迎 Beany 响应（正印/食神各自计票）
4. **📈 投票统计** — 按节点汇总投票结果

### 图表
- Canvas 手绘，无外部依赖
- 5-axis: 每个 run 独立画布，5 条彩色折线 + 图例
- 权重: 每个 run 独立画布，五行元素横向条形图，每天一柱

### 投票
- 按轮投票，voteKey = `{node_id}_R{rond_num}`
- API: `POST /api/vote` (body: `{node_id, preference}`), `GET /api/stats`
- 持久化: Upstash Redis (Vercel KV)，key=`beany_votes`
- 前端乐观更新（先更新 UI 再发请求）

### 数据流
1. `extract_data.py` → `public/data.js`（window.BEANY_DATA）
2. 运行时 `loadVotes()` → `/api/stats` → `votes` 对象
3. 投票 `doVote()` → 更新本地 + `POST /api/vote`
