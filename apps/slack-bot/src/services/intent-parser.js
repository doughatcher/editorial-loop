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
      model: 'claude-haiku-4-5-20251001',
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
        content: `The user sent this feedback message to an editorial assistant bot:

"${userText}"

The bot can:
1. Update a voice profile / writing style guide (stored in Obsidian vault)
2. Revise a specific blog post (stored in a GitHub repo)
3. Do both at once

Parse what the user wants. If they mention em-dashes, writing style, tone, or voice — that's a voice profile update. If they mention a specific post, title, or content change — that's a blog post update.`,
      }],
    }),
  });

  const data = await res.json();
  const toolUse = data.content?.find(b => b.type === 'tool_use');
  return toolUse?.input ?? { action: 'unclear', summary: userText };
}
