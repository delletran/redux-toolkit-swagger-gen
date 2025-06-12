import * as fs from "fs";
import * as path from "path";
import Mustache from "mustache";

const hooksTemplate = fs.readFileSync(
  path.resolve(__dirname, "../templates/hooksTemplate.mustache"),
  "utf-8"
);

const storeTemplate = fs.readFileSync(
  path.resolve(__dirname, "../templates/storeTemplate.mustache"),
  "utf-8"
);

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
  services: Record<string, any>
): void => {
  const reduxDir = path.resolve(outputDir, "redux");
  if (!fs.existsSync(reduxDir)) {
    fs.mkdirSync(reduxDir, { recursive: true });
  }

  // Process services to get a list of all generated services and thunks
  const serviceList: { name: string; path: string }[] = [];
  const thunkList: { thunkName: string; path: string }[] = [];

  Object.keys(services).forEach((routePath) => {
    const serviceName = routePath.replace(/\W/g, "_");
    serviceList.push({
      name: serviceName,
      path: routePath,
    });
    thunkList.push({
      thunkName: `${serviceName}Thunks`,
      path: routePath,
    });
  });

  const storeContent = Mustache.render(storeTemplate, {
    services: serviceList,
    thunks: thunkList,
  });

  fs.writeFileSync(path.join(reduxDir, "store.ts"), storeContent);
};
