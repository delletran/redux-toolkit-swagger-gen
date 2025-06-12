#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Build and create a test package
console.log('🔨 Building package...');
execSync('npm run build', { stdio: 'inherit' });

console.log('📦 Creating test package...');
execSync('npm pack', { stdio: 'inherit' });

// Find the created package
const files = fs.readdirSync('.');
const packageFile = files.find(file => file.startsWith('redux-toolkit-swagger-gen-') && file.endsWith('.tgz'));

if (!packageFile) {
  console.error('❌ Could not find packaged file');
  process.exit(1);
}

// Create a temporary directory to extract to
const tempDir = path.join(__dirname, '../temp-package-test');
if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir, { recursive: true });
}

// Extract and verify the package
console.log('🔍 Verifying package contents...');
execSync(`tar -xzf ${packageFile} -C ${tempDir}`, { stdio: 'inherit' });

// Check that templates directory exists
const templatesDir = path.join(tempDir, 'package/dist/src/templates');
if (fs.existsSync(templatesDir)) {
  const templateFiles = fs.readdirSync(templatesDir);
  console.log('✅ Templates directory exists');
  console.log('Template files found:');
  templateFiles.forEach(file => console.log(` - ${file}`));
} else {
  console.error('❌ Templates directory not found in packaged files');
  console.error('Missing directory:', templatesDir);
  process.exit(1);
}

// Clean up
console.log('🧹 Cleaning up...');
execSync(`rm -rf ${tempDir}`, { stdio: 'inherit' });

console.log('✅ Package verification completed successfully!');
