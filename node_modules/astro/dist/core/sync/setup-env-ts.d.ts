import type fsMod from 'node:fs';
import type { AstroSettings } from '../../@types/astro.js';
import { type Logger } from '../logger/core.js';
export declare function setUpEnvTs({ settings, logger, fs, }: {
    settings: AstroSettings;
    logger: Logger;
    fs: typeof fsMod;
}): Promise<void>;
