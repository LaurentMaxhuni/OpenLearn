export interface CsrfInput {
  readonly method?: string;
  readonly cookie?: string;
  readonly csrfToken?: string;
}

const cookieValue = (cookieHeader: string | undefined, name: string): string | undefined => {
  if (cookieHeader === undefined) return undefined;
  for (const part of cookieHeader.split(';')) {
    const separator = part.indexOf('=');
    if (separator < 0 || part.slice(0, separator).trim() !== name) continue;
    return decodeURIComponent(part.slice(separator + 1).trim());
  }
  return undefined;
};

const safeEqual = (left: string, right: string): boolean =>
  left.length === right.length && left === right;

/** Double-submit protection for cookie-authenticated dashboard mutations. */
export const dashboardCsrfProtection = (input: CsrfInput): boolean => {
  const method = input.method?.toUpperCase() ?? 'GET';
  if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') return true;
  if (input.csrfToken === undefined || input.csrfToken.length > 256) return false;
  try {
    const cookieToken = cookieValue(input.cookie, 'openlearn_csrf');
    return cookieToken !== undefined && safeEqual(cookieToken, input.csrfToken);
  } catch {
    return false;
  }
};
