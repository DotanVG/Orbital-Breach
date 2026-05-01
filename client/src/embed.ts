export function isEmbedMode(search = getCurrentSearch()): boolean {
  return new URLSearchParams(search).get("embed") === "1";
}

function getCurrentSearch(): string {
  if (typeof window === "undefined") return "";
  return window.location.search;
}
