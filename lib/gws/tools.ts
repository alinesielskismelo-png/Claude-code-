/**
 * Tradução das chamadas que os artefatos do Claude fazem aos conectores
 * ("Google Calendar", "Google Drive", "Google Sheets", "Gmail") para as APIs do Google.
 * Cada função devolve o mesmo formato de resposta que os conectores do claude.ai devolvem.
 */
import { GwsError, accessToken } from "./account";

type Args = Record<string, unknown>;
const MAX_DOWNLOAD = 8 * 1024 * 1024;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function g(url: string, init: RequestInit = {}): Promise<unknown> {
  for (let attempt = 0; ; attempt++) {
    const token = await accessToken();
    const r = await fetch(url, {
      ...init,
      headers: { authorization: `Bearer ${token}`, ...(init.body ? { "content-type": "application/json" } : {}), ...(init.headers || {}) },
    });
    if (r.status === 204) return {};
    if (r.ok) return r.json();
    const body = await r.text().catch(() => "");
    // Limite de velocidade do Google: espera um pouco e tenta de novo (até 3 vezes).
    if (isRateLimit(r.status, body) && attempt < 3) {
      await sleep(400 * 2 ** attempt + Math.random() * 200);
      continue;
    }
    throw httpError(r.status, body);
  }
}

function isRateLimit(status: number, body: string) {
  return status === 429 || (status === 403 && /rate ?limit|quota|userRateLimitExceeded|concurrent/i.test(body));
}

/** Roda fn em todos os itens, no máximo `limit` ao mesmo tempo (o Gmail não aceita 50 de uma vez). */
async function pool<T, R>(items: T[], limit: number, fn: (x: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i]);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}

function httpError(status: number, body: string): GwsError {
  if (status === 401) return new GwsError("needs_reauth", "A conexão com o Google expirou.");
  if (status === 403 && /insufficient|scope/i.test(body)) return new GwsError("not_granted", "Falta permissão do Google para isso.");
  if (isRateLimit(status, body)) return new GwsError("rate_limited", "Muitas chamadas ao Google; tente daqui a pouco.");
  if (status === 404) return new GwsError("not_found", "Não encontrado no Google.");
  if (status >= 500) return new GwsError("server_unavailable", "O Google não respondeu.");
  let reason = "";
  try {
    const j = JSON.parse(body) as { error?: { errors?: { reason?: string }[]; status?: string } };
    reason = j.error?.errors?.[0]?.reason || j.error?.status || "";
  } catch {
    /* corpo não é JSON */
  }
  return new GwsError("invalid_request", `Google recusou o pedido (${status}${reason ? ` ${reason.slice(0, 60)}` : ""}).`);
}

const s = (v: unknown) => (typeof v === "string" && v ? v : undefined);
const n = (v: unknown, def: number, max: number) => Math.max(1, Math.min(max, Number(v) || def));
function qs(params: Record<string, string | number | boolean | undefined>): string {
  const u = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== "") u.set(k, String(v));
  return u.toString();
}
const enc = encodeURIComponent;

/* ---------------- Agenda ---------------- */
const CAL = "https://www.googleapis.com/calendar/v3";

async function listCalendars() {
  const r = (await g(`${CAL}/users/me/calendarList?maxResults=250`)) as { items?: unknown[] };
  return { calendars: r.items || [] };
}

async function listEvents(a: Args) {
  const cal = s(a.calendarId) || "primary";
  const orderBy = s(a.orderBy) === "updated" ? "updated" : "startTime";
  const r = (await g(
    `${CAL}/calendars/${enc(cal)}/events?` +
      qs({
        timeMin: s(a.startTime) || s(a.timeMin),
        timeMax: s(a.endTime) || s(a.timeMax),
        maxResults: n(a.pageSize ?? a.maxResults, 100, 2500),
        singleEvents: true,
        orderBy,
        pageToken: s(a.pageToken),
        q: s(a.query) || s(a.q),
        timeZone: s(a.timeZone),
      }),
  )) as { items?: unknown[]; nextPageToken?: string };
  return { events: r.items || [], nextPageToken: r.nextPageToken };
}

function when(v: unknown, allDay: boolean, tz?: string) {
  const t = s(v);
  if (!t) throw new GwsError("invalid_request", "Falta a data do evento.");
  return allDay ? { date: t.slice(0, 10) } : { dateTime: t, ...(tz ? { timeZone: tz } : {}) };
}

async function createEvent(a: Args) {
  const cal = s(a.calendarId) || "primary";
  const allDay = a.allDay === true;
  const tz = s(a.timeZone);
  const body = {
    summary: s(a.summary) || s(a.title) || "(sem título)",
    location: s(a.location),
    description: s(a.description),
    start: when(a.startTime ?? a.start, allDay, tz),
    end: when(a.endTime ?? a.end ?? a.startTime, allDay, tz),
  };
  return g(`${CAL}/calendars/${enc(cal)}/events`, { method: "POST", body: JSON.stringify(body) });
}

async function deleteEvent(a: Args) {
  const cal = s(a.calendarId) || "primary";
  const id = s(a.eventId);
  if (!id) throw new GwsError("invalid_request", "Falta o evento.");
  await g(`${CAL}/calendars/${enc(cal)}/events/${enc(id)}`, { method: "DELETE" });
  return { deleted: true };
}

/* ---------------- Drive ---------------- */
const DRIVE2 = "https://www.googleapis.com/drive/v2";
const DRIVE3 = "https://www.googleapis.com/drive/v3";

async function searchFiles(a: Args) {
  const r = (await g(
    `${DRIVE2}/files?` +
      qs({
        q: s(a.query) ? `(${s(a.query)}) and trashed = false` : "trashed = false",
        maxResults: n(a.pageSize, 20, 100),
        orderBy: s(a.orderBy),
        pageToken: s(a.pageToken),
        supportsAllDrives: true,
        includeItemsFromAllDrives: true,
      }),
  )) as { items?: Record<string, unknown>[]; nextPageToken?: string };
  const files = (r.items || []).map((f) => ({
    id: f.id,
    title: f.title,
    mimeType: f.mimeType,
    modifiedTime: f.modifiedDate,
    createdTime: f.createdDate,
    viewUrl: f.alternateLink,
    iconLink: f.iconLink,
    thumbnailLink: f.thumbnailLink,
    fileSize: f.fileSize,
    parentId: (f.parents as { id?: string }[] | undefined)?.[0]?.id,
  }));
  return { files, nextPageToken: r.nextPageToken };
}

const EXPORT_DEFAULT: Record<string, string> = {
  "application/vnd.google-apps.document": "text/plain",
  "application/vnd.google-apps.spreadsheet": "text/csv",
  "application/vnd.google-apps.presentation": "application/pdf",
  "application/vnd.google-apps.drawing": "image/png",
};

async function downloadFile(a: Args) {
  const id = s(a.fileId);
  if (!id) throw new GwsError("invalid_request", "Falta o arquivo.");
  const meta = (await g(`${DRIVE3}/files/${enc(id)}?fields=mimeType,size,name&supportsAllDrives=true`)) as { mimeType: string; size?: string };
  if (Number(meta.size || 0) > MAX_DOWNLOAD) throw new GwsError("invalid_request", "Arquivo grande demais para abrir aqui (máx. 8 MB).");
  const native = meta.mimeType.startsWith("application/vnd.google-apps.");
  const exportMime = s(a.exportMimeType) || (native ? EXPORT_DEFAULT[meta.mimeType] || "application/pdf" : undefined);
  const url = exportMime && native
    ? `${DRIVE3}/files/${enc(id)}/export?mimeType=${enc(exportMime)}`
    : `${DRIVE3}/files/${enc(id)}?alt=media&supportsAllDrives=true`;
  const token = await accessToken();
  const r = await fetch(url, { headers: { authorization: `Bearer ${token}` } });
  if (!r.ok) throw httpError(r.status, await r.text().catch(() => ""));
  const buf = Buffer.from(await r.arrayBuffer());
  if (buf.length > MAX_DOWNLOAD) throw new GwsError("invalid_request", "Arquivo grande demais para abrir aqui (máx. 8 MB).");
  const mimeType = (exportMime && native ? exportMime : meta.mimeType) || "application/octet-stream";
  return { content: [{ type: "resource", resource: { uri: `gdrive:///${id}`, mimeType, blob: buf.toString("base64") } }] };
}

/* ---------------- Planilhas ---------------- */
const SHEETS = "https://sheets.googleapis.com/v4/spreadsheets";

function sheetArgs(a: Args) {
  const id = s(a.spreadsheetId);
  const range = s(a.range);
  if (!id || !range) throw new GwsError("invalid_request", "Falta a planilha ou o intervalo.");
  return { id, range };
}

async function getValues(a: Args) {
  const { id, range } = sheetArgs(a);
  return g(`${SHEETS}/${enc(id)}/values/${enc(range)}?` + qs({ valueRenderOption: s(a.valueRenderOption), majorDimension: s(a.majorDimension) }));
}

async function updateValues(a: Args) {
  const { id, range } = sheetArgs(a);
  const opt = s(a.valueInputOption) === "RAW" ? "RAW" : "USER_ENTERED";
  return g(`${SHEETS}/${enc(id)}/values/${enc(range)}?valueInputOption=${opt}`, {
    method: "PUT",
    body: JSON.stringify({ range, values: a.values || [] }),
  });
}

async function appendValues(a: Args) {
  const { id, range } = sheetArgs(a);
  const opt = s(a.valueInputOption) === "RAW" ? "RAW" : "USER_ENTERED";
  return g(`${SHEETS}/${enc(id)}/values/${enc(range)}:append?valueInputOption=${opt}&insertDataOption=INSERT_ROWS`, {
    method: "POST",
    body: JSON.stringify({ values: a.values || [] }),
  });
}

async function getSpreadsheet(a: Args) {
  const id = s(a.spreadsheetId);
  if (!id) throw new GwsError("invalid_request", "Falta a planilha.");
  return g(`${SHEETS}/${enc(id)}?fields=spreadsheetId,properties,sheets.properties`);
}

/* ---------------- Gmail (só leitura) ---------------- */
const GMAIL = "https://gmail.googleapis.com/gmail/v1/users/me";
type GHeader = { name: string; value: string };
type GPart = { mimeType?: string; body?: { data?: string }; parts?: GPart[]; headers?: GHeader[] };
type GMsg = { id: string; threadId: string; snippet?: string; labelIds?: string[]; internalDate?: string; payload?: GPart };

const header = (m: GMsg, name: string) => m.payload?.headers?.find((h) => h.name.toLowerCase() === name)?.value || "";
const viewUrl = (threadId: string) => `https://mail.google.com/mail/u/0/#all/${threadId}`;
function splitAddrs(v: string): string[] {
  return v ? v.split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/).map((x) => x.trim()).filter(Boolean) : [];
}
function displayNames(addrs: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const a of addrs) {
    const m = a.match(/^\s*"?([^"<]*)"?\s*<([^>]+)>/);
    if (m && m[1].trim()) out[m[2].trim()] = m[1].trim();
  }
  return out;
}
function plain(p?: GPart): string {
  if (!p) return "";
  if (p.mimeType === "text/plain" && p.body?.data) return Buffer.from(p.body.data, "base64url").toString("utf8");
  for (const c of p.parts || []) {
    const t = plain(c);
    if (t) return t;
  }
  if (p.mimeType === "text/html" && p.body?.data) {
    return Buffer.from(p.body.data, "base64url").toString("utf8").replace(/<style[\s\S]*?<\/style>/gi, "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  }
  return "";
}
function msgOut(m: GMsg, full: boolean) {
  const to = splitAddrs(header(m, "to"));
  const cc = splitAddrs(header(m, "cc"));
  const from = header(m, "from");
  return {
    id: m.id,
    threadId: m.threadId,
    subject: header(m, "subject"),
    snippet: m.snippet || "",
    sender: from,
    date: m.internalDate ? new Date(Number(m.internalDate)).toISOString() : header(m, "date"),
    labelIds: m.labelIds || [],
    toRecipients: to,
    ccRecipients: cc,
    addressDisplayNames: displayNames([from, ...to, ...cc]),
    ...(full ? { plaintextBody: plain(m.payload).slice(0, 200_000) } : {}),
  };
}

async function searchThreads(a: Args) {
  const list = (await g(`${GMAIL}/threads?` + qs({ q: s(a.query), maxResults: n(a.pageSize, 20, 50), pageToken: s(a.pageToken) }))) as {
    threads?: { id: string }[];
    nextPageToken?: string;
  };
  const meta = "format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Cc&metadataHeaders=Date";
  const threads = await pool(list.threads || [], 8, async (t) => {
      const th = (await g(`${GMAIL}/threads/${enc(t.id)}?${meta}`)) as { id: string; messages?: GMsg[] };
      const msgs = th.messages || [];
      return { id: th.id, messageCount: msgs.length, viewUrl: viewUrl(th.id), messages: msgs.map((m) => msgOut(m, false)) };
  });
  return { threads, nextPageToken: list.nextPageToken };
}

async function getThread(a: Args) {
  const id = s(a.threadId);
  if (!id) throw new GwsError("invalid_request", "Falta a conversa.");
  const full = s(a.messageFormat) !== "MINIMAL";
  const th = (await g(`${GMAIL}/threads/${enc(id)}?format=${full ? "full" : "metadata"}`)) as { id: string; messages?: GMsg[] };
  return { id: th.id, viewUrl: viewUrl(th.id), messages: (th.messages || []).map((m) => msgOut(m, full)) };
}

async function listDrafts(a: Args) {
  const list = (await g(`${GMAIL}/drafts?` + qs({ maxResults: n(a.pageSize, 20, 50), pageToken: s(a.pageToken) }))) as {
    drafts?: { id: string }[];
    nextPageToken?: string;
  };
  const full = s(a.view) === "DRAFT_VIEW_FULL";
  const drafts = await pool(list.drafts || [], 8, async (d) => {
      const dr = (await g(`${GMAIL}/drafts/${enc(d.id)}?format=${full ? "full" : "metadata"}`)) as { id: string; message: GMsg };
      return { ...msgOut(dr.message, full), id: dr.id, messageId: dr.message.id, viewUrl: viewUrl(dr.message.threadId) };
  });
  return { drafts, nextPageToken: list.nextPageToken };
}

/* ---------------- tabela de ferramentas ---------------- */
type Tool = (a: Args) => Promise<unknown>;
const TOOLS: Record<string, Record<string, Tool>> = {
  calendar: { list_calendars: listCalendars, list_events: listEvents, create_event: createEvent, delete_event: deleteEvent },
  drive: { search_files: searchFiles, download_file_content: downloadFile },
  sheets: { get_values: getValues, update_values: updateValues, append_values: appendValues, get_spreadsheet: getSpreadsheet },
  gmail: { search_threads: searchThreads, get_thread: getThread, list_drafts: listDrafts },
};

/** "Google Calendar", "google-calendar", "gcal"… → chave interna. */
export function serverKey(name: string): string | null {
  const k = name.toLowerCase().replace(/[^a-z]/g, "");
  if (k.includes("calendar") || k === "gcal" || k.includes("agenda")) return "calendar";
  if (k.includes("drive")) return "drive";
  if (k.includes("sheet") || k.includes("planilha")) return "sheets";
  if (k.includes("gmail") || k === "mail") return "gmail";
  return null;
}

export async function callTool(server: string, tool: string, args: Args): Promise<unknown> {
  const key = serverKey(server);
  if (!key) throw new GwsError("server_not_connected", `O conector "${server}" não existe neste site.`);
  const fn = TOOLS[key][tool.replace(/^.*__/, "")];
  if (!fn) throw new GwsError("unknown_tool", `A ferramenta "${tool}" não existe neste site.`);
  return fn(args || {});
}
