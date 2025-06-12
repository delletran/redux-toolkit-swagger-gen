const fs = require('fs');
const path = require('path');

// Create dist/src/templates directory if it doesn't exist
const templatesDir = path.join(__dirname, '../dist/src/templates');
if (!fs.existsSync(templatesDir)) {
  console.log('Creating directory:', templatesDir);
  fs.mkdirSync(templatesDir, { recursive: true });
}

// Copy all template files
function copyTemplates() {
  const sourceDir = path.join(__dirname, '../src/templates');
  const targetDir = templatesDir;
  
  if (!fs.existsSync(sourceDir)) {
    console.error('❌ Source templates directory not found:', sourceDir);
    return;
  }
  
  // Read the source directory
  console.log('Source templates directory:', sourceDir);
  const files = fs.readdirSync(sourceDir);
  console.log('Found template files:', files);
  
  // Copy each file
  for (const file of files) {
    const sourcePath = path.join(sourceDir, file);
    const targetPath = path.join(targetDir, file);
    
    if (fs.statSync(sourcePath).isFile()) {
      try {
        fs.copyFileSync(sourcePath, targetPath);
        console.log(`✓ Copied: ${file} to ${targetPath}`);
      } catch (error) {
        console.error(`❌ Error copying ${file}:`, error);
      }
    }
  }
  
  // Verify files were copied
  if (fs.existsSync(targetDir)) {
    const copiedFiles = fs.readdirSync(targetDir);
    console.log('Templates copied to:', targetDir);
    console.log('Templates in target directory:', copiedFiles);
  } else {
    console.error('❌ Target directory not found after copy operation');
  }
}

copyTemplates();
