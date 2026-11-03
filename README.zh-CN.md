# AI-Pay Hub

[English](README.md) | [简体中文](README.zh-CN.md)

基于 TypeScript、Fastify 与 Redis 的按次付费网关原型，探索 HTTP 402、支付订单、一次性重试与 AI 服务流式代理。包含网关生成页、管理页、Dify OpenAPI 导入入口和 Alipay 支付适配代码。

**当前状态：实验项目。** 默认分支没有合并 [支付与管理员流程改进 PR #1](https://github.com/summerain0401/AiPayHub/pull/1)。该 PR 的修复、测试结果和许可证文件不能当作当前默认分支已具备的内容。HTTP 402 响应也不等同于已实现任意 x402 协议或链上结算兼容。

## 本地开发

需要 Node.js 20+、pnpm 和可连接的 Redis 7：

```bash
pnpm install --frozen-lockfile
cp .env.example .env
# 按自己的本地环境编辑 .env，并先启动 Redis
pnpm dev
```

打开 <http://localhost:3000/generator>；管理界面在 `/dash`，健康检查为 `/ping`。`scripts/dev-setup.sh` 可辅助安装与创建配置，并可能启动 Docker Redis，请先阅读脚本再使用。

## 请求流程与配置

客户端请求 → 网关创建待支付订单 → 返回 HTTP 402 与支付入口 → 回调处理支付状态 → 客户端携带 `X-Order-Id` 重试 → 转发上游服务并消费订单。

配置名称与占位值见 [环境变量示例](.env.example)，部署说明见 [DEPLOYMENT.md](DEPLOYMENT.md)。需核对 Redis 地址、网关对外 URL、Webhook Secret、Alipay 应用及签名/验签配置。默认支付网关指向沙箱；未配置 Alipay 不能完成真实支付。

| 方法 | 路径 | 用途 |
| --- | --- | --- |
| GET | `/ping` | 健康检查 |
| POST | `/generate/create` | 创建网关 |
| 请求转发 | `/{gatewayId}/*` | 付费代理入口 |
| GET | `/poll/{orderId}` | 订单轮询 |
| GET | `/pay/{orderId}` | 支付入口 |
| POST | `/webhook/alipay` | 支付回调 |
| GET | `/dash/stats` | 管理统计 |
| GET | `/schema/{gatewayId}/openapi.json` | Dify 导入 |

## 验证与限制

```bash
pnpm lint
pnpm build
pnpm test
```

测试环境依赖和具体用例见 `tests/`；本次文档整理未执行真实支付或部署。默认分支仍含实验性管理与回调接口，不能直接据此认定适合公网生产，生产评估应结合代码及未合并 PR。

## 许可

现有 README / 包元数据标注 MIT，但默认分支尚无独立 LICENSE 文件。PR #1 中的许可文件尚未合并，本次不合并 PR 或另行更改许可。
