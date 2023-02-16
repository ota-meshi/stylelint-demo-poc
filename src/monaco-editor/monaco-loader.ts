import type { Monaco } from "./types.js";

async function setupMonaco(): Promise<void> {
  if (typeof window !== "undefined") {
    const monacoScript = Array.from(
      document.head.querySelectorAll("script")
    ).find(
      (script) =>
        script.src &&
        script.src.includes("monaco") &&
        script.src.includes("vs/loader")
    )!;
    // @ts-expect-error -- global Monaco's require
    window.require.config({
      paths: {
        vs: monacoScript.src.replace(/\/vs\/.*$/u, "/vs"),
      },
    });
  }
}

let setupedMonaco: Promise<void> | null = null;
let editorLoaded: Promise<Monaco> | null = null;

export function loadMonacoEngine(): Promise<void> {
  return setupedMonaco || (setupedMonaco = setupMonaco());
}
export function loadMonacoEditor(): Promise<Monaco> {
  if (editorLoaded) {
    return editorLoaded;
  }
  return (editorLoaded = (async () => {
    const monaco: Monaco = await loadModuleFromMonaco("vs/editor/editor.main");

    monaco.languages.css.cssDefaults.setOptions({
      validate: false, //Turn off CSS built-in validation.
    });
    return monaco;
  })());
}

export async function loadModuleFromMonaco<T>(moduleName: string): Promise<T> {
  await loadMonacoEngine();
  return new Promise((resolve) => {
    if (typeof window !== "undefined") {
      // @ts-expect-error -- global Monaco's require
      window.require([moduleName], (r: T) => {
        resolve(r);
      });
    }
  });
}
