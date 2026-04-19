/**
 * idea-generator.js
 *
 * Calls Claude to generate 3 blog post ideas + full drafts.
 * Uses tool_use to get structured output.
 *
 * Ideas breakdown:
 *   - 2 mapped to editorial pillars from the strategy doc
 *   - 1 wild card — creative, unexpected, still in Doug's voice
 *
 * INJECT_CONTEXT env var allows injecting a weekly thought or
 * prompt nudge (from workflow_dispatch or Slack reply in Phase 2).
 */

import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic();

const IDEA_TOOL = {
  name: 'submit_ideas',
  description: 'Submit the three generated blog post ideas with full drafts',
  input_schema: {
    type: 'object',
    required: ['ideas'],
    properties: {
      ideas: {
        type: 'array',
        minItems: 3,
        maxItems: 3,
        items: {
          type: 'object',
          required: ['title', 'pillar', 'hook', 'angle', 'source_material', 'slug', 'draft_content'],
          properties: {
            title: { type: 'string', description: 'Post title — specific, compelling, not a listicle' },
            pillar: { type: 'string', description: 'Editorial pillar name, or "Wild Card"' },
            hook: { type: 'string', description: 'One sentence — why this post is interesting' },
            angle: { type: 'string', description: '2-3 sentences — the actual argument the post makes' },
            source_material: { type: 'string', description: 'Vault files or patterns that informed this idea' },
            slug: { type: 'string', description: 'URL-friendly slug, e.g. "optimism-cascade-replatform"' },
            draft_content: { type: 'string', description: 'Full markdown draft including frontmatter, 800-1200 words' },
          },
        },
      },
    },
  },
};

export async function generateIdeas({ strategyDoc, recentContent, existingPosts }) {
  const today = new Date().toISOString().split('T')[0];
  const injectContext = process.env.INJECT_CONTEXT || '';

  const recentContentText = recentContent
    .map(f => `### ${f.path}\n${f.excerpt}`)
    .join('\n\n---\n\n');

  const existingPostsNote = existingPosts.length > 0
    ? `Existing posts (avoid repeating these angles):\n${existingPosts.map(p => `- ${p}`).join('\n')}`
    : 'No existing posts yet — the blog is fresh.';

  const injectNote = injectContext
    ? `\n## Weekly Context Injection\nThis week Doug wants to explore or incorporate:\n> ${injectContext}\nWeight this heavily when selecting the angle for at least one idea.\n`
    : '';

  const prompt = `You are generating weekly blog post ideas for Doug Hatcher at doughatcher.com.
Doug is a senior technical architect specializing in mid-market commerce (SFCC, Shopify Plus).
His voice: plain, confident, specific, practitioner-to-practitioner. No hustle-bro content.

---

## Strategy Document
${strategyDoc}

---

## Recent Vault Content (last 60 days)
This is what Doug has been working on, thinking about, and reading. Mine it for patterns.

${recentContentText}

---

## ${existingPostsNote}
${injectNote}
---

## Task

Generate exactly 3 blog post ideas with full drafts.

**Idea breakdown:**
- 2 ideas mapped to editorial pillars (The Optimism Cascade / The Constellation / The Merchant-Side Gap / The Post-Launch Reality)
- 1 wild card — creative, outside the pillars, but still grounded in Doug's expertise and voice. Surprise him.

**For each idea, strictly follow the Rules of Engagement:**
- Abstract a level above any real situation — no project or client is identifiable
- No named competitors, agencies, or platforms punched down at
- No listicle titles ("5 reasons...", "10 lessons...")
- Favor concrete technical specificity over vague commentary
- Keep the draft 800–1200 words

**Each draft must use this frontmatter:**
\`\`\`yaml
---
title: "<post title>"
date: ${today}
draft: true
pillar: "<pillar name or Wild Card>"
tags: []
---
\`\`\`

Body format: short punchy paragraphs, no headers needed for shorter posts, use plain markdown.`;

  const response = await client.messages.create({
    model: 'claude-opus-4-6',
    max_tokens: 12000,
    tools: [IDEA_TOOL],
    tool_choice: { type: 'tool', name: 'submit_ideas' },
    messages: [{ role: 'user', content: prompt }],
  });

  const toolUse = response.content.find(b => b.type === 'tool_use');
  if (!toolUse) throw new Error('Claude did not return structured ideas');

  return toolUse.input.ideas;
}
