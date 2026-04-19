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
  const response = await client.messages.create({
    model: 'claude-opus-4-6',
    max_tokens: 1024,
    messages: [{
      role: 'user',
      content: `You are writing a LinkedIn post for Doug Hatcher, a senior technical architect in mid-market commerce.

Doug's LinkedIn voice: plain, confident, specific, practitioner-to-practitioner. 300-500 words.
No listicles, no hustle-bro framing, no "I'm excited to share..." openers.
Start with a specific observation or claim that will stop a senior practitioner mid-scroll.
End with a single low-pressure CTA pointing to the full post.

The full blog post:
---
${postContent}
---

Blog post URL: ${postUrl}

Write only the LinkedIn post text. No commentary, no alternatives.`,
    }],
  });

  return response.content[0].text.trim();
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
