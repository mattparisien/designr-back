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
    ListProjectsRequest,
    UpdateProjectRequest,
} from '@canva-clone/shared-types/dist/api/project/project.requests';

import type {
    BulkDeleteProjectsResponse,
    DeleteProjectResponse,
    ErrorResponse,
    MutationResponse,
    ProjectListResponse,
    ProjectResponse,
} from '@canva-clone/shared-types/dist/api/project/project.responses';

// Import Project model using require to handle JS module
const Project = require('../models/Project');

const unlinkAsync = promisify(fs.unlink);

/* -------------------------------------------------------------------------
 * Helper — wrap async controller to forward errors to Express error handler
 * ------------------------------------------------------------------------- */
const asyncHandler = <T extends Request>(fn: (req: T, res: Response) => Promise<void>) =>
    (req: T, res: Response, next: (err?: any) => void) => fn(req, res).catch(next);

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
        projects,
        total,
        page: Number(page),
        pageSize: Number(pageSize),
    };
    res.json(response);
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
        project,
        etag: project.updatedAt.toISOString(),
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
        etag: saved.updatedAt.toISOString(),
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
        etag: project.updatedAt.toISOString(),
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
        ...original.toObject(),
        _id: undefined,
        title: req.body.newTitle ?? `${original.title} (copy)`,
        createdAt: undefined,
        updatedAt: undefined,
    });
    const saved = await copy.save();
    const response: MutationResponse = {
        success: true,
        id: saved.id,
        etag: saved.updatedAt.toISOString(),
    };
    res.status(201).json(response);
});
