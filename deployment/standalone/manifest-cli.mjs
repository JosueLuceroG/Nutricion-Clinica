import { readFile, writeFile } from "node:fs/promises";
import {
  buildFullInstallManifest,
  manifestDigest,
  validateFullInstallManifest,
} from "./contract.mjs";

function option(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

const mode = process.argv[2];
const inputPath = option("--input");
const outputPath = option("--output");
const digestOutputPath = option("--digest-output");
const digestInputPath = option("--digest-input");
if (
  !mode ||
  !inputPath ||
  !outputPath ||
  !["build", "validate"].includes(mode)
) {
  console.error(
    "usage: manifest-cli.mjs <build|validate> --input <json> --output <json> [--digest-output <file>|--digest-input <file>]",
  );
  process.exitCode = 2;
} else if (mode === "build") {
  const input = JSON.parse(await readFile(inputPath, "utf8"));
  const manifest = buildFullInstallManifest(input);
  await writeFile(outputPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  const digest = manifestDigest(manifest);
  if (digestOutputPath)
    await writeFile(digestOutputPath, `${digest}\n`, "utf8");
  console.log(`manifest: PASS ${digest}`);
} else {
  const manifest = JSON.parse(await readFile(inputPath, "utf8"));
  const result = validateFullInstallManifest(manifest);
  if (!result.valid) {
    for (const error of result.errors) console.error(`manifest: ${error}`);
    process.exitCode = 1;
  } else if (digestInputPath) {
    const expected = (await readFile(digestInputPath, "utf8")).trim();
    const actual = manifestDigest(manifest);
    if (expected !== actual) {
      console.error(
        `manifest: digest mismatch expected=${expected} actual=${actual}`,
      );
      process.exitCode = 1;
    } else {
      console.log(`manifest: PASS ${actual}`);
    }
  } else {
    console.log(`manifest: PASS ${manifestDigest(manifest)}`);
  }
}
