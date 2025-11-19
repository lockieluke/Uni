import { $ } from "bun";
import * as path from "path";

if (process.env.EAS_BUILD)
	await $`bun build:all`.cwd(path.join(process.cwd(), "../.."));
