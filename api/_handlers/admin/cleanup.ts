import { Request, Response } from 'express';
import { raffleService } from '../../_lib/raffleService';

export async function handleAdminCleanup(req: Request, res: Response) {
  // Simple protection: only allow POST and maybe a secret token if needed
  if (req.method !== 'POST') return res.status(405).end();
  
  try {
    await raffleService.cancelExpiredPurchases();
    return res.status(200).json({ success: true, message: 'Expired purchases cancelled' });
  } catch (err: any) {
    console.error('Error during cleanup:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
}
