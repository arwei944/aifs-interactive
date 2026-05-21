import fs from 'node:fs';
import path from 'node:path';

const WORKERS_DIR = path.resolve('data/runtime/workers');

export async function GET({ request }: { request: Request }) {
  const url = new URL(request.url);
  const workerId = url.searchParams.get('id') || '';

  if (!workerId) {
    // 返回所有 worker 状态
    try {
      const files = fs.readdirSync(WORKERS_DIR).filter(f => f.endsWith('.json'));
      const workers = files.map(f => {
        try {
          return JSON.parse(fs.readFileSync(path.join(WORKERS_DIR, f), 'utf-8'));
        } catch {
          return null;
        }
      }).filter(Boolean);
      return new Response(JSON.stringify(workers), {
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
        },
      });
    } catch {
      return new Response(JSON.stringify([]), {
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }

  // 返回单个 worker 状态
  try {
    const filePath = path.join(WORKERS_DIR, `${workerId}.json`);
    const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    return new Response(JSON.stringify(data), {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    });
  } catch {
    return new Response('null', {
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
