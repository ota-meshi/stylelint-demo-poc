import {
  FileSystemTree,
  WebContainer,
  WebContainerProcess,
} from "@webcontainer/api";
import { NotificationPanel } from "../notification";
import type { LintResult } from "stylelint";

const DIRECTIVE_OPEN = "{{{stylelint-json-start}}}";
const DIRECTIVE_CLOSE = "{{{stylelint-json-end}}}";

export type LinterServiceResult =
  | LinterServiceResultSuccess
  | LinterServiceResultError;
export type LinterServiceResultSuccess = {
  version: number;
  exit: 0;
  result: LintResult;
  fixResult: LintResult;
  output: string;
};
export type LinterServiceResultError = {
  version: number;
  exit: 1;
  result: string;
};
export type LintInput = {
  version: number;
  code: string;
  fileName: string;
  config: string;
  configFormat: "json";
};

export interface Linter {
  lint: (
    version: number,
    code: string,
    config: string
  ) => Promise<LinterServiceResult>;
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

  const server = await startServer(webContainer, notification);

  return {
    async lint(version, code, config) {
      return lint(server, version, code, config);
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

type Server = {
  process: WebContainerProcess;
  request: (data: any, test: (res: any) => boolean) => Promise<any>;
};

async function startServer(
  webContainer: WebContainer,
  notification: NotificationPanel
): Promise<Server> {
  notification.append("\nStarting server...\n");
  const serverProcess = await webContainer.spawn("npm", ["run", "start"]);
  const writer = serverProcess.input.getWriter();
  let callbackJson: ((json: string) => void) | null = null;
  serverProcess.output.pipeTo(
    new WritableStream({
      write(str) {
        if (
          !callbackJson ||
          !str.startsWith(DIRECTIVE_OPEN) ||
          !str.endsWith(DIRECTIVE_CLOSE)
        )
          return;
        const output = JSON.parse(
          str.slice(DIRECTIVE_OPEN.length, -DIRECTIVE_CLOSE.length)
        );
        callbackJson(output);
      },
    })
  );
  const server: Server = {
    process: serverProcess,
    request: async (data, test) => {
      writer.write(DIRECTIVE_OPEN + JSON.stringify(data) + DIRECTIVE_CLOSE);
      return new Promise((resolve) => {
        callbackJson = (output) => {
          if (test(output)) {
            callbackJson = null;
            resolve(output);
          }
        };
      });
    },
  };

  await server.request("ok?", (res) => res === "ok" || res === "boot");
  return server;
}

async function lint(
  server: Server,
  version: number,
  code: string,
  config: string
) {
  const content = await server.request(
    {
      version,
      code,
      fileName: "target.css",
      config,
      configFormat: "json",
    } as LintInput,
    (content) => content.version >= version
  );

  return content;
}
