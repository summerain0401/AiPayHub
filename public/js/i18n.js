// ============================================
// AI-Pay Hub i18n — 中英双语切换
// ============================================

const I18N = {
  lang: 'zh',

  dict: {
    // ---- Shared ----
    'app.name':           { zh: 'AI-Pay Hub', en: 'AI-Pay Hub' },
    'app.subtitle':       { zh: '智能体聚合微支付网关', en: 'Micro-payment Gateway for AI Creators' },

    // ---- Nav ----
    'nav.how':            { zh: '原理', en: 'How' },
    'nav.features':       { zh: '特性', en: 'Features' },
    'nav.start':          { zh: '立即开始', en: 'Get Started' },
    'nav.home':           { zh: '首页', en: 'Home' },
    'nav.generator':      { zh: '生成器', en: 'Generator' },
    'nav.dashboard':      { zh: '看板', en: 'Dashboard' },
    'nav.dify':           { zh: '集成指南', en: 'Dify Guide' },
    'nav.lock':           { zh: '内容锁', en: 'Content Lock' },
    'nav.back':           { zh: '返回生成器', en: 'Back to Generator' },

    // ---- Hero ----
    'hero.eyebrow':       { zh: 'AI 创作变现，从未如此简单', en: 'Micro-payment gateway for AI creators' },
    'hero.title1':        { zh: '你的 AI 只管创作。', en: 'Your AI earns.' },
    'hero.title2':        { zh: '收款交给我们。', en: 'We handle the billing.' },
    'hero.desc':          { zh: '一键为 Dify 工作流、MCP 服务器、Markdown 技能包接入按次付费。无需营业执照，无需写代码，阅后即焚防刷单。', en: 'One click to monetize your Dify workflows, MCP servers, and Markdown skills. No paperwork, no business license, per-use billing with burn-after-reading.' },
    'hero.cta':           { zh: '生成支付网关', en: 'Generate a Gateway' },
    'hero.cta2':          { zh: '了解原理', en: 'How It Works' },
    'hero.term.label':    { zh: '终端演示', en: 'TERMINAL' },
    'hero.term.paid':     { zh: '支付成功。', en: 'Payment confirmed.' },
    'hero.term.burned':   { zh: '订单已销毁，不可重复使用。', en: 'Order burned after reading.' },

    // ---- How ----
    'how.eyebrow':        { zh: '三步上手', en: 'Three Steps' },
    'how.title':          { zh: '几分钟搞定，不用等几周。', en: 'Monetize in minutes, not weeks.' },
    'how.s1.title':       { zh: '创建支付网关', en: 'Create a gateway' },
    'how.s1.desc':        { zh: '粘贴你的 AI 接口地址，设个单价，点一下生成。你会得到一个公开网关 ID 和私有管理密钥。无需注册、无需实名、无需营业执照。', en: 'Paste your AI endpoint, set a per-use price, click generate. You get a public gateway ID and a private admin key. No sign-up, no KYC, no paperwork.' },
    'how.s2.title':       { zh: '替换接口地址', en: 'Replace your API URL' },
    'how.s2.desc':        { zh: '把原来的 API 地址换成网关代理地址。任何用户首次请求都会收到 HTTP 402 和支付链接。你的原始接口始终隐藏在后端。', en: 'Swap your original API URL with the gateway proxy. The first request from any user returns HTTP 402 with a payment link. Your endpoint stays private.' },
    'how.s3.title':       { zh: '收款、放行、流式响应', en: 'Get paid, stream results' },
    'how.s3.desc':        { zh: '用户用支付宝完成支付，Webhook 回调标记订单已付。用户拿着订单令牌重试请求，网关放行转发，流式返回 AI 结果。响应完成后订单即焚，零重放风险。', en: 'User pays via Alipay X402. Webhook marks the order paid. User retries with the order token. Response streams through. Order burned after reading, zero replay risk.' },

    // ---- API Flow ----
    'api.eyebrow':        { zh: '接口流程', en: 'API Flow' },
    'api.title':          { zh: '同一个请求地址，两种返回结果。', en: 'One request format. Two outcomes.' },

    // ---- Features ----
    'feat.eyebrow':       { zh: '核心特性', en: 'Features' },
    'feat.title':         { zh: '为 AI 创作者而生，不为银行设计。', en: 'Built for AI creators, not banks.' },
    'feat.f1.title':      { zh: '免登录密钥对鉴权', en: 'No-login Key-Pair Auth' },
    'feat.f1.desc':       { zh: '告别密码、邮箱验证和 OAuth。你会拿到一个公开网关 ID 和一个管理密钥。把密钥粘贴到看板就能看到实时收入。这就是全部的鉴权系统，没有多余的环节。', en: 'Forget passwords, email verification, and OAuth. You get a public gateway ID and a private admin key. Paste the key into your dashboard to see revenue. That is the entire auth system.' },
    'feat.f2.title':      { zh: 'HTTP 402 + X402 协议', en: 'HTTP 402 + X402' },
    'feat.f2.desc':       { zh: '标准的 HTTP 402 Payment Required 响应加 Payment-Needed 头。AI 智能体自动识别、触发支付宝 X402 支付、重试请求。智能体对智能体的秒级结算。', en: 'Standard HTTP 402 Payment Required with Payment-Needed header. AI agents read the response, trigger Alipay X402 payment, and retry automatically. A2A settlement in seconds.' },
    'feat.f3.title':      { zh: '阅后即焚', en: 'Burn After Reading' },
    'feat.f3.desc':       { zh: '每个订单令牌只能用一次。上游 AI 响应传输完成后，订单立即从 Redis 中删除。无法重放攻击，无法重复扣款。', en: 'Each order token works once. After the upstream response completes, the order is deleted from Redis. No replay attacks, no double charges.' },

    // ---- Use Cases ----
    'use.eyebrow':        { zh: '适用场景', en: 'Who Uses This' },
    'use.title':          { zh: '一个网关，四类用户。', en: 'One gateway. Four audiences.' },
    'use.u1.label':       { zh: 'Dify / Coze 搭建者', en: 'Dify / Coze Builder' },
    'use.u1.desc':        { zh: '将我们的 OpenAPI Schema 导入为自定义工具。工作流自动获得"创建账单"和"校验状态"两个节点。拖拽、连线、变现，零代码。', en: 'Import our OpenAPI schema as a custom tool. Your workflow gets two nodes: create bill and check status. Drag, connect, monetize. No code needed.' },
    'use.u2.label':       { zh: 'MCP 服务器作者', en: 'MCP Server Author' },
    'use.u2.desc':        { zh: '将你的 MCP 端点接入网关。用户按次付费调用。你的服务器始终隐藏在代理后端，流式响应原封不动透传。', en: 'Point your MCP endpoint through the gateway. Users pay per call. Your server stays private behind the proxy.' },
    'use.u3.label':       { zh: '技能包创作者', en: 'Skill Pack Creator' },
    'use.u3.desc':        { zh: '将 .cursorrules 和 Markdown 技能包放在内容锁后面。用户未付费时只看到付款提示，付费后收到完整内容一次，随后销毁。', en: 'Protect your .cursorrules and Markdown skill packs behind a content lock. Users see a payment prompt until they pay. Content delivered once, then burned.' },
    'use.u4.label':       { zh: '社群运营者', en: 'Community Operator' },
    'use.u4.desc':        { zh: '基于 Webhook 的访问控制，适用于微信、Telegram、Discord 机器人集成。按用户计费，无需管理用户账号体系。', en: 'Webhook-based access control for WeChat, Telegram, and Discord bot integrations. Per-user billing without managing user accounts.' },

    // ---- CTA ----
    'cta.title':          { zh: '准备好变现了吗？', en: 'Ready to monetize?' },
    'cta.desc':           { zh: '一键生成支付网关。无需注册，无需审核，直接开始收款。', en: 'One click to generate a gateway. No sign-up. No paperwork. Just revenue.' },
    'cta.btn':            { zh: '生成我的支付网关', en: 'Generate Your Gateway' },
    'cta.footnote':       { zh: '可本地运行，也可部署到任意 VPS。自备 Redis 即可。', en: 'Runs locally or deploy to any VPS. Bring your own Redis.' },

    // ---- Generator ----
    'gen.title':          { zh: 'AI-Pay Hub', en: 'AI-Pay Hub' },
    'gen.subtitle':       { zh: 'AI 创作者的微支付网关，一键生成，即刻变现。', en: 'One-click micro-payment gateway for AI creators.' },
    'gen.form.title':     { zh: '创建网关', en: 'Create Gateway' },
    'gen.form.url':       { zh: '上游 AI 接口地址', en: 'Target API URL' },
    'gen.form.price':     { zh: '每次调用价格', en: 'Price per call' },
    'gen.form.email':     { zh: '邮箱', en: 'Email' },
    'gen.form.optional':  { zh: '选填', en: 'optional' },
    'gen.form.submit':    { zh: '生成网关', en: 'Generate Gateway' },
    'gen.form.loading':   { zh: '正在生成...', en: 'Generating...' },
    'gen.result.title':   { zh: '网关创建成功', en: 'Gateway Created' },
    'gen.result.gwid':    { zh: '公开网关 ID', en: 'Public Gateway ID' },
    'gen.result.key':     { zh: '管理密钥', en: 'Admin Secret Key' },
    'gen.result.keywarn': { zh: '仅此一次', en: 'shown once' },
    'gen.result.warn':    { zh: '密钥仅显示一次，请立即保存！关闭页面后将无法找回。', en: 'Save this key now. It will not be shown again.' },
    'gen.result.copy':    { zh: '复制', en: 'Copy' },
    'gen.result.copied':  { zh: '已复制', en: 'Copied' },
    'gen.result.proxy':   { zh: '代理地址', en: 'Proxy URL' },
    'gen.result.proxyhint':{zh:'将此地址替换原有的 API 地址即可。首次请求会返回 HTTP 402 支付链接。', en: 'Replace your API URL with this. First requests receive HTTP 402 with payment link.' },
    'gen.copy.fail':      { zh: '复制失败', en: 'Copy failed' },
    'gen.back':           { zh: '返回首页', en: 'Back to Home' },

    // ---- Dashboard ----
    'dash.title':         { zh: '管理看板', en: 'Dashboard' },
    'dash.subtitle':      { zh: '收入统计与订单流水查询。', en: 'Payment analytics and order management.' },
    'dash.login.title':   { zh: '验证身份', en: 'Authenticate' },
    'dash.login.gwid':    { zh: '网关 ID', en: 'Gateway ID' },
    'dash.login.key':     { zh: '管理密钥', en: 'Admin Secret Key' },
    'dash.login.submit':  { zh: '查看看板', en: 'View Dashboard' },
    'dash.login.loading': { zh: '验证中...', en: 'Verifying...' },
    'dash.login.error':   { zh: '密钥验证失败', en: 'Invalid credentials' },
    'dash.revenue':       { zh: '总收入', en: 'Total Revenue' },
    'dash.overview':      { zh: '订单概览', en: 'Orders' },
    'dash.paid':          { zh: '已支付', en: 'Paid' },
    'dash.pending':       { zh: '待支付', en: 'Pending' },
    'dash.total':         { zh: '总计', en: 'Total' },
    'dash.gw.info':       { zh: '网关信息', en: 'Gateway' },
    'dash.gw.url':        { zh: '上游地址', en: 'Target URL' },
    'dash.gw.price':      { zh: '每次调用价格', en: 'Price per call' },
    'dash.orders':        { zh: '最近订单', en: 'Recent Orders' },
    'dash.col.order':     { zh: '订单', en: 'Order' },
    'dash.col.amount':    { zh: '金额', en: 'Amount' },
    'dash.col.method':    { zh: '方式', en: 'Method' },
    'dash.col.status':    { zh: '状态', en: 'Status' },
    'dash.col.time':      { zh: '时间', en: 'Time' },
    'dash.empty':         { zh: '暂无订单。向你的网关发送一个请求即可创建订单。', en: 'No orders yet. Send a request to your gateway to create one.' },
    'dash.loading':       { zh: '加载中...', en: 'Loading...' },
    'dash.error':         { zh: '加载失败。', en: 'Failed to load orders.' },
    'dash.retry':         { zh: '重试', en: 'Retry' },
    'dash.enabled':       { zh: '已启用', en: 'Enabled' },
    'dash.disabled':      { zh: '已停用', en: 'Disabled' },
    'dash.toggle.enable': { zh: '启用', en: 'Enable' },
    'dash.toggle.disable':{ zh: '停用', en: 'Disable' },
    'dash.toast.enabled': { zh: '网关已启用', en: 'Gateway enabled' },
    'dash.toast.disabled':{ zh: '网关已停用', en: 'Gateway disabled' },
    'dash.method.alipay': { zh: '支付宝', en: 'Alipay' },
    'dash.method.wechat': { zh: '微信', en: 'WeChat' },
    'dash.status.paid':   { zh: '已支付', en: 'Paid' },
    'dash.status.pending':{ zh: '待支付', en: 'Pending' },

    // ---- Dify Guide ----
    'dify.back':          { zh: '返回', en: 'Back' },
    'dify.title':         { zh: 'Dify / Coze 集成指南', en: 'Dify / Coze Integration Guide' },
    'dify.subtitle':      { zh: '导入 OpenAPI Schema，几分钟搭建一个带支付门槛的 AI 工作流。', en: 'Import the OpenAPI schema and build a payment-gated workflow in minutes.' },
    'dify.s1.title':      { zh: '第一步：导入 OpenAPI Schema', en: 'Step 1: Import OpenAPI Schema' },
    'dify.s1.l1':         { zh: '在 Dify 中进入 <strong>工具</strong> -> <strong>自定义工具</strong> -> <strong>从 OpenAPI 导入</strong>', en: 'In Dify, go to <strong>Tools</strong> -> <strong>Custom Tool</strong> -> <strong>Import from OpenAPI</strong>' },
    'dify.s1.l2a':        { zh: '粘贴你的 Schema 地址：', en: 'Paste your schema URL:' },
    'dify.s1.l2b':        { zh: '导入后出现两个操作节点：<code>proxyRequest</code> 和 <code>pollStatus</code>', en: 'Two operations appear: <code>proxyRequest</code> and <code>pollStatus</code>' },
    'dify.s2.title':      { zh: '第二步：搭建工作流', en: 'Step 2: Build the Workflow' },
    'dify.s3.title':      { zh: '第三步：支付流程', en: 'Step 3: Payment Flow' },
    'dify.s3.l1':         { zh: '用户收到 X402 支付链接（支付宝）', en: 'User receives X402 payment link (Alipay)' },
    'dify.s3.l2':         { zh: '用户通过刷脸 / 指纹 / 密码完成支付', en: 'User authorizes payment via face / fingerprint / password' },
    'dify.s3.l3':         { zh: '网关收到支付宝异步通知，标记订单为已支付', en: 'Gateway webhook marks order as PAID' },
    'dify.s3.l4':         { zh: '工作流轮询检测到状态变更', en: 'Workflow poll detects status change' },
    'dify.s3.l5':         { zh: '流式返回 AI 结果给用户，订单响应完成后即焚', en: 'Response streams to user; order burned after reading' },
    'dify.retry.title':   { zh: '支付后重试', en: 'Retry with X-Order-Id' },
    'dify.retry.desc':    { zh: '用户支付完成后，使用同一个请求再加一个请求头即可重试：', en: 'After payment, retry the same request with one extra header:' },
    'dify.retry.hint':    { zh: '网关验证订单已支付后放行转发到上游 AI，响应结束后立即删除订单。', en: 'The gateway validates the order is PAID, forwards to upstream, and deletes the order after the response completes.' },

    // ---- Content Lock ----
    'lock.back':          { zh: '返回', en: 'Back' },
    'lock.title':         { zh: '动态内容锁', en: 'Dynamic Content Lock' },
    'lock.subtitle':      { zh: '保护 .cursorrules、MCP 配置等 Markdown 资产不被白嫖，付费后一次交付、阅后即焚。', en: 'Protect Markdown skills and MCP configs behind a payment gate with burn-after-reading.' },
    'lock.s1.title':      { zh: '工作原理', en: 'How It Works' },
    'lock.s1.l1':         { zh: '创建一个网关，指向上游 Markdown 文件的原始地址', en: 'Create a gateway pointing to your raw Markdown URL' },
    'lock.s1.l2':         { zh: '将代理地址分享给用户，而非原始链接', en: 'Share the AI-Pay Hub proxy URL instead of the raw link' },
    'lock.s1.l3':         { zh: '未付费用户看到的是支付提示 Markdown', en: 'Unpaid requests receive a payment-prompt Markdown block' },
    'lock.s1.l4':         { zh: '付费后，完整内容只交付一次', en: 'After payment, the full content is delivered once' },
    'lock.s1.l5':         { zh: '内容交付后立即从 Redis 中销毁（阅后即焚）', en: 'Content deleted from Redis after reading (burn-after-read)' },
    'lock.s2.title':      { zh: '示例：保护 .cursorrules', en: 'Example: Protect .cursorrules' },
    'lock.s2.private':    { zh: '私有原始地址', en: 'Private URL' },
    'lock.s2.proxy':      { zh: '代理地址（分享给用户）', en: 'Proxy URL (shared with users)' },
    'lock.s2.hint':       { zh: '用户访问代理地址时看到支付提示。付费后获得完整内容一次，随后订单销毁。', en: 'Users see a payment prompt until they pay. After paying, they receive the full content exactly once.' },
    'lock.s3.title':      { zh: '支持的内容类型', en: 'Supported Content Types' },
    'lock.s3.hint':       { zh: '请求携带 <code>Accept: text/markdown</code> 头时会收到 Markdown 格式的支付提示。', en: 'Requests with <code>Accept: text/markdown</code> header receive a Markdown payment prompt.' },

    // ---- Payment ----
    'pay.title':          { zh: 'AI-Pay Hub - 支付', en: 'AI-Pay Hub - Payment' },
    'pay.amount':         { zh: '支付金额', en: 'Amount' },
    'pay.method':         { zh: '支付方式', en: 'Payment Method' },
    'pay.btn':            { zh: '立即支付', en: 'Pay Now' },
    'pay.hint':           { zh: '支付完成后自动跳转', en: 'Auto-redirect after payment' },
    'pay.polling':        { zh: '请在打开的支付页面中完成支付...', en: 'Complete payment in opened page...' },
    'pay.success':        { zh: '支付成功', en: 'Payment Successful' },
    'pay.successHint':    { zh: '请返回原页面继续获取内容', en: 'Return to continue' },
    'pay.expired':        { zh: '订单已过期', en: 'Order Expired' },
    'pay.expiredHint':    { zh: '支付超时，请重新发起请求', en: 'Timeout, please retry' },
    'pay.retry':          { zh: '重新开始', en: 'Start Over' },

    // ---- Lang Toggle ----
    'lang.switch':        { zh: 'EN', en: '中' },
  },

  t(key) {
    return this.dict[key]?.[this.lang] ?? (this.dict[key]?.en ?? key);
  },

  toggle() {
    this.lang = this.lang === 'zh' ? 'en' : 'zh';
    localStorage.setItem('ai-pay-lang', this.lang);
    document.documentElement.lang = this.lang === 'zh' ? 'zh-CN' : 'en';
    this.renderAll();
  },

  init() {
    const saved = localStorage.getItem('ai-pay-lang');
    if (saved) this.lang = saved;
    this.lang = this.lang === 'zh' ? 'zh' : 'en';
    document.documentElement.lang = this.lang === 'zh' ? 'zh-CN' : 'en';
    this.renderAll();
  },

  renderAll() {
    document.querySelectorAll('[data-i18n]').forEach(el => {
      const key = el.getAttribute('data-i18n');
      if (key) el.textContent = this.t(key);
    });
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
      const key = el.getAttribute('data-i18n-placeholder');
      if (key) el.setAttribute('placeholder', this.t(key));
    });
    document.querySelectorAll('.lang-toggle').forEach(el => {
      el.textContent = this.t('lang.switch');
    });
    window.dispatchEvent(new CustomEvent('i18n-changed', { detail: { lang: this.lang } }));
  }
};
