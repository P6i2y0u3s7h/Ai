import type { IncomingMessage, ServerResponse } from 'http';

export default async function handler(req: IncomingMessage, res: ServerResponse & { json?: (data: any) => void }) {
  const provider = (process.env.AI_PROVIDER || 'groq').toLowerCase();
  const model = process.env.GROQ_MODEL || 'qwen/qwen3.8-27b';
  const groqKey = process.env.GROQ_API_KEY || '';
  const hasKey = Boolean(groqKey && groqKey.length > 5 && !groqKey.includes('your_'));

  const payload = {
    status: 'ok',
    service: 'StudyAI Vercel Serverless API',
    provider,
    model,
    hasApiKey: hasKey,
    freeTier: provider === 'groq',
    timestamp: new Date().toISOString()
  };

  res.statusCode = 200;
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.end(JSON.stringify(payload));
}

