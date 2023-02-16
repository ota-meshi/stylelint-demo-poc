import { WebContainer } from "@webcontainer/api";
import { NotificationPanel } from "../notification";
import { LintResult } from "stylelint";

import packageJsonContents from "./files-package.json?raw";
import serverJsContents from "./files-server.js?raw";

const OUTPUT_JSON_PATH = ".output.json";
const INPUT_JSON_PATH = ".input.json";
const META_JSON_PATH = ".meta.json";

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
    "server.js": {
      file: {
        contents: serverJsContents,
      },
    },
    "package.json": {
      file: {
        contents: packageJsonContents,
      },
    },
    [INPUT_JSON_PATH]: {
      file: {
        contents: "{}",
      },
    },
    [OUTPUT_JSON_PATH]: {
      file: {
        contents: "{}",
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

  await startServer(webContainer, notification);

  return {
    async lint(code, config) {
      const result = await lint(webContainer, code, config);
      if (result.exit !== 0) {
        throw new Error("Linting failed: " + result.result);
      }
      return result;
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

async function startServer(
  webContainer: WebContainer,
  notification: NotificationPanel
) {
  notification.append("\nStarting server...\n");
  await webContainer.spawn("npm", ["run", "start"]);
  await wait(100);
  while (!(await webContainer.fs.readdir("/")).includes(META_JSON_PATH)) {
    await wait(100);
  }
}

let seq = 0;

async function lint(webContainer: WebContainer, code: string, config: string) {
  let id = seq++;
  await webContainer.fs.writeFile(
    INPUT_JSON_PATH,
    JSON.stringify({
      id,
      code,
      fileName: "target.css",
      config,
      configFormat: "json",
    })
  );
  await wait(100);
  let content = JSON.parse(
    await webContainer.fs.readFile(OUTPUT_JSON_PATH, "utf8")
  );
  while (content.id !== id) {
    if (content.id > id) {
      throw new Error("Overtaken by the next linting");
    }
    await wait(100);
    content = JSON.parse(
      await webContainer.fs.readFile(OUTPUT_JSON_PATH, "utf8")
    );
  }

  return content;
}

function wait(time: number) {
  return new Promise((resolve) => setTimeout(resolve, time));
}
