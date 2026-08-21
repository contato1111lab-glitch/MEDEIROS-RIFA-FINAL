import express from 'express';
import path from 'path';
import apiAppImport from './api/index';
import { getInjectedHtml } from './api/_lib/renderHtml';
import { raffleService } from './api/_lib/raffleService';

const apiApp: any = (apiAppImport as any).default || apiAppImport;

const PORT = Number(process.env.PORT) || 3000;

/**
 * Servidor local de desenvolvimento.
 *
 * Na Vercel este arquivo não roda: o frontend é servido como estático e
 * /api/* vai direto para a função em api/index.ts. Aqui os dois precisam
 * conviver na mesma porta.
 *
 * A API é montada num app pai e só recebe as requisições que começam com
 * /api. Isso importa porque api/index.ts termina com um 404 em JSON e um
 * handler de erro — se o app da API fosse usado como app principal, esse 404
 * responderia antes do Vite e a página inicial viraria
 * {"error":"Rota não encontrada: GET /"}.
 */
const app = express();

app.use((req, res, next) => {
  if (req.path === '/api' || req.path.startsWith('/api/')) {
    return apiApp(req, res, next);
  }
  return next();
});

// Limpeza periódica de reservas expiradas (a cada 10 minutos).
// Em produção isso deve ser um Cron Job da Vercel chamando /api/admin/cleanup,
// porque uma serverless function não fica viva entre requisições.
const cleanupTimer = setInterval(() => {
  raffleService.cancelExpiredPurchases().catch(err => {
    console.error('Background cleanup failed:', err);
  });
}, 10 * 60 * 1000);
cleanupTimer.unref();

async function startLocalServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'custom', // Evita que o Vite sirva o index.html original automaticamente
    });
    app.use(vite.middlewares);

    // Intercepta e injeta o HTML no modo de desenvolvimento
    app.get('*all', async (req: express.Request, res: express.Response, next: express.NextFunction) => {
      if (req.path.startsWith('/api')) return next();
      try {
        let html = await getInjectedHtml(true); // forceRead no ambiente local para dev
        html = await vite.transformIndexHtml(req.originalUrl, html);
        res.status(200).set({ 'Content-Type': 'text/html' }).end(html);
      } catch (e) {
        vite.ssrFixStacktrace(e as Error);
        next(e);
      }
    });

  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    
    // Serve o HTML injetado no modo de produção local
    app.get('*all', async (req: express.Request, res: express.Response, next: express.NextFunction) => {
      if (req.path.startsWith('/api')) return next();
      try {
        const html = await getInjectedHtml();
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.status(200).send(html);
      } catch (e) {
        next(e);
      }
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`\n  Site:  http://localhost:${PORT}`);
    console.log(`  API:   http://localhost:${PORT}/api/health\n`);
  });
}

startLocalServer();
