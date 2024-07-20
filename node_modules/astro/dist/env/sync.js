import fsMod from "node:fs";
import { ENV_TYPES_FILE, TYPES_TEMPLATE_URL } from "./constants.js";
import { getEnvFieldType } from "./validators.js";
function syncAstroEnv(settings, fs = fsMod) {
  if (!settings.config.experimental.env) {
    return;
  }
  const schema = settings.config.experimental.env.schema ?? {};
  let client = "";
  let server = "";
  for (const [key, options] of Object.entries(schema)) {
    const str = `export const ${key}: ${getEnvFieldType(options)};	
`;
    if (options.context === "client") {
      client += str;
    } else {
      server += str;
    }
  }
  const template = fs.readFileSync(TYPES_TEMPLATE_URL, "utf-8");
  const dts = template.replace("// @@CLIENT@@", client).replace("// @@SERVER@@", server);
  fs.mkdirSync(settings.dotAstroDir, { recursive: true });
  fs.writeFileSync(new URL(ENV_TYPES_FILE, settings.dotAstroDir), dts, "utf-8");
}
export {
  syncAstroEnv
};
