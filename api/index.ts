import express from 'express';
import rateLimit from 'express-rate-limit';

import { handleCreatePayment } from './_handlers/payments/create';
import { handleSimplifyWebhook } from './_handlers/webhook/simplify';
import { handleSearchTickets } from './_handlers/tickets/search';
import { handleAdminRpc } from './_handlers/admin/rpc';
import { handleGetPurchase } from './_handlers/purchases/get';
import { handleAuth } from './_handlers/auth/index';
import { handleAdminCleanup } from './_handlers/admin/cleanup';
import { supabaseServerConfig } from './_lib/supabaseServer';
import { isMasterPasswordConfigured } from './_lib/auth';

/**
 * Single serverless entrypoint for the whole API.
 *
 * Everything under /api is rewritten here by vercel.json. Sibling files and
 * directories are prefixed with `_` (`_handlers`, `_lib`) because Vercel turns
 * every other file under /api into its own serverless function, which would
 * both multiply cold starts and try to deploy modules that export no handler.
 */
import { getInjectedHtml } from './_lib/renderHtml';

const app = express();

// Vercel always sits behind exactly one proxy hop.
app.set('trust proxy', 1);
app.disable('x-powered-by');

/**
 * CORS.
 *
 * The SPA and this API are served from the same Vercel domain, so the browser
 * never issues a cross-origin request in production and no CORS header is
 * required. Extra origins (preview deploys, Google AI Studio, local dev) must be
 * opted in explicitly through ALLOWED_ORIGINS.
 *
 * Reflecting an arbitrary Origin while also sending
 * Access-Control-Allow-Credentials lets any website on the internet make
 * credentialed calls to this API, so the origin is matched against the
 * allow-list before it is echoed back.
 */
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map(o => o.trim())
  .filter(Boolean);

app.use((req, res, next) => {
  const origin = req.headers.origin;

  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Vary', 'Origin');
  }

  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Content-Type, Authorization, x-master-password, x-admin-secret, x-webhook-secret'
  );

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  next();
});

/**
 * Rate limiting.
 *
 * This uses the default in-memory store, which is per-instance: on serverless
 * each cold start gets a fresh counter and concurrent instances do not share
 * state. It raises the cost of naive abuse but is not a hard guarantee — strict
 * limits need a shared store (Redis/Upstash).
 */
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Muitas requisições. Aguarde alguns minutos.' },
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Muitas tentativas de login. Aguarde alguns minutos.' },
});

const paymentLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Limite próprio para /api/admin/rpc.
 *
 * Este endpoint estava no mesmo limitador dos endpoints públicos (100 requisições
 * por 15 minutos) e isso é baixo demais para o painel: cada tela dispara várias
 * chamadas (dashboard, rifas, compras, usuários, banners, auditoria) e algumas
 * fazem polling. Um administrador trabalhando normalmente esbarrava em 429, o
 * que aparece na interface como operação que "parou de funcionar" sem
 * explicação.
 *
 * O teto é mais alto porque aqui a requisição já passou por autenticação e
 * verificação de papel — o limite serve contra laço acidental no cliente, não
 * contra visitante anônimo.
 */
const adminLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 600,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Muitas requisições. Aguarde alguns minutos.' },
});

// 50mb was sized for base64 image uploads that no longer pass through this API;
// images go straight from the browser to Supabase Storage and only the resulting
// URL is sent here.
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ limit: '1mb', extended: true }));

const router = express.Router();

/**
 * Health check.
 *
 * Reports which server-side secrets are present (never their values) so a
 * misconfigured deployment can be identified from the browser instead of by
 * reading function logs.
 */
router.get('/health', (_req: express.Request, res: express.Response) => {
  const config = {
    supabase: supabaseServerConfig.configured,
    superAdminPassword: isMasterPasswordConfigured(),
    simplifyCredentials: Boolean(process.env.SIMPLIFY_CLIENT_ID && process.env.SIMPLIFY_CLIENT_SECRET),
    webhookSecret: Boolean(process.env.WEBHOOK_SECRET),
    webhookUrl: Boolean(process.env.WEBHOOK_URL),
  };

  /**
   * Diagnóstico da configuração, sem expor valor de segredo nenhum.
   *
   * Conferir os nomes no painel da Vercel não prova que a função recebeu as
   * variáveis: um nome digitado errado, uma variável cadastrada só em Preview,
   * ou um deploy antigo produzem exatamente o mesmo painel "correto" com a
   * função quebrada. Aqui é a própria função em execução que responde.
   *
   * De cada valor sensível vai só o comprimento e um prefixo curto — o
   * suficiente para diferenciar o projeto Supabase novo do antigo, ou uma
   * credencial trocada, sem revelar a chave.
   */
  const fingerprint = (value?: string, prefixLength = 6) => {
    if (!value) return null;
    return { length: value.length, prefix: value.slice(0, prefixLength) };
  };

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
  // O "ref" do projeto identifica qual Supabase está em uso e não é secreto:
  // ele já aparece na URL pública usada pelo navegador.
  const projectRef = supabaseUrl.replace(/^https?:\/\//, '').split('.')[0] || null;

  const details = {
    node: process.version,
    environment: process.env.VERCEL_ENV || process.env.NODE_ENV || 'unknown',
    supabaseProjectRef: projectRef,
    supabaseUrlMatchesFrontend:
      Boolean(process.env.VITE_SUPABASE_URL) &&
      Boolean(supabaseUrl) &&
      process.env.VITE_SUPABASE_URL === supabaseUrl,
    serviceRoleKey: fingerprint(process.env.SUPABASE_SERVICE_ROLE_KEY),
    anonKey: fingerprint(process.env.VITE_SUPABASE_ANON_KEY),
    simplifyClientId: fingerprint(process.env.SIMPLIFY_CLIENT_ID),
    webhookUrl: process.env.WEBHOOK_URL || null,
    allowedOrigins: (process.env.ALLOWED_ORIGINS || '').split(',').map(o => o.trim()).filter(Boolean),
  };

  const ok = Object.values(config).every(Boolean);
  res.status(ok ? 200 : 503).json({ status: ok ? 'ok' : 'misconfigured', config, details });
});

// Payments
router.post('/payments/create', paymentLimiter, handleCreatePayment);
router.post('/webhook/simplify', handleSimplifyWebhook);
router.post('/tickets/search', apiLimiter, handleSearchTickets);

// Public data
router.get('/purchases/:id', apiLimiter, handleGetPurchase);

// Auth
router.post('/auth', authLimiter, handleAuth);

// Admin
router.post('/admin/rpc', adminLimiter, handleAdminRpc);
router.post('/admin/cleanup', adminLimiter, handleAdminCleanup);

/**
 * The router is mounted twice on purpose.
 *
 * A Vercel rewrite normally forwards the original path (`/api/admin/rpc`), but
 * mounting at the bare root as well means the routes still resolve if the
 * platform hands the function a prefix-stripped path. Registering both keeps
 * this working under `vercel dev`, the local Express server, and production
 * without a separate code path.
 */
app.use('/api', router);
app.use('/', router);

/**
 * Unknown routes must answer with JSON.
 *
 * Express' built-in 404 replies with an HTML page. The frontend parses every API
 * reply as JSON, so an HTML body surfaced as the opaque
 * `Unexpected token '<' ... is not valid JSON` rather than a usable message.
 */
app.use(async (req: express.Request, res: express.Response, next: express.NextFunction) => {
  // Allow API routes to yield 404s cleanly
  if (req.path === '/api' || req.path.startsWith('/api/')) {
    res.status(404).json({
      success: false,
      error: `Rota não encontrada: ${req.method} ${req.path}`,
    });
    return;
  }

  // Serve HTML for all other routes (Vercel rewrites EVERYTHING else to /api)
  try {
    const html = await getInjectedHtml();
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300'); // Cache Vercel super rápido
    res.status(200).send(html);
  } catch (e) {
    console.error('Error serving HTML via API', e);
    next(e);
  }
});

/**
 * Last-resort error handler, for the same reason: an uncaught throw would
 * otherwise produce an HTML error page the frontend cannot parse. Internal
 * details are logged but never returned to the client.
 */
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[UNHANDLED_ERROR]', err);

  if (res.headersSent) return;

  if (err?.type === 'entity.too.large') {
    res.status(413).json({ success: false, error: 'Requisição muito grande.' });
    return;
  }

  if (err?.type === 'entity.parse.failed') {
    res.status(400).json({ success: false, error: 'JSON inválido no corpo da requisição.' });
    return;
  }

  res.status(500).json({ success: false, error: 'Erro interno do servidor.' });
});

export default app;
