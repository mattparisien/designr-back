# AI Agent Autonomous Decision Making

This document explains how the AI agent autonomously decides which tools to use based on user prompts.

## How It Works

The AI agent uses OpenAI's function calling feature to automatically decide which tools to call based on the user's intent. The agent has access to multiple tools and will use them as needed:

### Available Tools

1. **Web Search** (`web_search`)
   - Automatically triggered when the user asks for current information
   - Examples: "What are the latest trends in...", "Find current statistics about...", "Search for recent news..."

2. **Project Creation** (`create_project`)
   - Automatically triggered when the user wants to create a new project
   - Examples: "Create a new presentation...", "Make a flyer for...", "I need a new Instagram post project..."

### Decision Making Process

The agent analyzes the user's prompt and:

1. **Determines Intent**: Understands what the user is trying to accomplish
2. **Selects Tools**: Chooses the appropriate tools based on the requirements
3. **Executes in Sequence**: Calls tools in the optimal order
4. **Synthesizes Response**: Combines tool results into a coherent answer

## Usage Examples

### Single Tool Usage

**Web Search Only:**
```
POST /api/agent/generate
{
  "prompt": "What are the current best practices for mobile app design?"
}
```
→ Agent will search the web and provide current information

**Project Creation Only:**
```
POST /api/agent/generate
{
  "prompt": "Create a new presentation project called 'Sales Report' for user 'john-123'"
}
```
→ Agent will create a project with appropriate settings

### Multi-Tool Usage

**Research + Create:**
```
POST /api/agent/generate
{
  "prompt": "Find the standard dimensions for LinkedIn posts and create a new project with those dimensions for user 'marketing-team'"
}
```
→ Agent will:
1. Search for current LinkedIn post dimensions
2. Create a project with the correct canvas size

### Conversational Response

**No Tools Needed:**
```
POST /api/agent/generate
{
  "prompt": "Explain the principles of good typography"
}
```
→ Agent will respond conversationally without using any tools

## API Endpoint

The agent uses a single endpoint for all interactions:

```
POST /api/agent/generate
Content-Type: application/json

{
  "prompt": "Your request here",
  "response_format": null  // Optional: { "type": "json_object" } for JSON responses
}
```

### Response Format

```json
{
  "response": "The agent's response text",
  "parsed": null  // Only present if JSON format was requested
}
```

## Testing

Run the autonomous decision-making test:

```bash
# Test all scenarios
node test-agent-autonomous-decisions.js

# Test specific scenario
node test-agent-autonomous-decisions.js web-search
node test-agent-autonomous-decisions.js project-creation
node test-agent-autonomous-decisions.js combined
node test-agent-autonomous-decisions.js conversational
```

## Key Benefits

1. **Natural Interface**: Users can request actions in natural language
2. **Intelligent Tool Selection**: Agent automatically chooses the right tools
3. **Multi-Step Workflows**: Can perform complex sequences of actions
4. **Flexible Integration**: Easy to add new tools and capabilities

## Adding New Tools

To add a new tool to the agent:

1. Define the tool in `config/agentConfig.js`
2. Implement the tool function in `utils/agentTools.js`
3. Add it to the AgentService constructor in `services/agentService.js`

The agent will automatically learn to use new tools based on their descriptions and the context of user requests.
