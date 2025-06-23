import { createReactAgent } from '@langchain/langgraph/prebuilt';
import { ChatAnthropic } from '@langchain/anthropic';
import tools from './tools/index.mjs';
import { MemorySaver } from '@langchain/langgraph';

// Initialize memory to persist state between graph runs
const checkpointSaver = new MemorySaver();


const model = new ChatAnthropic({
  model: 'claude-3-5-sonnet-latest',
});

const agent = createReactAgent({
  llm: model,
  tools,
  checkpointSaver
});

export default agent;