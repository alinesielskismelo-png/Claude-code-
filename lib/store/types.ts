import type {
  Artifact,
  ArtifactPatch,
  KvMap,
  NewArtifactInput,
  SaveVersionInput,
  Version,
  VersionWithCode,
} from "../types";

export interface ListQuery {
  q?: string;
  tag?: string;
}

/** Contrato de persistência. Há duas implementações: arquivos locais e Supabase. */
export interface Store {
  readonly name: "local" | "supabase";
  listArtifacts(query?: ListQuery): Promise<Artifact[]>;
  listTags(): Promise<{ tag: string; count: number }[]>;
  getArtifact(id: string): Promise<Artifact | null>;
  createArtifact(input: NewArtifactInput): Promise<{ artifact: Artifact; version: Version }>;
  updateArtifact(id: string, patch: ArtifactPatch): Promise<Artifact | null>;
  deleteArtifact(id: string): Promise<boolean>;
  listVersions(artifactId: string): Promise<Version[]>;
  getVersion(artifactId: string, versionId: string): Promise<VersionWithCode | null>;
  /** Cria uma nova versão e a torna a atual. */
  saveVersion(artifactId: string, input: SaveVersionInput): Promise<Version | null>;
  getKv(artifactId: string): Promise<KvMap>;
  /** value === null apaga a chave. */
  setKv(artifactId: string, key: string, value: unknown): Promise<void>;
}
