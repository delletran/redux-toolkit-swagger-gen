import * as fs from "fs";
import * as path from "path";
import Mustache from "mustache";
import { loadTemplate } from "../utils/template-loader";

const hooksTemplate = loadTemplate("hooksTemplate.mustache");
const storeTemplate = loadTemplate("storeTemplate.mustache");

export const generateReduxHooks = (outputDir: string): void => {
  const reduxDir = path.resolve(outputDir, "redux");
  if (!fs.existsSync(reduxDir)) {
    fs.mkdirSync(reduxDir, { recursive: true });
  }

  const hooksContent = Mustache.render(hooksTemplate, {});
  fs.writeFileSync(path.join(reduxDir, "hooks.ts"), hooksContent);
};

export const generateReduxStore = (
  outputDir: string,
  services: Record<string, any>,
  excludeOptions: string[] = [],
  apiBaseUrl?: string,
  reduxPath?: string,
  apiRelativePath?: string
): void => {
  // If apiRelativePath is provided, we're generating to a custom redux location
  // so don't append 'redux' subdirectory
  const reduxDir = apiRelativePath ? outputDir : path.resolve(outputDir, "redux");
  if (!fs.existsSync(reduxDir)) {
    fs.mkdirSync(reduxDir, { recursive: true });
  }

  // Process services to get a list of all generated services
  const serviceList: { name: string; path: string }[] = [];
  const thunkList: { thunkName: string; path: string; sanitizedPath: string }[] = [];

  Object.keys(services).forEach((routePath) => {
    const serviceName = routePath.replace(/\W/g, "_");
    serviceList.push({
      name: serviceName,
      path: routePath,
    });
    
    // Only add thunks if they're not excluded
    if (!excludeOptions.includes("thunks")) {
      thunkList.push({
        thunkName: `${serviceName}Thunks`,
        path: routePath,
        sanitizedPath: serviceName, // Add sanitized version for object property names
      });
    }
  });

  // Determine import prefix based on whether this is for the redux directory or API directory
  const importPrefix = apiRelativePath ? `${apiRelativePath}/` : '../';
  const authSliceImport = apiRelativePath ? './authSlice' : `../../../${reduxPath}/authSlice`;

  const storeContent = Mustache.render(storeTemplate, {
    services: serviceList,
    thunks: thunkList,
    apiBaseUrl: apiBaseUrl || '',
    reduxPath: reduxPath || 'src/store/redux',
    importPrefix: importPrefix || '../',
    authSliceImport: authSliceImport || `../../../${reduxPath || 'src/store/redux'}/authSlice`,
  });

  fs.writeFileSync(path.join(reduxDir, "store.ts"), storeContent);
};
