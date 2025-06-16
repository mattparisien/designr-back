class CSVChunkingService {
    constructor() {
        this.maxChunkSize = 1000; // Maximum characters per chunk
        this.minChunkSize = 100;  // Minimum characters per chunk
        this.overlapSize = 50;    // Character overlap between chunks
    }

    /**
     * Create chunks from CSV data for vectorization
     * @param {Object} csvData - Extracted CSV data from processing service
     * @param {string} assetId - Asset ID for reference
     * @returns {Array} Array of chunks ready for vectorization
     */
    async chunkCSVData(csvData, assetId) {
        try {
            const chunks = [];
            const { content, metadata } = csvData;

            // Create different types of chunks for comprehensive search
            
            // 1. Metadata and summary chunk
            chunks.push(...this.createMetadataChunks(metadata, assetId));
            
            // 2. Column-based chunks (schema and data type information)
            chunks.push(...this.createColumnChunks(content, metadata, assetId));
            
            // 3. Row-based chunks (actual data content)
            chunks.push(...this.createRowChunks(content, metadata, assetId));
            
            // 4. Statistical summary chunks
            chunks.push(...this.createStatisticalChunks(metadata, assetId));
            
            // 5. Sample data chunks for each column
            chunks.push(...this.createSampleDataChunks(content, metadata, assetId));

            console.log(`Created ${chunks.length} chunks for CSV asset ${assetId}`);
            return chunks;

        } catch (error) {
            console.error('Error chunking CSV data:', error);
            throw new Error(`CSV chunking failed: ${error.message}`);
        }
    }

    /**
     * Create metadata and summary chunks
     * @param {Object} metadata - CSV metadata
     * @param {string} assetId - Asset ID
     * @returns {Array} Metadata chunks
     */
    createMetadataChunks(metadata, assetId) {
        const chunks = [];
        
        // Overall file summary chunk
        const summaryText = `CSV File: ${metadata.fileName}
File Size: ${(metadata.fileSize / 1024).toFixed(2)} KB
Rows: ${metadata.rowCount}
Columns: ${metadata.columnCount}
Headers: ${metadata.headers.join(', ')}
Summary: ${metadata.extractedAt ? 'Processed on ' + new Date(metadata.extractedAt).toLocaleDateString() : ''}`;

        chunks.push({
            id: `${assetId}_metadata_summary`,
            assetId,
            type: 'csv_metadata',
            content: summaryText,
            metadata: {
                chunkType: 'summary',
                fileName: metadata.fileName,
                rowCount: metadata.rowCount,
                columnCount: metadata.columnCount,
                headers: metadata.headers
            },
            order: 0
        });

        return chunks;
    }

    /**
     * Create column-based chunks (schema information)
     * @param {Object} content - CSV content
     * @param {Object} metadata - CSV metadata
     * @param {string} assetId - Asset ID
     * @returns {Array} Column chunks
     */
    createColumnChunks(content, metadata, assetId) {
        const chunks = [];
        const { headers, columnStats } = metadata;

        headers.forEach((header, index) => {
            const stats = columnStats[header];
            const columnText = `Column: ${header}
Data Type: ${stats.dataType}
Fill Rate: ${stats.fillRate}%
Unique Values: ${stats.uniqueValues}
Sample Values: ${stats.sampleValues.join(', ')}
Missing Values: ${stats.nullCount} out of ${metadata.rowCount} rows`;

            chunks.push({
                id: `${assetId}_column_${index}`,
                assetId,
                type: 'csv_column',
                content: columnText,
                metadata: {
                    chunkType: 'column',
                    columnName: header,
                    columnIndex: index,
                    dataType: stats.dataType,
                    fillRate: parseFloat(stats.fillRate),
                    uniqueValues: stats.uniqueValues
                },
                order: index + 1
            });
        });

        return chunks;
    }

    /**
     * Create row-based chunks (actual data content)
     * @param {Object} content - CSV content
     * @param {Object} metadata - CSV metadata
     * @param {string} assetId - Asset ID
     * @returns {Array} Row chunks
     */
    createRowChunks(content, metadata, assetId) {
        const chunks = [];
        const { fullData, headers } = content;
        
        if (!fullData || fullData.length === 0) {
            return chunks;
        }

        // Group rows into chunks based on size
        let currentChunk = [];
        let currentSize = 0;
        let chunkIndex = 0;

        fullData.forEach((row, rowIndex) => {
            // Convert row to searchable text
            const rowText = headers.map(header => `${header}: ${row[header] || 'N/A'}`).join(' | ');
            const rowSize = rowText.length;

            // If adding this row would exceed chunk size, finalize current chunk
            if (currentSize + rowSize > this.maxChunkSize && currentChunk.length > 0) {
                chunks.push(this.createRowChunk(currentChunk, headers, assetId, chunkIndex));
                currentChunk = [];
                currentSize = 0;
                chunkIndex++;
            }

            currentChunk.push({ row, rowText, rowIndex });
            currentSize += rowSize;
        });

        // Add the last chunk if it has data
        if (currentChunk.length > 0) {
            chunks.push(this.createRowChunk(currentChunk, headers, assetId, chunkIndex));
        }

        return chunks;
    }

    /**
     * Create a single row chunk
     * @param {Array} rows - Array of row data
     * @param {Array} headers - Column headers
     * @param {string} assetId - Asset ID
     * @param {number} chunkIndex - Chunk index
     * @returns {Object} Row chunk
     */
    createRowChunk(rows, headers, assetId, chunkIndex) {
        const chunkText = rows.map(({ rowText }) => rowText).join('\n');
        const firstRowIndex = rows[0].rowIndex;
        const lastRowIndex = rows[rows.length - 1].rowIndex;

        return {
            id: `${assetId}_rows_${chunkIndex}`,
            assetId,
            type: 'csv_rows',
            content: chunkText,
            metadata: {
                chunkType: 'rows',
                rowRange: [firstRowIndex, lastRowIndex],
                rowCount: rows.length,
                headers: headers
            },
            order: 1000 + chunkIndex // Ensure row chunks come after column chunks
        };
    }

    /**
     * Create statistical summary chunks
     * @param {Object} metadata - CSV metadata
     * @param {string} assetId - Asset ID
     * @returns {Array} Statistical chunks
     */
    createStatisticalChunks(metadata, assetId) {
        const chunks = [];
        const { columnStats, headers, rowCount } = metadata;

        // Data quality summary
        const qualityStats = this.calculateDataQuality(columnStats, headers);
        const qualityText = `Data Quality Analysis:
Total Columns: ${headers.length}
High Quality Columns (>90% filled): ${qualityStats.highQuality.length} - ${qualityStats.highQuality.join(', ')}
Medium Quality Columns (50-90% filled): ${qualityStats.mediumQuality.length} - ${qualityStats.mediumQuality.join(', ')}
Low Quality Columns (<50% filled): ${qualityStats.lowQuality.length} - ${qualityStats.lowQuality.join(', ')}
Average Fill Rate: ${qualityStats.averageFillRate.toFixed(2)}%`;

        chunks.push({
            id: `${assetId}_stats_quality`,
            assetId,
            type: 'csv_statistics',
            content: qualityText,
            metadata: {
                chunkType: 'statistics',
                statisticType: 'data_quality',
                ...qualityStats
            },
            order: 500
        });

        // Data type distribution
        const typeDistribution = this.calculateTypeDistribution(columnStats);
        const typeText = `Data Type Distribution:
${Object.entries(typeDistribution).map(([type, count]) => `${type}: ${count} columns`).join('\n')}
Total Rows: ${rowCount}`;

        chunks.push({
            id: `${assetId}_stats_types`,
            assetId,
            type: 'csv_statistics',
            content: typeText,
            metadata: {
                chunkType: 'statistics',
                statisticType: 'data_types',
                typeDistribution
            },
            order: 501
        });

        return chunks;
    }

    /**
     * Create sample data chunks for each column
     * @param {Object} content - CSV content
     * @param {Object} metadata - CSV metadata
     * @param {string} assetId - Asset ID
     * @returns {Array} Sample data chunks
     */
    createSampleDataChunks(content, metadata, assetId) {
        const chunks = [];
        const { sampleData, headers } = content;
        const { columnStats } = metadata;

        headers.forEach((header, index) => {
            const samples = sampleData[header] || [];
            const stats = columnStats[header];
            
            if (samples.length > 0) {
                const sampleText = `Sample data for column "${header}":
Data Type: ${stats.dataType}
Sample Values: ${samples.join(', ')}
This column contains ${stats.dataType} data with ${stats.uniqueValues} unique values and ${stats.fillRate}% fill rate.`;

                chunks.push({
                    id: `${assetId}_samples_${index}`,
                    assetId,
                    type: 'csv_samples',
                    content: sampleText,
                    metadata: {
                        chunkType: 'samples',
                        columnName: header,
                        columnIndex: index,
                        sampleCount: samples.length,
                        dataType: stats.dataType
                    },
                    order: 2000 + index
                });
            }
        });

        return chunks;
    }

    /**
     * Calculate data quality metrics
     * @param {Object} columnStats - Column statistics
     * @param {Array} headers - Column headers
     * @returns {Object} Quality metrics
     */
    calculateDataQuality(columnStats, headers) {
        const highQuality = [];
        const mediumQuality = [];
        const lowQuality = [];
        let totalFillRate = 0;

        headers.forEach(header => {
            const fillRate = parseFloat(columnStats[header].fillRate);
            totalFillRate += fillRate;

            if (fillRate > 90) {
                highQuality.push(header);
            } else if (fillRate >= 50) {
                mediumQuality.push(header);
            } else {
                lowQuality.push(header);
            }
        });

        return {
            highQuality,
            mediumQuality,
            lowQuality,
            averageFillRate: totalFillRate / headers.length
        };
    }

    /**
     * Calculate data type distribution
     * @param {Object} columnStats - Column statistics
     * @returns {Object} Type distribution
     */
    calculateTypeDistribution(columnStats) {
        const distribution = {};
        
        Object.values(columnStats).forEach(stats => {
            const type = stats.dataType;
            distribution[type] = (distribution[type] || 0) + 1;
        });

        return distribution;
    }

    /**
     * Create chunks optimized for specific search scenarios
     * @param {Object} csvData - CSV data
     * @param {string} assetId - Asset ID
     * @param {string} searchType - Type of search optimization
     * @returns {Array} Optimized chunks
     */
    async createOptimizedChunks(csvData, assetId, searchType = 'general') {
        const baseChunks = await this.chunkCSVData(csvData, assetId);

        switch (searchType) {
            case 'schema':
                // Focus on column information and data types
                return baseChunks.filter(chunk => 
                    chunk.type === 'csv_column' || 
                    chunk.type === 'csv_metadata' ||
                    chunk.metadata.chunkType === 'statistics'
                );
            
            case 'content':
                // Focus on actual data values
                return baseChunks.filter(chunk => 
                    chunk.type === 'csv_rows' || 
                    chunk.type === 'csv_samples'
                );
            
            case 'analysis':
                // Focus on statistical and quality information
                return baseChunks.filter(chunk => 
                    chunk.type === 'csv_statistics' ||
                    chunk.metadata.chunkType === 'statistics'
                );
            
            default:
                return baseChunks;
        }
    }
}

export default new CSVChunkingService();
