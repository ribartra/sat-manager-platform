import {
  FEATURE_SETTINGS,
  getFeatureSetting,
  getFeatureSettings,
  type FeatureSettingKey,
} from "@/lib/app-settings";

/**
 * Feature-flag API for product surfaces.
 *
 * Flags hide/show capabilities in the UI (and gate optional product modules).
 * They are NOT authorization: every sensitive action must still enforce RBAC /
 * program scope on the server.
 */

export type FeatureFlagContext = {
  role?: string | null;
  userId?: string | null;
};

export type FeatureFlagMeta = {
  key: FeatureSettingKey;
  label: string;
  description: string;
  owner: string;
  defaultValue: boolean;
  expiresAt: string | null;
};

export function listFeatureFlagMeta(): FeatureFlagMeta[] {
  return (Object.keys(FEATURE_SETTINGS) as FeatureSettingKey[]).map((key) => {
    const config = FEATURE_SETTINGS[key];
    return {
      key,
      label: config.label,
      description: config.description,
      owner: config.owner,
      defaultValue: config.defaultValue,
      expiresAt: config.expiresAt,
    };
  });
}

function isExpired(expiresAt: string | null): boolean {
  if (!expiresAt) return false;
  const ts = Date.parse(expiresAt);
  return Number.isFinite(ts) && ts <= Date.now();
}

/**
 * Evaluate a platform feature flag. `context` is reserved for future targeting;
 * role must never be used to grant privileges — only to choose which UI to show.
 */
export async function isFeatureEnabled(
  key: FeatureSettingKey,
  _context?: FeatureFlagContext,
): Promise<boolean> {
  const meta = FEATURE_SETTINGS[key];
  if (isExpired(meta.expiresAt)) return meta.defaultValue;
  return getFeatureSetting(key);
}

export async function getFeatureFlagValues(
  _context?: FeatureFlagContext,
): Promise<Record<FeatureSettingKey, boolean>> {
  const values = await getFeatureSettings();
  const entries = (Object.keys(FEATURE_SETTINGS) as FeatureSettingKey[]).map((key) => {
    const meta = FEATURE_SETTINGS[key];
    if (isExpired(meta.expiresAt)) return [key, meta.defaultValue] as const;
    return [key, values[key]] as const;
  });
  return Object.fromEntries(entries) as Record<FeatureSettingKey, boolean>;
}

export async function getFeatureFlagSnapshot(context?: FeatureFlagContext) {
  const values = await getFeatureFlagValues(context);
  return {
    flags: values,
    meta: listFeatureFlagMeta().map((item) => ({
      ...item,
      enabled: values[item.key],
      expired: isExpired(item.expiresAt),
    })),
  };
}
