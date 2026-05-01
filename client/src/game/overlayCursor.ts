export interface DesktopOverlayCursorState {
  gameplayActive: boolean;
  mobile: boolean;
  sessionMenuOpen: boolean;
  tabHeld: boolean;
}

export function shouldShowDesktopOverlayCursor(
  state: DesktopOverlayCursorState,
): boolean {
  if (state.mobile || !state.gameplayActive) {
    return false;
  }

  return state.sessionMenuOpen || state.tabHeld;
}
