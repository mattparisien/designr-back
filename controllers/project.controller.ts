// src/controllers/project.controller.ts
/* ---------------------------------------------------------------------------
 * Project CRUD controller — aligned with new shared API + model types
 * ---------------------------------------------------------------------------
 * ➊  Uses API‑layer DTOs (ListProjectsRequest, BulkDeleteProjectsRequest, …)
 * ➋  Imports the *domain* Project model (Mongo/Mongoose) only once.
 * ➌  All JSON output conforms to the API response DTOs in `@api/project/*`.
 * ------------------------------------------------------------------------- */

import { Request, Response } from 'express';
import fs from 'fs';
import { promisify } from 'util';

import type {
    BulkDeleteProjectsRequest,
    CreateProjectRequest,
    DuplicateProjectRequest,
    UpdateProjectRequest
} from '@canva-clone/shared-types/dist/api/project/project.requests';

import type { Project as ProjectInterface } from '@canva-clone/shared-types/dist/models/project/project.types';

import type {
    BulkDeleteProjectsResponse,
    DeleteProjectResponse,
    ErrorResponse,
    MutationResponse,
    ProjectListResponse,
    ProjectResponse,
} from '@canva-clone/shared-types/dist/api/project/project.responses';

// Import Project model using ES module syntax
import Project from '../models/Project.js';

const unlinkAsync = promisify(fs.unlink);

/* -------------------------------------------------------------------------
 * Helper — wrap async controller to forward errors to Express error handler
 * ------------------------------------------------------------------------- */
const asyncHandler = <T extends Request>(fn: (req: T, res: Response) => Promise<void>) =>
    (req: T, res: Response, next: (err?: any) => void) => fn(req, res).catch(next);

/* -------------------------------------------------------------------------
 * Helper function to convert mongoose document to Project interface
 * ------------------------------------------------------------------------- */
const convertToProject = (doc: any): ProjectInterface => {
    const obj = doc.toObject();
    const { _id, ...rest } = obj;
    return {
        ...rest,
        id: _id.toString(),
        updatedAt: rest.updatedAt instanceof Date ? rest.updatedAt.toISOString() : rest.updatedAt,
        createdAt: rest.createdAt instanceof Date ? rest.createdAt.toISOString() : rest.createdAt,
    };
};

const getEtag = (doc: any): string => {
    return doc.updatedAt instanceof Date ? doc.updatedAt.toISOString() : doc.updatedAt || new Date().toISOString();
};

/* -------------------------------------------------------------------------
 * GET /v1/projects  — list with optional filters / pagination
 * ------------------------------------------------------------------------- */
export const listProjects = asyncHandler(async (req: Request, res) => {
    const {
        userId,
        type,
        search,
        page = 1,
        pageSize = 20,
    } = req.query;

    const filter: Record<string, any> = {};
    if (userId) filter.userId = userId;
    if (type) filter.type = type;
    if (search) {
        filter.$or = [
            { title: { $regex: search, $options: 'i' } },
            { description: { $regex: search, $options: 'i' } },
        ];
    }

    const skip = (Number(page) - 1) * Number(pageSize);

    const [projects, total] = await Promise.all([
        Project.find(filter)
            .select('title kind userId thumbnail shared starred updatedAt')
            .sort({ updatedAt: -1 })
            .skip(skip)
            .limit(Number(pageSize)),
        Project.countDocuments(filter),
    ]);

    const response: ProjectListResponse = {
        projects: projects.map(convertToProject),
        total,
        page: Number(page),
        pageSize: Number(pageSize),
    };
    res.json(response);
});

/* -------------------------------------------------------------------------
 * GET /v1/projects/paginated  — list with pagination and filters
 * ------------------------------------------------------------------------- */
export const getPaginatedProjects = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const {
        page = 1,
        limit = 12,
        userId,
        starred,
        shared,
        category,
        type,
        isTemplate,
        search
    } = req.query;

    // Convert string parameters to appropriate types
    const pageNumber = parseInt(page as string, 10);
    const limitNumber = parseInt(limit as string, 10);
    const skip = (pageNumber - 1) * limitNumber;

    // Build filter object based on query params
    const filter: Record<string, any> = {};
    if (userId) filter.userId = userId;
    if (starred) filter.starred = starred === 'true';
    if (shared) filter.shared = shared === 'true';
    if (category) filter.category = category;
    if (type) filter.type = type;
    if (isTemplate !== undefined) filter.isTemplate = isTemplate === 'true';

    // Add text search if provided
    if (search) {
        filter.$or = [
            { title: { $regex: search, $options: 'i' } },
            { description: { $regex: search, $options: 'i' } },
            { type: { $regex: search, $options: 'i' } },
            { category: { $regex: search, $options: 'i' } }
        ];
    }

    // Execute queries in parallel for better performance
    const [projects, totalProjects] = await Promise.all([
        Project.find(filter)
            .select('title type userId thumbnail category starred shared isTemplate description createdAt updatedAt')
            .sort({ updatedAt: -1 })
            .skip(skip)
            .limit(limitNumber),
        Project.countDocuments(filter)
    ]);

    // Calculate total pages
    const totalPages = Math.ceil(totalProjects / limitNumber);

    const response: ProjectListResponse = {
        projects: projects.map(convertToProject),
        total: totalProjects,
        page: pageNumber,
        pageSize: limitNumber
    };

    res.status(200).json(response);
});

/* -------------------------------------------------------------------------
 * GET /v1/projects/:id
 * ------------------------------------------------------------------------- */
export const getProject = asyncHandler(async (req: Request<{ id: string }>, res) => {
    const project = await Project.findById(req.params.id);
    if (!project) {
        const error: ErrorResponse = {
            success: false,
            code: 'NOT_FOUND',
            message: 'Project not found',
        };
        res.status(404).json(error);
        return;
    }
    const response: ProjectResponse = {
        project: convertToProject(project),
        etag: getEtag(project),
    };
    res.json(response);
});

/* -------------------------------------------------------------------------
 * POST /v1/projects
 * ------------------------------------------------------------------------- */
export const createProject = asyncHandler<Request<{}, any, CreateProjectRequest>>(async (req, res) => {
    const { title, kind, pages = [], thumbnail } = req.body;

    const project = new Project({
        title,
        kind,
        pages,
        thumbnail,
    });
    const saved = await project.save();
    const response: MutationResponse = {
        success: true,
        id: saved.id,
        etag: getEtag(saved),
    };
    res.status(201).json(response);
});

/* -------------------------------------------------------------------------
 * PATCH /v1/projects/:id
 * ------------------------------------------------------------------------- */
export const updateProject = asyncHandler<Request<{ id: string }, any, UpdateProjectRequest>>(async (req, res) => {
    const { id } = req.params;
    const updates = req.body;
    const project = await Project.findByIdAndUpdate(id, updates, { new: true });
    if (!project) {
        const error: ErrorResponse = {
            success: false,
            code: 'NOT_FOUND',
            message: 'Project not found',
        };
        res.status(404).json(error);
        return;
    }
    const response: MutationResponse = {
        success: true,
        id: project.id,
        etag: getEtag(project),
    };
    res.json(response);
});

/* -------------------------------------------------------------------------
 * DELETE /v1/projects/:id
 * ------------------------------------------------------------------------- */
export const deleteProject = asyncHandler<Request<{ id: string }>>(async (req, res) => {
    const project = await Project.findByIdAndDelete(req.params.id);
    if (!project) {
        const error: ErrorResponse = {
            success: false,
            code: 'NOT_FOUND',
            message: 'Project not found',
        };
        res.status(404).json(error);
        return;
    }
    const response: DeleteProjectResponse = {
        success: true,
        id: project.id,
        deleted: true,
    };
    res.json(response);
});

/* -------------------------------------------------------------------------
 * POST /v1/projects/bulk-delete
 * ------------------------------------------------------------------------- */
export const bulkDeleteProjects = asyncHandler<Request<{}, any, BulkDeleteProjectsRequest>>(async (req, res) => {
    const { ids } = req.body;
    await Project.deleteMany({ _id: { $in: ids } });
    const response: BulkDeleteProjectsResponse = {
        success: true,
        deletedIds: ids,
    };
    res.json(response);
});

/* -------------------------------------------------------------------------
 * POST /v1/projects/:id/duplicate
 * ------------------------------------------------------------------------- */
export const duplicateProject = asyncHandler<Request<{ id: string }, any, DuplicateProjectRequest>>(async (req, res) => {
    const original = await Project.findById(req.params.id);
    if (!original) {
        const error: ErrorResponse = {
            success: false,
            code: 'NOT_FOUND',
            message: 'Project not found',
        };
        res.status(404).json(error);
        return;
    }
    const copy = new Project({
        ...(original.toObject ? original.toObject() : original),
        _id: undefined,
        title: req.body.newTitle ?? `${original.title} (copy)`,
        createdAt: undefined,
        updatedAt: undefined,
    } as any);
    const saved = await copy.save();
    const response: MutationResponse = {
        success: true,
        id: saved.id,
        etag: getEtag(saved),
    };
    res.status(201).json(response);
});

/* -------------------------------------------------------------------------
 * Legacy route compatibility functions
 * These functions maintain compatibility with existing routes
 * ------------------------------------------------------------------------- */

// GET /api/projects - compatibility with old route
export const getProjects = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { userId, starred, category, type, isTemplate } = req.query;

    // Build filter object based on query params
    const filter: Record<string, any> = {};
    if (userId) filter.userId = userId;
    if (starred) filter.starred = starred === 'true';
    if (category) filter.category = category;
    if (type) filter.type = type;
    if (isTemplate !== undefined) filter.isTemplate = isTemplate === 'true';

    const projects = await Project.find(filter)
        .select('title type userId thumbnail category starred shared isTemplate createdAt updatedAt')
        .sort({ updatedAt: -1 });

    res.status(200).json(projects.map(convertToProject));
});

// GET /api/projects/templates - compatibility with old route
export const getTemplates = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { category, type } = req.query;

    // Build filter object based on query params
    const filter: Record<string, any> = { isTemplate: true };
    if (category) filter.category = category;
    if (type) filter.type = type;

    const templates = await Project.find(filter)
        .select('title type userId thumbnail category isTemplate createdAt updatedAt')
        .sort({ updatedAt: -1 });

    res.status(200).json(templates.map(convertToProject));
});

// GET /api/projects/:id - compatibility with old route
export const getProjectById = asyncHandler(async (req: Request<{ id: string }>, res: Response): Promise<void> => {
    const { id } = req.params;
    let project;

    if (id.match(/^[0-9a-fA-F]{24}$/)) {
        // If it's a valid ObjectId, use findById
        project = await Project.findById(id);
    } else {
        // If it's a custom ID format, try to find by other fields
        project = await Project.findOne({
            $or: [
                { _id: id },
                { 'pages.id': id } // If it might be a page ID
            ]
        });
    }

    if (!project) {
        res.status(404).json({ message: 'Project not found' });
        return;
    }

    res.status(200).json(convertToProject(project));
});

// POST /api/projects/full - compatibility with old route
export const createProjectWithFullData = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const projectData = req.body;

    const newProject = new Project(projectData);
    const savedProject = await newProject.save();

    res.status(201).json(convertToProject(savedProject));
});

// PUT /api/projects/:id/toggle-template - compatibility with old route
export const toggleTemplate = asyncHandler(async (req: Request<{ id: string }>, res: Response): Promise<void> => {
    const { id } = req.params;
    const { isTemplate } = req.body;

    if (isTemplate === undefined) {
        res.status(400).json({ message: 'isTemplate field is required' });
        return;
    }

    let project;

    if (id.match(/^[0-9a-fA-F]{24}$/)) {
        project = await Project.findByIdAndUpdate(
            id,
            { isTemplate },
            { new: true, runValidators: true }
        );
    } else {
        project = await Project.findOneAndUpdate(
            { $or: [{ _id: id }, { 'pages.id': id }] },
            { isTemplate },
            { new: true, runValidators: true }
        );
    }

    if (!project) {
        res.status(404).json({ message: 'Project not found' });
        return;
    }

    res.status(200).json(convertToProject(project));
});

// POST /api/projects/:id/clone - compatibility with old route
export const cloneProject = asyncHandler(async (req: Request<{ id: string }>, res: Response): Promise<void> => {
    const { id } = req.params;
    const { userId } = req.body;

    if (!userId) {
        res.status(400).json({ message: 'User ID is required for cloning' });
        return;
    }

    const project = await Project.findById(id);

    if (!project) {
        res.status(404).json({ message: 'Project not found' });
        return;
    }

    // Create a new project object without the _id field
    const projectData: any = project.toObject();
    const { _id, ...projectDataWithoutId } = projectData;

    // Update fields for the cloned project
    projectDataWithoutId.userId = userId;
    projectDataWithoutId.title = `${projectDataWithoutId.title} (Copy)`;
    projectDataWithoutId.shared = false;
    projectDataWithoutId.starred = false;
    projectDataWithoutId.isTemplate = false; // Ensure cloned templates become regular projects

    const newProject = new Project(projectDataWithoutId);
    const savedProject = await newProject.save();

    res.status(201).json(convertToProject(savedProject));
});
