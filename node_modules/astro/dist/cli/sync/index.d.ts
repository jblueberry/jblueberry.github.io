import type yargs from 'yargs-parser';
interface SyncOptions {
    flags: yargs.Arguments;
}
export declare function sync({ flags }: SyncOptions): Promise<0 | 1>;
export {};
