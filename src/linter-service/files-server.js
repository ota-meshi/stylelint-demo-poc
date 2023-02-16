/**
 * The server will monitor the .input.json file for changes
 * and read the JSON and linting the target file if there are any changes.
 * The linting result is written to the .output.json file.
 */
import stylelint from "stylelint";
import chokidar from "chokidar";
import fs from "fs";

const OUTPUT_JSON_PATH = ".output.json";
const INPUT_JSON_PATH = ".input.json";
const META_JSON_PATH = ".meta.json";

watch();

function watch() {
  console.log("Start watch file: ", INPUT_JSON_PATH);
  chokidar.watch(INPUT_JSON_PATH).on("change", async () => {
    const input = JSON.parse(fs.readFileSync(INPUT_JSON_PATH, "utf8"));
    lint(input);
  });
  fs.writeFileSync(META_JSON_PATH, JSON.stringify({ boot: true }));
}
async function lint(input) {
  console.log("Linting file: ", input.file);
  try {
    const result = await stylelint.lint({ files: [input.file] });
    const fixResult = await stylelint.lint({ files: [input.file], fix: true });

    const output = {
      id: input.id,
      exit: 0,
      result: result.results[0],
      fixResult: fixResult.results[0],
      output: fs.readFileSync(input.file, "utf8"),
    };
    fs.writeFileSync(OUTPUT_JSON_PATH, JSON.stringify(output));
  } catch (e) {
    const output = {
      id: input.id,
      exit: 1,
      result: e.message,
    };
    fs.writeFileSync(OUTPUT_JSON_PATH, JSON.stringify(output));
  }
}
