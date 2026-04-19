/**
 * publish.js — LinkedIn cross-post entry point
 *
 * Called by the blog-publish workflow when a blog post is merged to main.
 * Reads the post file from POST_PATH env var, generates a LinkedIn excerpt
 * via Claude, and posts it.
 */

import fs from 'fs';
import { generateLinkedInPost, postToLinkedIn } from './lib/linkedin-poster.js';

const POST_PATH = process.env.POST_PATH;
const BASE_URL = process.env.BASE_URL || 'https://doughatcher.com';

async function main() {
  if (!POST_PATH) throw new Error('POST_PATH env var required');

  const content = fs.readFileSync(POST_PATH, 'utf8');

  // Derive public URL from file path: content/blog/2026-04-18-my-slug.md → /blog/my-slug/
  const filename = POST_PATH.split('/').pop().replace('.md', '');
  // Strip leading date prefix (YYYY-MM-DD-)
  const slug = filename.replace(/^\d{4}-\d{2}-\d{2}-/, '');
  const postUrl = `${BASE_URL}/blog/${slug}/`;

  console.log(`📖 Post: ${POST_PATH}`);
  console.log(`🔗 URL: ${postUrl}`);

  console.log('🧠 Generating LinkedIn post via Claude...');
  const linkedInText = await generateLinkedInPost(content, postUrl);
  console.log('--- LinkedIn post preview ---');
  console.log(linkedInText);
  console.log('---');

  console.log('📤 Posting to LinkedIn...');
  const result = await postToLinkedIn(linkedInText);
  console.log(`✅ Posted: ${result.id}`);
}

main().catch(err => {
  console.error('❌ publish failed:', err.message);
  process.exit(1);
});
