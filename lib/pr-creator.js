/**
 * pr-creator.js
 *
 * Creates a branch in doughatcher/dotcom, commits the draft post, and opens a Draft PR.
 * Returns the PR URL.
 *
 * Requires GH_TOKEN env var and gh CLI available in PATH.
 * Git identity must be configured in DOTCOM_PATH before calling (done in workflow).
 */

import { execSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

const BLOG_PATH = process.env.BLOG_PATH || './content/blog';
// When running from a separate repo, git ops run inside the dotcom checkout
const DOTCOM_PATH = process.env.DOTCOM_PATH || '.';

export async function createDraftPR(idea) {
  const today = new Date().toISOString().split('T')[0];
  const branch = `blog/${today}-${idea.slug}`;
  const filePath = path.join(BLOG_PATH, `${today}-${idea.slug}.md`);
  // git runs from DOTCOM_PATH, so it needs a path relative to that directory
  const gitFilePath = path.relative(path.resolve(DOTCOM_PATH), path.resolve(filePath));

  try {
    // Delete stale remote branch if it exists (from a previous failed run)
    try { git(`push origin --delete ${branch}`); } catch (_) {}

    // Create branch off main (delete local if it exists from a previous run)
    try { git(`branch -D ${branch}`); } catch (_) {}
    git(`checkout -b ${branch}`);

    // Write the draft (with linkedin_copy injected into frontmatter)
    fs.mkdirSync(BLOG_PATH, { recursive: true });
    fs.writeFileSync(filePath, injectLinkedInCopy(idea.draft_content, idea.linkedin_copy), 'utf8');

    // Commit and push
    git(`add "${gitFilePath}"`);
    git(`commit -m "blog(draft): ${idea.title}"`);
    git(`push origin ${branch}`);

    // Open Draft PR — write body to temp file to avoid shell quoting issues
    const body = buildPRBody(idea, filePath);
    const bodyFile = path.join(os.tmpdir(), `pr-body-${idea.slug}.md`);
    fs.writeFileSync(bodyFile, body, 'utf8');
    const prUrl = run(
      `gh pr create --draft \
        --repo doughatcher/dotcom \
        --head ${branch} \
        --title ${JSON.stringify(idea.title)} \
        --body-file ${JSON.stringify(bodyFile)} \
        --base main`,
    ).trim();

    return prUrl;
  } finally {
    // Always return to main for the next iteration
    try { git('checkout main'); } catch (_) {}
  }
}

function buildPRBody(idea, filePath) {
  return `## 📝 Blog Draft — ${idea.pillar}

**Hook:** ${idea.hook}

**Angle:** ${idea.angle}

**Source material:** ${idea.source_material}

---

Draft is in \`${filePath}\`. Edit directly on this branch or merge as-is.

**To publish:** merge this PR. The \`blog-publish\` workflow will auto-generate a LinkedIn post and cross-post it.

**To discard:** close without merging.`;
}

// Inject linkedin_copy as a YAML block scalar into the post frontmatter
function injectLinkedInCopy(draftContent, linkedInCopy) {
  if (!linkedInCopy) return draftContent;
  // Find the closing --- of the frontmatter (after the opening ---)
  const fmEnd = draftContent.indexOf('\n---', 4);
  if (fmEnd === -1) return draftContent;
  const indented = linkedInCopy.replace(/\n/g, '\n  ');
  return draftContent.slice(0, fmEnd) +
    `\nlinkedin_copy: |\n  ${indented}` +
    draftContent.slice(fmEnd);
}

// Run a git command inside the dotcom checkout
function git(args) {
  return execSync(`git ${args}`, {
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'inherit'],
    cwd: path.resolve(DOTCOM_PATH),
  });
}

// Run a shell command in the current working directory
function run(cmd) {
  return execSync(cmd, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'inherit'] });
}
