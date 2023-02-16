import { setupMonacoEditor } from "../monaco-editor/monaco-setup.js";

export function setupCodeEditor({
  rootElement,
  listeners,
}: {
  rootElement: HTMLElement;
  listeners: {
    onChangeValue: (value: string) => void;
  };
}) {
  return setupMonacoEditor({
    rootElement,
    init: {
      language: "css",
      value: `a {
  color: #ff;
  background-color: #555555;
}`,
    },
    listeners: {
      onChangeValue: listeners.onChangeValue,
    },
    useDiffEditor: true,
  });
}
