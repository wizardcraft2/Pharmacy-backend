import axios from 'axios';
import nodemailer from 'nodemailer';
import { WebClient } from '@slack/web-api';
import logger from './logger';

class DeliveryChannelService {
  constructor() {
    this.channels = new Map();
    this.initializeChannels();
  }

  initializeChannels() {
    // Email channel
    this.channels.set('email', {
      name: 'Email',
      send: this.sendEmail.bind(this),
      validate: this.validateEmailConfig.bind(this)
    });

    // Slack channel
    this.channels.set('slack', {
      name: 'Slack',
      send: this.sendSlack.bind(this),
      validate: this.validateSlackConfig.bind(this)
    });

    // Microsoft Teams channel
    this.channels.set('teams', {
      name: 'Microsoft Teams',
      send: this.sendTeams.bind(this),
      validate: this.validateTeamsConfig.bind(this)
    });

    // Webhook channel
    this.channels.set('webhook', {
      name: 'Webhook',
      send: this.sendWebhook.bind(this),
      validate: this.validateWebhookConfig.bind(this)
    });
  }

  async sendEmail(content, config) {
    const transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth: {
        user: config.user,
        pass: config.password
      }
    });

    const info = await transporter.sendMail({
      from: config.from,
      to: config.to,
      subject: content.subject,
      html: content.html,
      attachments: content.attachments
    });

    return {
      messageId: info.messageId,
      channel: 'email'
    };
  }

  async sendSlack(content, config) {
    const slack = new WebClient(config.token);
    
    const blocks = [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: content.subject
        }
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: content.text || content.html.replace(/<[^>]*>/g, '')
        }
      }
    ];

    const result = await slack.chat.postMessage({
      channel: config.channel,
      blocks,
      text: content.subject
    });

    return {
      messageId: result.ts,
      channel: 'slack'
    };
  }

  async sendTeams(content, config) {
    const message = {
      "@type": "MessageCard",
      "@context": "http://schema.org/extensions",
      "summary": content.subject,
      "themeColor": "0072C6",
      "title": content.subject,
      "sections": [
        {
          "text": content.text || content.html.replace(/<[^>]*>/g, '')
        }
      ]
    };

    const response = await axios.post(config.webhookUrl, message);
    
    return {
      messageId: response.headers['x-ms-request-id'],
      channel: 'teams'
    };
  }

  async sendWebhook(content, config) {
    const response = await axios({
      method: config.method || 'POST',
      url: config.url,
      headers: config.headers,
      data: {
        subject: content.subject,
        content: content.html,
        text: content.text,
        metadata: content.metadata
      }
    });

    return {
      messageId: response.headers['x-request-id'],
      channel: 'webhook'
    };
  }

  validateEmailConfig(config) {
    const required = ['host', 'port', 'user', 'password', 'from'];
    return this.validateConfig(config, required);
  }

  validateSlackConfig(config) {
    const required = ['token', 'channel'];
    return this.validateConfig(config, required);
  }

  validateTeamsConfig(config) {
    const required = ['webhookUrl'];
    return this.validateConfig(config, required);
  }

  validateWebhookConfig(config) {
    const required = ['url'];
    return this.validateConfig(config, required);
  }

  validateConfig(config, required) {
    const missing = required.filter(field => !config[field]);
    if (missing.length > 0) {
      throw new Error(`Missing required fields: ${missing.join(', ')}`);
    }
    return true;
  }

  async send(channelType, content, config) {
    const channel = this.channels.get(channelType);
    if (!channel) {
      throw new Error(`Unsupported delivery channel: ${channelType}`);
    }

    try {
      channel.validate(config);
      return await channel.send(content, config);
    } catch (error) {
      logger.error(`Error sending through ${channelType}:`, error);
      throw error;
    }
  }

  getAvailableChannels() {
    return Array.from(this.channels.keys());
  }
}

export const deliveryChannel = new DeliveryChannelService(); 