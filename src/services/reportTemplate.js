import mongoose from 'mongoose';
import Handlebars from 'handlebars';
import { dataExport } from './dataExport';
import logger from './logger';

class ReportTemplateService {
  constructor() {
    this.templates = new Map();
    this.registerHelpers();
    this.loadDefaultTemplates();
  }

  registerHelpers() {
    Handlebars.registerHelper('formatDate', (date) => {
      return new Date(date).toLocaleDateString();
    });

    Handlebars.registerHelper('formatNumber', (number) => {
      return new Intl.NumberFormat().format(number);
    });

    Handlebars.registerHelper('percentage', (value) => {
      return `${(value * 100).toFixed(2)}%`;
    });

    Handlebars.registerHelper('json', (context) => {
      return JSON.stringify(context, null, 2);
    });

    Handlebars.registerHelper('chart', (data, options) => {
      // Return placeholder for chart that will be rendered by frontend
      return `<div class="chart" data-type="${options.hash.type}" data-data='${JSON.stringify(data)}'></div>`;
    });
  }

  loadDefaultTemplates() {
    this.templates.set('daily', {
      name: 'Daily Report',
      subject: 'Daily Performance Report - {{formatDate date}}',
      html: `
        <h1>Daily Performance Report - {{formatDate date}}</h1>
        
        <h2>Overview</h2>
        <div class="metrics-grid">
          <div class="metric">
            <h3>Total Requests</h3>
            <p>{{formatNumber analytics.totalRequests}}</p>
          </div>
          <div class="metric">
            <h3>Average Response Time</h3>
            <p>{{analytics.avgResponseTime}}ms</p>
          </div>
          <div class="metric">
            <h3>Error Rate</h3>
            <p>{{percentage analytics.errorRate}}</p>
          </div>
        </div>

        {{#if performance.violations}}
        <h2>Performance Alerts</h2>
        <div class="alerts">
          {{#each performance.violations}}
            <div class="alert alert-{{level}}">
              <strong>{{type}}</strong>: {{message}}
            </div>
          {{/each}}
        </div>
        {{/if}}

        <h2>Top Endpoints</h2>
        {{{chart analytics.topEndpoints type="bar"}}}

        {{#if experiments}}
        <h2>Active Experiments</h2>
        {{#each experiments}}
          <h3>{{name}}</h3>
          <p>Status: {{status}}</p>
          {{{chart results type="line"}}}
        {{/each}}
        {{/if}}
      `
    });

    this.templates.set('weekly', {
      name: 'Weekly Summary',
      subject: 'Weekly Performance Summary - Week {{weekNumber}}',
      html: `
        <h1>Weekly Performance Summary</h1>
        <p>Week {{weekNumber}} ({{formatDate startDate}} - {{formatDate endDate}})</p>

        <h2>Performance Trends</h2>
        {{{chart weeklyTrends type="line"}}}

        <h2>Key Metrics</h2>
        <div class="metrics-comparison">
          <div class="current">
            <h3>This Week</h3>
            <ul>
              <li>Requests: {{formatNumber metrics.current.requests}}</li>
              <li>Avg Response: {{metrics.current.avgResponse}}ms</li>
              <li>Error Rate: {{percentage metrics.current.errorRate}}</li>
            </ul>
          </div>
          <div class="previous">
            <h3>Previous Week</h3>
            <ul>
              <li>Requests: {{formatNumber metrics.previous.requests}}</li>
              <li>Avg Response: {{metrics.previous.avgResponse}}ms</li>
              <li>Error Rate: {{percentage metrics.previous.errorRate}}</li>
            </ul>
          </div>
        </div>
      `
    });
  }

  async createTemplate(name, subject, html) {
    try {
      // Validate template syntax
      Handlebars.compile(html);
      
      const template = {
        name,
        subject,
        html,
        createdAt: new Date()
      };

      await mongoose.model('ReportTemplate').create(template);
      this.templates.set(name, template);

      return template;
    } catch (error) {
      logger.error('Error creating template:', error);
      throw error;
    }
  }

  async renderTemplate(templateName, data) {
    const template = this.templates.get(templateName);
    if (!template) {
      throw new Error(`Template not found: ${templateName}`);
    }

    try {
      const subjectTemplate = Handlebars.compile(template.subject);
      const bodyTemplate = Handlebars.compile(template.html);

      return {
        subject: subjectTemplate(data),
        html: bodyTemplate(data)
      };
    } catch (error) {
      logger.error('Error rendering template:', error);
      throw error;
    }
  }

  async getTemplates() {
    return Array.from(this.templates.values());
  }

  async deleteTemplate(name) {
    if (name === 'daily' || name === 'weekly') {
      throw new Error('Cannot delete default templates');
    }

    await mongoose.model('ReportTemplate').deleteOne({ name });
    this.templates.delete(name);
  }
}

export const reportTemplate = new ReportTemplateService(); 