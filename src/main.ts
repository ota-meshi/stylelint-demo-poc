import "./style.css";
import { setupCodeEditor } from "./code-editor";
import { setupConfigEditor } from "./config-editor";
import { setupResultPanel } from "./result-panel";
import { setupLinter } from "./linter-service";
import { Warning } from "stylelint";
import { editor } from "monaco-editor";
import { loadMonacoEditor } from "./monaco-editor";
import { setupNotificationPanel } from "./notification";

main();

async function main() {
  const notification = setupNotificationPanel({
    rootElement: document.querySelector<HTMLDivElement>("#notification")!,
  });
  const [codeEditor, configEditor, resultPanel, linter] = await Promise.all([
    setupCodeEditor({
      rootElement: document.querySelector<HTMLDivElement>("#code")!,
      listeners: {
        onChangeValue: async (value) => {
          lint(value, configEditor.getValue());
        },
      },
    }),
    setupConfigEditor({
      rootElement: document.querySelector<HTMLDivElement>("#config")!,
      listeners: {
        onChangeValue: async (value) => {
          lint(codeEditor.getLeftValue(), value);
        },
      },
    }),
    setupResultPanel({
      rootElement: document.querySelector<HTMLDivElement>("#result")!,
    }),
    setupLinter(notification),
  ]);
  const monaco = await loadMonacoEditor();

  notification.hide();

  lint(codeEditor.getLeftValue(), configEditor.getValue());

  async function lint(code: string, config: string) {
    codeEditor.setRightValue(code);
    codeEditor.setLeftMarkers([]);
    codeEditor.setRightMarkers([]);
    const result = await linter.lint(code, config);
    resultPanel.setResult(result);

    codeEditor.setLeftMarkers(result.result.warnings.map(messageToMarker));
    codeEditor.setRightMarkers(result.fixResult.warnings.map(messageToMarker));
    codeEditor.setRightValue(result.output);
  }

  function messageToMarker(warning: Warning): editor.IMarkerData {
    const startLineNumber = ensurePositiveInt(warning.line, 1);
    const startColumn = ensurePositiveInt(warning.column, 1);
    const endLineNumber = ensurePositiveInt(warning.endLine, startLineNumber);
    const endColumn = ensurePositiveInt(warning.endColumn, startColumn);
    const docUrl = `https://stylelint.io/user-guide/rules/${warning.rule}`;
    const code = docUrl
      ? { value: warning.rule, link: docUrl, target: docUrl }
      : warning.rule || "FATAL";
    return {
      code: code as any,
      severity:
        warning.severity === "warning"
          ? monaco.MarkerSeverity.Warning
          : monaco.MarkerSeverity.Error,
      source: "stylelint",
      message: warning.text,
      startLineNumber,
      startColumn,
      endLineNumber,
      endColumn,
    };
  }

  /**
   * Ensure that a given value is a positive value.
   * @param value The value to check.
   * @param defaultValue The default value which is used if the `value` is undefined.
   * @returns {number} The positive value as the result.
   */
  function ensurePositiveInt(value: number | undefined, defaultValue: number) {
    return Math.max(1, (value !== undefined ? value : defaultValue) | 0);
  }
}
