const mongoose = require('mongoose');

// Test the new project API structure
async function testProjectAPIStructure() {
    try {
        console.log('🧪 Testing new Project API structure...\n');

        // Connect to MongoDB
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/canva-clone');
        console.log('✅ Connected to MongoDB');

        // Test create project structure
        const testProjectData = {
            title: 'Test Project',
            description: 'A test project to verify new API structure',
            type: 'presentation',
            ownerId: 'test-user-123',
            starred: false,
            tags: ['test', 'api'],
            layout: {
                pages: [
                    {
                        name: 'Page 1',
                        canvas: {
                            width: 1920,
                            height: 1080
                        },
                        elements: [],
                        background: {
                            type: 'color',
                            value: '#ffffff'
                        }
                    }
                ]
            }
        };

        console.log('\n📋 Test project data structure:');
        console.log(JSON.stringify(testProjectData, null, 2));

        // Test API call simulation
        console.log('\n🔄 Simulating API call...');
        const { layout: layoutPayload, ...meta } = testProjectData;

        console.log('\n✅ Layout payload extracted:');
        console.log('Layout:', JSON.stringify(layoutPayload, null, 2));

        console.log('\n✅ Project metadata extracted:');
        console.log('Meta:', JSON.stringify(meta, null, 2));

        console.log('\n🎯 Expected backend processing:');
        console.log('1. Create Layout document from layoutPayload');
        console.log('2. Create Project document with meta + layoutId');
        console.log('3. Optionally vectorize for template search');

        // Test required fields
        const requiredFields = ['title', 'ownerId'];
        const missingFields = requiredFields.filter(field => !meta[field]);
        
        if (missingFields.length > 0) {
            console.log(`\n❌ Missing required fields: ${missingFields.join(', ')}`);
        } else {
            console.log('\n✅ All required fields present');
        }

        // Test layout structure
        if (!layoutPayload || !layoutPayload.pages || !Array.isArray(layoutPayload.pages)) {
            console.log('\n❌ Invalid layout structure');
        } else {
            console.log('\n✅ Layout structure is valid');
            console.log(`   - ${layoutPayload.pages.length} page(s)`);
            layoutPayload.pages.forEach((page, index) => {
                console.log(`   - Page ${index + 1}: ${page.name || 'Unnamed'}`);
                console.log(`     Canvas: ${page.canvas?.width}x${page.canvas?.height}`);
                console.log(`     Elements: ${page.elements?.length || 0}`);
            });
        }

        console.log('\n🔧 API Structure Test Complete!');
        console.log('Frontend should send data in the format shown above.');
        console.log('Backend expects { layout: { pages: [...] }, title, ownerId, ... }');

    } catch (error) {
        console.error('\n❌ Test failed:', error.message);
    } finally {
        await mongoose.disconnect();
        console.log('\n📡 Disconnected from MongoDB');
    }
}

// Run if called directly
if (require.main === module) {
    require('dotenv').config();
    testProjectAPIStructure().catch(console.error);
}

module.exports = { testProjectAPIStructure };
