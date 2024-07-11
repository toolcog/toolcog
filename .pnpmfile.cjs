// This monorepo makes use of sub-packages to simplify dependency management
// and speed up development builds without compromising modularity or
// treeshake-ability.
//
// For turborepo to construct its task graph, it needs precise sub-package
// dependencies to be listed in `package.json`, even though package managers
// don't require it. To prevent pnpm from overwriting sub-package directories
// with symlinks, this script rewrites every sub-package dependency to its
// outermost package.

const { rewriteDeps } = require("./config/deps.cjs");

const readPackage = (pkg) => {
  pkg = rewriteDeps(pkg);

  if (pkg.name === "@toolcog/core") {
    // Filter out soft cyclic dependency between
    // "@toolcog/core" and "@toolcog/runtime".
    delete pkg.peerDependencies;
    delete pkg.peerDependenciesMeta;
  } else if (pkg.name === "@toolcog/node") {
    // Filter out soft cyclic dependency between
    // "@toolcog/node" and "toolcog".
    delete pkg.peerDependencies;
    delete pkg.peerDependenciesMeta;
  }

  return pkg;
};

module.exports = {
  hooks: { readPackage },
};
