export function shouldShowLoginNav(isAuthenticated: boolean): boolean {
  return !isAuthenticated;
}
