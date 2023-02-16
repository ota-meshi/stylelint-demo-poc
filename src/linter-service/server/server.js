/**
 * The server will monitor the .input.json file for changes
 * and read the JSON and linting the target file if there are any changes.
 * The linting result is written to the .output.json file.
 *
 * FIXME:
 * Normally, it would make more sense to use stdout/stdin than via a file,
 * but I couldn't figure out how to do it well.
 */
import stylelint from "stylelint";
import chokidar from "chokidar";
import fs from "fs";
import path from "path";

const rootDir = path.resolve();
const SRC_DIR = path.join(rootDir, "src");
const OUTPUT_JSON_PATH = path.join(rootDir, ".output.json");
const INPUT_JSON_PATH = path.join(rootDir, ".input.json");
const META_JSON_PATH = path.join(rootDir, ".meta.json");

/**
 * @typedef {object} LintInput
 * @property {string} id
 * @property {string} code
 * @property {string} fileName
 * @property {string} config
 * @property {'json'} configFormat
 */

watch();

function watch() {
  console.log("Start watch file: ", INPUT_JSON_PATH);

  let processing, next;
  chokidar.watch(INPUT_JSON_PATH).on("change", async () => {
    const input = JSON.parse(fs.readFileSync(INPUT_JSON_PATH, "utf8"));
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
  fs.writeFileSync(META_JSON_PATH, JSON.stringify({ boot: true }));
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

    const output = {
      id: input.id,
      exit: 0,
      result: result.results[0],
      fixResult: fixResult.results[0],
      output: fixedFile,
    };
    // Write the linting result to the output file.
    fs.writeFileSync(OUTPUT_JSON_PATH, JSON.stringify(output));
  } catch (e) {
    console.error(e);
    const output = {
      id: input.id,
      exit: 1,
      result: e.message,
    };
    fs.writeFileSync(OUTPUT_JSON_PATH, JSON.stringify(output));
  }
}
