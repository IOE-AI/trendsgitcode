import type { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { provider = 'github', owner, repo, path = 'README.md', ref = 'main' } = req.query as Record<string, string>;

  if (!owner || !repo) {
    return res.status(400).json({ error: 'Missing required params: owner, repo' });
  }

  try {
    let fetchUrl = '';

    if (provider.toLowerCase() === 'gitcode') {
      const token = process.env.GITCODE_TOKEN;
      if (!token) {
        return res.status(500).json({ error: 'Server missing GITCODE_TOKEN' });
      }
      // Preserve slashes while encoding path segments
      const encodedPath = (path || '')
        .split('/')
        .map(segment => encodeURIComponent(segment))
        .join('/');

      fetchUrl = `https://raw.gitcode.com/${owner}/${repo}/raw/${encodeURIComponent(ref)}/${encodedPath}?access_token=${token}&ref=${encodeURIComponent(ref)}`;
    } else {
      // For GitHub raw, keep slashes and encode only the ref
      fetchUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${encodeURIComponent(ref)}/${path}`;
    }
    const response = await fetch(fetchUrl);
    if (!response.ok) {
      const body = await response.text().catch(() => '');
      return res.status(response.status).json({ error: 'Failed to fetch README', details: body });
    }

    const contentType = response.headers.get('content-type') || 'application/octet-stream';
    res.setHeader('Content-Type', contentType);
    // Forward cache header if exists (optional)
    const cacheControl = response.headers.get('cache-control');
    if (cacheControl) {
      res.setHeader('Cache-Control', cacheControl);
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    return res.status(200).send(buffer);
  } catch (err: any) {
    return res.status(500).json({ error: 'Unexpected error fetching README', details: err?.message || String(err) });
  }
}