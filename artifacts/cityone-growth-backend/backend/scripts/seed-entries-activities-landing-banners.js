#!/usr/bin/env node
/**
 * 第二批第2份：入口、活动、落地页、Banner 历史数据迁移 seed 脚本
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import fs from "node:fs";
import { query, withTransaction } from "../src/db/pool.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, "..", "data");

function readJson(filename) {
  const fp = path.join(DATA_DIR, filename);
  if (!fs.existsSync(fp)) return [];
  try {
    const parsed = JSON.parse(fs.readFileSync(fp, "utf-8"));
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}

function toML(v) {
  if (!v) return { zh: "", th: "", en: "" };
  if (typeof v === "object" && ("zh" in v || "th" in v || "en" in v))
    return { zh: v.zh || "", th: v.th || "", en: v.en || "" };
  return { zh: typeof v === "string" ? v : "", th: "", en: "" };
}

async function seedEntryTemplates() {
  const list = readJson("entry-templates.json");
  console.log(`[entry_templates] JSON count: ${list.length}`);
  let inserted = 0, skipped = 0;
  for (const t of list) {
    try {
      await query(
        `INSERT INTO entry_templates (template_code, template_name, entry_type, default_feature_name, status)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (template_code) DO UPDATE SET
           template_name = EXCLUDED.template_name,
           entry_type = EXCLUDED.entry_type,
           default_feature_name = EXCLUDED.default_feature_name,
           status = EXCLUDED.status,
           updated_at = NOW()`,
        [t.template_id, t.template_name, t.entry_type || "", t.default_feature_name || "", t.status || "enabled"]
      );
      inserted++;
    } catch (e) { console.error("  skip:", t.template_id, e.message); skipped++; }
  }
  console.log(`[entry_templates] inserted/updated: ${inserted}, skipped: ${skipped}`);
}

async function seedEntryInstances() {
  const list = readJson("entry-instances.json");
  console.log(`[entry_instances] JSON count: ${list.length}`);
  let inserted = 0, skipped = 0;
  for (const e of list) {
    try {
      await query(
        `INSERT INTO entry_instances (entry_code, site_id, site_name, entry_type, entry_qr_code, current_feature_name, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (entry_code) DO UPDATE SET
           site_id = EXCLUDED.site_id,
           site_name = EXCLUDED.site_name,
           entry_type = EXCLUDED.entry_type,
           entry_qr_code = EXCLUDED.entry_qr_code,
           current_feature_name = EXCLUDED.current_feature_name,
           status = EXCLUDED.status,
           updated_at = NOW()`,
        [
          e.entry_id,
          e.site_id || "",
          e.site_name || "",
          e.entry_type || "",
          e.entry_code || "",
          e.current_feature_name || "",
          e.status || "enabled",
        ]
      );
      inserted++;
    } catch (err) { console.error("  skip:", e.entry_id, err.message); skipped++; }
  }
  console.log(`[entry_instances] inserted/updated: ${inserted}, skipped: ${skipped}`);
}

async function seedLandingPages() {
  const list = readJson("landing-templates.json");
  console.log(`[landing_pages] JSON count: ${list.length}`);

  // 去重：JSON 中 lt_001/lt_002 各出现 2 次（历史重复）
  const seen = new Set();
  const deduped = list.filter(t => {
    const k = t.template_id || t.id || "";
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  console.log(`[landing_pages] after dedup: ${deduped.length}`);

  let inserted = 0, skipped = 0;
  for (let i = 0; i < deduped.length; i++) {
    const t = deduped[i];
    const code = t.template_id || t.id || `lt_auto_${i + 1}`;
    const name = t.template_name || t.name || "";
    // 支持两种 JSON 字段格式
    const title = t.title_zh != null
      ? { zh: t.title_zh || "", th: t.title_th || "", en: t.title_en || "" }
      : toML(t.title);
    const subTitle = t.sub_title_zh != null
      ? { zh: t.sub_title_zh || "", th: t.sub_title_th || "", en: t.sub_title_en || "" }
      : toML(t.subTitle);
    const benefitText = t.benefit_text_zh != null
      ? { zh: t.benefit_text_zh || "", th: t.benefit_text_th || "", en: t.benefit_text_en || "" }
      : toML(t.benefitText);
    const supportText = t.support_text_zh != null
      ? { zh: t.support_text_zh || "", th: t.support_text_th || "", en: t.support_text_en || "" }
      : toML(t.supportText);
    const primaryCtaText = t.primary_cta_text_zh != null
      ? { zh: t.primary_cta_text_zh || "", th: t.primary_cta_text_th || "", en: t.primary_cta_text_en || "" }
      : toML(t.buttonText);

    try {
      await query(
        `INSERT INTO landing_pages
           (landing_code, name, template_type, title, sub_title, benefit_text, support_text, primary_cta_text,
            hero_image, hero_video, primary_cta_action, follow_success_action,
            target_activity_id, target_product_id, target_page,
            auto_claim_reward, auto_join_activity, auto_open_nearby, auto_open_welfare_home, status)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)
         ON CONFLICT (landing_code) DO UPDATE SET
           name = EXCLUDED.name,
           template_type = EXCLUDED.template_type,
           title = EXCLUDED.title,
           sub_title = EXCLUDED.sub_title,
           benefit_text = EXCLUDED.benefit_text,
           support_text = EXCLUDED.support_text,
           primary_cta_text = EXCLUDED.primary_cta_text,
           hero_image = EXCLUDED.hero_image,
           hero_video = EXCLUDED.hero_video,
           primary_cta_action = EXCLUDED.primary_cta_action,
           follow_success_action = EXCLUDED.follow_success_action,
           target_activity_id = EXCLUDED.target_activity_id,
           target_product_id = EXCLUDED.target_product_id,
           target_page = EXCLUDED.target_page,
           auto_claim_reward = EXCLUDED.auto_claim_reward,
           auto_join_activity = EXCLUDED.auto_join_activity,
           auto_open_nearby = EXCLUDED.auto_open_nearby,
           auto_open_welfare_home = EXCLUDED.auto_open_welfare_home,
           status = EXCLUDED.status,
           updated_at = NOW()`,
        [
          code, name,
          t.template_type || "",
          JSON.stringify(title), JSON.stringify(subTitle),
          JSON.stringify(benefitText), JSON.stringify(supportText),
          JSON.stringify(primaryCtaText),
          t.hero_image || t.coverImage || "",
          t.hero_video || "",
          t.primary_cta_action || t.autoAction || "follow_oa",
          t.follow_success_action || "open_welfare_home",
          t.target_activity_id || t.targetActivityId || "",
          t.target_product_id || t.targetProductId || "",
          t.target_page || "",
          !!(t.auto_claim_reward),
          !!(t.auto_join_activity),
          !!(t.auto_open_nearby),
          !!(t.auto_open_welfare_home),
          t.status || (t.enabled !== false ? "enabled" : "disabled"),
        ]
      );
      inserted++;
    } catch (err) { console.error("  skip:", code, err.message); skipped++; }
  }
  console.log(`[landing_pages] inserted/updated: ${inserted}, skipped: ${skipped}`);
}

async function seedCreativeLandingBindings() {
  const list = readJson("creative-landing-bindings.json");
  console.log(`[creative_landing_bindings] JSON count: ${list.length}`);
  let inserted = 0, skipped = 0;
  for (const b of list) {
    const code = b.binding_id || `clb_auto_${Date.now()}`;
    try {
      await query(
        `INSERT INTO creative_landing_bindings
           (binding_code, creative_id, creative_theme, landing_code, target_channel, audience_type, utm_source, utm_campaign, status)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
         ON CONFLICT (binding_code) DO UPDATE SET
           creative_id = EXCLUDED.creative_id,
           landing_code = EXCLUDED.landing_code,
           utm_source = EXCLUDED.utm_source,
           utm_campaign = EXCLUDED.utm_campaign,
           updated_at = NOW()`,
        [
          code, b.creative_id || "", b.creative_theme || "",
          b.landing_template_id || "",
          b.target_channel || "", b.audience_type || "",
          b.utm_source || "", b.utm_campaign || "",
          b.status || "enabled",
        ]
      );
      inserted++;
    } catch (err) { console.error("  skip:", code, err.message); skipped++; }
  }
  console.log(`[creative_landing_bindings] inserted/updated: ${inserted}, skipped: ${skipped}`);
}

async function seedBanners() {
  const list = readJson("banners.json");
  console.log(`[banners] JSON count: ${list.length}`);
  let inserted = 0, skipped = 0;
  for (const b of list) {
    const code = b.id || `bn_auto_${Date.now()}`;
    try {
      await query(
        `INSERT INTO banners
           (banner_code, title, sub_title, image_url, position_key, jump_type, link_type, link_url, enabled, sort_order)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
         ON CONFLICT (banner_code) DO UPDATE SET
           title = EXCLUDED.title,
           sub_title = EXCLUDED.sub_title,
           image_url = EXCLUDED.image_url,
           link_type = EXCLUDED.link_type,
           link_url = EXCLUDED.link_url,
           enabled = EXCLUDED.enabled,
           sort_order = EXCLUDED.sort_order,
           updated_at = NOW()`,
        [
          code,
          JSON.stringify(toML(b.title)),
          JSON.stringify(toML(b.sub_title)),
          b.image_url || "",
          b.position_key || "home_top",
          b.jump_type || b.link_type || "external",
          b.link_type || "external",
          b.link_url || "",
          b.enabled !== false,
          b.sort_order != null ? Number(b.sort_order) : 0,
        ]
      );
      inserted++;
    } catch (err) { console.error("  skip:", code, err.message); skipped++; }
  }
  console.log(`[banners] inserted/updated: ${inserted}, skipped: ${skipped}`);
}

async function seedActivityTemplates() {
  const list = readJson("activity-templates.json");
  console.log(`[activity_templates] JSON count: ${list.length}`);
  let inserted = 0, skipped = 0;
  for (const t of list) {
    const code = t.template_id;
    try {
      await query(
        `INSERT INTO activity_templates
           (template_code, template_name, activity_type, header_json, media_assets_json,
            intro_block_json, steps_block_json, reward_block_json, notice_block_json, cta_block_json, status)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
         ON CONFLICT (template_code) DO UPDATE SET
           template_name = EXCLUDED.template_name,
           activity_type = EXCLUDED.activity_type,
           status = EXCLUDED.status,
           updated_at = NOW()`,
        [
          code, t.template_name || "", t.activity_type || "",
          t.header_json ? JSON.stringify(t.header_json) : null,
          t.media_assets_json ? JSON.stringify(t.media_assets_json) : null,
          t.intro_block_json ? JSON.stringify(t.intro_block_json) : null,
          t.steps_block_json ? JSON.stringify(t.steps_block_json) : null,
          t.reward_block_json ? JSON.stringify(t.reward_block_json) : null,
          t.notice_block_json ? JSON.stringify(t.notice_block_json) : null,
          t.cta_block_json ? JSON.stringify(t.cta_block_json) : null,
          t.status || "enabled",
        ]
      );
      inserted++;
    } catch (err) { console.error("  skip:", code, err.message); skipped++; }
  }
  console.log(`[activity_templates] inserted/updated: ${inserted}, skipped: ${skipped}`);
}

async function seedActivities() {
  const list = readJson("activities.json");
  console.log(`[activities] JSON count: ${list.length}`);
  if (list.length === 0) {
    console.log(`[activities] 0 条历史数据，跳过 seed`);
    return;
  }
  let inserted = 0, skipped = 0;
  for (const a of list) {
    try {
      const name = typeof a.activity_name === "object" ? a.activity_name : { zh: a.activity_name || "", th: "", en: "" };
      await query(
        `INSERT INTO activities
           (activity_id, activity_type, activity_name, activity_title, activity_subtitle, activity_desc,
            template_code, usage_mode, start_time, end_time, status,
            require_oa_follow, auto_join_after_follow,
            share_enabled, share_title, share_desc, share_cover, campaign_id, share_status,
            goal, department, owner_dept, partner_dept, coupon_name,
            highlights, participation_guide, reward_guide, notice_text,
            cover_image, cover_video, reward_points, sort_order)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31,$32)
         ON CONFLICT (activity_id) DO UPDATE SET
           activity_type = EXCLUDED.activity_type,
           activity_name = EXCLUDED.activity_name,
           status = EXCLUDED.status,
           updated_at = NOW()`,
        [
          a.activity_id, a.activity_type || "", JSON.stringify(name),
          a.activity_title || "", a.activity_subtitle || "", a.activity_desc || "",
          a.template_id || "", a.usage_mode || "public",
          a.start_time || "", a.end_time || "",
          a.status || "draft",
          !!a.require_oa_follow, !!a.auto_join_after_follow,
          !!a.share_enabled, a.share_title || "", a.share_desc || "", a.share_cover || "",
          a.campaign_id || "", a.share_status || "disabled",
          a.goal || "", a.department || "", a.owner_dept || "", a.partner_dept || "",
          a.coupon_name || "", a.highlights || "", a.participation_guide || "",
          a.reward_guide || "", a.notice_text || "",
          a.cover_image || "", a.cover_video || "",
          Number(a.reward_points) || 0, 0,
        ]
      );
      inserted++;
    } catch (err) { console.error("  skip:", a.activity_id, err.message); skipped++; }
  }
  console.log(`[activities] inserted/updated: ${inserted}, skipped: ${skipped}`);
}

async function seedActivityProductBindings() {
  const list = readJson("activity-product-bindings.json");
  console.log(`[activity_product_bindings] JSON count: ${list.length}`);
  let inserted = 0, skipped = 0;
  for (const b of list) {
    const code = b.binding_id;
    try {
      await query(
        `INSERT INTO activity_product_bindings
           (binding_code, activity_code, product_id, binding_type, trigger_event, user_scope, sort_no, status)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
         ON CONFLICT (binding_code) DO UPDATE SET
           activity_code = EXCLUDED.activity_code,
           product_id = EXCLUDED.product_id,
           updated_at = NOW()`,
        [
          code, b.activity_id || "", b.product_id || "", b.binding_type || "",
          b.trigger_event || "", b.user_scope || "all", Number(b.sort_no) || 0,
          b.status || "enabled",
        ]
      );
      inserted++;
    } catch (err) { console.error("  skip:", code, err.message); skipped++; }
  }
  console.log(`[activity_product_bindings] inserted/updated: ${inserted}, skipped: ${skipped}`);
}

async function seedActivityParticipations() {
  const list = readJson("activity-participations.json");
  console.log(`[activity_participations] JSON count: ${list.length}`);
  let inserted = 0, skipped = 0;
  for (const p of list) {
    try {
      await query(
        `INSERT INTO activity_participations
           (id, activity_id, user_id, line_user_id, points_awarded, source_entry_id, source_channel_id, joined_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
         ON CONFLICT (id) DO UPDATE SET
           activity_id = EXCLUDED.activity_id,
           user_id = EXCLUDED.user_id,
           points_awarded = EXCLUDED.points_awarded`,
        [
          p.id, p.activity_id || "", p.user_id || "", p.line_user_id || p.user_id || "",
          Number(p.points_awarded) || 0,
          p.source_entry_id || "",
          p.source_channel_id || "",
          p.joined_at ? new Date(p.joined_at) : new Date(),
        ]
      );
      inserted++;
    } catch (err) { console.error("  skip:", p.id, err.message); skipped++; }
  }
  console.log(`[activity_participations] inserted/updated: ${inserted}, skipped: ${skipped}`);
}

async function main() {
  console.log("=== 开始 seed：入口、活动、落地页、Banner ===\n");
  await seedEntryTemplates();
  await seedEntryInstances();
  await seedLandingPages();
  await seedCreativeLandingBindings();
  await seedBanners();
  await seedActivityTemplates();
  await seedActivities();
  await seedActivityProductBindings();
  await seedActivityParticipations();
  console.log("\n=== Seed 完成 ===");
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
