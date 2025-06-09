const csv = require('csv-parser');
const fs = require('fs');
const path = require('path');
const axios = require('axios');

class CSVProcessingService {
    constructor() {
        this.tempDir = path.join(__dirname, '../temp-uploads');
        this.ensureTempDir();
    }

    ensureTempDir() {
        if (!fs.existsSync(this.tempDir)) {
            fs.mkdirSync(this.tempDir, { recursive: true });
        }
    }

    /**
     * Extract CSV data from file path or URL
     * @param {string} source - File path or URL to CSV
     * @returns {Promise<Object>} Extracted CSV data with metadata
     */
    async extractCSVData(source) {
        try {
            let filePath;
            let isTemporary = false;

            // Handle URL downloads
            if (source.startsWith('http://') || source.startsWith('https://')) {
                filePath = await this.downloadCSVFromURL(source);
                isTemporary = true;
            } else {
                filePath = source;
            }

            // Validate file exists
            if (!fs.existsSync(filePath)) {
                throw new Error(`CSV file not found: ${filePath}`);
            }

            const extractedData = await this.parseCSVFile(filePath);

            // Clean up temporary file
            if (isTemporary) {
                this.cleanupTempFile(filePath);
            }

            return extractedData;
        } catch (error) {
            console.error('Error extracting CSV data:', error);
            throw new Error(`CSV extraction failed: ${error.message}`);
        }
    }

    /**
     * Download CSV from URL
     * @param {string} url - URL to download CSV from
     * @returns {Promise<string>} Path to downloaded file
     */
    async downloadCSVFromURL(url) {
        try {
            const response = await axios({
                method: 'GET',
                url: url,
                responseType: 'stream',
                timeout: 30000, // 30 second timeout
                headers: {
                    'User-Agent': 'CSV-Processor/1.0'
                }
            });

            const fileName = `csv_${Date.now()}_${Math.random().toString(36).substring(7)}.csv`;
            const filePath = path.join(this.tempDir, fileName);
            const writer = fs.createWriteStream(filePath);

            response.data.pipe(writer);

            return new Promise((resolve, reject) => {
                writer.on('finish', () => resolve(filePath));
                writer.on('error', reject);
                response.data.on('error', reject);
            });
        } catch (error) {
            throw new Error(`Failed to download CSV from URL: ${error.message}`);
        }
    }

    /**
     * Parse CSV file and extract structured data
     * @param {string} filePath - Path to CSV file
     * @returns {Promise<Object>} Parsed CSV data with analysis
     */
    async parseCSVFile(filePath) {
        return new Promise((resolve, reject) => {
            const rows = [];
            let headers = [];
            let rowCount = 0;
            const columnStats = {};
            const sampleData = {};

            fs.createReadStream(filePath)
                .pipe(csv({
                    skipEmptyLines: true,
                    skipLinesWithError: true
                }))
                .on('headers', (headerList) => {
                    headers = headerList;
                    // Initialize column statistics
                    headers.forEach(header => {
                        columnStats[header] = {
                            dataType: 'unknown',
                            uniqueValues: new Set(),
                            nullCount: 0,
                            sampleValues: []
                        };
                        sampleData[header] = [];
                    });
                })
                .on('data', (row) => {
                    rows.push(row);
                    rowCount++;

                    // Analyze each column
                    headers.forEach(header => {
                        const value = row[header];
                        const stats = columnStats[header];

                        if (!value || value.trim() === '') {
                            stats.nullCount++;
                        } else {
                            stats.uniqueValues.add(value);
                            
                            // Collect sample values (max 10 per column)
                            if (stats.sampleValues.length < 10) {
                                stats.sampleValues.push(value);
                            }

                            // Store sample data for search (max 5 per column)
                            if (sampleData[header].length < 5) {
                                sampleData[header].push(value);
                            }

                            // Determine data type
                            if (stats.dataType === 'unknown') {
                                stats.dataType = this.inferDataType(value);
                            }
                        }
                    });
                })
                .on('end', () => {
                    // Finalize column statistics
                    Object.keys(columnStats).forEach(header => {
                        const stats = columnStats[header];
                        stats.uniqueValues = stats.uniqueValues.size;
                        stats.fillRate = ((rowCount - stats.nullCount) / rowCount * 100).toFixed(2);
                    });

                    const result = {
                        success: true,
                        metadata: {
                            fileName: path.basename(filePath),
                            fileSize: fs.statSync(filePath).size,
                            rowCount,
                            columnCount: headers.length,
                            headers,
                            columnStats,
                            extractedAt: new Date().toISOString()
                        },
                        content: {
                            headers,
                            sampleData,
                            fullData: rows.slice(0, 1000), // Limit to first 1000 rows for vectorization
                            summary: this.generateDataSummary(headers, columnStats, rowCount)
                        }
                    };

                    resolve(result);
                })
                .on('error', (error) => {
                    reject(new Error(`CSV parsing failed: ${error.message}`));
                });
        });
    }

    /**
     * Infer data type from value
     * @param {string} value - Value to analyze
     * @returns {string} Inferred data type
     */
    inferDataType(value) {
        const trimmed = value.trim();

        // Check for number
        if (!isNaN(trimmed) && !isNaN(parseFloat(trimmed))) {
            return trimmed.includes('.') ? 'float' : 'integer';
        }

        // Check for date
        const dateRegex = /^\d{4}-\d{2}-\d{2}$|^\d{2}\/\d{2}\/\d{4}$|^\d{2}-\d{2}-\d{4}$/;
        if (dateRegex.test(trimmed)) {
            return 'date';
        }

        // Check for boolean
        const lowerValue = trimmed.toLowerCase();
        if (['true', 'false', 'yes', 'no', '1', '0'].includes(lowerValue)) {
            return 'boolean';
        }

        // Check for email
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (emailRegex.test(trimmed)) {
            return 'email';
        }

        // Check for URL
        try {
            new URL(trimmed);
            return 'url';
        } catch {
            // Not a URL
        }

        return 'text';
    }

    /**
     * Generate a summary of the CSV data
     * @param {Array} headers - Column headers
     * @param {Object} columnStats - Statistics for each column
     * @param {number} rowCount - Total number of rows
     * @returns {string} Human-readable summary
     */
    generateDataSummary(headers, columnStats, rowCount) {
        let summary = `This CSV file contains ${rowCount} rows and ${headers.length} columns. `;
        
        const columnDescriptions = headers.map(header => {
            const stats = columnStats[header];
            return `${header} (${stats.dataType}, ${stats.fillRate}% filled, ${stats.uniqueValues} unique values)`;
        });

        summary += `The columns are: ${columnDescriptions.join(', ')}.`;
        
        // Add insights about data quality
        const highQualityColumns = headers.filter(h => parseFloat(columnStats[h].fillRate) > 90);
        const lowQualityColumns = headers.filter(h => parseFloat(columnStats[h].fillRate) < 50);
        
        if (highQualityColumns.length > 0) {
            summary += ` High-quality columns with >90% data: ${highQualityColumns.join(', ')}.`;
        }
        
        if (lowQualityColumns.length > 0) {
            summary += ` Columns with missing data (<50% filled): ${lowQualityColumns.join(', ')}.`;
        }

        return summary;
    }

    /**
     * Clean up temporary files
     * @param {string} filePath - Path to file to delete
     */
    cleanupTempFile(filePath) {
        try {
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
                console.log(`Cleaned up temporary file: ${filePath}`);
            }
        } catch (error) {
            console.error(`Error cleaning up temporary file ${filePath}:`, error);
        }
    }

    /**
     * Validate CSV file
     * @param {string} filePath - Path to CSV file
     * @returns {boolean} Whether file is valid CSV
     */
    async validateCSV(filePath) {
        try {
            const stats = fs.statSync(filePath);
            
            // Check file size (limit to 50MB)
            if (stats.size > 50 * 1024 * 1024) {
                throw new Error('CSV file too large (max 50MB)');
            }

            // Try to read first few lines to validate format
            const firstLines = await this.readFirstLines(filePath, 5);
            if (firstLines.length === 0) {
                throw new Error('CSV file appears to be empty');
            }

            return true;
        } catch (error) {
            throw new Error(`CSV validation failed: ${error.message}`);
        }
    }

    /**
     * Read first N lines of a file
     * @param {string} filePath - Path to file
     * @param {number} lineCount - Number of lines to read
     * @returns {Promise<Array>} Array of lines
     */
    readFirstLines(filePath, lineCount) {
        return new Promise((resolve, reject) => {
            const lines = [];
            const stream = fs.createReadStream(filePath);
            let data = '';
            let lineCounter = 0;

            stream.on('data', (chunk) => {
                data += chunk;
                const newLines = data.split('\n');
                
                while (newLines.length > 1 && lineCounter < lineCount) {
                    lines.push(newLines.shift());
                    lineCounter++;
                }
                
                data = newLines[0];
                
                if (lineCounter >= lineCount) {
                    stream.destroy();
                }
            });

            stream.on('end', () => {
                if (data && lineCounter < lineCount) {
                    lines.push(data);
                }
                resolve(lines);
            });

            stream.on('error', reject);
        });
    }
}

module.exports = new CSVProcessingService();
