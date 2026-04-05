#!/usr/bin/env node
import { execSync } from "node:child_process";

execSync("openapi-typescript http://localhost:8000/openapi.json -o src/types/openapi.generated.d.ts", {
  cwd: new URL("..", import.meta.url),
  stdio: "inherit",
});
