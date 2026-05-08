#!/usr/bin/env node

import { createInterface } from 'readline';
import { writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const rl = createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(prompt) {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
}

console.log('\n🔐 Jira Authentication Setup\n');
console.log('This will create a .env file with your Jira credentials.\n');
console.log('First, you need to create a Jira API token:');
console.log('1. Go to: https://id.atlassian.com/manage-profile/security/api-tokens');
console.log('2. Click "Create API token"');
console.log('3. Give it a name (e.g., "Sprint Tracker")');
console.log('4. Copy the token\n');

async function setup() {
  const email = await question('Enter your Tekion email: ');
  const token = await question('Enter your Jira API token: ');

  const envContent = `# Jira Authentication
JIRA_EMAIL=${email.trim()}
JIRA_API_TOKEN=${token.trim()}

# Jira Configuration
JIRA_BASE_URL=https://tekion.atlassian.net
JIRA_API_BASE=https://api.atlassian.com/ex/jira/92da72f4-8c05-4b25-a53d-cb44c0205f44/rest/api/3

# Server Configuration
PORT=3001
`;

  writeFileSync(join(__dirname, '.env'), envContent);
  
  console.log('\n✅ .env file created successfully!');
  console.log('\nNext steps:');
  console.log('1. Start the server: node server.js');
  console.log('2. Open the app in your browser');
  console.log('3. Try adding a Jira filter\n');
  
  rl.close();
}

setup().catch(error => {
  console.error('Error:', error);
  rl.close();
  process.exit(1);
});
