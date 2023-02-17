import {
  FileSystemTree,
  WebContainer,
  WebContainerProcess,
} from "@webcontainer/api";
import { NotificationPanel } from "../notification";
import type { LintResult } from "stylelint";
import { createJsonPayload, extractJson } from "./server/extract-json";

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
  notification.begin();
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

  notification.end();

  let processing: Promise<void> | null = null;
  let next: (() => Promise<LinterServiceResult>) | null = null;
  let last: Promise<LinterServiceResult> | null = null;
  async function setLintProcess(
    run: () => Promise<LinterServiceResult>
  ): Promise<LinterServiceResult> {
    if (processing) {
      next = run;
      while (processing) {
        await processing;
      }
      return last!;
    }
    const promise = run();
    processing = promise.then(() => {
      processing = null;
      if (next) {
        setLintProcess(next);
        next = null;
      }
    });
    last = promise;
    return promise;
  }

  return {
    async lint(version, code, config) {
      // Returns the result of the last linting process.
      return setLintProcess(() => lint(server, version, code, config));
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
  _process: WebContainerProcess;
  request: (data: any, test: (res: any) => boolean) => Promise<any>;
  restart: () => Promise<void>;
};

async function startServer(
  webContainer: WebContainer,
  notification: NotificationPanel
): Promise<Server> {
  let server = await startServerInternal();

  let waitPromise = Promise.resolve(undefined as any);
  function restart() {
    return (waitPromise = waitPromise.then(async () => {
      server.process.kill();
      await server.process.exit;
      server = await startServerInternal("Restarting server...");
    }));
  }
  return {
    get _process() {
      return server.process;
    },
    async request(data, test) {
      return (waitPromise = waitPromise.then(async () => {
        while (server.isExit) {
          await restart();
        }
        return server.request(data, test);
      }));
    },
    restart,
  };

  async function startServerInternal(message: string = "Starting server...") {
    notification.begin();
    notification.append("\n" + message + "\n");
    const serverProcess = await webContainer.spawn("npm", ["run", "start"]);

    let boot = false;
    let callbacks: ((json: string) => void)[] = [];
    serverProcess.output.pipeTo(
      new WritableStream({
        write(str) {
          if (!callbacks.length) {
            if (!boot) console.log(str);
            return;
          }
          const output = extractJson(str);
          if (!output) {
            if (!boot) console.log(str);
            return;
          }
          callbacks.forEach((f) => f(output));
        },
      })
    );

    const writer = serverProcess.input.getWriter();
    const serverInternal = {
      process: serverProcess,
      request: async (data: any, test: (data: any) => boolean) => {
        writer.write(createJsonPayload(data));
        return new Promise((resolve) => {
          const callback = (output: string) => {
            if (test(output)) {
              const i = callbacks.indexOf(callback);
              if (i > 0) callbacks.splice(i);
              resolve(output);
            }
          };
          callbacks.push(callback);
        });
      },
      isExit: false,
    };
    serverProcess.exit.then((_exitCode) => {
      serverInternal.isExit = true;
    });

    await serverInternal.request(
      "ok?",
      (res) => res === "ok" || res === "boot"
    );
    boot = true;

    notification.end();

    return serverInternal;
  }
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
