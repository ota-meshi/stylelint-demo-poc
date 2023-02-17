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

const rootDir = path.resolve();
const SRC_DIR = path.join(rootDir, "src");

const DIRECTIVE_OPEN = "{{{stylelint-json-start}}}";
const DIRECTIVE_CLOSE = "{{{stylelint-json-end}}}";

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

  let processing, next;
  process.stdin.on("data", (data) => {
    const str = data.toString();
    if (!str.startsWith(DIRECTIVE_OPEN) || !str.endsWith(DIRECTIVE_CLOSE))
      return;
    const input = JSON.parse(
      str.slice(DIRECTIVE_OPEN.length, -DIRECTIVE_CLOSE.length)
    );
    // Health check.
    if (input === "ok?") {
      process.stdout.write(
        DIRECTIVE_OPEN + JSON.stringify("ok") + DIRECTIVE_CLOSE
      );
      return;
    }
    // Request linting.
    if (!processing) {
      processing = lint(input).then(() => {
        // When finished, run the waiting lint.
        processing = next?.();
      });
    } else {
      // Waits for lint if previous lint is processing.
      next = () => lint(input);
    }
  });

  // Notify the start of boot.
  process.stdout.write(
    DIRECTIVE_OPEN + JSON.stringify("boot") + DIRECTIVE_CLOSE
  );
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
    process.stdout.write(
      DIRECTIVE_OPEN + JSON.stringify(output) + DIRECTIVE_CLOSE
    );
  } catch (e) {
    console.error(e);
    /** @type {LinterServiceResult} */
    const output = {
      version: input.version,
      exit: 1,
      result: e.message,
    };
    process.stdout.write(
      DIRECTIVE_OPEN + JSON.stringify(output) + DIRECTIVE_CLOSE
    );
  }
}
