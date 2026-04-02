export const ENTRY_ROUTING_CONFIG = {
  allowed_entry_types: [
    "table_card",
    "rollup_banner",
    "staff_share",
    "cabinet_sticker",
    "social_ad",
    "koc_post",
    "oa_menu",
    "device_qr",
    "cabinet_qr",
    "site_qr"
  ],

  onsite_business_entry_types: [
    "device_qr",
    "cabinet_qr",
    "site_qr"
  ],

  forced_feature_enabled: true,

  feature_route_rules: {
    by_site_and_entry_type: [
      {
        site_id: "site_001",
        entry_type: "table_card",
        feature_name: "shake"
      },
      {
        site_id: "site_001",
        entry_type: "rollup_banner",
        feature_name: "flash_coupon"
      },
      {
        site_id: "site_001",
        entry_type: "staff_share",
        feature_name: "battery_sos"
      }
    ],

    by_entry_type: {
      table_card: "shake",
      rollup_banner: "flash_coupon",
      staff_share: "battery_sos",
      cabinet_sticker: "battery_sos",
      social_ad: "blessing_draw",
      koc_post: "blessing_draw",
      oa_menu: "benefit_center"
    },

    fallback_feature_name: "battery_sos"
  },

  user_stage_labels: {
    visitor_unfollowed: "访客未关注",
    oa_followed_registered: "已关注并自动注册",
    identified_user: "已识别用户"
  }
};

export function getEntryRoutingConfig() {
  return ENTRY_ROUTING_CONFIG;
}
