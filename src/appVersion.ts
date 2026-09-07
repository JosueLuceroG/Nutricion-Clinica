import packageJson from "../package.json";

export const APP_VERSION =
  import.meta.env.VITE_RELEASE_VERSION?.trim() || packageJson.version;
