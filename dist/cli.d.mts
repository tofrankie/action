//#region src/cli.d.ts
interface CliArgs {
  token?: string;
  tag?: string;
  ref?: string;
  publishNpm: boolean;
  yes: boolean;
}
declare function parseArgs(argv: string[]): CliArgs;
declare function resolveToken(argvToken?: string): string;
declare function parseRepoFromOrigin(origin: string): {
  owner: string;
  repo: string;
} | null;
//#endregion
export { CliArgs, parseArgs, parseRepoFromOrigin, resolveToken };