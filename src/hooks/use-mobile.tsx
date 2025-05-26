
import * as React from "react"

const MOBILE_BREAKPOINT = 768

export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = React.useState(false); // Default to false (desktop-first approach)
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true); // Indicate that the component has mounted on the client

    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
    const handler = () => {
      setIsMobile(mql.matches);
    };

    // Check on mount
    handler();

    mql.addEventListener("change", handler);

    return () => {
      mql.removeEventListener("change", handler);
    };
  }, []);

  // On the server, `mounted` will be `false`, so `false` (desktop) is returned.
  // On the client, before useEffect runs, `mounted` is `false`, so `false` is returned.
  // After useEffect runs, `mounted` is `true`, and the actual `isMobile` state is returned.
  // This ensures server and initial client render are consistent.
  if (!mounted) {
    return false; // Consistent value for SSR and initial client render
  }

  return isMobile;
}
