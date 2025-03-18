import { Parser } from 'json2csv';
import ExcelJS from 'exceljs';
import { apiAnalytics } from './analytics';
import { abTesting } from './abTesting';
import logger from './logger';

class DataExportService {
  async exportAnalytics(format, options = {}) {
    try {
      const data = await apiAnalytics.getAnalytics(options);
      return this.formatData(data, format);
    } catch (error) {
      logger.error('Error exporting analytics:', error);
      throw error;
    }
  }

  async exportExperiments(format, experimentName = null) {
    try {
      let data;
      if (experimentName) {
        data = await abTesting.getResults(experimentName);
      } else {
        data = await Promise.all(
          Array.from(abTesting.experiments.keys())
            .map(name => abTesting.getResults(name))
        );
      }
      return this.formatData(data, format);
    } catch (error) {
      logger.error('Error exporting experiments:', error);
      throw error;
    }
  }

  async formatData(data, format) {
    switch (format.toLowerCase()) {
      case 'csv':
        return this.toCSV(data);
      case 'excel':
        return this.toExcel(data);
      case 'json':
        return JSON.stringify(data, null, 2);
      default:
        throw new Error(`Unsupported format: ${format}`);
    }
  }

  async toCSV(data) {
    try {
      const parser = new Parser({
        flatten: true,
        flattenSeparator: '_'
      });
      return parser.parse(data);
    } catch (error) {
      logger.error('Error converting to CSV:', error);
      throw error;
    }
  }

  async toExcel(data) {
    try {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Data');

      // Convert data to array format for Excel
      const arrayData = this.flattenDataForExcel(data);

      // Add headers
      worksheet.addRow(Object.keys(arrayData[0]));

      // Add data
      arrayData.forEach(row => {
        worksheet.addRow(Object.values(row));
      });

      // Format cells
      worksheet.getRow(1).font = { bold: true };
      worksheet.columns.forEach(column => {
        column.width = 15;
      });

      return workbook.xlsx.writeBuffer();
    } catch (error) {
      logger.error('Error converting to Excel:', error);
      throw error;
    }
  }

  flattenDataForExcel(data, prefix = '') {
    if (!Array.isArray(data)) {
      data = [data];
    }

    return data.map(item => {
      const flattened = {};
      
      Object.entries(item).forEach(([key, value]) => {
        const fullKey = prefix ? `${prefix}_${key}` : key;
        
        if (value && typeof value === 'object' && !Array.isArray(value)) {
          Object.assign(flattened, this.flattenDataForExcel(value, fullKey));
        } else {
          flattened[fullKey] = Array.isArray(value) ? JSON.stringify(value) : value;
        }
      });

      return flattened;
    });
  }
}

export const dataExport = new DataExportService(); 