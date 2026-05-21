import fs from 'node:fs';
import path from 'node:path';

const RUNTIME_DIR = path.resolve('data/runtime');

export async function GET() {
  try {
    const filePath = path.join(RUNTIME_DIR, 'translate-log.json');
    const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    return new Response(JSON.stringify(data), {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    });
  } catch {
    return new Response(JSON.stringify({ log: [] }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
