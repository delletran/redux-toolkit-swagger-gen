import * as fs from "fs";
import * as path from "path";

/**
 * Safely loads a template file by trying different possible locations:
 * 1. Relative to the current file (../templates) - development
 * 2. From the dist/src/templates directory - npm package
 * 3. From process.cwd()/templates - fallback
 */
export function loadTemplate(templateName: string): string {
  const possiblePaths = [
    path.resolve(__dirname, "../templates", templateName),
    path.resolve(__dirname, "../../templates", templateName),
    path.resolve(__dirname, "../../../src/templates", templateName),
    path.resolve(__dirname, "../../src/templates", templateName),
    path.resolve(__dirname, "../../../dist/src/templates", templateName),
    path.resolve(process.cwd(), "src/templates", templateName),
    path.resolve(process.cwd(), "templates", templateName),
    path.resolve(process.cwd(), "node_modules/redux-toolkit-swagger-gen/dist/src/templates", templateName),
    path.resolve(process.cwd(), "node_modules/redux-toolkit-swagger-gen/src/templates", templateName),
  ];

  for (const templatePath of possiblePaths) {
    if (fs.existsSync(templatePath)) {
      if (process.env.DEBUG) {
        console.log(`Template ${templateName} loaded from: ${templatePath}`);
      }
      return fs.readFileSync(templatePath, "utf-8");
    }
  }

  // If no template found, log all paths we tried for debugging
  console.error(`Template not found: ${templateName}`);
  console.error(`Searched in the following locations:`);
  possiblePaths.forEach(p => console.error(` - ${p}`));
  
  throw new Error(`Template not found: ${templateName}`);
}
