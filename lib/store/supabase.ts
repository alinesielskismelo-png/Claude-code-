import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type {
  Artifact,
  ArtifactPatch,
  KvMap,
  NewArtifactInput,
  SaveVersionInput,
  Version,
  VersionWithCode,
} from "../types";
import { countTags, matches } from "./filter";
import type { ListQuery, Store } from "./types";

/* eslint-disable @typescript-eslint/no-explicit-any */
type Row = Record<string, any>;

const ARTIFACT_COLS =
  "id,title,description,tags,kind,current_version_id,version_count,created_at,updated_at";
const VERSION_COLS = "id,artifact_id,number,message,source,size,created_at";

function toArtifact(r: Row): Artifact {
  return {
    id: r.id,
    title: r.title,
    description: r.description ?? "",
    tags: r.tags ?? [],
    kind: r.kind,
    currentVersionId: r.current_version_id,
    versionCount: r.version_count,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

function toVersion(r: Row): Version {
  return {
    id: r.id,
    artifactId: r.artifact_id,
    number: r.number,
    message: r.message ?? "",
    source: r.source,
    size: r.size,
    createdAt: r.created_at,
  };
}

const ASSET_BUCKET = "assets";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function check<T>(res: { data: T; error: { message: string } | null }): T {
  if (res.error) throw new Error(`Supabase: ${res.error.message}`);
  return res.data;
}

/** Postgres no Supabase, acessado só pelo servidor com a service role key. */
export class SupabaseStore implements Store {
  readonly name = "supabase" as const;
  private db: SupabaseClient;

  constructor(url: string, serviceKey: string) {
    this.db = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  }

  async listArtifacts(query?: ListQuery) {
    // Biblioteca pessoal: dá para filtrar no servidor da aplicação, com busca sem acentos.
    const rows = check(await this.db.from("artifacts").select(ARTIFACT_COLS).order("updated_at", { ascending: false }));
    return (rows as Row[]).map(toArtifact).filter((a) => matches(a, query));
  }

  async listTags() {
    return countTags(await this.listArtifacts());
  }

  async getArtifact(id: string) {
    if (!UUID_RE.test(id)) return null;
    const row = check(await this.db.from("artifacts").select(ARTIFACT_COLS).eq("id", id).maybeSingle());
    return row ? toArtifact(row as Row) : null;
  }

  async createArtifact(input: NewArtifactInput) {
    const row = check(
      await this.db
        .from("artifacts")
        .insert({ title: input.title, description: input.description || "", tags: input.tags || [], kind: input.kind })
        .select("id")
        .single(),
    ) as Row;
    const version = await this.saveVersion(row.id, { code: input.code, message: "Importado", source: "import" });
    const artifact = await this.getArtifact(row.id);
    if (!artifact || !version) throw new Error("Falha ao criar o artefato");
    return { artifact, version };
  }

  async updateArtifact(id: string, patch: ArtifactPatch) {
    if (!UUID_RE.test(id)) return null;
    const upd: Row = { updated_at: new Date().toISOString() };
    if (patch.title !== undefined) upd.title = patch.title;
    if (patch.description !== undefined) upd.description = patch.description;
    if (patch.tags !== undefined) upd.tags = patch.tags;
    if (patch.kind !== undefined) upd.kind = patch.kind;
    const row = check(await this.db.from("artifacts").update(upd).eq("id", id).select(ARTIFACT_COLS).maybeSingle());
    return row ? toArtifact(row as Row) : null;
  }

  async deleteArtifact(id: string) {
    if (!UUID_RE.test(id)) return false;
    const rows = check(await this.db.from("artifacts").delete().eq("id", id).select("id")) as Row[];
    return rows.length > 0;
  }

  async listVersions(artifactId: string) {
    if (!UUID_RE.test(artifactId)) return [];
    const rows = check(
      await this.db
        .from("artifact_versions")
        .select(VERSION_COLS)
        .eq("artifact_id", artifactId)
        .order("number", { ascending: false }),
    );
    return (rows as Row[]).map(toVersion);
  }

  async getVersion(artifactId: string, versionId: string): Promise<VersionWithCode | null> {
    if (!UUID_RE.test(artifactId) || !UUID_RE.test(versionId)) return null;
    const row = check(
      await this.db
        .from("artifact_versions")
        .select(`${VERSION_COLS},code`)
        .eq("artifact_id", artifactId)
        .eq("id", versionId)
        .maybeSingle(),
    ) as Row | null;
    return row ? { ...toVersion(row), code: row.code } : null;
  }

  async saveVersion(artifactId: string, input: SaveVersionInput) {
    if (!UUID_RE.test(artifactId)) return null;
    const row = check(
      await this.db.rpc("save_artifact_version", {
        p_artifact_id: artifactId,
        p_code: input.code,
        p_message: (input.message || "").slice(0, 500),
        p_source: input.source || "manual",
      }),
    ) as Row | null;
    return row && row.id ? toVersion(row) : null;
  }

  async getKv(artifactId: string): Promise<KvMap> {
    if (!UUID_RE.test(artifactId)) return {};
    const rows = check(await this.db.from("artifact_kv").select("key,value").eq("artifact_id", artifactId)) as Row[];
    const out: KvMap = {};
    for (const r of rows) out[r.key] = r.value;
    return out;
  }

  async setKv(artifactId: string, key: string, value: unknown) {
    if (!UUID_RE.test(artifactId)) return;
    if (value === null || value === undefined) {
      check(await this.db.from("artifact_kv").delete().eq("artifact_id", artifactId).eq("key", key));
    } else {
      check(
        await this.db
          .from("artifact_kv")
          .upsert({ artifact_id: artifactId, key, value, updated_at: new Date().toISOString() }),
      );
    }
  }

  async getSetting(key: string): Promise<string | null> {
    const row = check(await this.db.from("app_settings").select("value").eq("key", key).maybeSingle()) as Row | null;
    return row ? String(row.value) : null;
  }

  async setSetting(key: string, value: string | null) {
    if (value === null) {
      check(await this.db.from("app_settings").delete().eq("key", key));
      return;
    }
    check(await this.db.from("app_settings").upsert({ key, value, updated_at: new Date().toISOString() }));
  }

  private bucketReady: Promise<void> | null = null;

  /** Bucket privado "assets" no Supabase Storage; criado na primeira vez. */
  private ensureBucket() {
    if (!this.bucketReady) {
      this.bucketReady = (async () => {
        const { data } = await this.db.storage.getBucket(ASSET_BUCKET);
        if (data) return;
        const r = await this.db.storage.createBucket(ASSET_BUCKET, { public: false });
        if (r.error && !/already exists/i.test(r.error.message)) throw new Error(`Supabase: ${r.error.message}`);
      })().catch((e) => {
        this.bucketReady = null;
        throw e;
      });
    }
    return this.bucketReady;
  }

  async putAsset(id: string, data: Uint8Array, contentType: string) {
    await this.ensureBucket();
    const r = await this.db.storage.from(ASSET_BUCKET).upload(id, data, { contentType, upsert: false });
    if (r.error) throw new Error(`Supabase: ${r.error.message}`);
  }

  async getAsset(id: string) {
    const r = await this.db.storage.from(ASSET_BUCKET).download(id);
    if (r.error || !r.data) return null;
    return { data: new Uint8Array(await r.data.arrayBuffer()), contentType: r.data.type || "application/octet-stream" };
  }
}
