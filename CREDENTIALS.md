# 密钥和凭据

## Upstash Redis (Vercel KV)
用于持久化投票数据。

**REST API Endpoint:**
`https://major-phoenix-111418.upstash.io`

**Token (读写):**
`gQAAAAAAAbM6AAIgcDFkNWMwNWRkOTRkNTM0NWZiYmZmNTQzMTE2ODdkMzhmOA`

**Token (只读):**
`ggAAAAAFAbM6AAIgcDFkNWMwNWRkOTRkNTM0NWZiYmZmNTQzMTE2ODdkMzhmOA`

**Redis key:**
`beany_votes`

**Vercel 自动注入的环境变量:**
`KV_REST_API_URL`, `KV_REST_API_TOKEN`, `KV_URL`, `REDIS_URL`

## 删除投票数据
```bash
curl -X POST "https://major-phoenix-111418.upstash.io/del/beany_votes" \
  -H "Authorization: Bearer gQAAAAAAAbM6AAIgcDFkNWMwNWRkOTRkNTM0NWZiYmZmNTQzMTE2ODdkMzhmOA" \
  -H "Content-Type: application/json"
```

## GitHub
- 仓库: `https://github.com/lxblackcat/beany-compare`
- Token (已存入 `~/.git-credentials`)

## Vercel
- 项目: `beany-compare`
- 网址: `https://beany-compare.vercel.app`
