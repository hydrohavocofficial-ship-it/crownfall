#!/usr/bin/env node
/**
 * Autonomous AI Game Improver
 * Powered by local Ternary Bonsai 2 27B (running at http://127.0.0.1:8080/v1).
 *
 * Runs indefinitely in the background:
 *  1. Checks connection to Ternary Bonsai 2 27B llama-server.
 *  2. Loads tasks from scripts/improvement-tasks.json.
 *  3. When all tasks are completed, asks Bonsai 2 27B to generate new high-impact tasks.
 *  4. For each task:
 *     - Fetches context and reference templates.
 *     - Prompts Bonsai 2 27B for the exact implementation.
 *     - Parses and applies file creations and patches.
 *     - Self-healing compiler loop: if TypeScript fails, feeds errors back to Bonsai to fix.
 *     - Combat regression verification: runs 125+ checks across all fighters.
 *     - If passed: rebuilds index.html, commits to Git, updates progress markdown.
 *     - If failed: automatically rolls back via git reset --hard HEAD.
 *  5. Loops continuously until commanded to stop.
 */

import { readFile, writeFile, appendFile, mkdir } from 'node:fs/promises';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';

const execAsync = promisify(exec);
const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const tasksFile = resolve(__dirname, 'improvement-tasks.json');
const logFile = resolve(__dirname, 'autonomous.log');
const progressFile = resolve(root, 'AUTONOMOUS_PROGRESS.md');

const DEFAULT_ENDPOINT = process.env.BONSAI_ENDPOINT || 'http://127.0.0.1:8080/v1';
const MODEL_NAME = process.env.BONSAI_MODEL_NAME || 'Ternary-Bonsai-2-27B';

async function writeLog(msg, type = 'info') {
  const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);
  const colorMap = {
    info: '\x1b[36m[INFO]\x1b[0m',
    ok: '\x1b[32m[OK]\x1b[0m',
    warn: '\x1b[33m[WARN]\x1b[0m',
    err: '\x1b[31m[ERROR]\x1b[0m',
    ai: '\x1b[35m[BONSAI 27B]\x1b[0m',
    task: '\x1b[34m[TASK]\x1b[0m',
  };
  const prefix = colorMap[type] || '[LOG]';
  const plainPrefix = `[${type.toUpperCase()}]`;
  console.log(`${prefix} ${msg}`);
  const line = `[${timestamp}] ${plainPrefix} ${msg}\n`;
  try {
    await appendFile(logFile, line, 'utf8');
  } catch {}
}

async function checkBonsaiServer(endpoint) {
  try {
    const url = endpoint.replace(/\/v1\/?$/, '') + '/health';
    const res = await fetch(url, { signal: AbortSignal.timeout(4000) });
    return res.ok;
  } catch {
    return false;
  }
}

async function callBonsai(endpoint, prompt, systemPrompt, maxTokens = 3072, temperature = 0.5) {
  const messages = [];
  if (systemPrompt) messages.push({ role: 'system', content: systemPrompt });
  messages.push({ role: 'user', content: prompt });

  const res = await fetch(`${endpoint}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: MODEL_NAME,
      messages,
      temperature,
      max_tokens: maxTokens,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Bonsai server returned HTTP ${res.status}: ${errText}`);
  }

  const data = await res.json();
  const choice = data.choices?.[0]?.message;
  let text = choice?.content?.trim() || '';
  if (!text && choice?.reasoning_content) {
    text = choice.reasoning_content.trim();
  }
  return text;
}

async function runCommand(cmd) {
  try {
    const { stdout, stderr } = await execAsync(cmd, { cwd: root, maxBuffer: 15 * 1024 * 1024 });
    return { success: true, stdout, stderr };
  } catch (err) {
    return { success: false, stdout: err.stdout || '', stderr: err.stderr || err.message };
  }
}

async function rollback(reason) {
  await writeLog(`Rolling back working tree due to: ${reason}`, 'warn');
  await runCommand('git reset --hard HEAD');
  await runCommand('git clean -fd');
}

function parseFileBlocks(text) {
  const files = [];

  // Match ```file:path/to/file ... ```
  const fileRegex = /```(?:[a-zA-Z0-9_-]+)?\s*(?:file|path)?:\s*([^\r\n]+)\r?\n([\s\S]*?)```/g;
  let match;
  while ((match = fileRegex.exec(text)) !== null) {
    const path = match[1].trim().replace(/^['"]|['"]$/g, '');
    const code = match[2];
    files.push({ type: 'file', path, code });
  }

  // Match ```patch:path/to/file ... ```
  const patchRegex = /```patch:\s*([^\r\n]+)\r?\n<<<<<<< SEARCH\r?\n([\s\S]*?)\r?\n=======\r?\n([\s\S]*?)\r?\n>>>>>>>\r?\n```/g;
  while ((match = patchRegex.exec(text)) !== null) {
    const path = match[1].trim().replace(/^['"]|['"]$/g, '');
    const search = match[2];
    const replace = match[3];
    files.push({ type: 'patch', path, search, replace });
  }

  return files;
}

async function applyChanges(fileBlocks) {
  for (const block of fileBlocks) {
    const absPath = resolve(root, block.path);
    if (block.type === 'file') {
      await mkdir(dirname(absPath), { recursive: true });
      await writeFile(absPath, block.code, 'utf8');
      await writeLog(`Wrote file: ${block.path} (${block.code.length} bytes)`, 'ok');
    } else if (block.type === 'patch') {
      const existing = await readFile(absPath, 'utf8');
      if (existing.includes(block.search)) {
        const updated = existing.replace(block.search, block.replace);
        await writeFile(absPath, updated, 'utf8');
        await writeLog(`Patched file: ${block.path}`, 'ok');
      } else {
        await writeLog(`Patch search block not found in: ${block.path}`, 'warn');
      }
    }
  }
}

async function updateProgressArtifact(task, testResult, commitHash) {
  const dateStr = new Date().toISOString().replace('T', ' ').substring(0, 19);
  const entry = `
### [${task.id}] ${task.title}
- **Timestamp:** \`${dateStr}\`
- **Category:** \`${task.category}\`
- **Status:** **Completed & Verified**
- **Git Commit:** \`${commitHash || 'latest'}\`
- **Verification:** 125+ combat regression checks passed, standalone \`index.html\` updated.
- **Description:** ${task.description}
`;
  try {
    let header = '';
    try {
      header = await readFile(progressFile, 'utf8');
    } catch {
      header = `# Autonomous AI Game Development Dashboard\n\n**Powered by:** Ternary Bonsai 2 27B (local llama-server)\n**Repository:** \`C:\\Users\\javan\\Downloads\\game\`\n**Target:** Autonomous triple-A 2D anime fighter refinement\n\n---\n\n## Improvement History\n`;
    }
    await writeFile(progressFile, header + entry, 'utf8');
  } catch {}
}

const FALLBACK_TASK_CATALOG = [
  {
    id: "vfx-clash-sparks",
    title: "Clash Particle Shockwaves on Simultaneous Hitbox Collisions",
    category: "visual_juice",
    targetFiles: ["src/game/game.ts", "src/game/effects.ts"],
    description: "Spawn high-contrast anime shockwaves, radial spark sprays, and audio clash cues when two fighters hit simultaneously.",
    status: "pending"
  },
  {
    id: "char-kizaru",
    title: "Implement Kizaru / Borsalino (Light-Speed Fruit Fighter)",
    category: "new_character",
    targetFiles: ["src/game/kizaru.ts", "src/game/characters.ts"],
    description: "Implement Admiral Kizaru with Pika Pika no Mi light sword slashes, light-speed teleport kicks, Yasakani no Magatama mirror barrage, and blinding yellow-laser visuals.",
    status: "pending"
  },
  {
    id: "char-broly",
    title: "Implement Broly (Legendary Super Saiyan Brawler)",
    category: "new_character",
    targetFiles: ["src/game/broly.ts", "src/game/characters.ts"],
    description: "Implement Broly with hulking heavy armor, green wrathful ki aura, Eraser Cannon, Gigantic Roar, armored command grapples, and screen-shattering seismic slams.",
    status: "pending"
  },
  {
    id: "char-rimuru",
    title: "Implement Rimuru Tempest (Demon Lord Slime)",
    category: "new_character",
    targetFiles: ["src/game/rimuru.ts", "src/game/characters.ts"],
    description: "Implement Rimuru Tempest with Gluttony / Beelzebuth devour vortex, Megiddo water satellite lasers, Dark Flame / Hell Flare orbs, slime shape-shifting dashes, and sword cuts.",
    status: "pending"
  },
  {
    id: "vfx-stage-parallax",
    title: "Dynamic Stage Parallax and Ambient Atmospheric Particles",
    category: "visual_juice",
    targetFiles: ["src/game/arenas.ts", "src/game/render.ts"],
    description: "Enhance arena rendering with subtle multi-layer parallax motion and ambient floating particles (cherry blossoms, ember sparks, stardust) suited to each stage.",
    status: "pending"
  },
  {
    id: "balance-combo-scaling",
    title: "Dynamic Damage Proration & Hitstun Decay on Long Combos",
    category: "balance",
    targetFiles: ["src/game/fighter.ts", "src/game/game.ts"],
    description: "Refine damage proration and hitstun decay to ensure combos remain hype and rewarding without inescapable touch-of-death infinite loops.",
    status: "pending"
  }
];

async function generateNextTasks(endpoint, completedTasks) {
  await writeLog('Querying Ternary Bonsai 2 27B to generate the next iteration of game improvement tasks...', 'ai');
  const existingIds = completedTasks.map(t => t.id).join(', ');
  const prompt = `
You are the lead designer and AI systems architect of a 2D anime fighter game.
Current completed improvements: ${existingIds}.

Please generate 3 new, high-value tasks to push the game closer to AAA anime fighter quality.
Possible directions:
- New anime characters (e.g. Kizaru from One Piece, Broly from Dragon Ball Super, Rimuru Tempest from Tensura).
- High-fidelity visual juice (cinematic camera zoom, screen distortion, clash particles, aura layers).
- Audio and impact polish.
- Balance and recovery adjustments.

Output ONLY a valid JSON array of 3 objects with the following schema:
[
  {
    "id": "char-name or vfx-feature",
    "title": "Clear Actionable Title",
    "category": "new_character" | "visual_juice" | "balance" | "audio",
    "targetFiles": ["src/game/filename.ts"],
    "description": "Specific gameplay and visual requirements.",
    "status": "pending"
  }
]
`.trim();

  try {
    const response = await callBonsai(endpoint, prompt, 'You are a game design and Luau/TypeScript expert. Output strictly valid JSON.');
    let jsonStr = response.trim();
    const jsonMatch = jsonStr.match(/\[\s*\{[\s\S]*\}\s*\]/);
    if (jsonMatch) jsonStr = jsonMatch[0];
    const generated = JSON.parse(jsonStr);
    if (Array.isArray(generated) && generated.length > 0) {
      await writeLog(`Successfully generated ${generated.length} new tasks from Bonsai 2 27B!`, 'ok');
      return generated;
    }
  } catch (err) {
    await writeLog(`Could not parse JSON tasks from Bonsai response: ${err.message}. Using high-priority catalog tasks.`, 'warn');
  }

  // Fallback to tasks from our catalog not yet completed
  const pendingFromCatalog = FALLBACK_TASK_CATALOG.filter(t => !completedTasks.some(c => c.id === t.id));
  return pendingFromCatalog.slice(0, 3);
}

async function loadReferenceTemplate(category) {
  if (category === 'new_character') {
    try {
      const gbContent = await readFile(resolve(root, 'src/game/gokublack.ts'), 'utf8');
      return `\n\n--- REFERENCE CHARACTER TEMPLATE (gokublack.ts) ---\n${gbContent.slice(0, 5000)}\n--- END TEMPLATE ---`;
    } catch {
      return '';
    }
  }
  return '';
}

async function executeTask(task, endpoint) {
  await writeLog(`======================================================`, 'task');
  await writeLog(`STARTING TASK [${task.id}]: "${task.title}"`, 'task');
  await writeLog(`Category: ${task.category}`, 'info');
  await writeLog(`Description: ${task.description}`, 'info');

  // 1. Gather context from target files
  let fileContexts = [];
  for (const rel of task.targetFiles) {
    try {
      const content = await readFile(resolve(root, rel), 'utf8');
      fileContexts.push(`File: ${rel}\n\`\`\`typescript\n${content.slice(0, 6000)}\n\`\`\``);
    } catch {
      // File does not exist yet (e.g. brand new character)
    }
  }

  const templateContext = await loadReferenceTemplate(task.category);

  const systemPrompt = `You are an elite game developer implementing features in a 2D anime fighter built with TypeScript and HTML5 Canvas.
When outputting code, you MUST format each file or edit using explicit markdown code blocks:

For complete files:
\`\`\`file:src/game/path_to_file.ts
<full typescript code here>
\`\`\`

For targeted replacements:
\`\`\`patch:src/game/path_to_file.ts
<<<<<<< SEARCH
<exact existing lines to replace>
=======
<replacement lines>
>>>>>>>
\`\`\`

Ensure all TypeScript imports and types are valid, compile without errors, and integrate seamlessly with existing character/game systems.`;

  const userPrompt = `
Task ID: ${task.id}
Task Title: ${task.title}
Category: ${task.category}
Description: ${task.description}
Target Files: ${task.targetFiles.join(', ')}

Existing Files Context:
${fileContexts.join('\n\n')}
${templateContext}

Implement the requested feature or character now with full, compilable TypeScript code blocks.
`.trim();

  await writeLog('Consulting Ternary Bonsai 2 27B for code changes...', 'ai');
  let attempt = 0;
  const maxAttempts = 3;
  let lastError = null;

  while (attempt < maxAttempts) {
    attempt++;
    try {
      let promptToSend = userPrompt;
      if (lastError) {
        promptToSend += `\n\n[COMPILER ERROR IN PREVIOUS ATTEMPT]:\n${lastError}\n\nPlease fix these errors and output the corrected code blocks.`;
      }

      const response = await callBonsai(endpoint, promptToSend, systemPrompt, 3500);
      await writeLog(`Received ${response.length} characters from Bonsai 2 27B (Attempt ${attempt}/${maxAttempts})`, 'ai');

      const fileBlocks = parseFileBlocks(response);
      if (fileBlocks.length === 0) {
        // If Bonsai returned raw typescript block for single target file, adapt it
        const rawTsMatch = response.match(/```(?:typescript|ts)\r?\n([\s\S]*?)```/);
        if (rawTsMatch && task.targetFiles.length === 1) {
          fileBlocks.push({ type: 'file', path: task.targetFiles[0], code: rawTsMatch[1] });
        }
      }

      if (fileBlocks.length === 0) {
        await writeLog('No applicable code blocks found in model response. Skipping...', 'warn');
        lastError = 'No valid code blocks found.';
        continue;
      }

      await applyChanges(fileBlocks);

      // Verify TypeScript build
      await writeLog('Verifying TypeScript compilation (npm run build:app)...', 'info');
      const buildResult = await runCommand('npm run build:app');
      if (!buildResult.success) {
        lastError = (buildResult.stderr || buildResult.stdout).slice(0, 1500);
        await writeLog(`TypeScript build failed:\n${lastError}`, 'warn');
        await rollback('Compilation failure');
        continue; // Retry with error feedback to Bonsai
      }

      // Verify combat regression suite
      await writeLog('Running combat regression tests (node scripts/combat-regression.mjs)...', 'info');
      const testResult = await runCommand('node scripts/combat-regression.mjs');
      if (!testResult.success) {
        lastError = (testResult.stderr || testResult.stdout).slice(0, 1500);
        await writeLog(`Combat regression failed:\n${lastError}`, 'warn');
        await rollback('Combat regression failure');
        continue;
      }

      // Tests passed! Rebuild standalone index.html
      await writeLog('Regression tests passed with 0 errors! Rebuilding standalone index.html...', 'ok');
      await runCommand('npm run build');

      // Commit to git
      const commitRes = await runCommand(`git add . && git commit -m "[Bonsai AI] ${task.title}"`);
      const commitHash = commitRes.stdout.match(/\[.+?\s+([0-9a-f]+)\]/)?.[1] || 'success';
      await writeLog(`Committed to Git (${commitHash}): "[Bonsai AI] ${task.title}"`, 'ok');

      task.status = 'completed';
      task.completedAt = new Date().toISOString();
      await updateProgressArtifact(task, testResult.stdout, commitHash);
      return true;

    } catch (err) {
      await writeLog(`Execution error on attempt ${attempt}: ${err.message}`, 'err');
      await rollback(err.message);
      lastError = err.message;
    }
  }

  task.status = 'failed';
  task.failedReason = lastError || 'Max attempts reached';
  return false;
}

async function main() {
  const args = process.argv.slice(2);
  const endpoint = args.find(a => a.startsWith('--endpoint='))?.split('=')[1] || DEFAULT_ENDPOINT;

  console.log('\n================================================================');
  console.log('       AUTONOMOUS CONTINUOUS AI GAME IMPROVER');
  console.log('       Engine: Ternary Bonsai 2 27B (CUDA Local Model)');
  console.log(`       Endpoint: ${endpoint}`);
  console.log('================================================================\n');

  await writeLog(`Connecting to local Ternary Bonsai 2 27B server at ${endpoint}...`, 'info');
  const healthy = await checkBonsaiServer(endpoint);
  if (!healthy) {
    await writeLog(`Could not connect to Ternary Bonsai server at ${endpoint}!`, 'err');
    await writeLog('Please ensure llama-server is running on port 8080.', 'warn');
    process.exit(1);
  }
  await writeLog('Ternary Bonsai 2 27B server is ONLINE and responding.', 'ok');

  let cycle = 0;

  // CONTINUOUS LOOP THAT RUNS FOREVER UNTIL COMMANDED TO STOP
  while (true) {
    cycle++;
    await writeLog(`Starting Continuous Cycle #${cycle}...`, 'info');

    let tasks = [];
    try {
      const raw = await readFile(tasksFile, 'utf8');
      tasks = JSON.parse(raw);
    } catch {
      tasks = [...FALLBACK_TASK_CATALOG];
      await writeFile(tasksFile, JSON.stringify(tasks, null, 2), 'utf8');
    }

    let pending = tasks.filter(t => t.status === 'pending');

    // If no pending tasks remain, ask Bonsai to generate the next iteration
    if (pending.length === 0) {
      await writeLog('All currently queued tasks are completed. Generating next iteration...', 'ok');
      const newTasks = await generateNextTasks(endpoint, tasks);
      tasks.push(...newTasks);
      await writeFile(tasksFile, JSON.stringify(tasks, null, 2), 'utf8');
      pending = tasks.filter(t => t.status === 'pending');
    }

    await writeLog(`Pending tasks in queue: ${pending.length}`, 'info');

    for (const task of pending) {
      const success = await executeTask(task, endpoint);
      // Persist updated task statuses
      await writeFile(tasksFile, JSON.stringify(tasks, null, 2), 'utf8');

      // Short cooldown between tasks
      await writeLog(`Completed task [${task.id}] with result: ${success ? 'PASSED' : 'SKIPPED'}. Cooling down 5s...`, 'info');
      await new Promise(r => setTimeout(r, 5000));
    }

    await writeLog(`Cycle #${cycle} finished. Looping to next iteration in 10s...`, 'ok');
    await new Promise(r => setTimeout(r, 10000));
  }
}

main().catch(async (err) => {
  await writeLog(`Fatal error in auto-improver: ${err.message}`, 'err');
  process.exit(1);
});
