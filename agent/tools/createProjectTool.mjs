import { tool } from '@langchain/core/tools';
import { z } from 'zod';

// Define the create project tool for the agent to use
const createProjectTool = tool(
  async ({ data, headers = {} }) => {
    try {
        console.log('project created!');
      const response = await fetch('http://localhost:3001/api/projects', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...headers
        },
        body: JSON.stringify(data)
      });

      const responseData = await response.json();
      
      return {
        status: response.status,
        statusText: response.statusText,
        data: responseData,
        success: response.ok
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        status: null,
        data: null
      };
    }
  },
  {
    name: 'createProject',
    description: 'Create a new project by sending data to the projects endpoint',
    schema: z.object({
      data: z.object({}).passthrough().describe('The project data to send in the request body'),
      headers: z.object({}).passthrough().optional().describe('Optional headers to include in the request')
    }),
  }
);

export default createProjectTool;