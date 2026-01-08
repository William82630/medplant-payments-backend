import type { VercelRequest, VercelResponse } from 'vercel';

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  return res.status(200).json({
    message: 'create-order endpoint is alive',
  });
}
