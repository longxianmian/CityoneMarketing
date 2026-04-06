/**
 * routes/agent-admin.js
 *
 * Agent 管理端配置 CRUD 接口
 * 覆盖：agents、role-keywords、skills、wenwen-card-templates、
 *       policy-contents、biz-kpi-metrics、biz-report-templates、
 *       biz-alert-rules、biz-action-suggestions、
 *       ops-issue-types、ops-repair-actions
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, "..", "..", "data");

// ─── 通用文件读写 ─────────────────────────────────────────────────────────────

function loadJson(filename, defaultValue = []) {
  const filePath = path.join(DATA_DIR, filename);
  if (!fs.existsSync(filePath)) return defaultValue;
  try { return JSON.parse(fs.readFileSync(filePath, "utf-8")); } catch { return defaultValue; }
}

function saveJson(filename, data) {
  fs.writeFileSync(path.join(DATA_DIR, filename), JSON.stringify(data, null, 2), "utf-8");
}

function sendOk(res, sendJson, msg, data) {
  return sendJson(res, 200, { code: 200, msg, data });
}
function sendError(res, sendJson, statusCode, errorCode, msg) {
  return sendJson(res, statusCode, { code: statusCode, msg, error: errorCode });
}

function nextId(list) {
  return list.length > 0 ? Math.max(...list.map(i => i.id || 0)) + 1 : 1;
}

// ─── Agents 基础信息 ──────────────────────────────────────────────────────────

export function handleAgentsList(req, res, url, sendJson) {
  return sendOk(res, sendJson, "agents loaded", loadJson("agents.json", []));
}

export async function handleAgentsUpdate(req, res, url, sendJson, readBody) {
  try {
    const agentCode = url.pathname.split("/").slice(-2, -1)[0];
    const body = await readBody(req);
    const agents = loadJson("agents.json", []);
    const idx = agents.findIndex(a => a.agent_code === agentCode);
    if (idx < 0) return sendError(res, sendJson, 404, "NOT_FOUND", "Agent 不存在");
    agents[idx] = { ...agents[idx], ...body, agent_code: agentCode, updated_at: new Date().toISOString() };
    saveJson("agents.json", agents);
    return sendOk(res, sendJson, "agent updated", agents[idx]);
  } catch (err) {
    return sendError(res, sendJson, 500, "UPDATE_FAILED", err.message);
  }
}

export async function handleAgentToggle(req, res, url, sendJson, readBody) {
  try {
    const agentCode = url.pathname.split("/").slice(-2, -1)[0];
    const body = await readBody(req);
    const agents = loadJson("agents.json", []);
    const idx = agents.findIndex(a => a.agent_code === agentCode);
    if (idx < 0) return sendError(res, sendJson, 404, "NOT_FOUND", "Agent 不存在");
    agents[idx].is_enabled = !!body.is_enabled;
    agents[idx].updated_at = new Date().toISOString();
    saveJson("agents.json", agents);
    return sendOk(res, sendJson, "agent toggled", agents[idx]);
  } catch (err) {
    return sendError(res, sendJson, 500, "TOGGLE_FAILED", err.message);
  }
}

// ─── 角色关键词 ───────────────────────────────────────────────────────────────

export function handleKeywordsList(req, res, url, sendJson) {
  const agentCode = url.searchParams.get("agent_code") || "";
  const language = url.searchParams.get("language") || "";
  let data = loadJson("agent-role-keywords.json", []);
  if (agentCode) data = data.filter(k => k.agent_code === agentCode);
  if (language) data = data.filter(k => k.language === language);
  return sendOk(res, sendJson, "keywords loaded", data);
}

export async function handleKeywordsSave(req, res, url, sendJson, readBody) {
  try {
    const body = await readBody(req);
    if (!body.agent_code || !body.language) return sendError(res, sendJson, 400, "MISSING_FIELDS", "agent_code 和 language 必填");
    const list = loadJson("agent-role-keywords.json", []);
    const idx = list.findIndex(k => k.agent_code === body.agent_code && k.language === body.language);
    const record = { ...(idx >= 0 ? list[idx] : {}), ...body, updated_at: new Date().toISOString() };
    if (idx < 0) { record.id = nextId(list); list.push(record); }
    else list[idx] = record;
    saveJson("agent-role-keywords.json", list);
    return sendOk(res, sendJson, "keywords saved", record);
  } catch (err) {
    return sendError(res, sendJson, 500, "SAVE_FAILED", err.message);
  }
}

// ─── Skills ──────────────────────────────────────────────────────────────────

export function handleSkillsList(req, res, url, sendJson) {
  const agentCode = url.searchParams.get("agent_code") || "";
  let data = loadJson("agent-skills.json", []);
  if (agentCode) data = data.filter(s => s.agent_code === agentCode);
  return sendOk(res, sendJson, "skills loaded", data);
}

export async function handleSkillsCreate(req, res, url, sendJson, readBody) {
  try {
    const body = await readBody(req);
    if (!body.agent_code || !body.skill_code) return sendError(res, sendJson, 400, "MISSING_FIELDS", "agent_code 和 skill_code 必填");
    const list = loadJson("agent-skills.json", []);
    if (list.find(s => s.skill_code === body.skill_code)) return sendError(res, sendJson, 400, "DUPLICATE", "skill_code 已存在");
    const record = { id: nextId(list), ...body, updated_at: new Date().toISOString() };
    list.push(record);
    saveJson("agent-skills.json", list);
    return sendOk(res, sendJson, "skill created", record);
  } catch (err) {
    return sendError(res, sendJson, 500, "CREATE_FAILED", err.message);
  }
}

export async function handleSkillsUpdate(req, res, url, sendJson, readBody) {
  try {
    const id = Number(url.pathname.split("/").pop());
    const body = await readBody(req);
    const list = loadJson("agent-skills.json", []);
    const idx = list.findIndex(s => s.id === id);
    if (idx < 0) return sendError(res, sendJson, 404, "NOT_FOUND", "Skill 不存在");
    list[idx] = { ...list[idx], ...body, id, updated_at: new Date().toISOString() };
    saveJson("agent-skills.json", list);
    return sendOk(res, sendJson, "skill updated", list[idx]);
  } catch (err) {
    return sendError(res, sendJson, 500, "UPDATE_FAILED", err.message);
  }
}

export async function handleSkillsDelete(req, res, url, sendJson) {
  try {
    const id = Number(url.pathname.split("/").pop());
    const list = loadJson("agent-skills.json", []);
    const idx = list.findIndex(s => s.id === id);
    if (idx < 0) return sendError(res, sendJson, 404, "NOT_FOUND", "Skill 不存在");
    const removed = list.splice(idx, 1)[0];
    saveJson("agent-skills.json", list);
    return sendOk(res, sendJson, "skill deleted", removed);
  } catch (err) {
    return sendError(res, sendJson, 500, "DELETE_FAILED", err.message);
  }
}

// ─── 问问卡片模板 ─────────────────────────────────────────────────────────────

export function handleCardTemplatesList(req, res, url, sendJson) {
  const language = url.searchParams.get("language") || "";
  let data = loadJson("wenwen-card-templates.json", []);
  if (language) data = data.filter(t => t.language === language);
  return sendOk(res, sendJson, "card templates loaded", data);
}

export async function handleCardTemplatesCreate(req, res, url, sendJson, readBody) {
  try {
    const body = await readBody(req);
    if (!body.card_type) return sendError(res, sendJson, 400, "MISSING_FIELDS", "card_type 必填");
    const list = loadJson("wenwen-card-templates.json", []);
    const record = { id: nextId(list), ...body, updated_at: new Date().toISOString() };
    list.push(record);
    saveJson("wenwen-card-templates.json", list);
    return sendOk(res, sendJson, "card template created", record);
  } catch (err) {
    return sendError(res, sendJson, 500, "CREATE_FAILED", err.message);
  }
}

export async function handleCardTemplatesUpdate(req, res, url, sendJson, readBody) {
  try {
    const id = Number(url.pathname.split("/").pop());
    const body = await readBody(req);
    const list = loadJson("wenwen-card-templates.json", []);
    const idx = list.findIndex(t => t.id === id);
    if (idx < 0) return sendError(res, sendJson, 404, "NOT_FOUND", "模板不存在");
    list[idx] = { ...list[idx], ...body, id, updated_at: new Date().toISOString() };
    saveJson("wenwen-card-templates.json", list);
    return sendOk(res, sendJson, "card template updated", list[idx]);
  } catch (err) {
    return sendError(res, sendJson, 500, "UPDATE_FAILED", err.message);
  }
}

export async function handleCardTemplatesDelete(req, res, url, sendJson) {
  try {
    const id = Number(url.pathname.split("/").pop());
    const list = loadJson("wenwen-card-templates.json", []);
    const idx = list.findIndex(t => t.id === id);
    if (idx < 0) return sendError(res, sendJson, 404, "NOT_FOUND", "模板不存在");
    const removed = list.splice(idx, 1)[0];
    saveJson("wenwen-card-templates.json", list);
    return sendOk(res, sendJson, "card template deleted", removed);
  } catch (err) {
    return sendError(res, sendJson, 500, "DELETE_FAILED", err.message);
  }
}

// ─── 协议内容 ─────────────────────────────────────────────────────────────────

export function handlePolicyContentsList(req, res, url, sendJson) {
  const policyType = url.searchParams.get("policy_type") || "";
  const language = url.searchParams.get("language") || "";
  let data = loadJson("policy-contents.json", []);
  if (policyType) data = data.filter(p => p.policy_type === policyType);
  if (language) data = data.filter(p => p.language === language);
  return sendOk(res, sendJson, "policy contents loaded", data);
}

export async function handlePolicyContentsSave(req, res, url, sendJson, readBody) {
  try {
    const body = await readBody(req);
    if (!body.policy_type || !body.language) return sendError(res, sendJson, 400, "MISSING_FIELDS", "policy_type 和 language 必填");
    const list = loadJson("policy-contents.json", []);
    const idx = list.findIndex(p => p.policy_type === body.policy_type && p.language === body.language);
    const record = { ...(idx >= 0 ? list[idx] : {}), ...body, updated_at: new Date().toISOString() };
    if (idx < 0) { record.id = nextId(list); list.push(record); }
    else list[idx] = record;
    saveJson("policy-contents.json", list);
    return sendOk(res, sendJson, "policy content saved", record);
  } catch (err) {
    return sendError(res, sendJson, 500, "SAVE_FAILED", err.message);
  }
}

// ─── 业务 KPI 指标 ────────────────────────────────────────────────────────────

export function handleKpiMetricsList(req, res, url, sendJson) {
  const department = url.searchParams.get("department") || "";
  let data = loadJson("biz-kpi-metrics.json", []);
  if (department) data = data.filter(m => m.department === department);
  return sendOk(res, sendJson, "kpi metrics loaded", data);
}

export async function handleKpiMetricsCreate(req, res, url, sendJson, readBody) {
  try {
    const body = await readBody(req);
    if (!body.metric_code || !body.department) return sendError(res, sendJson, 400, "MISSING_FIELDS", "metric_code 和 department 必填");
    const list = loadJson("biz-kpi-metrics.json", []);
    const record = { id: nextId(list), ...body, updated_at: new Date().toISOString() };
    list.push(record);
    saveJson("biz-kpi-metrics.json", list);
    return sendOk(res, sendJson, "kpi metric created", record);
  } catch (err) {
    return sendError(res, sendJson, 500, "CREATE_FAILED", err.message);
  }
}

export async function handleKpiMetricsUpdate(req, res, url, sendJson, readBody) {
  try {
    const id = Number(url.pathname.split("/").pop());
    const body = await readBody(req);
    const list = loadJson("biz-kpi-metrics.json", []);
    const idx = list.findIndex(m => m.id === id);
    if (idx < 0) return sendError(res, sendJson, 404, "NOT_FOUND", "KPI 指标不存在");
    list[idx] = { ...list[idx], ...body, id, updated_at: new Date().toISOString() };
    saveJson("biz-kpi-metrics.json", list);
    return sendOk(res, sendJson, "kpi metric updated", list[idx]);
  } catch (err) {
    return sendError(res, sendJson, 500, "UPDATE_FAILED", err.message);
  }
}

export async function handleKpiMetricsDelete(req, res, url, sendJson) {
  try {
    const id = Number(url.pathname.split("/").pop());
    const list = loadJson("biz-kpi-metrics.json", []);
    const idx = list.findIndex(m => m.id === id);
    if (idx < 0) return sendError(res, sendJson, 404, "NOT_FOUND", "KPI 指标不存在");
    const removed = list.splice(idx, 1)[0];
    saveJson("biz-kpi-metrics.json", list);
    return sendOk(res, sendJson, "kpi metric deleted", removed);
  } catch (err) {
    return sendError(res, sendJson, 500, "DELETE_FAILED", err.message);
  }
}

// ─── 报表模板 ─────────────────────────────────────────────────────────────────

export function handleReportTemplatesList(req, res, url, sendJson) {
  const department = url.searchParams.get("department") || "";
  const templateType = url.searchParams.get("template_type") || "";
  let data = loadJson("biz-report-templates.json", []);
  if (department && department !== "all") data = data.filter(t => t.department === department || t.department === "all");
  if (templateType) data = data.filter(t => t.template_type === templateType);
  return sendOk(res, sendJson, "report templates loaded", data);
}

export async function handleReportTemplatesCreate(req, res, url, sendJson, readBody) {
  try {
    const body = await readBody(req);
    if (!body.template_name || !body.template_type) return sendError(res, sendJson, 400, "MISSING_FIELDS", "template_name 和 template_type 必填");
    const list = loadJson("biz-report-templates.json", []);
    const record = { id: nextId(list), ...body, updated_at: new Date().toISOString() };
    list.push(record);
    saveJson("biz-report-templates.json", list);
    return sendOk(res, sendJson, "report template created", record);
  } catch (err) {
    return sendError(res, sendJson, 500, "CREATE_FAILED", err.message);
  }
}

export async function handleReportTemplatesUpdate(req, res, url, sendJson, readBody) {
  try {
    const id = Number(url.pathname.split("/").pop());
    const body = await readBody(req);
    const list = loadJson("biz-report-templates.json", []);
    const idx = list.findIndex(t => t.id === id);
    if (idx < 0) return sendError(res, sendJson, 404, "NOT_FOUND", "报表模板不存在");
    list[idx] = { ...list[idx], ...body, id, updated_at: new Date().toISOString() };
    saveJson("biz-report-templates.json", list);
    return sendOk(res, sendJson, "report template updated", list[idx]);
  } catch (err) {
    return sendError(res, sendJson, 500, "UPDATE_FAILED", err.message);
  }
}

export async function handleReportTemplatesDelete(req, res, url, sendJson) {
  try {
    const id = Number(url.pathname.split("/").pop());
    const list = loadJson("biz-report-templates.json", []);
    const idx = list.findIndex(t => t.id === id);
    if (idx < 0) return sendError(res, sendJson, 404, "NOT_FOUND", "报表模板不存在");
    const removed = list.splice(idx, 1)[0];
    saveJson("biz-report-templates.json", list);
    return sendOk(res, sendJson, "report template deleted", removed);
  } catch (err) {
    return sendError(res, sendJson, 500, "DELETE_FAILED", err.message);
  }
}

// ─── 预警规则 ─────────────────────────────────────────────────────────────────

export function handleAlertRulesList(req, res, url, sendJson) {
  return sendOk(res, sendJson, "alert rules loaded", loadJson("biz-alert-rules.json", []));
}

export async function handleAlertRulesCreate(req, res, url, sendJson, readBody) {
  try {
    const body = await readBody(req);
    if (!body.metric_code) return sendError(res, sendJson, 400, "MISSING_FIELDS", "metric_code 必填");
    const list = loadJson("biz-alert-rules.json", []);
    const record = { id: nextId(list), ...body, updated_at: new Date().toISOString() };
    list.push(record);
    saveJson("biz-alert-rules.json", list);
    return sendOk(res, sendJson, "alert rule created", record);
  } catch (err) {
    return sendError(res, sendJson, 500, "CREATE_FAILED", err.message);
  }
}

export async function handleAlertRulesUpdate(req, res, url, sendJson, readBody) {
  try {
    const id = Number(url.pathname.split("/").pop());
    const body = await readBody(req);
    const list = loadJson("biz-alert-rules.json", []);
    const idx = list.findIndex(r => r.id === id);
    if (idx < 0) return sendError(res, sendJson, 404, "NOT_FOUND", "预警规则不存在");
    list[idx] = { ...list[idx], ...body, id, updated_at: new Date().toISOString() };
    saveJson("biz-alert-rules.json", list);
    return sendOk(res, sendJson, "alert rule updated", list[idx]);
  } catch (err) {
    return sendError(res, sendJson, 500, "UPDATE_FAILED", err.message);
  }
}

export async function handleAlertRulesDelete(req, res, url, sendJson) {
  try {
    const id = Number(url.pathname.split("/").pop());
    const list = loadJson("biz-alert-rules.json", []);
    const idx = list.findIndex(r => r.id === id);
    if (idx < 0) return sendError(res, sendJson, 404, "NOT_FOUND", "预警规则不存在");
    const removed = list.splice(idx, 1)[0];
    saveJson("biz-alert-rules.json", list);
    return sendOk(res, sendJson, "alert rule deleted", removed);
  } catch (err) {
    return sendError(res, sendJson, 500, "DELETE_FAILED", err.message);
  }
}

// ─── 动作建议模板 ─────────────────────────────────────────────────────────────

export function handleActionSuggestionsList(req, res, url, sendJson) {
  const department = url.searchParams.get("department") || "";
  let data = loadJson("biz-action-suggestions.json", []);
  if (department) data = data.filter(s => s.department === department);
  return sendOk(res, sendJson, "action suggestions loaded", data);
}

export async function handleActionSuggestionsCreate(req, res, url, sendJson, readBody) {
  try {
    const body = await readBody(req);
    if (!body.department) return sendError(res, sendJson, 400, "MISSING_FIELDS", "department 必填");
    const list = loadJson("biz-action-suggestions.json", []);
    const record = { id: nextId(list), ...body, updated_at: new Date().toISOString() };
    list.push(record);
    saveJson("biz-action-suggestions.json", list);
    return sendOk(res, sendJson, "action suggestion created", record);
  } catch (err) {
    return sendError(res, sendJson, 500, "CREATE_FAILED", err.message);
  }
}

export async function handleActionSuggestionsUpdate(req, res, url, sendJson, readBody) {
  try {
    const id = Number(url.pathname.split("/").pop());
    const body = await readBody(req);
    const list = loadJson("biz-action-suggestions.json", []);
    const idx = list.findIndex(s => s.id === id);
    if (idx < 0) return sendError(res, sendJson, 404, "NOT_FOUND", "动作建议不存在");
    list[idx] = { ...list[idx], ...body, id, updated_at: new Date().toISOString() };
    saveJson("biz-action-suggestions.json", list);
    return sendOk(res, sendJson, "action suggestion updated", list[idx]);
  } catch (err) {
    return sendError(res, sendJson, 500, "UPDATE_FAILED", err.message);
  }
}

export async function handleActionSuggestionsDelete(req, res, url, sendJson) {
  try {
    const id = Number(url.pathname.split("/").pop());
    const list = loadJson("biz-action-suggestions.json", []);
    const idx = list.findIndex(s => s.id === id);
    if (idx < 0) return sendError(res, sendJson, 404, "NOT_FOUND", "动作建议不存在");
    const removed = list.splice(idx, 1)[0];
    saveJson("biz-action-suggestions.json", list);
    return sendOk(res, sendJson, "action suggestion deleted", removed);
  } catch (err) {
    return sendError(res, sendJson, 500, "DELETE_FAILED", err.message);
  }
}

// ─── 运维故障类型字典 ─────────────────────────────────────────────────────────

export function handleIssueTypesList(req, res, url, sendJson) {
  return sendOk(res, sendJson, "issue types loaded", loadJson("ops-issue-types.json", []));
}

export async function handleIssueTypesCreate(req, res, url, sendJson, readBody) {
  try {
    const body = await readBody(req);
    if (!body.issue_code) return sendError(res, sendJson, 400, "MISSING_FIELDS", "issue_code 必填");
    const list = loadJson("ops-issue-types.json", []);
    if (list.find(i => i.issue_code === body.issue_code)) return sendError(res, sendJson, 400, "DUPLICATE", "issue_code 已存在");
    const record = { id: nextId(list), ...body, updated_at: new Date().toISOString() };
    list.push(record);
    saveJson("ops-issue-types.json", list);
    return sendOk(res, sendJson, "issue type created", record);
  } catch (err) {
    return sendError(res, sendJson, 500, "CREATE_FAILED", err.message);
  }
}

export async function handleIssueTypesUpdate(req, res, url, sendJson, readBody) {
  try {
    const id = Number(url.pathname.split("/").pop());
    const body = await readBody(req);
    const list = loadJson("ops-issue-types.json", []);
    const idx = list.findIndex(i => i.id === id);
    if (idx < 0) return sendError(res, sendJson, 404, "NOT_FOUND", "故障类型不存在");
    list[idx] = { ...list[idx], ...body, id, updated_at: new Date().toISOString() };
    saveJson("ops-issue-types.json", list);
    return sendOk(res, sendJson, "issue type updated", list[idx]);
  } catch (err) {
    return sendError(res, sendJson, 500, "UPDATE_FAILED", err.message);
  }
}

export async function handleIssueTypesDelete(req, res, url, sendJson) {
  try {
    const id = Number(url.pathname.split("/").pop());
    const list = loadJson("ops-issue-types.json", []);
    const idx = list.findIndex(i => i.id === id);
    if (idx < 0) return sendError(res, sendJson, 404, "NOT_FOUND", "故障类型不存在");
    const removed = list.splice(idx, 1)[0];
    saveJson("ops-issue-types.json", list);
    return sendOk(res, sendJson, "issue type deleted", removed);
  } catch (err) {
    return sendError(res, sendJson, 500, "DELETE_FAILED", err.message);
  }
}

// ─── 运维修复动作字典 ─────────────────────────────────────────────────────────

export function handleRepairActionsList(req, res, url, sendJson) {
  const issueCode = url.searchParams.get("issue_code") || "";
  let data = loadJson("ops-repair-actions.json", []);
  if (issueCode) data = data.filter(a => a.issue_code === issueCode);
  return sendOk(res, sendJson, "repair actions loaded", data);
}

export async function handleRepairActionsCreate(req, res, url, sendJson, readBody) {
  try {
    const body = await readBody(req);
    if (!body.action_code) return sendError(res, sendJson, 400, "MISSING_FIELDS", "action_code 必填");
    const list = loadJson("ops-repair-actions.json", []);
    if (list.find(a => a.action_code === body.action_code)) return sendError(res, sendJson, 400, "DUPLICATE", "action_code 已存在");
    const record = { id: nextId(list), ...body, updated_at: new Date().toISOString() };
    list.push(record);
    saveJson("ops-repair-actions.json", list);
    return sendOk(res, sendJson, "repair action created", record);
  } catch (err) {
    return sendError(res, sendJson, 500, "CREATE_FAILED", err.message);
  }
}

export async function handleRepairActionsUpdate(req, res, url, sendJson, readBody) {
  try {
    const id = Number(url.pathname.split("/").pop());
    const body = await readBody(req);
    const list = loadJson("ops-repair-actions.json", []);
    const idx = list.findIndex(a => a.id === id);
    if (idx < 0) return sendError(res, sendJson, 404, "NOT_FOUND", "修复动作不存在");
    list[idx] = { ...list[idx], ...body, id, updated_at: new Date().toISOString() };
    saveJson("ops-repair-actions.json", list);
    return sendOk(res, sendJson, "repair action updated", list[idx]);
  } catch (err) {
    return sendError(res, sendJson, 500, "UPDATE_FAILED", err.message);
  }
}

export async function handleRepairActionsDelete(req, res, url, sendJson) {
  try {
    const id = Number(url.pathname.split("/").pop());
    const list = loadJson("ops-repair-actions.json", []);
    const idx = list.findIndex(a => a.id === id);
    if (idx < 0) return sendError(res, sendJson, 404, "NOT_FOUND", "修复动作不存在");
    const removed = list.splice(idx, 1)[0];
    saveJson("ops-repair-actions.json", list);
    return sendOk(res, sendJson, "repair action deleted", removed);
  } catch (err) {
    return sendError(res, sendJson, 500, "DELETE_FAILED", err.message);
  }
}
