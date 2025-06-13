// Test setup for agent tests
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

let mongoServer;

// Mock services for testing
const mockVectorStore = {
  searchAssets: jest.fn(),
  searchDocuments: jest.fn(),
  searchDocumentChunks: jest.fn(),
  addDocument: jest.fn(),
  addAsset: jest.fn(),
  initialize: jest.fn()
};

const mockImageAnalysis = {
  analyzeImage: jest.fn(),
  extractColors: jest.fn(),
  detectObjects: jest.fn(),
  initialize: jest.fn()
};

// Mock HTTP responses for project creation
const mockFetchJson = jest.fn();

// Mock the OpenAI agents ES modules that are dynamically imported
const mockAgent = jest.fn();
const mockRun = jest.fn();
const mockTool = jest.fn();
const mockWebSearchTool = jest.fn();
const mockUser = jest.fn();
const mockAssistant = jest.fn();
const mockSystem = jest.fn();
const mockZ = {
  object: jest.fn().mockReturnValue({
    describe: jest.fn().mockReturnThis(),
    default: jest.fn().mockReturnThis(),
    min: jest.fn().mockReturnThis(),
    max: jest.fn().mockReturnThis(),
    int: jest.fn().mockReturnThis(),
    enum: jest.fn().mockReturnThis()
  }),
  string: jest.fn().mockReturnValue({
    describe: jest.fn().mockReturnThis(),
    default: jest.fn().mockReturnThis()
  }),
  number: jest.fn().mockReturnValue({
    describe: jest.fn().mockReturnThis(),
    default: jest.fn().mockReturnThis(),
    min: jest.fn().mockReturnThis(),
    max: jest.fn().mockReturnThis(),
    int: jest.fn().mockReturnThis()
  }),
  enum: jest.fn().mockReturnValue({
    describe: jest.fn().mockReturnThis(),
    default: jest.fn().mockReturnThis()
  })
};

class MockRunToolCallOutputItem {
  constructor(rawItem, output) {
    this.rawItem = rawItem || { status: 'completed', name: 'test_tool' };
    this.output = output || '{}';
  }
}

// Mock the dynamic imports function
jest.mock('../../utils/dynamicImports', () => ({
  requireDynamic: jest.fn().mockResolvedValue({
    Agent: mockAgent,
    run: mockRun,
    tool: mockTool,
    webSearchTool: mockWebSearchTool,
    z: mockZ,
    RunToolCallOutputItem: MockRunToolCallOutputItem,
    user: mockUser,
    assistant: mockAssistant,
    system: mockSystem
  })
}));

// Mock the fetchJson utility
jest.mock('../../utils/fetchJson', () => ({
  fetchJson: mockFetchJson
}));

// Mock the vector store service
jest.mock('../../services/vectorStore', () => mockVectorStore);

// Mock the image analysis service
jest.mock('../../services/imageAnalysisService', () => mockImageAnalysis);

// Setup before all tests
beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const mongoUri = mongoServer.getUri();
  await mongoose.connect(mongoUri);
});

// Cleanup after all tests
afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

// Clear database between tests
beforeEach(async () => {
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    const collection = collections[key];
    await collection.deleteMany({});
  }
  
  // Reset all mocks
  jest.clearAllMocks();
  mockVectorStore.searchAssets.mockClear();
  mockVectorStore.searchDocuments.mockClear();
  mockVectorStore.searchDocumentChunks.mockClear();
  mockImageAnalysis.analyzeImage.mockClear();
  mockFetchJson.mockClear();
  
  // Reset agent mocks
  mockAgent.mockClear();
  mockRun.mockClear();
  mockTool.mockClear();
  mockWebSearchTool.mockClear();
  mockUser.mockClear();
  mockAssistant.mockClear();
  mockSystem.mockClear();
});

module.exports = {
  mockVectorStore,
  mockImageAnalysis,
  mockFetchJson,
  mockAgent,
  mockRun,
  mockTool,
  mockWebSearchTool,
  mockZ,
  MockRunToolCallOutputItem,
  mockUser,
  mockAssistant,
  mockSystem
};