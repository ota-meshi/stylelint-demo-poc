/**
 * The server waits for stdin, and when stdin is received,
 * it starts linting based on that information.
 * The linting result is written to stdout.
 *
 * Always pass data with a directive open prefix and a directive close suffix.
 */
import stylelint from "stylelint";
import fs from "fs";
import path from "path";
import { createJsonPayload, extractJson } from "./extract-json.js";

const rootDir = path.resolve();
const SRC_DIR = path.join(rootDir, "src");

/**
 * @typedef {import('../index').LintInput} LintInput
 * @typedef {import('../index').LinterServiceResult} LinterServiceResult
 */

main();

function main() {
  console.log("Start server");

  process.stdin.setEncoding("utf8");
  process.stdin.setRawMode(true);
  process.stdin.resume();

  process.stdin.on("data", (data) => {
    const input = extractJson(data.toString());
    if (!input) return;
    // Health check.
    if (input === "ok?") {
      process.stdout.write(createJsonPayload("ok"));
      return;
    }
    // Request linting.
    lint(input);
  });

  // Notify the start of boot.
  process.stdout.write(createJsonPayload("boot"));
}
/**
 * Linting with stylelint
 * @param {LintInput} input
 */
async function lint(input) {
  console.log("Linting file: ", input.fileName);
  try {
    const targetFile = path.join(SRC_DIR, input.fileName);
    if (!targetFile.startsWith(SRC_DIR)) {
      throw new Error("An out-of-scope path was specified.");
    }
    const configFile = path.join(
      SRC_DIR,
      input.configFormat === "json" ? ".stylelintrc.json" : ".stylelintrc.json"
    );

    fs.mkdirSync(path.dirname(targetFile), { recursive: true });
    fs.mkdirSync(path.dirname(configFile), { recursive: true });
    fs.writeFileSync(targetFile, input.code, "utf8");
    fs.writeFileSync(configFile, input.config, "utf8");

    const result = await stylelint.lint({ files: [targetFile] });
    const fixResult = await stylelint.lint({ files: [targetFile], fix: true });
    const fixedFile = fs.readFileSync(targetFile, "utf8");

    /** @type {LinterServiceResult} */
    const output = {
      version: input.version,
      exit: 0,
      result: result.results[0],
      fixResult: fixResult.results[0],
      output: fixedFile,
    };
    // Write the linting result to the stdout.
    process.stdout.write(createJsonPayload(output));
  } catch (e) {
    console.error(e);
    /** @type {LinterServiceResult} */
    const output = {
      version: input.version,
      exit: 1,
      result: /** @type {any} */ (e).message,
    };
    process.stdout.write(createJsonPayload(output));
  }
}
