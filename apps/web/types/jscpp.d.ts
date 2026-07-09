// JSCPP@2.0.9 ships no TypeScript types (checked: package.json has no "types"/
// "typings" field, and no @types/jscpp exists on npm). Minimal ambient surface
// for the pieces lib/jscpp-runner.ts actually calls — verified against the
// installed package's lib/launcher.js and lib/rt.js source, not just the README.
declare module "JSCPP" {
  interface JSCPPStdio {
    write?: (s: string) => void;
    drain?: () => string | null;
  }
  interface JSCPPConfig {
    stdio?: JSCPPStdio;
    maxTimeout?: number;
    unsigned_overflow?: "error" | "warn" | "ignore";
  }
  interface JSCPPModule {
    run(code: string, input: string, config?: JSCPPConfig): number;
  }
  const JSCPP: JSCPPModule;
  export default JSCPP;
}
