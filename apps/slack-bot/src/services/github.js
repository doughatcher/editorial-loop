/**
 * GitHub Contents API helpers.
 * Uses the REST API to read and write files, enabling commits from Workers.
 */
const GH_API = 'https://api.github.com';

async function ghFetch(path, options, token) {
  const res = await fetch(`${GH_API}${path}`, {
    ...options,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'editorial-slack-bot/1.0',
      ...(options?.headers ?? {}),
    },
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`GitHub API ${res.status}: ${err}`);
  }
  return res.json();
}

/**
 * Read a file from a GitHub repo.
 * Returns { content (decoded string), sha }
 */
export async function readFile(repo, path, token) {
  const data = await ghFetch(`/repos/${repo}/contents/${encodeURIComponent(path)}`, {}, token);
  const content = atob(data.content.replace(/\n/g, ''));
  return { content, sha: data.sha };
}

/**
 * Write (create or update) a file in a GitHub repo.
 * Returns the commit URL.
 */
export async function writeFile(repo, path, content, message, sha, token) {
  const encoded = btoa(unescape(encodeURIComponent(content)));
  const body = { message, content: encoded };
  if (sha) body.sha = sha; // required for updates

  const data = await ghFetch(
    `/repos/${repo}/contents/${encodeURIComponent(path)}`,
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    },
    token
  );

  return data.commit.html_url;
}

/**
 * List files in a directory (shallow, no recursion).
 * Returns array of { name, path, type }
 */
export async function listDir(repo, path, token) {
  return ghFetch(`/repos/${repo}/contents/${encodeURIComponent(path)}`, {}, token);
}
