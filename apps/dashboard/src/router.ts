export type DashboardRoute =
  | { readonly kind: 'plans' }
  | { readonly kind: 'plan'; readonly planId: string }
  | { readonly kind: 'unknown' };

export const routeForPath = (pathname: string): DashboardRoute => {
  if (pathname === '/plans' || pathname === '/') {
    return { kind: 'plans' };
  }
  if (!pathname.startsWith('/plans/')) {
    return { kind: 'unknown' };
  }
  const encodedPlanId = pathname.slice('/plans/'.length);
  if (encodedPlanId.length === 0) {
    return { kind: 'unknown' };
  }
  try {
    return { kind: 'plan', planId: decodeURIComponent(encodedPlanId) };
  } catch {
    return { kind: 'unknown' };
  }
};
