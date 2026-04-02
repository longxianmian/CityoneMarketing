/**
 * tool-nearby-sites.js
 * 查附近可用站点
 * P0：基于 mock 数据，后续接 A 系统站点服务
 */

const MOCK_SITES = [
  { site_id: "site_001", site_name: "Central World 1F", address: "999 Rama I Rd, Bangkok", available_devices: 8, total_slots: 12, distance_m: 120 },
  { site_id: "site_002", site_name: "Siam Paragon B1", address: "991 Rama I Rd, Bangkok", available_devices: 3, total_slots: 8, distance_m: 350 },
  { site_id: "site_003", site_name: "MBK Center 2F", address: "444 Phayathai Rd, Bangkok", available_devices: 0, total_slots: 6, distance_m: 680 },
  { site_id: "site_004", site_name: "Terminal 21 3F", address: "88 Sukhumvit Soi 19, Bangkok", available_devices: 5, total_slots: 10, distance_m: 1200 },
  { site_id: "site_005", site_name: "EmQuartier 1F", address: "689 Sukhumvit Rd, Bangkok", available_devices: 2, total_slots: 8, distance_m: 1850 }
];

export async function execute(slots = {}, identity = {}) {
  const siteId = slots.site_id;
  let sites = MOCK_SITES;

  // 如果有已知站点，优先推到第一位
  if (siteId) {
    sites = [
      ...sites.filter((s) => s.site_id === siteId),
      ...sites.filter((s) => s.site_id !== siteId)
    ];
  }

  const available = sites.filter((s) => s.available_devices > 0);

  return {
    success: true,
    tool_code: "tool-nearby-sites",
    tool_result: {
      sites: sites.slice(0, 5),
      available_count: available.length,
      total_count: sites.length
    },
    display_payload: {
      type: "site_list",
      title: "附近站点"
    }
  };
}
