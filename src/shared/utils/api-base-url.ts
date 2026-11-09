export const isSameApiBaseUrl = (left: string, right: string): boolean => {
  try {
    const first = new URL(left);
    const second = new URL(right);
    if (![first, second].every((url) =>
      ["http:", "https:"].includes(url.protocol)
      && !url.username && !url.password && !url.search && !url.hash)) return false;

    return first.origin === second.origin
      && first.pathname.replace(/\/+$/, "") === second.pathname.replace(/\/+$/, "");
  } catch {
    return false;
  }
};
