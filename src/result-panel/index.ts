import ansiRegex from "ansi-regex";
import { LinterServiceResult } from "../linter-service";

export function setupResultPanel({
  rootElement,
}: {
  rootElement: HTMLElement;
}) {
  return {
    setResult: (result: LinterServiceResult) => {
      rootElement.innerHTML = "";
      if (result.exit !== 0) {
        const li = document.createElement("li");
        li.textContent = result.result.replace(ansiRegex(), "");
        rootElement.appendChild(li);
        return;
      }
      for (const w of result.result.warnings) {
        const li = document.createElement("li");
        li.textContent = "[" + w.line + ":" + w.column + "] " + w.text;
        rootElement.appendChild(li);
      }
    },
  };
}
