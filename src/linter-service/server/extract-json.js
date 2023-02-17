const DIRECTIVE_OPEN = "{{{stylelint-json-start}}}";
const DIRECTIVE_CLOSE = "{{{stylelint-json-end}}}";

/**
 * @param {string} str
 */
export function extractJson(str) {
  if (!str.startsWith(DIRECTIVE_OPEN) || !str.endsWith(DIRECTIVE_CLOSE)) {
    return null;
  }
  return JSON.parse(str.slice(DIRECTIVE_OPEN.length, -DIRECTIVE_CLOSE.length));
}

/**
 * @param {any} payload
 */
export function createJsonPayload(payload) {
  return DIRECTIVE_OPEN + JSON.stringify(payload) + DIRECTIVE_CLOSE;
}
