# 微至销售助手｜内部测试版

这是一个面向内部测试的 H5 页面。当前项目已从 Coze Chat SDK 模式改为 Coze API 代理模式：

GitHub Pages 前端 → Cloudflare Worker 后端代理 → Coze API → 微至销售助手 Agent

## 为什么移除 Chat SDK

之前的 Coze Chat SDK 片段需要在前端写入 `PAT/token` 和 `onRefreshToken()`。GitHub Pages 是公开静态托管，浏览器用户可以看到所有前端源码，因此不能隐藏 Coze PAT、API token、access token、secret 或私密凭证。

当前版本不再使用 Coze Chat SDK。前端只调用 Cloudflare Worker，Worker 在服务端环境变量中保存 Coze token 并调用 Coze API。

## 文件结构

- `index.html`：访问码页、聊天 UI、Tailwind CDN。
- `styles.css`：移动端、微信浏览器、安全区和轻量动画样式。
- `app.js`：访问码 UI、会话 id、聊天气泡、截图预览、Worker `fetch()` 调用。
- `.nojekyll`：让 GitHub Pages 跳过 Jekyll 处理。
- `worker/worker.js`：Cloudflare Worker 代理实现。
- `worker/README.md`：Worker 部署说明。
- `worker/wrangler.toml.example`：Wrangler 配置示例。

## 前端配置

在 `app.js` 顶部配置：

```js
const INTERNAL_ACCESS_CODE = "REPLACE_WITH_ACCESS_CODE";
const BACKEND_CHAT_ENDPOINT = "REPLACE_WITH_CLOUDFLARE_WORKER_URL";
```

`INTERNAL_ACCESS_CODE` 只用于前端 UI 轻量拦截，真正的访问码校验在 Worker 中完成。上线时需要把 Worker 部署地址填入 `BACKEND_CHAT_ENDPOINT`。

每个浏览器会生成本地测试会话 id，并存储在：

```text
localStorage: microcure_sales_session_id
```

访问码验证状态存储在：

```text
sessionStorage
```

## 前端部署到 GitHub Pages

1. 提交 `index.html`、`styles.css`、`app.js`、`README.md`、`.nojekyll` 和 `worker/`。
2. 在 GitHub 仓库 Settings → Pages 中启用 GitHub Pages。
3. 选择部署分支和根目录。
4. 部署 Worker 后，把 Worker URL 填入 `app.js` 的 `BACKEND_CHAT_ENDPOINT`。
5. 用微信浏览器打开 GitHub Pages 链接测试。

## Worker 部署到 Cloudflare Workers

进入 `worker/` 目录：

```bash
cd worker
npm install -g wrangler
cp wrangler.toml.example wrangler.toml
```

修改 `wrangler.toml` 中的 `name` 和 `FRONTEND_ORIGIN`，然后设置 secrets：

```bash
wrangler secret put INTERNAL_ACCESS_CODE
wrangler secret put COZE_API_TOKEN
wrangler secret put COZE_BOT_ID
wrangler secret put COZE_API_BASE_URL
```

部署：

```bash
wrangler deploy
```

`COZE_API_TOKEN` 必须使用 Cloudflare Worker secret，不能写入 `wrangler.toml`，也不能提交到仓库。

## Worker 请求格式

前端发送：

```json
{
  "access_code": "内部访问码",
  "session_id": "microcure_sales_session_id",
  "message": "客户问题"
}
```

Worker 返回：

```json
{
  "reply": "assistant response text"
}
```

未来如果接入图片文件上传，可以在请求中增加安全的 `image_metadata`，但当前版本不会发送截图内容或图片二进制。

## 截图上传

前端保留截图按钮和预览 UI：

- 支持 `jpg`、`jpeg`、`png`、`webp`
- 最大 10 MB
- 可移除预览
- 不允许视频、PDF、Word
- 当前不会把截图发到后端

用户尝试带截图发送时会显示：

```text
截图上传功能将在后端文件上传接口接入后开放。当前请先用文字描述截图内容。
```

## 安全说明

- GitHub Pages 是公开静态托管。
- 前端访问码只是 UI 便利，不是强访问控制。
- 真实访问码校验在 Worker 中完成。
- 不要提交 Coze API token、PAT、SAT、access token、secret 或任何私密凭证。
- 不要提交产品知识库文件。
- 不要提交客户截图、客户个人信息、客户聊天记录、合同、底价、付款信息或未公开认证文件。
- 更强安全性应继续放在 Worker 或正式后端中实现，包括鉴权、审计、限流和敏感信息处理。

## 不要提交

- Coze API token
- PAT、SAT、access token、secret
- Product knowledge base
- Customer screenshots
- Customer personal data
- 客户聊天记录、合同、底价、付款信息、未公开认证文件

## 内部测试清单

- 错误访问码会被前端拒绝。
- 错误访问码会被 Worker 返回 401。
- 文本聊天可以调用 Worker。
- Coze API 返回后，助手回复显示在现有机器人气泡中。
- 后端不可用时前端显示错误状态。
- Coze API 错误时前端显示错误状态。
- 请求超时时前端显示“请求超时，请稍后重试。”。
- 微信浏览器移动端布局正常。
- 截图上传被阻止，并显示“截图上传功能将在后端文件上传接口接入后开放。当前请先用文字描述截图内容。”。
- 没有假 AI 回复。
- 前端文件中没有 Coze token、PAT、SAT、access token 或 secret。
