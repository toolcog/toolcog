/**
 * Returns the top-level npm package name, stripping off any trailing
 * sub-package path segments.
 */
const getBasePackageName = (pkgName) => {
  const segments = pkgName.split("/");
  const topLevelSegments = segments[0].startsWith("@") ? 2 : 1;
  if (segments.length > topLevelSegments) {
    pkgName = segments.slice(0, topLevelSegments).join("/");
  }
  return pkgName;
};

/**
 * Rewrites sub-package dependencies to the outermost package to which the
 * dependency belongs, preventing pnpm from overwriting actual sub-package
 * directories with symlinks.
 */
const rewriteSubpackageDeps = (pkg, depType) => {
  if (!pkg[depType]) {
    return pkg[depType];
  }
  pkg[depType] = Object.fromEntries(
    Object.entries(pkg[depType]).reduce((deps, [dep, version]) => {
      const baseDepName = getBasePackageName(dep);
      // Exclude self-dependencies.
      if (baseDepName !== pkg.name) {
        deps.push([baseDepName, version]);
      }
      return deps;
    }, []),
  );
};

/**
 * Rewrites all sub-package dependencies of a local package.
 */
const rewriteDeps = (pkg) => {
  rewriteSubpackageDeps(pkg, "peerDependencies");
  rewriteSubpackageDeps(pkg, "dependencies");
  rewriteSubpackageDeps(pkg, "devDependencies");
  return pkg;
};

exports.rewriteDeps = rewriteDeps;
