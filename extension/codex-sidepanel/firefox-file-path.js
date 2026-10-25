// File references belong to the run's host and working directory, never to the
// extension's URL or the browser process's working directory.
export function absoluteFilePath(path, cwd) {
  if (typeof path !== "string" || !path) return null;
  if (path.startsWith("file://")) {
    try {
      const url = new URL(path);
      // URL.pathname normalizes dot segments; the host must resolve those
      // after following symlinks, so decode the original pathname instead.
      const pathname = /^file:\/\/[^/]*(\/[^?#]*)/iu.exec(path)?.[1];
      if (pathname == null) return null;
      path = decodeURIComponent(pathname);
      if (url.hostname) path = `//${url.hostname}${path}`;
      else if (/^\/[a-z]:\//iu.test(path)) path = path.slice(1);
    } catch { return null; }
  } else if (/^[a-z][a-z\d+.-]*:/iu.test(path) && !/^[a-z]:[\\/]/iu.test(path)) {
    return null;
  }
  // Packaged host helpers also represent drive paths as /C:/work/file.
  const drivePath = (value) => typeof value === "string" && /^\/[a-z]:[\\/]/iu.test(value)
    ? value.slice(1) : value;
  path = drivePath(path);
  cwd = drivePath(cwd);
  const windows = /^[a-z]:[\\/]/iu.test(path) || /^[\\/]{2}/u.test(path)
    || (typeof cwd === "string" && (/^[a-z]:[\\/]/iu.test(cwd) || /^[\\/]{2}/u.test(cwd)));
  const absolute = (value) => windows
    ? /^[a-z]:[\\/]/iu.test(value) || /^[\\/]{2}/u.test(value)
    : value.startsWith("/");
  if (!absolute(path)) {
    if (typeof cwd !== "string" || !absolute(cwd)) return null;
    // A root-relative Windows path inherits only the known host's drive.
    if (windows && /^[\\/]/u.test(path)) {
      if (!/^[a-z]:/iu.test(cwd)) return null;
      path = `${cwd.slice(0, 2)}${path}`;
    } else path = `${cwd.replace(windows ? /[\\/]+$/u : /\/+$/u, "")}/${path}`;
  }
  // Do not collapse "..": /work/link/../report can differ from
  // /work/report when link is a symlink. Copy contents uses this exact path.
  return windows ? path.replaceAll("/", "\\") : path;
}
