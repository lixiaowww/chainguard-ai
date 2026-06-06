# Idea2Business Cloud SaaS 部署指南

本指南将引导你将 `idea2business` 项目从本地环境推向线上生产环境，成为一个真正的多租户 SaaS 平台。

## 第一步：云端数据库与鉴权 (Supabase)
1. **创建项目**：登录 [Supabase](https://supabase.com/) 并创建一个新项目。
2. **执行 SQL**：进入 SQL Editor，执行我们在进展报告中提供的 SQL 脚本（创建 `projects` 和 `versions` 表，并开启 RLS 策略）。
3. **获取凭证**：在 Project Settings -> API 中获取 `URL` 和 `anon public key`。

## 第二步：前端部署 (Vercel / Netlify)
由于我们的前端是基于 Vite 的单页应用 (SPA)，推荐部署到 Vercel：
1. **关联仓库**：在 Vercel 仪表盘中关联你的 GitHub/GitLab 仓库。
2. **根目录设置**：设置根目录为 `idea2business`（或者如果你的仓库只包含该目录，则直接部署）。
3. **环境变量**：在 Vercel 控制面板中添加以下变量：
   - `VITE_SUPABASE_URL`: 你的 Supabase URL
   - `VITE_SUPABASE_ANON_KEY`: 你的 Supabase 公钥
4. **构建命令**：`npm run build`
5. **输出目录**：`dist`

## 第三步：后端部署 (Railway / Render / Cloud Run)
后端 Express 需要一个可以运行 Node.js 容器的环境：
1. **推荐平台**：Railway (极速部署) 或 Render。
2. **环境变量**：
   - `GEMINI_API_KEY`: 你的 Google Gemini API 密钥
   - `PORT`: 8080 (或其他指定端口)
3. **前端适配**：确保前端 `App.tsx` 中的 API 调用地址指向你部署后的后端 URL。
   - *优化建议*：在生产环境中，可以将前后端部署在同一个域名下，通过路径分发（如 `/api/*`）来避免跨域问题。

## 第四步：安全与审计 (Harness Check)
1. **CORS 配置**：在 `server.ts` 中根据你的生产域名配置 CORS 策略，禁止非法来源调用 API。
2. **Gemini 额度限制**：在 Google AI Studio 中为你的 API Key 设置配额硬上限，防止被恶意刷单。
3. **Auth 回调**：在 Supabase Auth -> URL Configuration 中，将你的生产域名（如 `https://app.idea2business.pro`）加入 Site URL 白名单。

## 第五步：商业化准备 (Monetization - 可选)
如果你准备开始收费：
1. **Stripe 集成**：在 Supabase `profiles` 表中增加 `stripe_customer_id` 字段。
2. **Webhook 钩子**：在 Express 中添加 `/api/webhooks/stripe` 接口，监听支付成功事件并更新用户的 `tier` 等级。

---

**部署完成后，你将拥有一个可以在全球访问、具备用户体系和商业审计能力的 SaaS 平台。祝你的 Idea2Business 大获成功！**
