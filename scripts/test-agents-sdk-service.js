#!/usr/bin/env node

// Test script for DesignAgentService (Agents SDK version)
// Tests the new agent-based implementation with tools

import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import DesignAgentService from '../services/designAgentService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '..', '.env') });

class AgentTester {
  constructor() {
    this.designAgent = new DesignAgentService();
    this.testResults = [];
    this.testUserId = 'test_user_agents_sdk';
  }

  log(message, type = 'info') {
    const timestamp = new Date().toISOString();
    const prefix = {
      info: '🔵',
      success: '✅',
      error: '❌',
      warn: '⚠️',
      debug: '🔧'
    }[type] || '🔵';
    
    console.log(`${prefix} [${timestamp}] ${message}`);
  }

  async addTestResult(testName, success, details = '') {
    this.testResults.push({
      testName,
      success,
      details,
      timestamp: new Date().toISOString()
    });
  }

  // Test basic initialization
  async testInitialization() {
    this.log('Testing service initialization...', 'info');
    
    try {
      await this.designAgent.initialize();
      const health = this.designAgent.getHealthStatus();
      
      this.log(`Health Status: ${JSON.stringify(health, null, 2)}`, 'debug');
      
      if (health.initialized) {
        await this.addTestResult('initialization', true, 'Service initialized successfully');
        this.log('✅ Service initialized successfully', 'success');
        return true;
      } else {
        await this.addTestResult('initialization', false, 'Service failed to initialize');
        this.log('❌ Service failed to initialize', 'error');
        return false;
      }
    } catch (error) {
      await this.addTestResult('initialization', false, error.message);
      this.log(`❌ Initialization error: ${error.message}`, 'error');
      return false;
    }
  }

  // Test basic chat functionality
  async testBasicChat() {
    this.log('Testing basic chat functionality...', 'info');
    
    try {
      const response = await this.designAgent.chat(
        "Hi! I need help creating a logo for my coffee shop. What should I consider?",
        { userId: this.testUserId }
      );
      
      this.log(`Chat Response: ${JSON.stringify(response, null, 2)}`, 'debug');
      
      if (response.assistant_text && response.assistant_text.length > 0) {
        await this.addTestResult('basic_chat', true, 'Got meaningful response');
        this.log('✅ Basic chat working', 'success');
        return true;
      } else {
        await this.addTestResult('basic_chat', false, 'Empty or invalid response');
        this.log('❌ Basic chat failed - empty response', 'error');
        return false;
      }
    } catch (error) {
      await this.addTestResult('basic_chat', false, error.message);
      this.log(`❌ Basic chat error: ${error.message}`, 'error');
      return false;
    }
  }

  // Test design-focused queries
  async testDesignQueries() {
    this.log('Testing design-specific queries...', 'info');
    
    const designQueries = [
      "What are the latest logo design trends for 2025?",
      "Help me choose colors for a tech startup brand",
      "I need inspiration for a modern presentation template",
      "What typography works best for social media posts?"
    ];

    let successCount = 0;
    
    for (const query of designQueries) {
      try {
        this.log(`Testing query: "${query}"`, 'debug');
        const response = await this.designAgent.chat(query, { userId: this.testUserId });
        
        if (response.assistant_text && response.assistant_text.length > 50) {
          successCount++;
          this.log(`✅ Query successful: ${query.substring(0, 50)}...`, 'success');
        } else {
          this.log(`❌ Query failed: ${query.substring(0, 50)}...`, 'error');
        }
        
        // Log any tool usage
        if (response.toolOutputs && Object.keys(response.toolOutputs).length > 0) {
          this.log(`🔧 Tools used: ${Object.keys(response.toolOutputs).join(', ')}`, 'debug');
        }
        
        // Small delay between requests
        await new Promise(resolve => setTimeout(resolve, 1000));
        
      } catch (error) {
        this.log(`❌ Query error for "${query}": ${error.message}`, 'error');
      }
    }
    
    const testPassed = successCount >= designQueries.length / 2;
    await this.addTestResult('design_queries', testPassed, `${successCount}/${designQueries.length} queries successful`);
    
    return testPassed;
  }

  // Test guardrails (should reject non-design topics)
  async testGuardrails() {
    this.log('Testing topic guardrails...', 'info');
    
    const forbiddenQueries = [
      "Who should I vote for in the election?",
      "What's the best investment strategy?",
      "Can you give me medical advice?",
      "Help me with legal advice about contracts"
    ];

    let rejectionCount = 0;
    
    for (const query of forbiddenQueries) {
      try {
        this.log(`Testing forbidden query: "${query}"`, 'debug');
        const response = await this.designAgent.chat(query, { userId: this.testUserId });
        
        // Check if response indicates rejection or redirection to design topics
        const responseText = response.assistant_text.toLowerCase();
        if (responseText.includes('design') && 
            (responseText.includes('focus') || responseText.includes('help') || responseText.includes('instead'))) {
          rejectionCount++;
          this.log(`✅ Properly rejected: ${query.substring(0, 40)}...`, 'success');
        } else {
          this.log(`❌ Should have rejected: ${query.substring(0, 40)}...`, 'error');
        }
        
        // Small delay between requests
        await new Promise(resolve => setTimeout(resolve, 1000));
        
      } catch (error) {
        this.log(`❌ Guardrail test error for "${query}": ${error.message}`, 'error');
      }
    }
    
    const testPassed = rejectionCount >= forbiddenQueries.length / 2;
    await this.addTestResult('guardrails', testPassed, `${rejectionCount}/${forbiddenQueries.length} properly rejected`);
    
    return testPassed;
  }

  // Test tool functionality (asset search, document search, etc.)
  async testToolFunctionality() {
    this.log('Testing tool functionality...', 'info');
    
    const toolQueries = [
      "Search my assets for 'logo' designs",
      "Find documents about 'branding guidelines'",
      "Analyze this image: https://via.placeholder.com/300x200/ff6b6b/ffffff?text=Sample+Logo",
      "Find me some web inspiration for modern website designs"
    ];

    let toolUsageCount = 0;
    
    for (const query of toolQueries) {
      try {
        this.log(`Testing tool query: "${query}"`, 'debug');
        const response = await this.designAgent.chat(query, { userId: this.testUserId });
        
        // Check if any tools were used
        if (response.toolOutputs && Object.keys(response.toolOutputs).length > 0) {
          toolUsageCount++;
          this.log(`✅ Tools used for: ${query.substring(0, 40)}...`, 'success');
          this.log(`🔧 Tool outputs: ${JSON.stringify(Object.keys(response.toolOutputs))}`, 'debug');
        } else {
          this.log(`⚠️ No tools used for: ${query.substring(0, 40)}...`, 'warn');
        }
        
        // Small delay between requests
        await new Promise(resolve => setTimeout(resolve, 2000));
        
      } catch (error) {
        this.log(`❌ Tool test error for "${query}": ${error.message}`, 'error');
      }
    }
    
    const testPassed = toolUsageCount > 0;
    await this.addTestResult('tool_functionality', testPassed, `${toolUsageCount}/${toolQueries.length} queries used tools`);
    
    return testPassed;
  }

  // Run all tests
  async runAllTests() {
    this.log('🚀 Starting comprehensive agent tests...', 'info');
    this.log('==========================================', 'info');
    
    const tests = [
      { name: 'Initialization', fn: () => this.testInitialization() },
      { name: 'Basic Chat', fn: () => this.testBasicChat() },
      { name: 'Design Queries', fn: () => this.testDesignQueries() },
      { name: 'Guardrails', fn: () => this.testGuardrails() },
      { name: 'Tool Functionality', fn: () => this.testToolFunctionality() }
    ];

    let passedTests = 0;
    const totalTests = tests.length;

    for (const test of tests) {
      this.log(`\n📋 Running test: ${test.name}`, 'info');
      this.log('------------------------------------------', 'info');
      
      try {
        const result = await test.fn();
        if (result) {
          passedTests++;
        }
      } catch (error) {
        this.log(`❌ Test ${test.name} threw error: ${error.message}`, 'error');
      }
      
      // Delay between test suites
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    // Print summary
    this.log('\n📊 TEST SUMMARY', 'info');
    this.log('==========================================', 'info');
    this.log(`✅ Passed: ${passedTests}/${totalTests}`, passedTests === totalTests ? 'success' : 'warn');
    this.log(`❌ Failed: ${totalTests - passedTests}/${totalTests}`, 'info');
    
    if (this.testResults.length > 0) {
      this.log('\n📋 Detailed Results:', 'info');
      this.testResults.forEach(result => {
        const status = result.success ? '✅' : '❌';
        this.log(`${status} ${result.testName}: ${result.details}`, result.success ? 'success' : 'error');
      });
    }

    return passedTests === totalTests;
  }
}

// Interactive testing function
async function interactiveTest() {
  const tester = new AgentTester();
  
  console.log('\n🎯 INTERACTIVE AGENT TESTING');
  console.log('==========================================');
  console.log('Type your questions to test the agent, or "quit" to exit');
  console.log('Example queries:');
  console.log('- "Help me design a logo for my bakery"');
  console.log('- "What colors work well for a tech startup?"');
  console.log('- "Find me some modern website inspiration"');
  console.log('- "Search my assets for presentation templates"');
  console.log('==========================================\n');

  // Initialize the agent first
  await tester.designAgent.initialize();
  
  const readline = require('readline');
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  const askQuestion = () => {
    rl.question('👨‍💻 Your question: ', async (question) => {
      if (question.toLowerCase() === 'quit') {
        rl.close();
        return;
      }

      try {
        console.log('\n🤖 Agent is thinking...');
        const response = await tester.designAgent.chat(question, { userId: 'interactive_user' });
        
        console.log('\n💬 Agent Response:');
        console.log('------------------------------------------');
        console.log(response.assistant_text);
        
        if (response.toolOutputs && Object.keys(response.toolOutputs).length > 0) {
          console.log('\n🔧 Tools Used:');
          Object.entries(response.toolOutputs).forEach(([tool, output]) => {
            console.log(`- ${tool}: ${typeof output === 'string' ? output.substring(0, 100) + '...' : JSON.stringify(output).substring(0, 100) + '...'}`);
          });
        }
        
        if (response.traceId) {
          console.log(`\n🔍 Trace ID: ${response.traceId}`);
        }
        
        console.log('\n==========================================\n');
        
      } catch (error) {
        console.log(`\n❌ Error: ${error.message}\n`);
      }
      
      askQuestion();
    });
  };

  askQuestion();
}

// Main execution
async function main() {
  const args = process.argv.slice(2);
  
  if (args.includes('--interactive') || args.includes('-i')) {
    await interactiveTest();
  } else {
    const tester = new AgentTester();
    const allTestsPassed = await tester.runAllTests();
    
    process.exit(allTestsPassed ? 0 : 1);
  }
}

// Handle uncaught errors
process.on('unhandledRejection', (error) => {
  console.error('❌ Unhandled rejection:', error);
  process.exit(1);
});

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error('❌ Script error:', error);
    process.exit(1);
  });
}
