/**
 * Update the voice profile in the Obsidian vault backup repo.
 * Reads the current doc, asks Claude to incorporate the note, writes it back.
 */
import { readFile, writeFile } from './github.js';

export async function updateVoiceProfile(intent, env) {
  const { voiceNote } = intent;
  const repo = env.VAULT_REPO;
  const path = env.VOICE_PROFILE_PATH;

  // Read current voice profile
  const { content: currentDoc, sha } = await readFile(repo, path, env.GITHUB_TOKEN);

  // Ask Claude to update it
  const updated = await incorporateVoiceNote(currentDoc, voiceNote, env);

  // Write back
  const commitUrl = await writeFile(
    repo,
    path,
    updated,
    `voice: ${voiceNote.slice(0, 72)}`,
    sha,
    env.GITHUB_TOKEN
  );

  return { commitUrl };
}

async function incorporateVoiceNote(currentDoc, note, env) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 2048,
      messages: [{
        role: 'user',
        content: `You are updating a writing voice profile document.

The user wants to incorporate this feedback:
"${note}"

Here is the current document:
---
${currentDoc}
---

Update the document to incorporate this feedback. If a "Writing Style" section exists, add or update the relevant rules there. If not, create one. Keep everything else unchanged. Return only the updated document, no commentary.`,
      }],
    }),
  });

  const data = await res.json();
  return data.content[0].text;
}
