import { Request, Response } from 'express';
import { raffleService } from '../../_lib/raffleService';

// The purchase id is the capability to view an order, so anything that is not a
// well-formed UUID is rejected before it reaches the database.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function handleGetPurchase(req: Request, res: Response) {
  // CORS and preflight are handled centrally in api/index.ts against an
  // allow-list, so the per-handler wildcard headers were removed.

  try {
    // Express 5 types a route parameter as string | string[].
    const raw = req.params.id;
    const id = Array.isArray(raw) ? raw[0] : raw;

    if (!id || !UUID_RE.test(id)) {
      return res.status(400).json({ success: false, error: 'Identificador de compra inválido.' });
    }

    const purchase = await raffleService.getPurchaseById(id);
    if (!purchase) {
      return res.status(404).json({ success: false, error: 'Compra não encontrada.' });
    }

    return res.status(200).json({ success: true, purchase });
  } catch (error: any) {
    console.error('[GET_PURCHASE] failed:', error);
    return res.status(500).json({ success: false, error: 'Erro ao consultar a compra.' });
  }
}
