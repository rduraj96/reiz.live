import { execFileSync } from "node:child_process";
import path from "node:path";

export default function globalSetup() {
  execFileSync(process.execPath, [path.resolve("tests/e2e/fixtures/make-tone.mjs")]);
}
