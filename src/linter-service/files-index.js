import stylelint from "stylelint";
import fs from "fs";

lint(process.argv[2]);

async function lint(file) {
  const result = await stylelint.lint({ files: [file] });
  const fixResult = await stylelint.lint({ files: [file], fix: true });

  const output = {
    result: result.results[0],
    fixResult: fixResult.results[0],
    output: fs.readFileSync(file, "utf8"),
  };
  fs.writeFileSync(".output.json", JSON.stringify(output, null, 2));
}
