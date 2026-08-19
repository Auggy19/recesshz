/** Auth is unused for link-based Recess; stub kept for compatibility. */
export function useAuth() {
  return {
    isLoading: false,
    isAuthenticated: false,
    user: null,
    signIn: async () => {},
    signOut: async () => {},
  };
}
