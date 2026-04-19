/**
 * vault-reader.js
 *
 * Reads content from the checked-out vault backup and the local blog directory.
 * Expects VAULT_PATH env var pointing to the checked-out obsidian-vault-backup repo.
 *
 * Scans sections defined in Context/blog-engine/manifest.md within the vault.
 * Falls back to sensible defaults if the manifest is missing.
 */

import fs from 'fs';
import path from 'path';

const VAULT_PATH = process.env.VAULT_PATH || './vault';
const BLOG_PATH = process.env.BLOG_PATH || './content/blog';
const SCAN_DAYS = parseInt(process.env.SCAN_DAYS || '60');

const STRATEGY_DOC = 'Personal/Career/Public Voice - Positioning and Editorial POV.md';

const DEFAULT_SECTIONS = [
  'Personal/',
  'Context/sessions/',
  'Blue Acorn iCi/Cases/',
];

const MAX_FILES_PER_SECTION = 15;
const EXCERPT_LENGTH = 600;

export async function readVaultContent() {
  const strategyDoc = readFile(path.join(VAULT_PATH, STRATEGY_DOC));
  if (!strategyDoc) throw new Error(`Strategy doc not found at ${STRATEGY_DOC}`);

  const sections = readManifestSections();
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - SCAN_DAYS);

  const recentContent = [];
  for (const section of sections) {
    const sectionPath = path.join(VAULT_PATH, section);
    if (!fs.existsSync(sectionPath)) continue;

    const files = findRecentMarkdown(sectionPath, cutoff)
      .slice(0, MAX_FILES_PER_SECTION);

    for (const file of files) {
      const raw = readFile(file);
      if (!raw) continue;
      recentContent.push({
        path: path.relative(VAULT_PATH, file),
        excerpt: raw.slice(0, EXCERPT_LENGTH),
      });
    }
  }

  // Existing blog posts (just filenames — avoid re-pitching the same angles)
  const existingPosts = fs.existsSync(BLOG_PATH)
    ? fs.readdirSync(BLOG_PATH, { recursive: true })
        .filter(f => f.endsWith('.md') && !f.endsWith('.gitkeep'))
    : [];

  return { strategyDoc, recentContent, existingPosts };
}

function readManifestSections() {
  const manifestPath = path.join(VAULT_PATH, 'Context/blog-engine/manifest.md');
  if (!fs.existsSync(manifestPath)) return DEFAULT_SECTIONS;

  // Parse simple YAML-ish list under "## Sections"
  const content = fs.readFileSync(manifestPath, 'utf8');
  const match = content.match(/## Sections\s+([\s\S]*?)(?=##|$)/);
  if (!match) return DEFAULT_SECTIONS;

  const sections = match[1]
    .split('\n')
    .map(l => l.replace(/^[-\s*]+/, '').trim())
    .filter(l => l.length > 0 && !l.startsWith('#'));

  return sections.length > 0 ? sections : DEFAULT_SECTIONS;
}

function findRecentMarkdown(dir, cutoff) {
  const results = [];
  try {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory() && !entry.name.startsWith('.')) {
        results.push(...findRecentMarkdown(full, cutoff));
      } else if (entry.name.endsWith('.md')) {
        const { mtime } = fs.statSync(full);
        if (mtime >= cutoff) results.push(full);
      }
    }
  } catch { /* skip unreadable dirs */ }

  return results.sort((a, b) =>
    fs.statSync(b).mtime - fs.statSync(a).mtime
  );
}

function readFile(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch {
    return null;
  }
}
