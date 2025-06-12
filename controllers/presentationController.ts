import { Request, Response } from 'express';

// Import JavaScript modules using require
const Presentation = require('../../models/Presentation');

// Import shared types
import type { 
  Page,
  CreatePageData,
  CanvasBackground
} from '@canva-clone/shared-types/dist/canvas/components/pages';
import type { Dimensions } from '@canva-clone/shared-types/dist/design/hierarchical';
import type { ProjectId, PageId } from '@canva-clone/shared-types/dist/core/identifiers';

// Type definitions for request bodies
interface CreatePresentationRequest {
  title?: string;
  userId: string;
  category?: string;
  dimensions?: Dimensions;
  pages?: Page[];
  thumbnail?: string;
  starred?: boolean;
  shared?: boolean;
}

interface UpdatePresentationRequest {
  title?: string;
  category?: string;
  dimensions?: Dimensions;
  pages?: Page[];
  thumbnail?: string;
  starred?: boolean;
  shared?: boolean;
}

interface ClonePresentationRequest {
  userId: string;
}

// Get all presentations (with optional filtering)
export const getPresentations = async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId, starred, category } = req.query;
    
    // Build filter object based on query params
    const filter: any = {};
    if (userId) filter.userId = userId;
    if (starred) filter.starred = starred === 'true';
    if (category) filter.category = category;
    
    const presentations = await Presentation.find(filter)
      .select('title userId thumbnail category starred shared createdAt updatedAt')
      .sort({ updatedAt: -1 });
      
    res.status(200).json(presentations);
  } catch (error: any) {
    console.error('Error fetching presentations:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Get presentation by ID
export const getPresentationById = async (req: Request<{ id: string }>, res: Response): Promise<void> => {
  try {
    const presentation = await Presentation.findById(req.params.id);
    
    if (!presentation) {
      res.status(404).json({ message: 'Presentation not found' });
      return;
    }
    
    res.status(200).json(presentation);
  } catch (error: any) {
    console.error('Error fetching presentation:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Create new presentation
export const createPresentation = async (req: Request<{}, {}, CreatePresentationRequest>, res: Response): Promise<void> => {
  try {
    const newPresentation = new Presentation(req.body);
    const savedPresentation = await newPresentation.save();
    
    res.status(201).json(savedPresentation);
  } catch (error: any) {
    console.error('Error creating presentation:', error);
    res.status(400).json({ message: 'Failed to create presentation', error: error.message });
  }
};

// Update presentation
export const updatePresentation = async (req: Request<{ id: string }, {}, UpdatePresentationRequest>, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const updates = req.body;
    
    const presentation = await Presentation.findByIdAndUpdate(
      id, 
      updates, 
      { new: true, runValidators: true }
    );
    
    if (!presentation) {
      res.status(404).json({ message: 'Presentation not found' });
      return;
    }
    
    res.status(200).json(presentation);
  } catch (error: any) {
    console.error('Error updating presentation:', error);
    res.status(400).json({ message: 'Failed to update presentation', error: error.message });
  }
};

// Delete presentation
export const deletePresentation = async (req: Request<{ id: string }>, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    
    const presentation = await Presentation.findByIdAndDelete(id);
    
    if (!presentation) {
      res.status(404).json({ message: 'Presentation not found' });
      return;
    }
    
    res.status(200).json({ message: 'Presentation deleted successfully' });
  } catch (error: any) {
    console.error('Error deleting presentation:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Clone presentation
export const clonePresentation = async (req: Request<{ id: string }, {}, ClonePresentationRequest>, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { userId } = req.body;
    
    if (!userId) {
      res.status(400).json({ message: 'User ID is required for cloning' });
      return;
    }
    
    const presentation = await Presentation.findById(id);
    
    if (!presentation) {
      res.status(404).json({ message: 'Presentation not found' });
      return;
    }
    
    // Create a new presentation object without the _id field
    const presentationData = presentation.toObject();
    delete presentationData._id;
    
    // Update fields for the cloned presentation
    presentationData.userId = userId;
    presentationData.title = `${presentationData.title} (Copy)`;
    presentationData.shared = false;
    presentationData.starred = false;
    
    const newPresentation = new Presentation(presentationData);
    const savedPresentation = await newPresentation.save();
    
    res.status(201).json(savedPresentation);
  } catch (error: any) {
    console.error('Error cloning presentation:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};
