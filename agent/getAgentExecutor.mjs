// agents/getAgentExecutor.ts
import { ChatOpenAI } from "@langchain/openai";
import { TavilySearch } from "@langchain/tavily";
import { AgentExecutor, createOpenAIToolsAgent } from "langchain/agents";
import { pull } from "langchain/hub";

let executorPromise = null;

export async function getAgentExecutor() {
  if (!executorPromise) {
    executorPromise = (async () => {
      /* 1. LLM -------------------------------------------------------------- */
      const llm = new ChatOpenAI({ model: "gpt-4o-mini", temperature: 0 });

      /* 2. Tools ------------------------------------------------------------ */
      const tools = [new TavilySearch({ maxResults: 3 })];

      /* 3. Prompt (must be ChatPromptTemplate) ------------------------------ */
      // Either pull a ready-made one…
      const prompt = await pull(
        "hwchase17/openai-tools-agent"
      );


      /* 4. Agent + executor ------------------------------------------------- */
      const agent = await createOpenAIToolsAgent({ llm, tools, prompt });
      return new AgentExecutor({ agent, tools });
    })();
  }
  return executorPromise;
}
