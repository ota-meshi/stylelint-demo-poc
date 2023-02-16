import { WebContainer } from "@webcontainer/api";
import { NotificationPanel } from "../notification";
import { LintResult } from "stylelint";

import packageJsonContents from "./files-package.json?raw";
import serverJsContents from "./files-server.js?raw";

const SRC_ROOT = "src/";
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
    src: {
      directory: {},
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
      await Promise.all([
        webContainer.fs.writeFile(SRC_ROOT + "target.css", code),
        webContainer.fs.writeFile(SRC_ROOT + ".stylelintrc.json", config),
      ]);
      const result = await lint(webContainer, SRC_ROOT + "target.css");
      if (result.exit !== 0) {
        throw new Error("Linting failed");
      }
      return result.output;
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

async function lint(webContainer: WebContainer, target: string) {
  let id = seq++;
  await webContainer.fs.writeFile(
    INPUT_JSON_PATH,
    JSON.stringify({ id, file: target })
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

  return {
    exit: content.exit,
    output: content,
  };
}

function wait(time: number) {
  return new Promise((resolve) => setTimeout(resolve, time));
}
