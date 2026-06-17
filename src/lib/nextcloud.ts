const base = () => {
  const url = process.env.NC_BASE_URL;
  const user = process.env.NC_USER;
  const pass = process.env.NC_APP_PASSWORD;
  const path = process.env.NC_PHOTOS_PATH;

  if (!url || !user || !pass || !path) {
    throw new Error('Missing Nextcloud env vars: NC_BASE_URL, NC_USER, NC_APP_PASSWORD, NC_PHOTOS_PATH');
  }

  return { url, user, pass, path };
};

const authHeader = (user: string, pass: string) =>
  'Basic ' + Buffer.from(`${user}:${pass}`).toString('base64');

export async function listPhotos(): Promise<string[]> {
  const { url, user, pass, path } = base();
  const endpoint = `${url}/remote.php/dav/files/${encodeURIComponent(user)}/${path}/`;

  const res = await fetch(endpoint, {
    method: 'PROPFIND',
    headers: {
      Authorization: authHeader(user, pass),
      Depth: '1',
    },
  });

  if (!res.ok) {
    throw new Error(`Nextcloud PROPFIND failed: ${res.status} ${res.statusText}`);
  }

  const xml = await res.text();

  // Extract all <d:href> values from the WebDAV response
  const hrefMatches = xml.matchAll(/<[^:>]*:href[^>]*>([^<]+)<\/[^:>]*:href>/gi);
  const filenames: string[] = [];

  for (const match of hrefMatches) {
    const href = decodeURIComponent(match[1].trim());
    const basename = href.split('/').pop() ?? '';
    if (/\.(jpe?g|png|webp)$/i.test(basename)) {
      filenames.push(basename);
    }
  }

  return filenames.sort((a, b) => b.localeCompare(a));
}

export async function fetchPhoto(filename: string): Promise<Response> {
  const { url, user, pass, path } = base();
  const endpoint = `${url}/remote.php/dav/files/${encodeURIComponent(user)}/${path}/${encodeURIComponent(filename)}`;

  const res = await fetch(endpoint, {
    headers: {
      Authorization: authHeader(user, pass),
    },
  });

  if (!res.ok) {
    throw new Error(`Nextcloud fetch failed: ${res.status} ${res.statusText}`);
  }

  return res;
}
