import type { APIRoute } from 'astro';
import { listPhotos } from '../../lib/nextcloud';

export const GET: APIRoute = async () => {
  try {
    const filenames = await listPhotos();
    const photos = filenames.map(id => ({
      id,
      img: `/api/photos/${id}`,
      height: 600,
    }));
    return new Response(JSON.stringify({ photos }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
