const fs = require('fs');
const path = require('path');

// Create a simple test CSV file
const csvContent = `Name,Age,Department,Email
John Doe,30,Engineering,john@example.com
Jane Smith,25,Marketing,jane@example.com
Bob Johnson,35,Sales,bob@example.com`;

const testFilePath = path.join(__dirname, 'test-weather.csv');
fs.writeFileSync(testFilePath, csvContent);

console.log(`Test CSV file created at: ${testFilePath}`);
console.log('Content:');
console.log(csvContent);
