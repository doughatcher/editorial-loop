/**
 * slack-notifier.js
 *
 * Posts this week's ideas to Slack via incoming webhook.
 * Phase 1: Slack incoming webhook (just a URL, no app needed).
 * Phase 2: swap for Slack bot + interactive buttons (approve/tweak/skip).
 *
 * Set SLACK_WEBHOOK_URL secret in the repo to enable.
 */

export async function notifySlack(ideas) {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL;
  if (!webhookUrl) {
    console.log('   SLACK_WEBHOOK_URL not set — skipping Slack notification');
    return;
  }

  const blocks = [
    {
      type: 'header',
      text: { type: 'plain_text', text: '📝 This week\'s blog ideas' },
    },
    {
      type: 'context',
      elements: [{
        type: 'mrkdwn',
        text: `Generated ${new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })} · Merge a Draft PR to publish · Inject context via *Actions → Run workflow*`,
      }],
    },
    { type: 'divider' },
  ];

  for (let i = 0; i < ideas.length; i++) {
    const { title, pillar, hook, prUrl } = ideas[i];
    const label = pillar === 'Wild Card' ? '🃏 Wild Card' : `📌 ${pillar}`;

    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*${i + 1}. ${title}*\n${label}\n${hook}`,
      },
      accessory: {
        type: 'button',
        text: { type: 'plain_text', text: 'View Draft PR' },
        url: prUrl,
      },
    });
  }

  blocks.push({ type: 'divider' });
  blocks.push({
    type: 'context',
    elements: [{
      type: 'mrkdwn',
      text: 'Reply to this message with thoughts to inject context into next week\'s run.',
    }],
  });

  const res = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ blocks }),
  });

  if (!res.ok) {
    console.warn(`   Slack returned ${res.status}: ${await res.text()}`);
  }
}
