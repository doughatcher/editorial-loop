/**
 * Update a blog post in doughatcher/dotcom.
 * Finds the post by slug/title match, reads it, revises with Claude, writes back.
 */
import { readFile, writeFile, listDir } from './github.js';

export async function updateBlogPost(intent, env) {
  const { blogSlug, blogInstructions } = intent;
  const repo = env.DOTCOM_REPO;
  const contentPath = env.BLOG_CONTENT_PATH;

  // List all blog posts and find the best match
  const files = await listDir(repo, contentPath, env.GITHUB_TOKEN);
  const match = findPost(files, blogSlug);

  if (!match) {
    throw new Error(`No blog post found matching "${blogSlug}". Available posts: ${files.map(f => f.name).join(', ')}`);
  }

  // Read the matched post
  const { content: currentPost, sha } = await readFile(repo, match.path, env.GITHUB_TOKEN);

  // Revise with Claude
  const revised = await revisePost(currentPost, blogInstructions, env);

  // Write back
  const commitUrl = await writeFile(
    repo,
    match.path,
    revised,
    `blog(revise): ${blogInstructions.slice(0, 60)}`,
    sha,
    env.GITHUB_TOKEN
  );

  return { commitUrl, file: match.name };
}

function findPost(files, slug) {
  if (!slug) return null;
  const term = slug.toLowerCase().replace(/[^a-z0-9]/g, '-');
  // Exact slug match first
  let match = files.find(f => f.name.toLowerCase().includes(term));
  if (!match) {
    // Fuzzy: match any word from the slug
    const words = term.split('-').filter(w => w.length > 3);
    match = files.find(f => words.some(w => f.name.toLowerCase().includes(w)));
  }
  return match ?? null;
}

async function revisePost(currentPost, instructions, env) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 4096,
      messages: [{
        role: 'user',
        content: `You are revising a blog post for Doug Hatcher. His writing style rules:
- NO em-dashes (—). Never. Restructure the sentence instead.
- Short sentences. One idea per sentence.
- No hedging language. Commit to the claim.
- Active voice throughout.
- No buzzwords: seamless, scalable, robust, leverage (as verb), journey, ecosystem.
- Sound like a confident senior practitioner talking to a peer.

Revision instructions: "${instructions}"

Here is the current post:
---
${currentPost}
---

Apply the revision instructions while strictly following the style rules above. Preserve the frontmatter. Return only the revised post, no commentary.`,
      }],
    }),
  });

  const data = await res.json();
  return data.content[0].text;
}
