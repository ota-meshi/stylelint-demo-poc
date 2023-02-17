import ansiRegex from "ansi-regex";
const ansiRe = ansiRegex();
export type NotificationPanel = {
  hide(): unknown;
  append(string: string): unknown;
};
const CHA = "\u001b[1G";
export function setupNotificationPanel({
  rootElement,
}: {
  rootElement: HTMLElement;
}): NotificationPanel {
  return {
    append: (string: string) => {
      let start = 0;

      for (const match of string.matchAll(ansiRe)) {
        if (match[0] === CHA) {
          const lastLinefeed = rootElement.textContent!.lastIndexOf("\n");
          if (lastLinefeed > -1)
            rootElement.textContent = rootElement.textContent!.slice(
              0,
              lastLinefeed + 1
            );
        }
        rootElement.textContent += string.slice(start, match.index!);
        start = match.index! + match[0].length;
      }
      rootElement.textContent += string.slice(start);
    },
    hide() {
      rootElement.style.display = "none";
    },
  };
}
