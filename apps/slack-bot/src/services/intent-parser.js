/**
 * Ask Claude what the user wants to do.
 *
 * Returns:
 *   { action, summary, voiceNote, blogSlug, blogInstructions }
 *
 * action is one of:
 *   'update_voice_profile' — add/update a writing style rule
 *   'update_blog_post'     — revise a specific blog post
 *   'update_both'          — do both
 *   'unclear'              — couldn't parse intent
 */
export async function parseIntent(userText, env) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      tools: [{
        name: 'parse_intent',
        description: 'Parse the user\'s editorial feedback into a structured action plan',
        input_schema: {
          type: 'object',
          required: ['action', 'summary'],
          properties: {
            action: {
              type: 'string',
              enum: ['update_voice_profile', 'update_blog_post', 'update_both', 'unclear'],
              description: 'What the user wants to do',
            },
            summary: {
              type: 'string',
              description: 'One sentence summary of what will be changed',
            },
            voiceNote: {
              type: 'string',
              description: 'The specific writing style rule or note to add to the voice profile. Only for update_voice_profile or update_both.',
            },
            blogSlug: {
              type: 'string',
              description: 'The slug or partial title of the blog post to edit. Only for update_blog_post or update_both.',
            },
            blogInstructions: {
              type: 'string',
              description: 'Clear instructions for how to revise the blog post. Only for update_blog_post or update_both.',
            },
          },
        },
      }],
      tool_choice: { type: 'tool', name: 'parse_intent' },
      messages: [{
        role: 'user',
        content: `The user sent this feedback to an editorial assistant bot. It may be a voice transcript — expect run-on sentences, informal language, and stream-of-consciousness phrasing.

Message:
"${userText}"

The bot can:
1. Update a voice profile / writing style guide (stored in Obsidian vault)
2. Revise a specific blog post (stored in a GitHub repo)
3. Do both at once

Parsing rules:
- If they mention writing style, tone, voice, em-dashes, punctuation, sentence structure, word choices to avoid — that's a voice profile update. Capture it as a clear, actionable rule in voiceNote.
- If they mention a specific post, title, slug, or give content/editorial direction for a post — that's a blog post update. Extract the slug/title hint in blogSlug and translate their rambling into clear revision instructions in blogInstructions.
- "regenerate the post", "rewrite the post", "fix the post", "let's redo the post" = blog post update.
- When intent spans both voice style and post content, use update_both.
- Only return unclear if the message is genuinely unrelated to writing or editorial work.

For blogInstructions, synthesize their intent into clear editing instructions — do not just transcribe what they said.`,
      }],
    }),
  });

  const data = await res.json();
  console.log('intent-parser response:', JSON.stringify(data).slice(0, 500));
  if (data.error) {
    throw new Error(`Anthropic API error: ${data.error.type} — ${data.error.message}`);
  }
  const toolUse = data.content?.find(b => b.type === 'tool_use');
  return toolUse?.input ?? { action: 'unclear', summary: userText };
}
