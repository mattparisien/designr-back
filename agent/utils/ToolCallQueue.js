// utils/toolCallQueue.js
// Handle multiple tool calls sequentially to avoid hosted/local tool conflicts

class ToolCallQueue {
  constructor() {
    this.queue = [];
    this.isProcessing = false;
  }

  /**
   * Add a tool call to the queue
   * @param {Function} toolCall - The tool call function
   * @param {string} toolName - Name of the tool for logging
   */
  async enqueue(toolCall, toolName) {
    return new Promise((resolve, reject) => {
      this.queue.push({
        toolCall,
        toolName,
        resolve,
        reject
      });
      
      // Start processing if not already processing
      if (!this.isProcessing) {
        this.process();
      }
    });
  }

  /**
   * Process the queue sequentially
   */
  async process() {
    if (this.isProcessing || this.queue.length === 0) {
      return;
    }

    this.isProcessing = true;
    console.log(`🔧 Processing ${this.queue.length} tool calls sequentially...`);

    while (this.queue.length > 0) {
      const { toolCall, toolName, resolve, reject } = this.queue.shift();
      
      try {
        console.log(`🔧 Executing tool: ${toolName}`);
        const result = await toolCall();
        console.log(`✅ Tool completed: ${toolName}`);
        
        // Add a small delay between tool calls to avoid race conditions
        await new Promise(resolve => setTimeout(resolve, 100));
        
        resolve(result);
      } catch (error) {
        console.error(`❌ Tool failed: ${toolName}`, error.message);
        reject(error);
      }
    }

    this.isProcessing = false;
    console.log('🔧 Tool queue processing complete');
  }

  /**
   * Get queue status
   */
  getStatus() {
    return {
      queueLength: this.queue.length,
      isProcessing: this.isProcessing
    };
  }
}

// Export singleton instance
module.exports = new ToolCallQueue();