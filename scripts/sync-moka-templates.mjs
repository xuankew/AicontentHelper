#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const sh = path.join(__dirname, "sync-moka-templates.sh");
execFileSync("/bin/bash", [sh], { stdio: "inherit" });
