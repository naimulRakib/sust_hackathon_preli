import type { VercelRequest, VercelResponse } from '@vercel/node';
import { TicketRequestSchema } from '../lib/schema';
import { investigateTicket } from '../lib/investigator';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Only accept POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  }

  // Parse body
  let body: unknown;
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  } catch {
    return res.status(400).json({ error: 'Invalid JSON body.' });
  }

  if (!body || typeof body !== 'object') {
    return res.status(400).json({ error: 'Request body must be a JSON object.' });
  }

  // Validate request schema
  const validation = TicketRequestSchema.safeParse(body);
  if (!validation.success) {
    const issues = validation.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ');
    return res.status(400).json({ error: `Invalid request: ${issues}` });
  }

  // Semantic validation: empty complaint
  if (!validation.data.complaint.trim()) {
    return res.status(422).json({ error: 'Complaint text cannot be empty.' });
  }

  // Process the ticket
  try {
    const result = await investigateTicket(validation.data);
    return res.status(200).json(result);
  } catch (err) {
    // Never expose internals
    console.error('Internal error processing ticket:', err);
    return res.status(500).json({ error: 'Internal server error. Please try again.' });
  }
}
