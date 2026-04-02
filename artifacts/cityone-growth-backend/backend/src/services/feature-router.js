import { getEntryRoutingConfig } from "../config/entry-routing-config.js";

export function resolveFeatureRoute(params) {
  const config = getEntryRoutingConfig();
  const rules = config.feature_route_rules || {};
  const forcedFeatureEnabled = !!config.forced_feature_enabled;

  if (forcedFeatureEnabled && params.feature_name) {
    return {
      feature_name: params.feature_name,
      route_source: "forced_feature_name"
    };
  }

  const bySiteAndEntryType = rules.by_site_and_entry_type || [];
  const matchedSiteRule = bySiteAndEntryType.find(
    (item) =>
      item.site_id === params.site_id && item.entry_type === params.entry_type
  );

  if (matchedSiteRule) {
    return {
      feature_name: matchedSiteRule.feature_name,
      route_source: "site_and_entry_type_rule"
    };
  }

  const byEntryType = rules.by_entry_type || {};
  const defaultFeature = byEntryType[params.entry_type];

  if (defaultFeature) {
    return {
      feature_name: defaultFeature,
      route_source: "entry_type_default_rule"
    };
  }

  return {
    feature_name: rules.fallback_feature_name || "battery_sos",
    route_source: "system_fallback_rule"
  };
}

export function getFeatureRouteRules() {
  const config = getEntryRoutingConfig();
  return config.feature_route_rules || {};
}
