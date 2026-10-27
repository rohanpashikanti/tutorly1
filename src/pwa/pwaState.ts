export type InstallOutcome = 'accepted' | 'dismissed' | 'installed';

export function isStandaloneMode(displayModeStandalone: boolean, legacyStandalone: boolean): boolean {
  return displayModeStandalone || legacyStandalone;
}

export function getInstallationMessage(outcome: InstallOutcome): string {
  if (outcome === 'installed') return 'Tutorly is installed. You can open it from your app launcher.';
  if (outcome === 'accepted') return 'Installation was accepted. The browser will confirm when Tutorly is installed.';
  return 'Installation was dismissed. You can use the browser menu to install later.';
}
