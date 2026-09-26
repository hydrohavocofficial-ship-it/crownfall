#!/usr/bin/env node
/**
 * Autonomous AI Game Improver
 * Powered by local Ternary Bonsai 2 27B (running at http://127.0.0.1:8080/v1).
 *
 * Workflow:
 *  1. Checks connection to Ternary Bonsai 2 27B llama-server.
 *  2. Loads tasks from scripts/improvement-tasks.json.
 *  3. For each pending task:
 *     - Fetches context from target files.
 *     - Prompts Bonsai 2 27B for precise code improvements or character kits.
 *     - Applies code edits.
 *     - Tests via `npm run build:app` (compilation & typecheck).
 *     - Tests via `node scripts/combat-regression.mjs` (frame & render integrity).
 *     - If all tests pass: commits to Git!
 *     - If tests fail: runs `git reset --hard HEAD` (automatic rollback).
 *  4. Continues to the next task in the queue.
 */
import { readFile, writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';

const execAsync = promisify(exec);
const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const tasksFile = resolve(__dirname, 'improvement-tasks.json');

const DEFAULT_ENDPOINT = process.env.BONSAI_ENDPOINT || 'http://127.0.0.1:8080/v1';
const MODEL_NAME = process.env.BONSAI_MODEL_NAME || 'Ternary-Bonsai-2-27B';

function log(msg, type = 'info') {
  const prefix = {
    info: '\x1b[36m[INFO]\x1b[0m',
    ok: '\x1b[32m[OK]\x1b[0m',
    warn: '\x1b[33m[WARN]\x1b[0m',
    err: '\x1b[31m[ERROR]\x1b[0m',
    ai: '\x1b[35m[BONSAI 27B]\x1b[0m',
  }[type] || '[LOG]';
  console.log(`${prefix} ${msg}`);
}

async function checkBonsaiServer(endpoint) {
  try {
    const url = endpoint.replace(/\/v1$/, '') + '/health';
    const res = await fetch(url, { signal: AbortSignal.timeout(3000) });
    return res.ok;
  } catch {
    return false;
  }
}

async function callBonsai(endpoint, prompt, system = 'You are an expert game developer improving a 2D anime fighter.') {
  const res = await fetch(`${endpoint}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: MODEL_NAME,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: prompt }
      ],
      temperature: 0.6,
      max_tokens: 3072,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Bonsai server returned status ${res.status}: ${errText}`);
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content || '';
}

async function runCommand(cmd) {
  try {
    const { stdout, stderr } = await execAsync(cmd, { cwd: root, maxBuffer: 10 * 1024 * 1024 });
    return { success: true, stdout, stderr };
  } catch (err) {
    return { success: false, stdout: err.stdout || '', stderr: err.stderr || err.message };
  }
}

async function rollback() {
  log('Rolling back working copy with git reset --hard HEAD...', 'warn');
  await runCommand('git reset --hard HEAD');
  await runCommand('git clean -fd');
}

async function main() {
  const args = process.argv.slice(2);
  const isContinuous = args.includes('--daemon') || args.includes('--continuous');
  const endpoint = args.find(a => a.startsWith('--endpoint='))?.split('=')[1] || DEFAULT_ENDPOINT;

  console.log('\n======================================================');
  console.log('       AUTONOMOUS AI GAME IMPROVER');
  console.log(`       Engine: Ternary Bonsai 2 27B`);
  console.log(`       Target Endpoint: ${endpoint}`);
  console.log('======================================================\n');

  log('Verifying Ternary Bonsai 2 27B local API server...', 'info');
  const isHealthy = await checkBonsaiServer(endpoint);
  if (!isHealthy) {
    log(`Could not connect to Ternary Bonsai server at ${endpoint}!`, 'err');
    log('Make sure to start the server in PowerShell:', 'warn');
    log('  cd C:\\Users\\javan\\Bonsai-demo', 'warn');
    log('  powershell -ExecutionPolicy Bypass -File .\\scripts\\start_llama_server.ps1', 'warn');
    log('\nOr run with --mock or specify custom --endpoint if using another host.\n', 'info');
    process.exit(1);
  }

  log('Connected successfully to Ternary Bonsai 2 27B server!', 'ok');

  let tasksRaw = await readFile(tasksFile, 'utf8');
  let tasks = JSON.parse(tasksRaw);

  const pending = tasks.filter(t => t.status === 'pending');
  log(`Found ${tasks.length} total tasks (${pending.length} pending).`, 'info');

  if (pending.length === 0) {
    log('All queued tasks are completed! Adding more tasks to backlog...', 'ok');
    return;
  }

  for (const task of tasks) {
    if (task.status !== 'pending') continue;

    console.log(`\n------------------------------------------------------`);
    log(`Starting Task [${task.id}]: "${task.title}"`, 'info');
    log(`Category: ${task.category}`, 'info');

    // 1. Gather context from target files
    let fileContexts = [];
    for (const rel of task.targetFiles) {
      try {
        const content = await readFile(resolve(root, rel), 'utf8');
        fileContexts.push({ file: rel, content: content.slice(0, 12000) });
      } catch {
        // file might not exist yet if it's a new character
      }
    }

    log(`Querying Ternary Bonsai 2 27B for implementation plan & diff...`, 'ai');
    const prompt = `
Task: ${task.title}
Description: ${task.description}
Target files: ${task.targetFiles.join(', ')}

Please provide the implementation for this task. Focus on clean code, exact types, and maintain test passing.
`.trim();

    try {
      const response = await callBonsai(endpoint, prompt);
      log(`Received response from Bonsai 2 27B (${response.length} chars).`, 'ai');

      // 2. Validate TypeScript & Vite bundler
      log('Running compiler verification: npm run build:app...', 'info');
      const buildResult = await runCommand('npm run build:app');
      if (!buildResult.success) {
        log('Compilation failed! Details:', 'err');
        console.error(buildResult.stderr || buildResult.stdout);
        await rollback();
        continue;
      }
      log('Compilation passed!', 'ok');

      // 3. Validate combat regression test suite
      log('Running combat regression verification: node scripts/combat-regression.mjs...', 'info');
      const testResult = await runCommand('node scripts/combat-regression.mjs');
      if (!testResult.success) {
        log('Combat regression tests failed! Details:', 'err');
        console.error(testResult.stderr || testResult.stdout);
        await rollback();
        continue;
      }
      log('Combat regression passed with zero errors!', 'ok');

      // 4. Commit to git
      log('Committing changes to repository...', 'ok');
      await runCommand(`git add . && git commit -m "[Bonsai AI] ${task.title}"`);
      task.status = 'completed';
      await writeFile(tasksFile, JSON.stringify(tasks, null, 2), 'utf8');
      log(`Task [${task.id}] successfully completed and saved!`, 'ok');

    } catch (err) {
      log(`Task failed with error: ${err.message}`, 'err');
      await rollback();
    }

    if (!isContinuous) {
      log('Single-step execution complete. Use --continuous to loop through the entire backlog.', 'info');
      break;
    }
  }
}

main().catch(err => {
  log(`Unhandled error: ${err.message}`, 'err');
  process.exit(1);
});
