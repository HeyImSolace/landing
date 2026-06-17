import type { APIRoute } from 'astro';
import { fetchPhoto } from '../../../lib/nextcloud';

export const GET: APIRoute = async ({ params }) => {
  const filename = params.filename ?? '';

  // Prevent path traversal
  if (!filename || filename.includes('/') || filename.includes('..')) {
    return new Response(JSON.stringify({ error: 'Invalid filename' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const upstream = await fetchPhoto(filename);

    const headers = new Headers();
    const contentType = upstream.headers.get('Content-Type');
    const contentLength = upstream.headers.get('Content-Length');
    if (contentType) headers.set('Content-Type', contentType);
    if (contentLength) headers.set('Content-Length', contentLength);
    // Cache images for 5 minutes in the browser
    headers.set('Cache-Control', 'public, max-age=300');

    return new Response(upstream.body, { status: 200, headers });
  } catch {
    return new Response(JSON.stringify({ error: 'upstream fetch failed' }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
