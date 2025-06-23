import { tool } from '@langchain/core/tools';
import { z } from 'zod';

// Define the tools for the agent to use
const weatherTool = tool(
  async ({ query }) => {
    // This is a placeholder, but don't tell the LLM that...
    if (query.toLowerCase().includes('san francisco')) {
      return "It's 60 degrees and foggy.";
    }
    return "It's 90 degrees and sunny.";
  },
  {
    name: 'weather',
    description: 'Get Weather in a specific city',
    schema: z.object({
      query: z.string().describe('The query to use in your search.'),
    }),
  }
);

export default weatherTool;