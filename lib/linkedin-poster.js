/**
 * linkedin-poster.js
 *
 * Generates a LinkedIn-optimized excerpt from a blog post via Claude,
 * then posts it to LinkedIn via the UGC Posts API.
 *
 * Required secrets:
 *   LINKEDIN_ACCESS_TOKEN  — OAuth 2.0 token with w_member_social scope
 *   LINKEDIN_PERSON_URN    — your LinkedIn member URN, e.g. "ACoAA..."
 *                            (find at linkedin.com/in/<yourslug>/ → Page source → "entityUrn")
 *
 * Note: LinkedIn access tokens expire after 60 days. Refresh via the OAuth flow
 * and update the LINKEDIN_ACCESS_TOKEN secret before it lapses.
 */

import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic();

export async function generateLinkedInPost(postContent, postUrl) {
  // Use pre-generated linkedin_copy from frontmatter if present
  const pregenerated = extractLinkedInCopy(postContent);
  if (pregenerated) {
    return pregenerated.replace('{{url}}', postUrl).replace(/Full post: \{\{url\}\}/g, `Full post: ${postUrl}`).trim();
  }

  // Fallback: generate fresh from the full post content
  const response = await client.messages.create({
    model: 'claude-opus-4-6',
    max_tokens: 1024,
    messages: [{
      role: 'user',
      content: `You are writing a LinkedIn post for Doug Hatcher, a Director of Engineering with deep roots in commerce architecture and platform engineering.

Write for two audiences at once: executive leaders (what broke, why it matters to the org, the strategic judgment call) and technical leaders (the specific tradeoff, the implementation detail that changes everything, the failure mode practitioners live with).

Voice rules:
- Open with a specific claim or observation — not a question, not an announcement, not "I'm excited to share"
- 300-500 words
- No em-dashes. No hedging. No buzzwords.
- Sound like someone who has already solved this problem twice and is talking to a peer, not performing on LinkedIn
- End with exactly: "Full post: ${postUrl}"

The full blog post:
---
${postContent}
---

Write only the LinkedIn post text. No commentary, no alternatives.`,
    }],
  });

  return response.content[0].text.trim();
}

// Extract linkedin_copy YAML block scalar from frontmatter
function extractLinkedInCopy(content) {
  const fmMatch = content.match(/^---\n([\s\S]+?)\n---/);
  if (!fmMatch) return null;
  const copyMatch = fmMatch[1].match(/^linkedin_copy:\s*\|\s*\n((?:[ \t].+\n?)*)/m);
  if (!copyMatch) return null;
  return copyMatch[1].replace(/^  /gm, '').trim();
}

export async function postToLinkedIn(text) {
  const token = process.env.LINKEDIN_ACCESS_TOKEN;
  const personUrn = process.env.LINKEDIN_PERSON_URN;

  if (!token || !personUrn) {
    throw new Error('LINKEDIN_ACCESS_TOKEN and LINKEDIN_PERSON_URN must be set');
  }

  const body = {
    author: `urn:li:person:${personUrn}`,
    lifecycleState: 'PUBLISHED',
    specificContent: {
      'com.linkedin.ugc.ShareContent': {
        shareCommentary: { text },
        shareMediaCategory: 'NONE',
      },
    },
    visibility: {
      'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC',
    },
  };

  const res = await fetch('https://api.linkedin.com/v2/ugcPosts', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'X-Restli-Protocol-Version': '2.0.0',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`LinkedIn API ${res.status}: ${detail}`);
  }

  return res.json();
}
