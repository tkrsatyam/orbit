#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const REPO_ROOT = resolve(__dirname, '../..');

// Environment variables
const GEMINI_API_KEY = process.env.GEMINI_AI_REVIEW_API_KEY || process.env.GEMINI_API_KEY;
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GITHUB_REPOSITORY = process.env.GITHUB_REPOSITORY;
const PR_NUMBER = process.env.PR_NUMBER;
const BASE_REF = process.env.BASE_REF || 'main';
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-3.8-flash';
const DIFF_THRESHOLD = parseInt(process.env.DIFF_THRESHOLD || '2000', 10);

const EXCLUSION_PATTERNS = [
  ':!package-lock.json',
  ':!*/package-lock.json',
  ':!pnpm-lock.yaml',
  ':!*/pnpm-lock.yaml',
  ':!yarn.lock',
  ':!*/yarn.lock',
  ':!*.svg',
  ':!*.png',
  ':!*.jpg',
  ':!*.jpeg',
  ':!*.webp',
  ':!*.ico',
  ':!*.woff',
  ':!*.woff2',
  ':!*.ttf',
  ':!*.eot',
  ':!*.map',
  ':!*.min.js',
  ':!*.min.css',
  ':!*.md',
  ':!docs/**',
  ':!backend/src/main/resources/static/**'
];

function runGit(args) {
  try {
    return execFileSync('git', args, {
      cwd: REPO_ROOT,
      encoding: 'utf8',
      maxBuffer: 15 * 1024 * 1024
    }).trim();
  } catch (error) {
    console.warn(`Git command failed: git ${args.join(' ')}`);
    console.warn(error.message);
    return '';
  }
}

function getCommitSha() {
  const sha = runGit(['rev-parse', '--short', 'HEAD']);
  return sha || 'unknown';
}

function getDiffStat(baseBranch, pathPrefix = null) {
  const args = ['diff', '--shortstat', `origin/${baseBranch}...HEAD`, '--'];
  if (pathPrefix) {
    args.push(pathPrefix);
  }
  args.push(...EXCLUSION_PATTERNS);

  const output = runGit(args);
  if (!output) {
    return { files: 0, insertions: 0, deletions: 0, total: 0 };
  }

  const insertionsMatch = output.match(/(\d+)\s+insertion/);
  const deletionsMatch = output.match(/(\d+)\s+deletion/);
  const filesMatch = output.match(/(\d+)\s+file/);

  const insertions = insertionsMatch ? parseInt(insertionsMatch[1], 10) : 0;
  const deletions = deletionsMatch ? parseInt(deletionsMatch[1], 10) : 0;
  const files = filesMatch ? parseInt(filesMatch[1], 10) : 0;

  return {
    files,
    insertions,
    deletions,
    total: insertions + deletions
  };
}

function getDiffContent(baseBranch, pathPrefix = null) {
  const args = ['diff', `origin/${baseBranch}...HEAD`, '--'];
  if (pathPrefix) {
    args.push(pathPrefix);
  }
  args.push(...EXCLUSION_PATTERNS);

  return runGit(args);
}

function readMarkdownRule(relativePath) {
  const fullPath = resolve(REPO_ROOT, relativePath);
  if (!existsSync(fullPath)) {
    console.warn(`Rule file not found: ${fullPath}`);
    return '';
  }
  return readFileSync(fullPath, 'utf8').trim();
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function callGeminiWithRetry(promptText, apiKey, model, maxAttempts = 3) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const requestBody = {
    contents: [
      {
        role: 'user',
        parts: [{ text: promptText }]
      }
    ],
    generationConfig: {
      temperature: 0.2
    }
  };

  let lastError = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      console.log(`Calling Gemini API (${model}), attempt ${attempt}/${maxAttempts}...`);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 90000);

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        const data = await response.json();
        const candidate = data.candidates?.[0];
        const reviewText = candidate?.content?.parts?.[0]?.text;
        if (reviewText) {
          return reviewText;
        }
        throw new Error('Gemini returned an empty candidate or text field.');
      }

      const status = response.status;
      const errorText = await response.text();
      lastError = new Error(`Gemini API error (status ${status}): ${errorText}`);

      // Retry on 429 (Rate Limit) and 503 (High Demand / Unavailable)
      if (status === 429 || status === 503) {
        if (attempt < maxAttempts) {
          const jitter = Math.floor(Math.random() * 800);
          const delayMs = Math.pow(2, attempt) * 2000 + jitter;
          console.warn(`Encountered HTTP ${status}. Retrying in ${delayMs}ms...`);
          await sleep(delayMs);
          continue;
        }
        throw lastError;
      }

      // Non-retryable client/server error: fail immediately
      throw lastError;
    } catch (err) {
      lastError = err;
      const isRetryableNetworkError =
        err.name === 'AbortError' ||
        err.code === 'UND_ERR_CONNECT_TIMEOUT' ||
        err.code === 'ECONNRESET' ||
        err.code === 'ETIMEDOUT';

      if (attempt < maxAttempts && isRetryableNetworkError) {
        const delayMs = Math.pow(2, attempt) * 2000;
        console.warn(`Request failed with ${err.name || err.code}. Retrying in ${delayMs}ms...`);
        await sleep(delayMs);
        continue;
      }

      // If it's not a retryable network error, do not retry
      break;
    }
  }

  throw lastError;
}

async function postCommentToPR(repo, prNumber, token, commentBody) {
  const url = `https://api.github.com/repos/${repo}/issues/${prNumber}/comments`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'orbit-ai-reviewer'
    },
    body: JSON.stringify({ body: commentBody })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to post comment to GitHub (status ${response.status}): ${errorText}`);
  }

  console.log('Successfully posted review comment to pull request.');
}

async function main() {
  if (!GEMINI_API_KEY) {
    console.warn('GEMINI_AI_REVIEW_API_KEY is not set. Skipping AI review.');
    process.exit(0);
  }

  if (!GITHUB_TOKEN || !GITHUB_REPOSITORY || !PR_NUMBER) {
    console.warn('Missing GITHUB_TOKEN, GITHUB_REPOSITORY, or PR_NUMBER. Skipping AI review.');
    process.exit(0);
  }

  const commitSha = getCommitSha();
  console.log(`Starting AI Code Review for PR #${PR_NUMBER} (commit: ${commitSha}, base: ${BASE_REF})...`);

  // Ensure base branch is fetched
  runGit(['fetch', 'origin', BASE_REF, '--depth=1']);

  // Calculate statistics
  const totalStats = getDiffStat(BASE_REF);
  const backendStats = getDiffStat(BASE_REF, 'backend');
  const frontendStats = getDiffStat(BASE_REF, 'frontend');

  console.log(`Total changed lines: ${totalStats.total} (${totalStats.insertions}+ / ${totalStats.deletions}-)`);
  console.log(`Backend: ${backendStats.total} lines. Frontend: ${frontendStats.total} lines.`);

  if (totalStats.total === 0) {
    console.log('No eligible code changes detected after filtering lockfiles and assets. Skipping review.');
    process.exit(0);
  }

  // Load rules
  const basePrompt = readMarkdownRule('.github/ai-review/ai-review-prompt.md');
  const backendRules = readMarkdownRule('.github/ai-review/backend-rules.md');
  const frontendRules = readMarkdownRule('.github/ai-review/frontend-rules.md');

  let reviewComment = '';
  const header = `## 🤖 AI Code Review | Commit \`${commitSha}\`\n\n`;
  const footer = `\n\n---\n*This review was automatically generated by ${GEMINI_MODEL} and is advisory.*`;

  // Decision: Single Call Mode vs Split Call Mode
  const shouldSplit = totalStats.total > DIFF_THRESHOLD && backendStats.total > 100 && frontendStats.total > 100;

  if (shouldSplit) {
    console.log(`Diff exceeds threshold (${totalStats.total} > ${DIFF_THRESHOLD}) with substantial BE and FE changes. Executing Split Mode.`);

    const backendDiff = getDiffContent(BASE_REF, 'backend');
    const frontendDiff = getDiffContent(BASE_REF, 'frontend');

    const backendFullPrompt = `${basePrompt}\n\n# Backend Domain Rules\n${backendRules}\n\n# Git Diff Under Review\n<diff_content>\n${backendDiff}\n</diff_content>`;
    const frontendFullPrompt = `${basePrompt}\n\n# Frontend Domain Rules\n${frontendRules}\n\n# Git Diff Under Review\n<diff_content>\n${frontendDiff}\n</diff_content>`;

    try {
      const [backendReview, frontendReview] = await Promise.all([
        callGeminiWithRetry(backendFullPrompt, GEMINI_API_KEY, GEMINI_MODEL),
        callGeminiWithRetry(frontendFullPrompt, GEMINI_API_KEY, GEMINI_MODEL)
      ]);

      reviewComment = `${header}### 📦 Backend Review\n\n${backendReview}\n\n---\n\n### 🎨 Frontend Review\n\n${frontendReview}${footer}`;
    } catch (splitError) {
      console.warn('Split review failed:', splitError.message);
      return;
    }
  } else {
    console.log(`Executing Single Call Mode (total lines: ${totalStats.total}, threshold: ${DIFF_THRESHOLD}).`);

    let combinedRules = '';
    if (backendStats.total > 0) {
      combinedRules += `\n\n# Backend Domain Rules\n${backendRules}`;
    }
    if (frontendStats.total > 0) {
      combinedRules += `\n\n# Frontend Domain Rules\n${frontendRules}`;
    }

    const fullDiff = getDiffContent(BASE_REF);
    const singlePrompt = `${basePrompt}${combinedRules}\n\n# Git Diff Under Review\n<diff_content>\n${fullDiff}\n</diff_content>`;

    try {
      const reviewResult = await callGeminiWithRetry(singlePrompt, GEMINI_API_KEY, GEMINI_MODEL);
      reviewComment = `${header}${reviewResult}${footer}`;
    } catch (singleError) {
      console.warn('Single review call failed:', singleError.message);
      return;
    }
  }

  try {
    await postCommentToPR(GITHUB_REPOSITORY, PR_NUMBER, GITHUB_TOKEN, reviewComment);
  } catch (postError) {
    console.warn('Failed to post review comment to PR:', postError.message);
  }
}

main().catch((err) => {
  console.error('Unexpected error in review script:', err);
  process.exit(0); // Advisory: never break CI pipeline
});
