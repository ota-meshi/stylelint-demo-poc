import { LinterServiceResult } from "../linter-service";

export function setupResultPanel({
  rootElement,
}: {
  rootElement: HTMLElement;
}) {
  return {
    setResult: (result: LinterServiceResult) => {
      rootElement.innerHTML = "";
      for (const w of result.result.warnings) {
        const li = document.createElement("li");
        li.textContent = "[" + w.line + ":" + w.column + "] " + w.text;
        rootElement.appendChild(li);
      }
    },
  };
}
