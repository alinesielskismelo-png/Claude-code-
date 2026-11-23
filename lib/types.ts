export type ArtifactKind = "html" | "react";
export type VersionSource = "import" | "manual" | "ai" | "restore";

export interface Artifact {
  id: string;
  title: string;
  description: string;
  tags: string[];
  kind: ArtifactKind;
  currentVersionId: string | null;
  versionCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface Version {
  id: string;
  artifactId: string;
  number: number;
  message: string;
  source: VersionSource;
  size: number;
  createdAt: string;
}

export interface VersionWithCode extends Version {
  code: string;
}

export interface NewArtifactInput {
  title: string;
  description?: string;
  tags?: string[];
  kind: ArtifactKind;
  code: string;
}

export interface ArtifactPatch {
  title?: string;
  description?: string;
  tags?: string[];
  kind?: ArtifactKind;
}

export interface SaveVersionInput {
  code: string;
  message?: string;
  source?: VersionSource;
}

/** Dados persistidos pelo próprio artefato (localStorage, window.storage, db). */
export type KvMap = Record<string, unknown>;
