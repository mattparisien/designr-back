// utils/ToolCallQueue.ts
// Handle multiple tool calls sequentially to avoid hosted/local tool conflicts

export interface ToolCallItem {
  toolCall: () => Promise<any>;
  toolName: string;
  resolve: (value: any) => void;
  reject: (reason?: any) => void;
}

export class ToolCallQueue {
  private queue: ToolCallItem[] = [];
  private isProcessing = false;

  async enqueue(toolCall: () => Promise<any>, toolName: string): Promise<any> {
    return new Promise((resolve, reject) => {
      this.queue.push({ toolCall, toolName, resolve, reject });
      if (!this.isProcessing) {
        void this.process();
      }
    });
  }

  private async process(): Promise<void> {
    if (this.isProcessing || this.queue.length === 0) {
      return;
    }
    this.isProcessing = true;
    console.log(`🔧 Processing ${this.queue.length} tool calls sequentially...`);
    while (this.queue.length > 0) {
      const { toolCall, toolName, resolve, reject } = this.queue.shift()!;
      try {
        console.log(`🔧 Executing tool: ${toolName}`);
        const result = await toolCall();
        console.log(`✅ Tool completed: ${toolName}`);
        await new Promise((r) => setTimeout(r, 100));
        resolve(result);
      } catch (error) {
        console.error(`❌ Tool failed: ${toolName}`, (error as Error).message);
        reject(error);
      }
    }
    this.isProcessing = false;
    console.log('🔧 Tool queue processing complete');
  }

  getStatus() {
    return { queueLength: this.queue.length, isProcessing: this.isProcessing };
  }
}

// Export singleton instance
const instance = new ToolCallQueue();
export default instance;
