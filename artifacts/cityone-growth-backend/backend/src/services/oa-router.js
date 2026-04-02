const OA_BASE_URL =
  process.env.OA_BASE_URL || "https://line.me/R/ti/p/@your_oa_id";

export function buildOAFollowRedirect({
  params,
  feature,
  isOnsiteBusinessEntry
}) {
  const returnContext = buildReturnContext({
    params,
    feature,
    isOnsiteBusinessEntry
  });

  const returnPath = buildReturnPath({
    params,
    feature,
    isOnsiteBusinessEntry
  });

  const followReturnToken = buildFollowReturnToken(returnContext);

  const redirect = encodeURIComponent(returnPath);

  return {
    oa_redirect_url: `${OA_BASE_URL}?redirect=${redirect}`,
    follow_return_token: followReturnToken,
    return_path: returnPath,
    return_context_payload: returnContext
  };
}

export function buildReturnContext({
  params,
  feature,
  isOnsiteBusinessEntry
}) {
  return {
    route_scene: isOnsiteBusinessEntry ? "business" : "feature",
    site_id: params.site_id,
    entry_type: params.entry_type,
    entry_code: params.entry_code,
    feature_name: isOnsiteBusinessEntry ? "" : feature,
    referrer_type: params.referrer_type,
    referrer_id: params.referrer_id,
    utm_source: params.utm_source,
    utm_campaign: params.utm_campaign
  };
}

function buildReturnPath({
  params,
  feature,
  isOnsiteBusinessEntry
}) {
  const query = new URLSearchParams({
    site_id: params.site_id,
    entry_type: params.entry_type,
    entry_code: params.entry_code
  });

  if (!isOnsiteBusinessEntry && feature) {
    query.set("feature_name", feature);
  }

  if (params.referrer_type) {
    query.set("referrer_type", params.referrer_type);
  }

  if (params.referrer_id) {
    query.set("referrer_id", params.referrer_id);
  }

  if (params.utm_source) {
    query.set("utm_source", params.utm_source);
  }

  if (params.utm_campaign) {
    query.set("utm_campaign", params.utm_campaign);
  }

  return `/api/entry/resolve?${query.toString()}`;
}

function buildFollowReturnToken(returnContext) {
  const raw = JSON.stringify(returnContext);
  return Buffer.from(raw, "utf8").toString("base64url");
}
