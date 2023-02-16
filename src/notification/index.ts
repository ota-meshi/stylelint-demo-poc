export type NotificationPanel = {
  hide(): unknown;
  append(string: string): unknown;
};
export function setupNotificationPanel({
  rootElement,
}: {
  rootElement: HTMLElement;
}): NotificationPanel {
  return {
    append: (string: string) => {
      rootElement.textContent += string;
    },
    hide() {
      rootElement.style.display = "none";
    },
  };
}
