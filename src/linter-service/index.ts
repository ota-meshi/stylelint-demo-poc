import { FileSystemTree, WebContainer } from "@webcontainer/api";
import { NotificationPanel } from "../notification";
import { LintResult } from "stylelint";

import packageJsonContents from "./server/package.json?raw";
import serverJsContents from "./server/server.js?raw";

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
  notification.append("Starting WebContainer...\n");

  const webContainer = await WebContainer.boot();
  const serverFiles: FileSystemTree = {};
  for (const [file, contents] of Object.entries(
    import.meta.glob("./server/**/*.{js,json}", { as: "raw" })
  ).map(([file, load]) => {
    return [
      file.slice(9).replace(/^_/, "."),
      load() as Promise<string>,
    ] as const;
  })) {
    serverFiles[file] = {
      file: {
        contents: await contents,
      },
    };
  }
  console.log("Server files:", serverFiles);
  await webContainer.mount(serverFiles);

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
