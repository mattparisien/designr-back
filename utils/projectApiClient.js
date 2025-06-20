// projectApiClient.js - Utility for making API calls to project endpoints using fetch

/**
 * Configuration for project API client
 */
const PROJECT_API_CONFIG = {
  // Base URL for the API - can be overridden via environment variable
  BASE_URL: process.env.API_BASE_URL || 'http://localhost:5000',
  
  // API endpoints
  ENDPOINTS: {
    PROJECTS: '/api/projects',
    PROJECTS_BY_ID: '/api/projects/:id',
    CLONE_PROJECT: '/api/projects/:id/clone',
    TEMPLATES: '/api/projects/templates',
    TOGGLE_TEMPLATE: '/api/projects/:id/toggle-template'
  },
  
  // Default request configuration
  DEFAULT_HEADERS: {
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  },
  
  // Timeout for requests (in milliseconds)
  TIMEOUT: 30000
};

/**
 * Creates a project via the API
 * @param {Object} projectData - The project data to create
 * @param {Object} options - Additional options
 * @param {string} options.baseUrl - Override base URL
 * @param {Object} options.headers - Additional headers
 * @param {number} options.timeout - Request timeout
 * @returns {Promise<Object>} - The created project data
 * @throws {Error} - If the API request fails
 */
async function createProject(projectData, options = {}) {
  const {
    baseUrl = PROJECT_API_CONFIG.BASE_URL,
    headers = {},
    timeout = PROJECT_API_CONFIG.TIMEOUT
  } = options;
  
  if (!projectData) {
    throw new Error('Project data is required');
  }
  
  if (!projectData.title) {
    throw new Error('Project title is required');
  }
  
  if (!projectData.userId) {
    throw new Error('User ID is required');
  }
  
  // Prepare project data with defaults
  const projectPayload = {
    title: projectData.title,
    description: projectData.description || '',
    type: projectData.type || 'custom',
    userId: projectData.userId,
    thumbnail: projectData.thumbnail || '',
    category: projectData.category || '',
    tags: projectData.tags || [],
    starred: projectData.starred || false,
    shared: projectData.shared || false,
    isTemplate: projectData.isTemplate || false,
    sharedWith: projectData.sharedWith || [],
    pages: projectData.pages || [{
      id: 'page-1',
      name: 'Page 1',
      canvasSize: projectData.canvasSize || { name: 'Custom', width: 800, height: 600 },
      thumbnail: '',
      elements: [],
      background: {
        type: 'color',
        value: '#ffffff'
      }
    }],
    canvasSize: projectData.canvasSize || { name: 'Custom', width: 800, height: 600 },
    metadata: projectData.metadata || {}
  };
  
  const url = `${baseUrl}${PROJECT_API_CONFIG.ENDPOINTS.PROJECTS}`;
  
  // Create AbortController for timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        ...PROJECT_API_CONFIG.DEFAULT_HEADERS,
        ...headers
      },
      body: JSON.stringify(projectPayload),
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`API request failed: ${response.status} ${response.statusText}${errorData.message ? ` - ${errorData.message}` : ''}`);
    }
    
    const result = await response.json();
    return result;
    
  } catch (error) {
    clearTimeout(timeoutId);
    
    if (error.name === 'AbortError') {
      throw new Error(`Request timeout after ${timeout}ms`);
    }
    
    throw error;
  }
}

/**
 * Gets a project by ID via the API
 * @param {string} projectId - The project ID
 * @param {Object} options - Additional options
 * @returns {Promise<Object>} - The project data
 */
async function getProject(projectId, options = {}) {
  const {
    baseUrl = PROJECT_API_CONFIG.BASE_URL,
    headers = {},
    timeout = PROJECT_API_CONFIG.TIMEOUT
  } = options;
  
  if (!projectId) {
    throw new Error('Project ID is required');
  }
  
  const url = `${baseUrl}${PROJECT_API_CONFIG.ENDPOINTS.PROJECTS_BY_ID.replace(':id', projectId)}`;
  
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        ...PROJECT_API_CONFIG.DEFAULT_HEADERS,
        ...headers
      },
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`API request failed: ${response.status} ${response.statusText}${errorData.message ? ` - ${errorData.message}` : ''}`);
    }
    
    return await response.json();
    
  } catch (error) {
    clearTimeout(timeoutId);
    
    if (error.name === 'AbortError') {
      throw new Error(`Request timeout after ${timeout}ms`);
    }
    
    throw error;
  }
}

/**
 * Updates a project via the API
 * @param {string} projectId - The project ID
 * @param {Object} updateData - The data to update
 * @param {Object} options - Additional options
 * @returns {Promise<Object>} - The updated project data
 */
async function updateProject(projectId, updateData, options = {}) {
  const {
    baseUrl = PROJECT_API_CONFIG.BASE_URL,
    headers = {},
    timeout = PROJECT_API_CONFIG.TIMEOUT
  } = options;
  
  if (!projectId) {
    throw new Error('Project ID is required');
  }
  
  if (!updateData) {
    throw new Error('Update data is required');
  }
  
  const url = `${baseUrl}${PROJECT_API_CONFIG.ENDPOINTS.PROJECTS_BY_ID.replace(':id', projectId)}`;
  
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  
  try {
    const response = await fetch(url, {
      method: 'PUT',
      headers: {
        ...PROJECT_API_CONFIG.DEFAULT_HEADERS,
        ...headers
      },
      body: JSON.stringify(updateData),
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`API request failed: ${response.status} ${response.statusText}${errorData.message ? ` - ${errorData.message}` : ''}`);
    }
    
    return await response.json();
    
  } catch (error) {
    clearTimeout(timeoutId);
    
    if (error.name === 'AbortError') {
      throw new Error(`Request timeout after ${timeout}ms`);
    }
    
    throw error;
  }
}

/**
 * Lists projects via the API
 * @param {Object} filters - Query filters
 * @param {Object} options - Additional options
 * @returns {Promise<Array>} - Array of projects
 */
async function listProjects(filters = {}, options = {}) {
  const {
    baseUrl = PROJECT_API_CONFIG.BASE_URL,
    headers = {},
    timeout = PROJECT_API_CONFIG.TIMEOUT
  } = options;
  
  const queryParams = new URLSearchParams();
  
  // Add filters as query parameters
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      queryParams.append(key, value.toString());
    }
  });
  
  const url = `${baseUrl}${PROJECT_API_CONFIG.ENDPOINTS.PROJECTS}${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
  
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        ...PROJECT_API_CONFIG.DEFAULT_HEADERS,
        ...headers
      },
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`API request failed: ${response.status} ${response.statusText}${errorData.message ? ` - ${errorData.message}` : ''}`);
    }
    
    return await response.json();
    
  } catch (error) {
    clearTimeout(timeoutId);
    
    if (error.name === 'AbortError') {
      throw new Error(`Request timeout after ${timeout}ms`);
    }
    
    throw error;
  }
}

module.exports = {
  createProject,
  getProject,
  updateProject,
  listProjects,
  PROJECT_API_CONFIG
};
