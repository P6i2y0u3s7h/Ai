import type { IncomingMessage, ServerResponse } from 'http';
import { verifyAuthToken } from '../_lib/auth';

export const config = {
  api: {
    bodyParser: false // Allow multipart file streaming
  }
};

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  const origin = req.headers.origin || '*';
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }

  if (req.method !== 'POST') {
    res.statusCode = 405;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'Method Not Allowed' }));
    return;
  }

  const authHeader = req.headers.authorization;
  const user = await verifyAuthToken(authHeader);
  if (!user) {
    res.statusCode = 401;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'Unauthorized: Missing valid authentication.' }));
    return;
  }

  try {
    const buffers: Buffer[] = [];
    for await (const chunk of req) {
      buffers.push(chunk);
    }
    const totalBuffer = Buffer.concat(buffers);

    const docId = `doc-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const sizeBytes = totalBuffer.length;
    const sizeMb = (sizeBytes / (1024 * 1024)).toFixed(2);

    const metadata = {
      id: docId,
      userId: user.uid,
      name: 'Uploaded Document.pdf',
      size: `${sizeMb} MB`,
      sizeBytes,
      pageCount: 1,
      chunkCount: 1,
      status: 'ready',
      isScanned: false,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({
      success: true,
      document: metadata
    }));
  } catch (err: any) {
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: err.message || 'Failed to process document.' }));
  }
}

