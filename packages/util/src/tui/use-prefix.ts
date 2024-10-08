import { AsyncContext } from "@toolcog/util/async";
import { useState } from "./use-state.ts";
import { useEffect } from "./use-effect.ts";
import type { PartialTheme, RootTheme } from "./theme.ts";
import { useTheme } from "./use-theme.ts";

interface UsePrefixOptions {
  loading?: boolean | undefined;
  theme?: PartialTheme<RootTheme> | undefined;
}

const usePrefix = (options: UsePrefixOptions): string => {
  const loading = options.loading ?? false;
  const theme = useTheme(options.theme);

  const [showLoader, setShowLoader] = useState(false);
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    if (!loading) {
      setShowLoader(false);
      return;
    }

    let ticker: NodeJS.Timeout | undefined;
    let tick = 0;

    // Delay spin start to avoid flickering.
    const timeout = setTimeout(
      AsyncContext.Snapshot.wrap(() => {
        setShowLoader(true);
        ticker = setInterval(
          AsyncContext.Snapshot.wrap(() => {
            setFrame(tick % theme.spinner.frames.length);
            tick += 1;
          }),
          theme.spinner.interval,
        );
      }),
      300,
    );

    return () => {
      clearTimeout(timeout);
      clearInterval(ticker);
    };
  }, [loading]);

  if (showLoader) {
    return theme.style.spinner(theme.spinner.frames[frame]!);
  } else {
    return theme.style.prefix(theme.prefix);
  }
};

export type { UsePrefixOptions };
export { usePrefix };
