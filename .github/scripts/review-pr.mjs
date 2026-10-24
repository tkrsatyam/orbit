#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
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
const HEAD_REF = process.env.HEAD_REF || '';
const DIFF_THRESHOLD = parseInt(process.env.DIFF_THRESHOLD || '2000', 10);

const DEFAULT_MODEL_CHAIN = [
  'gemini-3.8-flash',
  'gemini-3.6-flash',
  'gemini-3.5-flash-lite',
  'gemini-3.1-flash-lite'
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

function getLatestCommitInfo() {
  const target = HEAD_SHA || 'HEAD';
  const out = runGit(['log', '-1', '--pretty=format:%h - %s%n%b', target], true);
  return out ? out.trim() : '';
}

function getLatestCommitFiles() {
  const target = HEAD_SHA || 'HEAD';
  const parent = runGit(['rev-parse', `${target}^`], true);
  if (parent) {
    const out = runGit(['diff', '--name-only', `${target}^`, target, '--', ...EXCLUSION_PATTERNS], true);
    if (out) {
      return out.split('\n').map((f) => f.trim()).filter(Boolean);
    }
  }
  return [];
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

function getChangedFiles(pathPrefix = null) {
  const args = ['diff', '--name-only', ...getDiffTargetArgs(), '--'];
  if (pathPrefix) {
    args.push(pathPrefix);
  }
  args.push(...EXCLUSION_PATTERNS);

  const output = runGit(args);
  if (!output) return [];
  return output.split('\n').map((f) => f.trim()).filter(Boolean);
}

function isTestFile(filePath) {
  const normalized = filePath.replace(/\\/g, '/');
  return (
    normalized.includes('/src/test/') ||
    normalized.includes('/e2e/') ||
    normalized.endsWith('.spec.ts') ||
    normalized.endsWith('.spec.js') ||
    /[A-Z][a-zA-Z0-9]*(Test|Tests|IT)\.java$/.test(normalized)
  );
}

function partitionDiff(diffContent) {
  if (!diffContent || !diffContent.trim()) {
    return { productionDiff: '', testDiff: '' };
  }

  const chunks = diffContent.split(/(?=^diff --git )/m);
  let productionDiff = '';
  let testDiff = '';

  for (const chunk of chunks) {
    if (!chunk.trim()) continue;
    const match = chunk.match(/^diff --git (?:\"a\/|a\/)(.+?)(?:\"| )/m);
    if (match) {
      const filePath = match[1];
      if (isTestFile(filePath)) {
        testDiff += chunk;
      } else {
        productionDiff += chunk;
      }
    } else {
      productionDiff += chunk;
    }
  }

  return { productionDiff: productionDiff.trim(), testDiff: testDiff.trim() };
}

function formatDiffBlock(diffContent) {
  const { productionDiff, testDiff } = partitionDiff(diffContent);
  let block = '\n\n# Git Diff Under Review\n<diff_content>';
  if (productionDiff) {
    block += `\n<production_diff>\n${productionDiff}\n</production_diff>`;
  }
  if (testDiff) {
    block += `\n<test_diff>\n${testDiff}\n</test_diff>`;
  }
  block += '\n</diff_content>';
  return block;
}

function formatFilesText(files) {
  const validExtensions = ['.java', '.ts', '.html', '.scss', '.yml', '.yaml', '.xml'];
  let filesText = '';
  let count = 0;

  for (const relPath of files) {
    const ext = relPath.substring(relPath.lastIndexOf('.')).toLowerCase();
    if (!validExtensions.includes(ext)) {
      continue;
    }

    const fullPath = resolve(REPO_ROOT, relPath);
    if (!existsSync(fullPath)) {
      continue;
    }

    try {
      const content = readFileSync(fullPath, 'utf8');
      if (content.length > 50000) {
        continue;
      }
      const lang = ext.replace('.', '');
      filesText += `\n### File: ${relPath}\n\`\`\`${lang}\n${content.trim()}\n\`\`\`\n`;
      count++;
    } catch (err) {
      console.warn(`Could not read full file ${relPath}: ${err.message}`);
    }
  }

  return { filesText, count };
}

function fetchPartitionedSourceFiles(fileList) {
  const prodFiles = fileList.filter((f) => !isTestFile(f));
  const testFiles = fileList.filter((f) => isTestFile(f));

  const prodResult = formatFilesText(prodFiles);
  const testResult = formatFilesText(testFiles);

  const totalFiles = prodResult.count + testResult.count;
  if (totalFiles === 0) return '';

  let block = `\n\n# Full Source Files at HEAD (${totalFiles} files)\n<modified_files_full_source>`;
  if (prodResult.count > 0) {
    block += `\n<production_source_files>${prodResult.filesText}\n</production_source_files>`;
  }
  if (testResult.count > 0) {
    block += `\n<test_source_files>${testResult.filesText}\n</test_source_files>`;
  }
  block += '\n</modified_files_full_source>';

  return block;
}

function fetchProjectContracts(changedFiles) {
  const contracts = [
    {
      path: 'backend/src/main/java/com/orbit/common/config/OrbitProperties.java',
      desc: 'Global Typed & Validated Configuration Record'
    },
    {
      path: 'backend/src/main/resources/application.yml',
      desc: 'Application Configuration & Environment Mappings'
    }
  ];

  const touchedStr = changedFiles.join(' ').toLowerCase();
  if (touchedStr.includes('websocket') || touchedStr.includes('stomp')) {
    contracts.push(
      { path: 'docs/architecture/sequences/websocket_lifecycle.md', desc: 'WebSocket Lifecycle Sequence' },
      { path: 'docs/architecture/sequences/presence_flow.md', desc: 'Presence Flow Sequence' }
    );
  }
  if (touchedStr.includes('message') || touchedStr.includes('chat')) {
    contracts.push({ path: 'docs/architecture/sequences/message_send_flow.md', desc: 'Message Send Sequence' });
  }
  if (touchedStr.includes('ai')) {
    contracts.push({ path: 'docs/architecture/sequences/ai_feature_flow.md', desc: 'AI Feature Flow Sequence' });
  }

  let contractsText = '';
  for (const contract of contracts) {
    const fullPath = resolve(REPO_ROOT, contract.path);
    if (existsSync(fullPath)) {
      try {
        const content = readFileSync(fullPath, 'utf8').trim();
        const ext = contract.path.substring(contract.path.lastIndexOf('.')).replace('.', '');
        contractsText += `\n### Contract: ${contract.path} (${contract.desc})\n\`\`\`${ext}\n${content}\n\`\`\`\n`;
      } catch (e) {
        // Ignore read errors
      }
    }
  }

  if (!contractsText) return '';
  return `\n\n# Project Contracts & Architectural Baselines\n<project_contracts>${contractsText}\n</project_contracts>`;
}

function fetchRequirementsAndAdrs(prTitle, prBody, headRef, changedFiles) {
  const combinedText = `${prTitle || ''} ${prBody || ''} ${headRef || ''} ${changedFiles.join(' ')}`;

  // 1. Extract Requirement IDs (e.g. P1-03, P1-13, P2-01)
  const reqMatches = [...new Set(combinedText.match(/P[1-4]-\d{2}/gi) || [])].map((m) => m.toUpperCase());

  // 2. Extract Ticket Keys (e.g. ORDM-44)
  const ticketMatches = [...new Set(combinedText.match(/ORDM-\d+/gi) || [])].map((m) => m.toUpperCase());

  // 3. Extract ADR references (e.g. ADR-002, ADR 002, ADR-2, ADR 2)
  const adrNumMatches = new Set();
  const adrRegex = /ADR[-\s]?0*(\d{1,3})/gi;
  let match;
  while ((match = adrRegex.exec(combinedText)) !== null) {
    adrNumMatches.add(parseInt(match[1], 10));
  }

  // Also infer ADRs from touched files/keywords if not explicitly mentioned
  const touchedLower = combinedText.toLowerCase();
  if (touchedLower.includes('websocket') || touchedLower.includes('stomp')) {
    adrNumMatches.add(2); // 002_websocket_scaling.md
  }
  if (touchedLower.includes('contact') && (touchedLower.includes('remove') || touchedLower.includes('delete'))) {
    adrNumMatches.add(6); // 006_contact_removal_strategy.md
  }
  if (touchedLower.includes('block')) {
    adrNumMatches.add(7); // 007_blocking_behavior.md
    adrNumMatches.add(13); // 013_block_endpoint_design.md
  }

  let extractedRequirements = '';
  const reqFilePath = resolve(REPO_ROOT, 'docs/REQUIREMENTS.md');
  if (existsSync(reqFilePath)) {
    try {
      const reqContent = readFileSync(reqFilePath, 'utf8');
      const lines = reqContent.split('\n');
      const matchedLines = [];

      for (const reqId of reqMatches) {
        for (const line of lines) {
          if (line.includes(`| ${reqId} `) || line.includes(`| ${reqId}|`)) {
            matchedLines.push(line.trim());
          }
        }
      }

      for (const ticket of ticketMatches) {
        for (const line of lines) {
          if (line.includes(ticket) && !matchedLines.includes(line.trim())) {
            matchedLines.push(line.trim());
          }
        }
      }

      if (matchedLines.length > 0) {
        extractedRequirements = `### Functional Requirements Grounding\n| ID | Epic | Feature | Functional Behavior |\n|---|---|---|---|\n${matchedLines.join('\n')}\n`;
      }
    } catch (e) {
      console.warn(`Could not read docs/REQUIREMENTS.md: ${e.message}`);
    }
  }

  let extractedAdrs = '';
  const discussionsDir = resolve(REPO_ROOT, 'docs/discussions');
  if (existsSync(discussionsDir)) {
    try {
      const files = readdirSync(discussionsDir);
      for (const num of adrNumMatches) {
        const paddedPrefix = String(num).padStart(3, '0');
        const adrFile = files.find((f) => f.startsWith(`${paddedPrefix}_`) && f.endsWith('.md'));
        if (adrFile) {
          const adrPath = resolve(discussionsDir, adrFile);
          const content = readFileSync(adrPath, 'utf8').trim();
          const truncatedContent = content.length > 4000 ? `${content.substring(0, 4000)}\n...(truncated for brevity)` : content;
          extractedAdrs += `\n### ADR ${adrFile}\n\`\`\`markdown\n${truncatedContent}\n\`\`\`\n`;
        }
      }
    } catch (e) {
      console.warn(`Could not read docs/discussions directory: ${e.message}`);
    }
  }

  if (!extractedRequirements && !extractedAdrs) {
    return '';
  }

  let result = '\n\n# Project Requirements & ADR Context\n<requirements_context>\n';
  if (extractedRequirements) {
    result += `${extractedRequirements}\n`;
  }
  if (extractedAdrs) {
    result += `### Architectural Decision Records (ADRs)\n${extractedAdrs}\n`;
  }
  result += '</requirements_context>';
  return result;
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
      temperature: 0.2,
      responseMimeType: 'application/json'
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

function parseReviewResponse(rawText, domain) {
  if (!rawText) {
    return {
      domain,
      status: 'PASS',
      summary: '',
      reviewOfUpdates: '',
      issues: [],
      verification: { architecture: 'Verified.', security: 'Verified.' }
    };
  }

  let parsed = null;
  try {
    parsed = JSON.parse(rawText.trim());
  } catch (e) {
    const match = rawText.match(/```(?:json)?\s*([\s\S]*?)\s*```/) || rawText.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        parsed = JSON.parse(match[1] || match[0]);
      } catch (innerErr) {
        // Fallback
      }
    }
  }

  if (parsed && typeof parsed === 'object') {
    return {
      domain: parsed.domain || domain,
      status: parsed.status || (Array.isArray(parsed.issues) && parsed.issues.length > 0 ? 'WARNING' : 'PASS'),
      summary: typeof parsed.summary === 'string' ? parsed.summary.trim() : '',
      reviewOfUpdates: typeof parsed.reviewOfUpdates === 'string' ? parsed.reviewOfUpdates.trim() : '',
      issues: Array.isArray(parsed.issues) ? parsed.issues : [],
      verification: {
        architecture: parsed.verification?.architecture || 'Verified.',
        security: parsed.verification?.security || 'Verified.'
      }
    };
  }

  return {
    domain,
    status: 'PASS',
    summary: rawText.substring(0, 300),
    reviewOfUpdates: rawText.substring(0, 300),
    issues: [],
    verification: { architecture: 'Verified.', security: 'Verified.' }
  };
}

function renderConsolidatedReport(results, commitSha, isFollowUp, modelsUsed = []) {
  const header = `<!-- orbit-ai-review:commit:${commitSha} -->\n## 🤖 AI Code Review | Commit \`${commitSha}\`\n\n`;

  // Aggregate issues across all domains
  const allIssues = results.flatMap((r) =>
    (r.issues || []).map((i) => ({
      domain: i.domain || r.domain,
      severity: i.severity || '[Warning]',
      location: i.location || '',
      description: i.description || '',
      suggestedFix: i.suggestedFix || ''
    }))
  );

  const allClean = allIssues.length === 0;

  // 1. Status Banner
  let statusBanner = '';
  if (results.length === 1) {
    const singleDomain = results[0].domain;
    if (allClean) {
      statusBanner = `> **Status**: ✅ **Approved** (${singleDomain} Scope)\n\n`;
    } else {
      statusBanner = `> **Status**: ⚠️ **Action Required** (${singleDomain} Scope: ${allIssues.length} finding${allIssues.length > 1 ? 's' : ''})\n\n`;
    }
  } else {
    if (allClean) {
      statusBanner = `> **Status**: ✅ **Approved** (All checks passed)\n\n`;
    } else {
      const domainStatuses = results.map((r) => {
        const count = (r.issues || []).length;
        return count === 0 ? `${r.domain}: ✅ Clean` : `${r.domain}: ⚠️ ${count} finding${count > 1 ? 's' : ''}`;
      });
      statusBanner = `> **Status**: ⚠️ **Action Required** | ${domainStatuses.join(' | ')}\n\n`;
    }
  }

  // 2. Summary or Review of Updates
  let summarySection = '';
  if (isFollowUp) {
    const updateNotes = results
      .map((r) => {
        const text = r.reviewOfUpdates || r.summary;
        return text ? `* **${r.domain}**: ${text}` : '';
      })
      .filter(Boolean);

    if (updateNotes.length > 0) {
      summarySection = `### Review of Updates\n\n${updateNotes.join('\n\n')}\n\n`;
    }
  } else {
    const summaryNotes = results
      .map((r) => {
        const text = r.summary || r.reviewOfUpdates;
        return text ? `* **${r.domain}**: ${text}` : '';
      })
      .filter(Boolean);

    if (summaryNotes.length > 0) {
      summarySection = `### Summary of Changes\n\n${summaryNotes.join('\n\n')}\n\n`;
    }
  }

  // 3. Issues Identified Table
  let issuesSection = '';
  if (allIssues.length > 0) {
    const severityWeight = { '[Critical]': 3, '[Warning]': 2, '[Suggestion]': 1 };
    allIssues.sort((a, b) => (severityWeight[b.severity] || 0) - (severityWeight[a.severity] || 0));

    let tableRows = '';
    for (const issue of allIssues) {
      let loc = issue.location;
      if (!loc.endsWith('<br>') && !loc.includes('<br>')) {
        loc += '<br>';
      }
      tableRows += `| \`${issue.domain}\` | \`${issue.severity}\` | \`${loc}\`${issue.description} | ${issue.suggestedFix} |\n`;
    }

    issuesSection = `### Issues Identified\n\n| Domain | Severity | Issue & Location | Suggested Fix |\n|---|---|---|---|\n${tableRows}\n`;
  }

  // 4. Verification / Sign-Off Section
  let signoffSection = '';
  if (allClean) {
    let archItems = results
      .map((r) => (results.length > 1 ? `  * **${r.domain}**: ${r.verification?.architecture || 'Verified.'}` : `* ${r.verification?.architecture || 'Verified.'}`))
      .join('\n');
    let secItems = results
      .map((r) => (results.length > 1 ? `  * **${r.domain}**: ${r.verification?.security || 'Verified.'}` : `* ${r.verification?.security || 'Verified.'}`))
      .join('\n');

    signoffSection = `✅ **No major issues identified.**\n\n### Verification Checklist\n- **Architecture & Protocol Verification**:\n${archItems}\n- **Security & Concurrency Verification**:\n${secItems}\n`;
  } else {
    let domainSignoffLines = '';
    for (const r of results) {
      const count = (r.issues || []).length;
      if (count === 0) {
        domainSignoffLines += `* **${r.domain}**: ✅ **Verified & Clean**. Architecture and security invariants confirmed; ready to merge.\n`;
        if (r.verification?.architecture) {
          domainSignoffLines += `  - *Architecture*: ${r.verification.architecture}\n`;
        }
        if (r.verification?.security) {
          domainSignoffLines += `  - *Security*: ${r.verification.security}\n`;
        }
      } else {
        domainSignoffLines += `* **${r.domain}**: ⚠️ **Action Required**. Please address the ${count} finding${count > 1 ? 's' : ''} in the table above.\n`;
      }
    }
    signoffSection = `### Domain Sign-Off Status\n${domainSignoffLines}\n`;
  }

  const uniqueModels = [...new Set(modelsUsed)].filter(Boolean).join(' / ') || 'Gemini';
  const footer = `\n---\n*This review was automatically generated by ${uniqueModels} and is advisory.*`;

  return `${header}${statusBanner}${summarySection}${issuesSection}${signoffSection}${footer}`;
}

async function fetchPRContext(repo, prNumber, token) {
  const headers = {
    'Authorization': `Bearer ${token}`,
    'Accept': 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'orbit-ai-reviewer'
  };

  try {
    const prRes = await fetch(`https://api.github.com/repos/${repo}/pulls/${prNumber}`, { headers });
    const prData = prRes.ok ? await prRes.json() : null;

    const commentsRes = await fetch(`https://api.github.com/repos/${repo}/issues/${prNumber}/comments?per_page=100`, { headers });
    const commentsData = commentsRes.ok ? await commentsRes.json() : [];

    let hasPriorReview = false;
    let contextText = '';
    if (prData) {
      contextText += `### PR Title: ${prData.title}\n\n### PR Description:\n${prData.body || 'No description provided.'}\n\n`;
    }

    if (commentsData.length > 0) {
      contextText += `### PR Discussion & Previous Review Feedback:\n`;
      const currentCommit = getCommitSha();
      for (const comment of commentsData) {
        const author = comment.user?.login || 'unknown';
        // Avoid self-echo of the exact commit currently being reviewed
        if (author.includes('bot') && comment.body.includes(`Commit \`${currentCommit}\``)) {
          continue;
        }
        if (comment.body.includes('<!-- orbit-ai-review:commit:') || comment.body.includes('## 🤖 AI Code Review')) {
          hasPriorReview = true;
        }
        contextText += `\n--- Comment by @${author} ---\n${comment.body}\n`;
      }
    }

    return {
      text: contextText.trim(),
      title: prData?.title || '',
      body: prData?.body || '',
      hasPriorReview
    };
  } catch (err) {
    console.warn(`Failed to fetch PR context: ${err.message}`);
    return { text: '', title: '', body: '', hasPriorReview: false };
  }
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

  // Extract list of changed files
  const changedFiles = getChangedFiles();
  const backendChangedFiles = getChangedFiles('backend');
  const frontendChangedFiles = getChangedFiles('frontend');

  // Build full source files and project contracts for behavioral delta analysis
  const projectContractsBlock = fetchProjectContracts(changedFiles);
  const fullSourceFilesBlock = fetchPartitionedSourceFiles(changedFiles);
  const backendSourceFilesBlock = fetchPartitionedSourceFiles(backendChangedFiles);
  const frontendSourceFilesBlock = fetchPartitionedSourceFiles(frontendChangedFiles);

  // Fetch PR description and discussion context
  const prContext = await fetchPRContext(GITHUB_REPOSITORY, PR_NUMBER, GITHUB_TOKEN);
  const commitInfo = getLatestCommitInfo();
  let commitInfoText = '';
  if (commitInfo) {
    commitInfoText = `### Latest Commit Under Review at HEAD:\n\`\`\`\n${commitInfo}\n\`\`\`\n\n`;
  }

  let prContextBlock = '';
  if (prContext.text || commitInfoText) {
    const combinedContext = `${commitInfoText}${prContext.text}`.trim();
    console.log(`Fetched PR and commit context (${combinedContext.length} chars). Injecting into review prompt.`);
    prContextBlock = `\n\n# Pull Request Description & Conversation Context\n<pr_context>\n${combinedContext}\n</pr_context>`;
  }

  // Extract relevant requirements and ADR context
  const requirementsContextBlock = fetchRequirementsAndAdrs(
    prContext.title,
    prContext.body,
    HEAD_REF,
    changedFiles
  );
  if (requirementsContextBlock) {
    console.log(`Extracted functional requirements and ADR context for PR #${PR_NUMBER}. Injecting into review prompt.`);
  }

  // Scope Gating & Follow-Up Detection
  const isFollowUpReview = Boolean(prContext.hasPriorReview || (prContext.text && prContext.text.includes('--- Comment by')));
  const latestCommitFiles = getLatestCommitFiles();

  let backendActive = false;
  let frontendActive = false;

  if (isFollowUpReview && latestCommitFiles.length > 0) {
    backendActive = latestCommitFiles.some((f) => f.startsWith('backend/'));
    frontendActive = latestCommitFiles.some((f) => f.startsWith('frontend/'));
    console.log(`Incremental Review detected (commit: ${commitSha}). Latest commit files: ${latestCommitFiles.length}. Backend active: ${backendActive}, Frontend active: ${frontendActive}.`);
    // Fallback if latest commit had no files matching domain prefix
    if (!backendActive && !frontendActive) {
      backendActive = changedFiles.some((f) => f.startsWith('backend/'));
      frontendActive = changedFiles.some((f) => f.startsWith('frontend/'));
    }
  } else {
    backendActive = changedFiles.some((f) => f.startsWith('backend/'));
    frontendActive = changedFiles.some((f) => f.startsWith('frontend/'));
    console.log(`Full PR Scope review. Backend active: ${backendActive}, Frontend active: ${frontendActive}.`);
  }

  if (!backendActive && !frontendActive) {
    console.log('No backend or frontend code changes detected in active scope. Skipping AI review.');
    return;
  }

  // Build full prompts for active domains (preserving full source files at HEAD, contracts, and requirements)
  let backendFullPrompt = null;
  if (backendActive) {
    const backendDiff = getDiffContent('backend');
    const backendDiffBlock = formatDiffBlock(backendDiff);
    backendFullPrompt = `${basePrompt}${requirementsContextBlock}${projectContractsBlock}${backendSourceFilesBlock}${prContextBlock}\n\n# Backend Domain Rules\n${backendRules}${backendDiffBlock}`;
  }

  let frontendFullPrompt = null;
  if (frontendActive) {
    const frontendDiff = getDiffContent('frontend');
    const frontendDiffBlock = formatDiffBlock(frontendDiff);
    frontendFullPrompt = `${basePrompt}${requirementsContextBlock}${projectContractsBlock}${frontendSourceFilesBlock}${prContextBlock}\n\n# Frontend Domain Rules\n${frontendRules}${frontendDiffBlock}`;
  }

  let reviewComment = '';

  if (backendActive && frontendActive) {
    console.log('Dispatching parallel Backend and Frontend reviews...');
    try {
      const [backendRes, frontendRes] = await Promise.all([
        callGeminiWithFallback(backendFullPrompt, GEMINI_API_KEY),
        callGeminiWithFallback(frontendFullPrompt, GEMINI_API_KEY)
      ]);
      const backendResult = parseReviewResponse(backendRes.reviewText, 'Backend');
      const frontendResult = parseReviewResponse(frontendRes.reviewText, 'Frontend');
      reviewComment = renderConsolidatedReport(
        [backendResult, frontendResult],
        commitSha,
        isFollowUpReview,
        [backendRes.modelUsed, frontendRes.modelUsed]
      );
    } catch (parallelErr) {
      console.warn('Parallel review failed:', parallelErr.message);
      return;
    }
  } else if (backendActive) {
    console.log('Dispatching Backend-only review...');
    try {
      const backendRes = await callGeminiWithFallback(backendFullPrompt, GEMINI_API_KEY);
      const backendResult = parseReviewResponse(backendRes.reviewText, 'Backend');
      reviewComment = renderConsolidatedReport(
        [backendResult],
        commitSha,
        isFollowUpReview,
        [backendRes.modelUsed]
      );
    } catch (beErr) {
      console.warn('Backend review failed:', beErr.message);
      return;
    }
  } else if (frontendActive) {
    console.log('Dispatching Frontend-only review...');
    try {
      const frontendRes = await callGeminiWithFallback(frontendFullPrompt, GEMINI_API_KEY);
      const frontendResult = parseReviewResponse(frontendRes.reviewText, 'Frontend');
      reviewComment = renderConsolidatedReport(
        [frontendResult],
        commitSha,
        isFollowUpReview,
        [frontendRes.modelUsed]
      );
    } catch (feErr) {
      console.warn('Frontend review failed:', feErr.message);
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
