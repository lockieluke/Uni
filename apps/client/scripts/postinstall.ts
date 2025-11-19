import * as path from "node:path";
import { $ } from "bun";

if (process.env.EAS_BUILD) await $`bun build:all`.cwd(path.join(process.cwd(), "../.."));
