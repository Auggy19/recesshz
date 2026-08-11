declare global {
  interface Window {
    /**
     * Navigate to the auth page with a custom redirect URL
     * @param redirectUrl - URL to redirect to after successful authentication
     */
    navigateToAuth: (redirectUrl: string) => void;
  }

  /**
   * Chrome / Android's install prompt. The browser fires `beforeinstallprompt`
   * when the site meets installability criteria; call `prompt()` to show the
   * native install dialog, then read `userChoice` for the outcome.
   */
  interface BeforeInstallPromptEvent extends Event {
    prompt: () => Promise<void>;
    userChoice: Promise<{
      outcome: "accepted" | "dismissed";
      platform: string;
    }>;
  }

  interface Navigator {
    /** iOS Safari only: true when the app is running standalone from the home screen. */
    standalone?: boolean;
  }
}

export {};
