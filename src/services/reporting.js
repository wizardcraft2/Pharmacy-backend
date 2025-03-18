import nodemailer from 'nodemailer';
import { apiAnalytics } from './analytics';
import { abTesting } from './abTesting';
import { performanceBudget } from './performanceBudget';
import { dataExport } from './dataExport';
import logger from './logger';

class ReportingService {
  constructor() {
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT,
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    });

    this.scheduleReports();
  }

  async generateDailyReport() {
    const date = new Date();
    const yesterday = new Date(date.setDate(date.getDate() - 1));

    const [
      analytics,
      experiments,
      performance,
    ] = await Promise.all([
      apiAnalytics.getAnalytics({ startDate: yesterday }),
      Promise.all(Array.from(abTesting.experiments.keys()).map(name => 
        abTesting.getResults(name)
      )),
      performanceBudget.checkBudgets()
    ]);

    const report = {
      date: yesterday.toISOString().split('T')[0],
      analytics: {
        totalRequests: analytics.reduce((sum, a) => sum + a.count, 0),
        avgResponseTime: analytics.reduce((sum, a) => sum + a.avgResponseTime, 0) / analytics.length,
        errorRate: analytics.reduce((sum, a) => sum + a.errorCount, 0) / analytics.reduce((sum, a) => sum + a.count, 0),
        topEndpoints: analytics.slice(0, 5)
      },
      experiments: experiments.filter(Boolean).map(exp => ({
        name: exp.experiment.name,
        status: exp.experiment.status,
        results: exp.results
      })),
      performance: {
        violations: performance,
        status: performance.length === 0 ? 'healthy' : 'warning'
      }
    };

    return report;
  }

  async sendReport(report, recipients) {
    const attachments = [];

    // Generate Excel export
    const analyticsExport = await dataExport.exportAnalytics('excel', {
      startDate: new Date(report.date)
    });

    attachments.push({
      filename: `analytics-${report.date}.xlsx`,
      content: analyticsExport
    });

    const html = this.generateReportHtml(report);

    await this.transporter.sendMail({
      from: process.env.SMTP_FROM,
      to: recipients,
      subject: `Daily Report - ${report.date}`,
      html,
      attachments
    });
  }

  generateReportHtml(report) {
    return `
      <h1>Daily Report - ${report.date}</h1>
      
      <h2>Analytics Overview</h2>
      <ul>
        <li>Total Requests: ${report.analytics.totalRequests}</li>
        <li>Average Response Time: ${report.analytics.avgResponseTime.toFixed(2)}ms</li>
        <li>Error Rate: ${(report.analytics.errorRate * 100).toFixed(2)}%</li>
      </ul>

      <h2>Top Endpoints</h2>
      <table border="1">
        <tr>
          <th>Endpoint</th>
          <th>Requests</th>
          <th>Avg Response Time</th>
        </tr>
        ${report.analytics.topEndpoints.map(endpoint => `
          <tr>
            <td>${endpoint._id}</td>
            <td>${endpoint.count}</td>
            <td>${endpoint.avgResponseTime.toFixed(2)}ms</td>
          </tr>
        `).join('')}
      </table>

      <h2>A/B Test Results</h2>
      ${report.experiments.map(exp => `
        <h3>${exp.name}</h3>
        <p>Status: ${exp.status}</p>
        <pre>${JSON.stringify(exp.results, null, 2)}</pre>
      `).join('')}

      <h2>Performance Status: ${report.performance.status}</h2>
      ${report.performance.violations.length > 0 ? `
        <h3>Violations:</h3>
        <ul>
          ${report.performance.violations.map(v => `
            <li>${v.message}</li>
          `).join('')}
        </ul>
      ` : '<p>No performance violations detected.</p>'}
    `;
  }

  scheduleReports() {
    // Schedule daily report at 1 AM
    const schedule = require('node-schedule');
    
    schedule.scheduleJob('0 1 * * *', async () => {
      try {
        logger.info('Generating daily report...');
        const report = await this.generateDailyReport();
        await this.sendReport(report, process.env.REPORT_RECIPIENTS.split(','));
        logger.info('Daily report sent successfully');
      } catch (error) {
        logger.error('Error sending daily report:', error);
      }
    });
  }
}

export const reporting = new ReportingService(); 