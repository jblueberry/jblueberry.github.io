import fs from 'node:fs';
import type { Arguments as Flags } from 'yargs-parser';
import type { AstroConfig, AstroInlineConfig, AstroUserConfig, CLIFlags } from '../../@types/astro.js';
/** Convert the generic "yargs" flag object into our own, custom TypeScript object. */
export declare function resolveFlags(flags: Partial<Flags>): CLIFlags;
export declare function resolveRoot(cwd?: string | URL): string;
export declare const configPaths: readonly string[];
interface ResolveConfigPathOptions {
    root: string;
    configFile?: string;
    fs: typeof fs;
}
/**
 * Resolve the file URL of the user's `astro.config.js|cjs|mjs|ts` file
 */
export declare function resolveConfigPath(options: ResolveConfigPathOptions): Promise<string | undefined>;
interface ResolveConfigResult {
    userConfig: AstroUserConfig;
    astroConfig: AstroConfig;
}
/**
 * Resolves the Astro config with a given inline config.
 *
 * @param inlineConfig An inline config that takes highest priority when merging and resolving the final config.
 * @param command The running command that uses this config. Usually 'dev' or 'build'.
 */
export declare function resolveConfig(inlineConfig: AstroInlineConfig, command: string, fsMod?: typeof fs): Promise<ResolveConfigResult>;
export {};
