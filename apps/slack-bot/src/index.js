/**
 * editorial-slack-bot — Cloudflare Worker
 *
 * Receives Slack Events API webhooks. Doug messages the bot with feedback
 * and the bot routes it to Claude, which then commits changes to GitHub:
 *
 *   - Voice profile updates → superterran/obsidian-vault-backup
 *   - Blog post edits       → doughatcher/dotcom (content/blog/)
 *   - Draft PR revisions    → doughatcher/dotcom (branch for PR)
 *
 * Slack sends an HTTP POST for each event. We must acknowledge within 3s
 * (return 200), then do the work asynchronously via ctx.waitUntil().
 */

import { Hono } from 'hono';
import { verifySlackSignature } from './services/slack-verify.js';
import { parseIntent } from './services/intent-parser.js';
import { updateVoiceProfile } from './services/voice-updater.js';
import { updateBlogPost } from './services/blog-updater.js';
import { slackReply } from './services/slack-reply.js';

const app = new Hono();

// ── Health check ──────────────────────────────────────────────────────────────
app.get('/', (c) => c.json({ ok: true, service: 'editorial-slack-bot', version: '1.0.0' }));

// ── Slack Events API ──────────────────────────────────────────────────────────
app.post('/slack/events', async (c) => {
  const rawBody = await c.req.text();
  const body = JSON.parse(rawBody);

  // Slack URL verification handshake (one-time during app setup)
  if (body.type === 'url_verification') {
    return c.json({ challenge: body.challenge });
  }

  // Verify request is genuinely from Slack
  const isValid = await verifySlackSignature(c.req.raw, rawBody, c.env.SLACK_SIGNING_SECRET);
  if (!isValid) {
    return c.json({ error: 'Invalid signature' }, 401);
  }

  const event = body.event;

  // Only process direct messages and app mentions; skip bot messages (avoid loops)
  if (!event || event.bot_id || event.subtype === 'bot_message') {
    return c.json({ ok: true });
  }

  const isRelevant =
    event.type === 'message' && event.channel_type === 'im' ||
    event.type === 'app_mention';

  if (!isRelevant) {
    return c.json({ ok: true });
  }

  // Acknowledge immediately — Slack requires < 3s response
  // Process asynchronously
  c.executionCtx.waitUntil(handleFeedback(event, c.env));

  return c.json({ ok: true });
});

// ── Core handler ──────────────────────────────────────────────────────────────
async function handleFeedback(event, env) {
  const { text, channel, ts, thread_ts } = event;
  const replyThread = thread_ts || ts;

  // Strip bot @mention from app_mention events (e.g. "<@U123ABC> do the thing")
  const cleanText = text.replace(/<@[A-Z0-9]+>/g, '').trim();

  try {
    await slackReply(channel, replyThread, '⏳ On it — analyzing your feedback...', env);

    // Ask Claude what the user wants to do
    const intent = await parseIntent(cleanText, env);

    let result;

    if (intent.action === 'update_voice_profile') {
      result = await updateVoiceProfile(intent, env);
      await slackReply(
        channel, replyThread,
        `✅ Voice profile updated.\n>${intent.summary}\n<${result.commitUrl}|View commit>`,
        env
      );

    } else if (intent.action === 'update_blog_post') {
      result = await updateBlogPost(intent, env);
      await slackReply(
        channel, replyThread,
        `✅ Blog post updated: *${result.file}*\n>${intent.summary}\n<${result.commitUrl}|View commit>`,
        env
      );

    } else if (intent.action === 'update_both') {
      const [voiceResult, blogResult] = await Promise.all([
        updateVoiceProfile(intent, env),
        updateBlogPost(intent, env),
      ]);
      await slackReply(
        channel, replyThread,
        `✅ Done:\n• Voice profile updated — <${voiceResult.commitUrl}|commit>\n• Blog post updated — <${blogResult.commitUrl}|commit>`,
        env
      );

    } else {
      await slackReply(
        channel, replyThread,
        `🤔 I understood: _${intent.summary}_\n\nBut I'm not sure what to change. Try being more specific:\n• "Update voice profile: no em-dashes, shorter sentences"\n• "Revise the SOW post: make the opening paragraph shorter"\n• "Both: add no-em-dash rule and rewrite the SOW intro"`,
        env
      );
    }

  } catch (err) {
    console.error('handleFeedback error:', err);
    await slackReply(
      channel, replyThread,
      `❌ Something went wrong: ${err.message}`,
      env
    ).catch(() => {});
  }
}

export default app;
