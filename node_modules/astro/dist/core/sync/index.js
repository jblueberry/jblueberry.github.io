import fsMod from "node:fs";
import { performance } from "node:perf_hooks";
import { fileURLToPath } from "node:url";
import { dim } from "kleur/colors";
import { createServer } from "vite";
import { getPackage } from "../../cli/install-package.js";
import { createContentTypesGenerator } from "../../content/index.js";
import { globalContentConfigObserver } from "../../content/utils.js";
import { syncAstroEnv } from "../../env/sync.js";
import { telemetry } from "../../events/index.js";
import { eventCliSession } from "../../events/session.js";
import { runHookConfigSetup } from "../../integrations/hooks.js";
import { getTimeStat } from "../build/util.js";
import { resolveConfig } from "../config/config.js";
import { createNodeLogger } from "../config/logging.js";
import { createSettings } from "../config/settings.js";
import { createVite } from "../create-vite.js";
import { collectErrorMetadata } from "../errors/dev/utils.js";
import {
  AstroError,
  AstroErrorData,
  AstroUserError,
  createSafeError,
  isAstroError
} from "../errors/index.js";
import { formatErrorMessage } from "../messages.js";
import { ensureProcessNodeEnv } from "../util.js";
import { setUpEnvTs } from "./setup-env-ts.js";
async function sync({
  inlineConfig,
  fs,
  telemetry: _telemetry = false
}) {
  ensureProcessNodeEnv("production");
  const logger = createNodeLogger(inlineConfig);
  const { astroConfig, userConfig } = await resolveConfig(inlineConfig ?? {}, "sync");
  if (_telemetry) {
    telemetry.record(eventCliSession("sync", userConfig));
  }
  let settings = await createSettings(astroConfig, inlineConfig.root);
  settings = await runHookConfigSetup({
    command: "build",
    settings,
    logger
  });
  return await syncInternal({ settings, logger, fs });
}
async function syncInternal({
  logger,
  fs = fsMod,
  settings,
  skip
}) {
  const cwd = fileURLToPath(settings.config.root);
  const timerStart = performance.now();
  const dbPackage = await getPackage(
    "@astrojs/db",
    logger,
    {
      optional: true,
      cwd
    },
    []
  );
  try {
    await dbPackage?.typegen?.(settings.config);
    if (!skip?.content) {
      await syncContentCollections(settings, { fs, logger });
    }
    syncAstroEnv(settings, fs);
    await setUpEnvTs({ settings, logger, fs });
    logger.info("types", `Generated ${dim(getTimeStat(timerStart, performance.now()))}`);
  } catch (err) {
    const error = createSafeError(err);
    logger.error(
      "types",
      formatErrorMessage(collectErrorMetadata(error), logger.level() === "debug") + "\n"
    );
    throw error;
  }
}
async function syncContentCollections(settings, { logger, fs }) {
  const tempViteServer = await createServer(
    await createVite(
      {
        server: { middlewareMode: true, hmr: false, watch: null },
        optimizeDeps: { noDiscovery: true },
        ssr: { external: [] },
        logLevel: "silent"
      },
      { settings, logger, mode: "build", command: "build", fs, sync: true }
    )
  );
  const hotSend = tempViteServer.hot.send;
  tempViteServer.hot.send = (payload) => {
    if (payload.type === "error") {
      throw payload.err;
    }
    return hotSend(payload);
  };
  try {
    const contentTypesGenerator = await createContentTypesGenerator({
      contentConfigObserver: globalContentConfigObserver,
      logger,
      fs,
      settings,
      viteServer: tempViteServer
    });
    const typesResult = await contentTypesGenerator.init();
    const contentConfig = globalContentConfigObserver.get();
    if (contentConfig.status === "error") {
      throw contentConfig.error;
    }
    if (typesResult.typesGenerated === false) {
      switch (typesResult.reason) {
        case "no-content-dir":
        default:
          logger.debug("types", "No content directory found. Skipping type generation.");
      }
    }
  } catch (e) {
    const safeError = createSafeError(e);
    if (isAstroError(e)) {
      throw e;
    }
    const hint = AstroUserError.is(e) ? e.hint : AstroErrorData.GenerateContentTypesError.hint;
    throw new AstroError(
      {
        ...AstroErrorData.GenerateContentTypesError,
        hint,
        message: AstroErrorData.GenerateContentTypesError.message(safeError.message)
      },
      { cause: e }
    );
  } finally {
    await tempViteServer.close();
  }
}
export {
  sync as default,
  syncInternal
};
