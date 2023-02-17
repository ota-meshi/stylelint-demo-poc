import ansiRegex from "ansi-regex";
export type NotificationPanel = {
  begin(): void;
  end(): void;
  append(string: string): void;
};
const CHA = "\u001b[1G";
export function setupNotificationPanel({
  rootElement,
}: {
  rootElement: HTMLElement;
}): NotificationPanel {
  let beginStack = 0;
  return {
    append: (string: string) => {
      const ansiRe = ansiRegex();
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
    begin() {
      if (beginStack === 0) {
        rootElement.textContent = "";
      }
      beginStack++;
      if (beginStack > 0) {
        rootElement.style.display = "";
      }
    },
    end() {
      beginStack = Math.max(beginStack - 1, 0);
      if (beginStack === 0) {
        rootElement.style.display = "none";
      }
    },
  };
}
