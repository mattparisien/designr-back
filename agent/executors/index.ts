import {
  CreateProjectRequest,
  MutationResponse,
  ProjectResponse,
  getPreset,
  ProjectType,
  DesignSlug,
  PageId,
  ElementId,
  ElementType,
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
  format?: string;
  category?: string;
  elements?: Array<{
    id: string;
    type: string;
    content: unknown;
    position: { x: number; y: number };
    size: { width: number; height: number };
    metadata: Record<string, unknown>;
  }>;
}

export interface NormalizeSearchResultsParams {
  results: Array<{
    title: string;
    snippet: string;
    url: string;
    image?: string;
  }>;
  designIntent: string;
}

/* ──────────────────────────────────────────────────────────────────────────
 * Executor map: one entry per tool
 * ──────────────────────────────────────────────────────────────────────── */

export interface ExecutorMap {
  search_assets: (p: SearchAssetsParams) => Promise<SearchResult>;
  search_docs: (p: SearchDocsParams) => Promise<SearchResult>;
  normalize_search_results: (p: NormalizeSearchResultsParams) => Promise<any>;
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

const api = axios.create({
  baseURL: process.env.BACKEND_URL ?? "http://localhost:3001", // or env var of your choice
});


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

    /* — normalize_search_results — */
    async normalize_search_results({ results, designIntent }) {
      // Transform search results into design elements
      const elements = results.map((result, index) => ({
        id: `element_${index}`,
        type: 'text',
        content: {
          text: `${result.title}\n${result.snippet}`,
          fontSize: 16,
          fontFamily: 'Arial',
          color: '#333333'
        },
        position: { x: 50, y: 50 + (index * 100) },
        size: { width: 300, height: 80 },
        metadata: {
          source: result.url,
          image: result.image,
          designIntent
        }
      }));

      return {
        elements,
        designIntent,
        sourceCount: results.length,
        message: `Successfully normalized ${results.length} search results into design elements for: ${designIntent}`
      };
    },

    /* — create_social_media_project — */
    async create_social_media_project({
      title,
      platform,
      format = "post",
      elements = []
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
        pages: [
          {
            id: "paage_1" as PageId,
            canvas: {
              dimensions: {
                width: 1080,
                height: 1080,
                aspectRatio: "1:1"
              },
              background: {
                type: "color",
                value: "#ffffff"
              },
              elements: elements.map((el, index) => ({
                id: el.id as ElementId || `element_${index}` as ElementId,
                type: el.type as ElementType || "text" as ElementType,
                position: el.position || { x: 50, y: 50 + (index * 100) },
                size: el.size || { width: 300, height: 80 },
                x: el.position?.x || 0,
                y: el.position?.y || 0,
                width: el.size?.width || 300,
                height: el.size?.height || 80,
                content: "hi"
              })),
            },
          }
        ]
      };

      // POST – note: first generic = response data type
      const postRes: AxiosResponse<MutationResponse> =
        await api.post("/api/projects", projectData);

      // GET the full project
      const getRes: AxiosResponse<ProjectResponse> =
        await api.get(`/api/projects/${postRes.data.id}`);

      return getRes.data;
    },
  };
}
