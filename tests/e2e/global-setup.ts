import { execFileSync } from "node:child_process";

export default function globalSetup() {
  execFileSync(process.execPath, ["--import", "tsx", "tests/e2e/support/prepare-db.ts"], { stdio: "inherit", env: process.env });
}
