/**
 * editorial-loop — weekly idea generation entry point
 *
 * Flow:
 *   1. Read vault content + strategy doc via manifest
 *   2. Generate 3 ideas via Claude (2 pillar-aligned, 1 wild card)
 *   3. Write a full draft for each as content/blog/YYYY-MM-DD-slug.md
 *   4. Open a Draft PR per idea
 *   5. Notify Slack with PR links
 *
 * Inject context for a given week via INJECT_CONTEXT env var
 * (set via workflow_dispatch input or manually).
 */

import { readVaultContent } from './lib/vault-reader.js';
import { generateIdeas } from './lib/idea-generator.js';
import { createDraftPR } from './lib/pr-creator.js';
import { notifySlack } from './lib/slack-notifier.js';

async function main() {
  console.log('📖 Reading vault content...');
  const { strategyDoc, recentContent, existingPosts } = await readVaultContent();
  console.log(`   ${recentContent.length} recent vault files, ${existingPosts.length} existing posts`);

  console.log('🧠 Generating ideas via Claude...');
  const ideas = await generateIdeas({ strategyDoc, recentContent, existingPosts });
  console.log(`   Generated ${ideas.length} ideas`);

  const prs = [];
  for (const idea of ideas) {
    console.log(`📝 Creating draft PR: "${idea.title}"`);
    const prUrl = await createDraftPR(idea);
    prs.push({ ...idea, prUrl });
  }

  console.log('📣 Notifying Slack...');
  await notifySlack(prs);

  console.log('✅ Done.');
}

main().catch(err => {
  console.error('❌ editorial-loop failed:', err.message);
  process.exit(1);
});
