import { WebContainer } from "@webcontainer/api";
import { NotificationPanel } from "../notification";
import { LintResult } from "stylelint";

import packageJsonContents from "./files-package.json?raw";
import indexJsContents from "./files-index.js?raw";

export type LinterServiceResult = {
  result: LintResult;
  fixResult: LintResult;
  output: string;
};
export interface Linter {
  lint: (code: string, config: string) => Promise<LinterServiceResult>;
}

export async function setupLinter(
  notification: NotificationPanel
): Promise<Linter> {
  const webContainer = await WebContainer.boot();
  await webContainer.mount({
    "index.js": {
      file: {
        contents: indexJsContents,
      },
    },
    "package.json": {
      file: {
        contents: packageJsonContents,
      },
    },
  });
  notification.append("Installing dependencies...\n");
  const exitCode = await installDependencies(webContainer, (data) => {
    notification.append(data);
  });
  if (exitCode !== 0) {
    notification.append("\nInstallation failed");
    throw new Error("Installation failed");
  }

  return {
    async lint(code, config) {
      await webContainer.fs.writeFile("target.css", code);
      await webContainer.fs.writeFile(".stylelintrc.json", config);

      const result = await lint(webContainer, "target.css");
      return JSON.parse(result.output);
    },
  };
}

async function installDependencies(
  webContainer: WebContainer,
  outputPipe: (data: string) => void
) {
  const installProcess = await webContainer.spawn("npm", ["install"]);
  void installProcess.output.pipeTo(
    new WritableStream({
      write(data) {
        outputPipe(data);
      },
    })
  );
  return installProcess.exit;
}

async function lint(webContainer: WebContainer, target: string) {
  const lintProcess = await webContainer.spawn("npm", [
    "run",
    "lint-exec",
    "--",
    target,
  ]);
  const exit = await lintProcess.exit;

  return {
    exit,
    output: await webContainer.fs.readFile(".output.json", "utf8"),
  };
}
