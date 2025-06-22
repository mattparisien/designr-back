// agents/getAgentExecutor.ts
import { ChatOpenAI } from "@langchain/openai";
import { createOpenAIToolsAgent, AgentExecutor } from "langchain/agents";
import { TavilySearch } from "@langchain/tavily";
import { pull } from "langchain/hub";
import { ChatPromptTemplate } from "@langchain/core/prompts";   // ✅

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

      // …or craft your own quickly:
      // const prompt = ChatPromptTemplate.fromMessages([
      //   ["system", "You are a helpful assistant."],
      //   MessagesPlaceholder("agent_scratchpad"),   // required
      // ]);

      /* 4. Agent + executor ------------------------------------------------- */
      const agent = await createOpenAIToolsAgent({ llm, tools, prompt });
      return new AgentExecutor({ agent, tools });
    })();
  }
  return executorPromise;
}
