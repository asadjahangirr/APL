/** Validate destinations without fetching them. Exported sites never proxy project URLs.
 * @param {string} value
 */
export function isPortfolioUrl(value) {
  if (!value || value.length > 2048 || /[\s\u0000-\u001f\u007f\\]/u.test(value)) return false;
  const authority = value.match(/^https?:\/\/([^/?#]+)/i)?.[1];
  if (!authority || /[@%]/.test(authority)) return false;
  const port = authority.startsWith("[")
    ? authority.slice(authority.indexOf("]") + 1)
    : authority.includes(":") ? authority.slice(authority.indexOf(":")) : "";
  if (port && (!/^:[0-9]{1,5}$/.test(port) || Number(port.slice(1)) > 65535)) return false;
  try {
    const url = new URL(value);
    return (url.protocol === "https:" || url.protocol === "http:") &&
      Boolean(url.hostname) && !url.username && !url.password;
  } catch {
    return false;
  }
}
