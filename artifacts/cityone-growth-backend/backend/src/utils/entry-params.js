import { getEntryRoutingConfig } from "../config/entry-routing-config.js";

export function parseEntryParams(searchParams) {
  const config = getEntryRoutingConfig();
  const allowedEntryTypes = config.allowed_entry_types || [];

  const params = {
    site_id: (searchParams.get("site_id") || "").trim(),
    entry_type: (searchParams.get("entry_type") || "").trim(),
    entry_code: (searchParams.get("entry_code") || "").trim(),

    user_id: (searchParams.get("user_id") || "").trim(),
    line_user_id: (searchParams.get("line_user_id") || "").trim(),

    feature_name: (searchParams.get("feature_name") || "").trim(),

    referrer_type: (searchParams.get("referrer_type") || "").trim(),
    referrer_id: (searchParams.get("referrer_id") || "").trim(),
    utm_source: (searchParams.get("utm_source") || "").trim(),
    utm_campaign: (searchParams.get("utm_campaign") || "").trim()
  };

  if (!params.site_id) {
    throw new Error("site_id 不能为空");
  }

  if (!params.entry_type) {
    throw new Error("entry_type 不能为空");
  }

  if (!allowedEntryTypes.includes(params.entry_type)) {
    throw new Error(
      `entry_type 不合法，可选值为：${allowedEntryTypes.join(", ")}`
    );
  }

  if (!params.entry_code) {
    throw new Error("entry_code 不能为空");
  }

  return params;
}

export function getAllowedEntryTypes() {
  const config = getEntryRoutingConfig();
  return config.allowed_entry_types || [];
}
