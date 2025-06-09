const fs = require('fs');
const path = require('path');

// Create a weather CSV file that matches the filename
const csvContent = `Date,Temperature,Humidity,Precipitation,Wind_Speed,Conditions
2012-01-14,32.5,65,0.0,12.3,Sunny
2012-01-15,28.1,72,0.2,8.7,Cloudy
2012-01-16,35.2,58,0.0,15.1,Clear
2012-01-17,29.8,68,1.5,10.2,Rain
2012-01-18,31.4,63,0.0,11.8,Partly Cloudy`;

const testFilePath = path.join(__dirname, 'weather-2012-01-14.csv');
fs.writeFileSync(testFilePath, csvContent);

console.log(`Test CSV file created at: ${testFilePath}`);
console.log('Content:');
console.log(csvContent);
