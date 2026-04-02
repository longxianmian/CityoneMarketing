export function buildEntryEventContext({
  params,
  userStage,
  featureRoute,
  diversionContext,
  rewardPlan,
  isOnsiteBusinessEntry
}) {
  const baseFields = {
    site_id: params.site_id,
    entry_type: params.entry_type,
    entry_code: params.entry_code,
    referrer_type: params.referrer_type,
    referrer_id: params.referrer_id,
    utm_source: params.utm_source,
    utm_campaign: params.utm_campaign,
    line_user_id: params.line_user_id,
    user_id: params.user_id,
    feature_name: featureRoute.feature_name,
    route_source: featureRoute.route_source,
    user_stage: userStage.code,
    diversion_stage: diversionContext.diversion_stage,
    reward_plan_code: rewardPlan.code
  };

  const events = [
    {
      event_name: "entry_opened",
      event_stage: "entry",
      fields: baseFields
    }
  ];

  if (diversionContext.need_follow) {
    events.push({
      event_name: "oa_follow_required",
      event_stage: "diversion",
      fields: {
        ...baseFields,
        follow_reason_code: diversionContext.follow_reason_code
      }
    });
  }

  if (userStage.code === "oa_followed_registered") {
    events.push({
      event_name: "oa_auto_registered",
      event_stage: "identity",
      fields: {
        ...baseFields,
        register_mode: "oa_auto_register"
      }
    });
  }

  if (diversionContext.bind_required) {
    events.push({
      event_name: "auto_register_ready",
      event_stage: "diversion",
      fields: {
        ...baseFields,
        register_reason_code: diversionContext.register_reason_code
      }
    });
  }

  if (!isOnsiteBusinessEntry) {
    events.push({
      event_name: "feature_routed",
      event_stage: "route",
      fields: {
        ...baseFields,
        route_scene: "feature"
      }
    });
  } else {
    events.push({
      event_name: "business_routed",
      event_stage: "route",
      fields: {
        ...baseFields,
        route_scene: "business"
      }
    });
  }

  return {
    tracking_version: "v1",
    event_count: events.length,
    events
  };
}
