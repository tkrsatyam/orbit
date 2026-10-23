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
const BASE_SHA = process.env.BASE_SHA;
const HEAD_SHA = process.env.HEAD_SHA;
const BASE_REF = process.env.BASE_REF || 'main';
const DIFF_THRESHOLD = parseInt(process.env.DIFF_THRESHOLD || '2000', 10);

const DEFAULT_MODEL_CHAIN = [
  'gemini-3.1-flash-lite',
  'gemini-3.5-flash-lite',
  'gemini-3.8-flash',
  'gemini-3.6-flash'
];

const MODEL_CHAIN = process.env.GEMINI_MODELS
  ? process.env.GEMINI_MODELS.split(',').map((m) => m.trim()).filter(Boolean)
  : (process.env.GEMINI_MODEL ? [process.env.GEMINI_MODEL] : DEFAULT_MODEL_CHAIN);

const EXCLUSION_PATTERNS = [
  ':!.github/**',
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

function runGit(args, suppressError = false) {
  try {
    return execFileSync('git', args, {
      cwd: REPO_ROOT,
      encoding: 'utf8',
      maxBuffer: 15 * 1024 * 1024
    }).trim();
  } catch (error) {
    if (!suppressError) {
      console.warn(`Git command failed: git ${args.join(' ')}`);
      console.warn(error.message);
    }
    return '';
  }
}

function getDiffTargetArgs() {
  if (BASE_SHA && HEAD_SHA) {
    const mergeBase = runGit(['merge-base', BASE_SHA, HEAD_SHA], true);
    if (mergeBase) {
      return [mergeBase, HEAD_SHA];
    }
    return [BASE_SHA, HEAD_SHA];
  }
  return [`origin/${BASE_REF}...HEAD`];
}

function getCommitSha() {
  if (HEAD_SHA) {
    return HEAD_SHA.substring(0, 7);
  }
  const sha = runGit(['rev-parse', '--short', 'HEAD']);
  return sha || 'unknown';
}

function getDiffStat(pathPrefix = null) {
  const args = ['diff', '--shortstat', ...getDiffTargetArgs(), '--'];
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

function getDiffContent(pathPrefix = null) {
  const args = ['diff', ...getDiffTargetArgs(), '--'];
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

async function callGeminiWithRetry(promptText, apiKey, model, maxAttempts = 2, timeoutMs = 60000) {
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
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

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

async function callGeminiWithFallback(promptText, apiKey) {
  let lastError = null;

  for (const model of MODEL_CHAIN) {
    try {
      console.log(`\n--- Attempting review with model: ${model} ---`);
      const reviewText = await callGeminiWithRetry(promptText, apiKey, model, 2, 60000);
      console.log(`Successfully generated review using ${model}.`);
      return { reviewText, modelUsed: model };
    } catch (err) {
      console.warn(`Model ${model} failed (${err.message}). Trying next fallback model...`);
      lastError = err;
    }
  }

  throw new Error(`All models in fallback chain failed: ${lastError?.message}`);
}

function sanitizeReviewMarkdown(markdown) {
  if (!markdown) return markdown;

  return markdown
    // Truncate backend boilerplate paths: backend/src/main/java/com/orbit/pkg/File.java#L...
    .replace(
      /`backend\/src\/(?:main|test)\/java\/com\/orbit\/([^`\s]+)`/g,
      '`backend/.../$1`'
    )
    // Truncate frontend boilerplate paths: frontend/src/app/(core/|features/|.../)pkg/File.ts#L...
    .replace(
      /`frontend\/src\/(?:app\/)?(?:core\/|features\/|shared\/)?(?:services\/)?([^`\s]+\/[^`\s]+)`/g,
      '`frontend/.../$1`'
    )
    // Ensure a <br> exists between the backtick location and the following description in table cells
    .replace(
      /(\|(?:\s*`[^`]+#L\d+`\s*))(?!\s*<br>)\s*([A-Za-z0-9])/g,
      '$1<br>$2'
    );
}

async function publishOrUpdateComment(repo, prNumber, token, commentBody, commitSha) {
  const sanitizedBody = sanitizeReviewMarkdown(commentBody);
  const listUrl = `https://api.github.com/repos/${repo}/issues/${prNumber}/comments?per_page=100`;
  const signatureTag = `<!-- orbit-ai-review:commit:${commitSha} -->`;
  const headerPattern = `## 🤖 AI Code Review | Commit \`${commitSha}\``;
  const headers = {
    'Authorization': `Bearer ${token}`,
    'Accept': 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'orbit-ai-reviewer'
  };

  try {
    const listRes = await fetch(listUrl, { headers });
    if (listRes.ok) {
      const comments = await listRes.json();
      const matchingComments = comments.filter(
        (c) =>
          typeof c.body === 'string' &&
          (c.body.includes(signatureTag) || c.body.includes(headerPattern))
      );

      if (matchingComments.length > 0) {
        const primary = matchingComments[0];
        console.log(`Found existing review comment (ID: ${primary.id}) for commit ${commitSha}. Updating in-place...`);
        const updateUrl = `https://api.github.com/repos/${repo}/issues/comments/${primary.id}`;
        const updateRes = await fetch(updateUrl, {
          method: 'PATCH',
          headers: { ...headers, 'Content-Type': 'application/json' },
          body: JSON.stringify({ body: sanitizedBody })
        });

        if (updateRes.ok) {
          console.log(`Successfully updated review comment (ID: ${primary.id}) for commit ${commitSha}.`);

          // Remove any duplicate comments previously created for this same commit
          for (let i = 1; i < matchingComments.length; i++) {
            const duplicate = matchingComments[i];
            console.log(`Cleaning up duplicate review comment (ID: ${duplicate.id}) for commit ${commitSha}...`);
            try {
              await fetch(`https://api.github.com/repos/${repo}/issues/comments/${duplicate.id}`, {
                method: 'DELETE',
                headers
              });
            } catch (delErr) {
              console.warn(`Failed to delete duplicate comment ${duplicate.id}:`, delErr.message);
            }
          }
          return;
        }
        console.warn(`Failed to update existing comment (status ${updateRes.status}). Falling back to creating new comment.`);
      }
    }
  } catch (err) {
    console.warn(`Error checking existing comments: ${err.message}. Proceeding to create new comment.`);
  }

  // Create new comment if no existing comment found or update failed
  const createUrl = `https://api.github.com/repos/${repo}/issues/${prNumber}/comments`;
  const createRes = await fetch(createUrl, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({ body: sanitizedBody })
  });

  if (!createRes.ok) {
    const errorText = await createRes.text();
    throw new Error(`Failed to post comment to GitHub (status ${createRes.status}): ${errorText}`);
  }

  console.log(`Successfully created new review comment for commit ${commitSha}.`);
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
  console.log(`Starting AI Code Review for PR #${PR_NUMBER} (commit: ${commitSha}, base: ${BASE_REF}, baseSha: ${BASE_SHA || 'none'}, headSha: ${HEAD_SHA || 'none'})...`);

  // Ensure commits are available in local git graph
  if (BASE_SHA && HEAD_SHA) {
    // If specific SHAs were not unpacked in checkout, fetch them directly
    const hasBase = runGit(['cat-file', '-t', BASE_SHA]);
    const hasHead = runGit(['cat-file', '-t', HEAD_SHA]);
    if (hasBase !== 'commit' || hasHead !== 'commit') {
      console.log(`Fetching commit revisions ${BASE_SHA} and ${HEAD_SHA}...`);
      runGit(['fetch', 'origin', BASE_SHA, HEAD_SHA]);
    }
  } else {
    // Fallback when running outside PR workflow: fetch base branch without shallow truncation
    runGit(['fetch', 'origin', BASE_REF]);
  }

  // Calculate statistics
  const totalStats = getDiffStat();
  const backendStats = getDiffStat('backend');
  const frontendStats = getDiffStat('frontend');

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
  const header = `<!-- orbit-ai-review:commit:${commitSha} -->\n## 🤖 AI Code Review | Commit \`${commitSha}\`\n\n`;

  // Decision: Single Call Mode vs Split Call Mode
  const shouldSplit = totalStats.total > DIFF_THRESHOLD && backendStats.total > 100 && frontendStats.total > 100;

  if (shouldSplit) {
    console.log(`Diff exceeds threshold (${totalStats.total} > ${DIFF_THRESHOLD}) with substantial BE and FE changes. Executing Split Mode.`);

    const backendDiff = getDiffContent('backend');
    const frontendDiff = getDiffContent('frontend');

    const backendFullPrompt = `${basePrompt}\n\n# Backend Domain Rules\n${backendRules}\n\n# Git Diff Under Review\n<diff_content>\n${backendDiff}\n</diff_content>`;
    const frontendFullPrompt = `${basePrompt}\n\n# Frontend Domain Rules\n${frontendRules}\n\n# Git Diff Under Review\n<diff_content>\n${frontendDiff}\n</diff_content>`;

    try {
      const [backendRes, frontendRes] = await Promise.all([
        callGeminiWithFallback(backendFullPrompt, GEMINI_API_KEY),
        callGeminiWithFallback(frontendFullPrompt, GEMINI_API_KEY)
      ]);

      const footer = `\n\n---\n*This review was automatically generated by ${backendRes.modelUsed} / ${frontendRes.modelUsed} and is advisory.*`;
      reviewComment = `${header}### 📦 Backend Review\n\n${backendRes.reviewText}\n\n---\n\n### 🎨 Frontend Review\n\n${frontendRes.reviewText}${footer}`;
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

    const fullDiff = getDiffContent();
    const singlePrompt = `${basePrompt}${combinedRules}\n\n# Git Diff Under Review\n<diff_content>\n${fullDiff}\n</diff_content>`;

    try {
      const { reviewText, modelUsed } = await callGeminiWithFallback(singlePrompt, GEMINI_API_KEY);
      const footer = `\n\n---\n*This review was automatically generated by ${modelUsed} and is advisory.*`;
      reviewComment = `${header}${reviewText}${footer}`;
    } catch (singleError) {
      console.warn('Single review call failed:', singleError.message);
      return;
    }
  }

  try {
    await publishOrUpdateComment(GITHUB_REPOSITORY, PR_NUMBER, GITHUB_TOKEN, reviewComment, commitSha);
  } catch (postError) {
    console.warn('Failed to publish review comment to PR:', postError.message);
  }
}

main().catch((err) => {
  console.error('Unexpected error in review script:', err);
  process.exit(0); // Advisory: never break CI pipeline
});
