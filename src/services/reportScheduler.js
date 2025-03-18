import schedule from 'node-schedule';
import { reporting } from './reporting';
import { reportTemplate } from './reportTemplate';
import logger from './logger';

class ReportSchedulerService {
  constructor() {
    this.jobs = new Map();
    this.loadScheduledReports();
  }

  async loadScheduledReports() {
    try {
      const scheduledReports = await mongoose.model('ScheduledReport').find({
        active: true
      });

      scheduledReports.forEach(report => {
        this.scheduleReport(report);
      });
    } catch (error) {
      logger.error('Error loading scheduled reports:', error);
    }
  }

  async createSchedule(options) {
    try {
      const scheduledReport = await mongoose.model('ScheduledReport').create({
        name: options.name,
        template: options.template,
        schedule: options.schedule,
        recipients: options.recipients,
        parameters: options.parameters,
        active: true,
        createdAt: new Date()
      });

      this.scheduleReport(scheduledReport);
      return scheduledReport;
    } catch (error) {
      logger.error('Error creating report schedule:', error);
      throw error;
    }
  }

  scheduleReport(report) {
    try {
      const job = schedule.scheduleJob(report.schedule, async () => {
        try {
          logger.info(`Running scheduled report: ${report.name}`);
          
          // Generate report data
          const data = await reporting.generateReport(report.parameters);
          
          // Render template
          const rendered = await reportTemplate.renderTemplate(report.template, data);
          
          // Send report
          await reporting.sendReport({
            ...rendered,
            recipients: report.recipients
          });

          // Update last run time
          await mongoose.model('ScheduledReport').findByIdAndUpdate(report._id, {
            lastRunAt: new Date(),
            $inc: { runCount: 1 }
          });

        } catch (error) {
          logger.error(`Error running scheduled report ${report.name}:`, error);
          
          // Update error status
          await mongoose.model('ScheduledReport').findByIdAndUpdate(report._id, {
            lastError: error.message,
            lastErrorAt: new Date()
          });
        }
      });

      this.jobs.set(report._id.toString(), job);
    } catch (error) {
      logger.error(`Error scheduling report ${report.name}:`, error);
    }
  }

  async updateSchedule(id, updates) {
    const report = await mongoose.model('ScheduledReport').findById(id);
    if (!report) {
      throw new Error('Scheduled report not found');
    }

    // Cancel existing job
    this.cancelSchedule(id);

    // Update report
    Object.assign(report, updates);
    await report.save();

    // Reschedule if active
    if (report.active) {
      this.scheduleReport(report);
    }

    return report;
  }

  async cancelSchedule(id) {
    const job = this.jobs.get(id);
    if (job) {
      job.cancel();
      this.jobs.delete(id);
    }

    await mongoose.model('ScheduledReport').findByIdAndUpdate(id, {
      active: false
    });
  }

  async listSchedules() {
    return mongoose.model('ScheduledReport')
      .find()
      .sort({ createdAt: -1 });
  }
}

export const reportScheduler = new ReportSchedulerService(); 