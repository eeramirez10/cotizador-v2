import { spawnSync } from "node:child_process";

const project = process.env.FIREBASE_STAGING_PROJECT_ID?.trim();
if (!project || !project.toLowerCase().includes("staging") || project === "cotizador-tuvansa") {
  throw new Error("FIREBASE_STAGING_PROJECT_ID must be the explicit staging project ID; production and aliases are refused.");
}
for (const [command, args] of [
  ["npm", ["run", "build:staging"]],
  ["firebase", ["deploy", "--only", "hosting", "--project", project]],
]) {
  const result = spawnSync(command, args, { stdio: "inherit" });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status || 1);
}
