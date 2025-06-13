// Test runner for all agent tests
const { spawn } = require('child_process');
const path = require('path');

async function runTests() {
  console.log('🧪 Running comprehensive AI Agent test suite...\n');
  
  const testFiles = [
    'tests/agent/setup.js',
    'tests/agent/searchAssets.test.js', 
    'tests/agent/searchDocs.test.js',
    'tests/agent/analyzeImage.test.js',
    'tests/agent/tools/projects/createPresentation.test.js',
    'tests/agent/tools/projects/createSocialMedia.test.js',
    'tests/agent/tools/projects/createPrint.test.js',
    'tests/agent/tools/projects/createCustom.test.js',
    'tests/agent/tools/projects/listProjectTypes.test.js',
    'tests/agent/guardrails.test.js',
    'tests/agent/integration.test.js'
  ];

  console.log('Test files to run:');
  testFiles.forEach((file, index) => {
    console.log(`  ${index + 1}. ${file}`);
  });
  console.log();

  try {
    // Run Jest with specific test files
    const jestArgs = [
      '--testPathPattern=tests/agent',
      '--verbose',
      '--coverage',
      '--collectCoverageFrom=agent/**/*.js',
      '--collectCoverageFrom=services/projectAgentService.js',
      '--coverageDirectory=coverage/agent',
      '--coverageReporters=text',
      '--coverageReporters=html',
      '--forceExit'
    ];

    const jest = spawn('npx', ['jest', ...jestArgs], {
      stdio: 'inherit',
      cwd: process.cwd()
    });

    jest.on('close', (code) => {
      if (code === 0) {
        console.log('✅ All agent tests passed!');
        console.log('📊 Coverage report generated in coverage/agent/');
      } else {
        console.log('❌ Some tests failed');
        process.exit(code);
      }
    });

    jest.on('error', (error) => {
      console.error('❌ Error running tests:', error);
      process.exit(1);
    });

  } catch (error) {
    console.error('❌ Failed to run test suite:', error);
    process.exit(1);
  }
}

// Show test summary
function showTestSummary() {
  console.log('📋 AI Agent Test Suite Summary');
  console.log('===============================');
  console.log('🔍 Tool Tests:');
  console.log('  • Search Assets Tool');
  console.log('  • Search Documents Tool');
  console.log('  • Analyze Image Tool');
  console.log('  • Create Presentation Tool');
  console.log('  • Create Social Media Tool');
  console.log('  • Create Print Tool');
  console.log('  • Create Custom Project Tool');
  console.log('  • List Project Types Tool');
  console.log();
  console.log('🛡️  Guardrail Tests:');
  console.log('  • Project-Focused Topics Guardrail');
  console.log();
  console.log('🔧 Integration Tests:');
  console.log('  • Complete Agent Service');
  console.log('  • End-to-End Workflows');
  console.log('  • Error Handling');
  console.log('  • Performance Tests');
  console.log();
  console.log('📊 Coverage Areas:');
  console.log('  • Tool parameter validation');
  console.log('  • API integration');
  console.log('  • Error handling');
  console.log('  • Edge cases');
  console.log('  • Service initialization');
  console.log('  • Chat functionality');
  console.log();
}

if (require.main === module) {
  showTestSummary();
  runTests();
}

module.exports = { runTests, showTestSummary };
