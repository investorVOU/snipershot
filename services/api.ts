import Constants from "expo-constants";

export function getApiBase(): string {
  const extra = Constants.expoConfig?.extra as { apiBase?: string } | undefined;
  const configuredBase =
    extra?.apiBase ||
    process.env.EXPO_PUBLIC_API_BASE ||
    process.env.EXPO_PUBLIC_DOMAIN ||
    "";
  if (configuredBase) {
    const normalized = configuredBase.trim().replace(/\/+$/, "");
    if (/^https?:\/\//i.test(normalized)) return normalized;
    if (
      /^(localhost|127(?:\.\d{1,3}){3}|0\.0\.0\.0|\[::1\])(?::\d+)?$/i.test(normalized) ||
      /^\d{1,3}(?:\.\d{1,3}){3}(?::\d+)?$/.test(normalized)
    ) {
      return `http://${normalized}`;
    }
    return `https://${normalized}`;
  }

  const hostUri =
    Constants.expoConfig?.hostUri ||
    (Constants as { manifest2?: { debuggerHost?: string } }).manifest2?.debuggerHost ||
    "";
  if (hostUri) {
    const host = hostUri.split("/")[0];
    const apiPort = process.env.EXPO_PUBLIC_API_PORT || process.env.PORT || "3000";
    return `http://${host.split(":")[0]}:${apiPort}`;
  }

  return "http://127.0.0.1:3000";
}
