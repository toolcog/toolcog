import { useMemo } from "./use-memo.ts";
import type { PartialTheme, RootTheme } from "./theme.ts";
import { rootTheme } from "./theme.ts";

const useTheme: {
  (theme: PartialTheme<RootTheme> | undefined): RootTheme;
  <Theme extends object>(
    theme: PartialTheme<Theme> | undefined,
    baseTheme: Theme,
  ): Theme;
} = <Theme extends object>(
  theme: PartialTheme<Theme> | undefined,
  baseTheme?: Theme,
): Theme => {
  if (baseTheme === undefined) {
    baseTheme = rootTheme as Theme;
  }
  return useMemo(() => {
    return {
      ...baseTheme,
      ...theme,
      ...(theme !== undefined && "style" in baseTheme && "style" in theme ?
        {
          style: {
            ...(baseTheme.style as object),
            ...(theme.style as object),
          },
        }
      : undefined),
    };
  }, [theme]);
};

export { useTheme };
