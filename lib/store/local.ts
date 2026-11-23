import { promises as fs } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
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

interface DbFile {
  artifacts: Artifact[];
  versions: Version[];
}

const ID_RE = /^[a-zA-Z0-9-]{1,64}$/;

/**
 * Armazenamento em arquivos, para rodar no próprio computador sem serviços externos.
 * data/db.json guarda metadados; data/code/<versão>.txt guarda o código; data/kv/<artefato>.json
 * guarda os dados que o artefato salva. Escritas são serializadas e atômicas (rename).
 */
export class LocalStore implements Store {
  readonly name = "local" as const;
  private dir: string;
  private queue: Promise<unknown> = Promise.resolve();

  constructor(dir: string) {
    this.dir = path.resolve(dir);
  }

  private lock<T>(fn: () => Promise<T>): Promise<T> {
    const run = this.queue.then(fn, fn);
    this.queue = run.catch(() => undefined);
    return run;
  }

  private async writeAtomic(file: string, data: string) {
    await fs.mkdir(path.dirname(file), { recursive: true });
    const tmp = `${file}.${randomUUID()}.tmp`;
    await fs.writeFile(tmp, data, "utf8");
    await fs.rename(tmp, file);
  }

  private async readDb(): Promise<DbFile> {
    try {
      return JSON.parse(await fs.readFile(path.join(this.dir, "db.json"), "utf8"));
    } catch (e: unknown) {
      if ((e as NodeJS.ErrnoException).code === "ENOENT") return { artifacts: [], versions: [] };
      throw e;
    }
  }

  private writeDb(db: DbFile) {
    return this.writeAtomic(path.join(this.dir, "db.json"), JSON.stringify(db, null, 1));
  }

  private codeFile(versionId: string) {
    if (!ID_RE.test(versionId)) throw new Error("id inválido");
    return path.join(this.dir, "code", `${versionId}.txt`);
  }

  private kvFile(artifactId: string) {
    if (!ID_RE.test(artifactId)) throw new Error("id inválido");
    return path.join(this.dir, "kv", `${artifactId}.json`);
  }

  async listArtifacts(query?: ListQuery) {
    const db = await this.readDb();
    return db.artifacts
      .filter((a) => matches(a, query))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  async listTags() {
    return countTags((await this.readDb()).artifacts);
  }

  async getArtifact(id: string) {
    return (await this.readDb()).artifacts.find((a) => a.id === id) || null;
  }

  createArtifact(input: NewArtifactInput) {
    return this.lock(async () => {
      const db = await this.readDb();
      const now = new Date().toISOString();
      const artifact: Artifact = {
        id: randomUUID(),
        title: input.title,
        description: input.description || "",
        tags: input.tags || [],
        kind: input.kind,
        currentVersionId: null,
        versionCount: 0,
        createdAt: now,
        updatedAt: now,
      };
      const version = this.newVersion(artifact, { code: input.code, message: "Importado", source: "import" }, now);
      await this.writeAtomic(this.codeFile(version.id), input.code);
      db.artifacts.push(artifact);
      db.versions.push(version);
      await this.writeDb(db);
      return { artifact, version };
    });
  }

  private newVersion(artifact: Artifact, input: SaveVersionInput, now: string): Version {
    const version: Version = {
      id: randomUUID(),
      artifactId: artifact.id,
      number: artifact.versionCount + 1,
      message: (input.message || "").slice(0, 500),
      source: input.source || "manual",
      size: Buffer.byteLength(input.code, "utf8"),
      createdAt: now,
    };
    artifact.versionCount += 1;
    artifact.currentVersionId = version.id;
    artifact.updatedAt = now;
    return version;
  }

  updateArtifact(id: string, patch: ArtifactPatch) {
    return this.lock(async () => {
      const db = await this.readDb();
      const a = db.artifacts.find((x) => x.id === id);
      if (!a) return null;
      if (patch.title !== undefined) a.title = patch.title;
      if (patch.description !== undefined) a.description = patch.description;
      if (patch.tags !== undefined) a.tags = patch.tags;
      if (patch.kind !== undefined) a.kind = patch.kind;
      a.updatedAt = new Date().toISOString();
      await this.writeDb(db);
      return a;
    });
  }

  deleteArtifact(id: string) {
    return this.lock(async () => {
      const db = await this.readDb();
      const a = db.artifacts.find((x) => x.id === id);
      if (!a) return false;
      const gone = db.versions.filter((v) => v.artifactId === id);
      db.artifacts = db.artifacts.filter((x) => x.id !== id);
      db.versions = db.versions.filter((v) => v.artifactId !== id);
      await this.writeDb(db);
      await Promise.all(gone.map((v) => fs.rm(this.codeFile(v.id), { force: true })));
      await fs.rm(this.kvFile(id), { force: true });
      return true;
    });
  }

  async listVersions(artifactId: string) {
    const db = await this.readDb();
    return db.versions.filter((v) => v.artifactId === artifactId).sort((a, b) => b.number - a.number);
  }

  async getVersion(artifactId: string, versionId: string): Promise<VersionWithCode | null> {
    const db = await this.readDb();
    const v = db.versions.find((x) => x.id === versionId && x.artifactId === artifactId);
    if (!v) return null;
    const code = await fs.readFile(this.codeFile(v.id), "utf8");
    return { ...v, code };
  }

  saveVersion(artifactId: string, input: SaveVersionInput) {
    return this.lock(async () => {
      const db = await this.readDb();
      const a = db.artifacts.find((x) => x.id === artifactId);
      if (!a) return null;
      const version = this.newVersion(a, input, new Date().toISOString());
      await this.writeAtomic(this.codeFile(version.id), input.code);
      db.versions.push(version);
      await this.writeDb(db);
      return version;
    });
  }

  async getKv(artifactId: string): Promise<KvMap> {
    try {
      return JSON.parse(await fs.readFile(this.kvFile(artifactId), "utf8"));
    } catch (e: unknown) {
      if ((e as NodeJS.ErrnoException).code === "ENOENT") return {};
      throw e;
    }
  }

  setKv(artifactId: string, key: string, value: unknown) {
    return this.lock(async () => {
      const kv = await this.getKv(artifactId);
      if (value === null || value === undefined) delete kv[key];
      else kv[key] = value;
      await this.writeAtomic(this.kvFile(artifactId), JSON.stringify(kv));
    });
  }
}
