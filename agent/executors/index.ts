import {
  CreateProjectRequest,
  MutationResponse,
  ProjectResponse,
  getPreset,
  ProjectType,
  DesignSlug,
} from "@canva-clone/shared-types";
import axios, { AxiosResponse } from "axios";
import { IImageAnalysisService } from "../../services/imageAnalysisService";
import { IVectorStoreService } from "../../services/vectorStore";

/* ──────────────────────────────────────────────────────────────────────────
 * Helper & tool-specific types
 * ──────────────────────────────────────────────────────────────────────── */

export interface SearchAssetsParams {
  search: string;
}
export interface SearchDocsParams {
  search: string;
}

interface SearchResult {
  results: unknown[];   // or a richer SearchResultItem[]
  count: number;
}

export interface CreateSocialMediaProjectParams {
  title: string;
  platform: string;
  format?: string;             // default "post"
}

/* ──────────────────────────────────────────────────────────────────────────
 * Executor map: one entry per tool
 * ──────────────────────────────────────────────────────────────────────── */

export interface ExecutorMap {
  search_assets: (p: SearchAssetsParams) => Promise<SearchResult>;
  search_docs:   (p: SearchDocsParams)   => Promise<SearchResult>;
  create_social_media_project: (
    p: CreateSocialMediaProjectParams
  ) => Promise<ProjectResponse>;
}

export interface AgentConfig {
  vectorStore?: IVectorStoreService;
  imageAnalysis?: IImageAnalysisService;
}

/* ──────────────────────────────────────────────────────────────────────────
 * Factory: returns a fully-typed map that satisfies ExecutorMap
 * ──────────────────────────────────────────────────────────────────────── */

export function createExecutors(
  { vectorStore, imageAnalysis }: AgentConfig
): ExecutorMap {

  return {
    /* — search_assets — */
    async search_assets({ search }) {
      const results =
        (await vectorStore?.searchAssets?.(search)) ?? [];
      return { results, count: results.length };
    },

    /* — search_docs — */
    async search_docs({ search }) {
      const results =
        (await vectorStore?.searchAssets?.(search)) ?? [];
      return { results, count: results.length };
    },

    /* — create_social_media_project — */
    async create_social_media_project({
      title,
      platform,
      format = "post",
    }) {
      /* Validate / normalise •––––––––––––––––––––––––––––––––––––––––––– */
      const validCategories = [
        "marketing",
        "education",
        "events",
        "personal",
        "other",
      ] as const;

      /* Build design spec if needed •––––––––––––––––––––––––––––––––––– */
      let designSpec: ReturnType<typeof getPreset> | undefined;
      try {
        designSpec = getPreset(
          `social.${platform}.${format}` as DesignSlug
        );
      } catch (_) {
        /* fall through – preset may be optional */
      }

      /* Persist the project •––––––––––––––––––––––––––––––––––––––––––– */
      const projectData: CreateProjectRequest = {
        title,
        type: ProjectType.Social,
      };

      // POST – note: first generic = response data type
      const postRes: AxiosResponse<MutationResponse> =
        await axios.post("/api/projects", projectData);

      // GET the full project
      const getRes: AxiosResponse<ProjectResponse> =
        await axios.get(`/api/projects/${postRes.data.id}`);

      return getRes.data;
    },
  };
}
