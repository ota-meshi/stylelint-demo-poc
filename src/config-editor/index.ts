import { setupMonacoEditor } from "../monaco-editor/monaco-setup.js";

export function setupConfigEditor({
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
      language: "json",
      value: JSON.stringify(
        {
          rules: {
            "color-no-invalid-hex": true,
            "color-hex-length": "short",
          },
        },
        null,
        2
      ),
    },
    listeners: listeners,
    useDiffEditor: false,
  });
}
