export type CameraViewMode = "first" | "third";

export function isThirdPersonCameraView(mode: CameraViewMode): boolean {
  return mode === "third";
}

export function resolveCameraViewModeForRound(
  defaultMode: CameraViewMode,
  selectedMode: CameraViewMode | null,
): CameraViewMode {
  return selectedMode ?? defaultMode;
}

export function toggleCameraViewMode(mode: CameraViewMode): CameraViewMode {
  return mode === "third" ? "first" : "third";
}
