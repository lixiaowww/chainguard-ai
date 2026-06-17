const { createCredentials, checkCredentials } = require('zapier-platform-cli/src/utils/api');
const { writeFile } = require('zapier-platform-cli/src/utils/files');
const constants = require('zapier-platform-cli/src/constants');
const { prettyJSONstringify } = require('zapier-platform-cli/src/utils/display');
const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const root = path.resolve(__dirname, '..');

function loadEnv() {
  const envPath = path.join(root, '.env');
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx === -1) continue;
    const key = trimmed.slice(0, idx);
    let val = trimmed.slice(idx + 1);
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    process.env[key] = val;
  }
}

async function main() {
  loadEnv();
  const email = process.env.ZAPIER_EMAIL;
  const password = process.env.ZAPIER_PASSWORD;

  if (!email || !password) {
    console.error('Set ZAPIER_EMAIL and ZAPIER_PASSWORD');
    process.exit(1);
  }

  const creds = await createCredentials(email, password);
  await writeFile(
    constants.AUTH_LOCATION,
    prettyJSONstringify({ [constants.AUTH_KEY]: creds.key }),
  );
  await checkCredentials();
  console.log('Zapier login OK');

  const run = (cmd) => execSync(cmd, { cwd: root, stdio: 'inherit' });

  try {
    run(
      'npx zapier register "ChainGuard AI" -y -a private -c internet-of-things ' +
        '-r employee ' +
        '-u "https://lixiaowww-chainguard-ai.hf.space" ' +
        '-D "Auto-audit reefer cargo claims from IoT data—liability, loss estimate, and claim evidence in 60 seconds."',
    );
  } catch {
    console.log('Register skipped (app may already exist)');
  }

  run('npx zapier push');
  console.log('Zapier push complete');
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
