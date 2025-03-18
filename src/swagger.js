import swaggerJsdoc from 'swagger-jsdoc';

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Pharmacy Wiki API',
      version: '1.0.0',
      description: 'API documentation for the Pharmacy Wiki application',
    },
    servers: [
      {
        url: process.env.API_URL || 'http://localhost:5000',
        description: 'Development server',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
      parameters: {
        apiVersion: {
          in: 'header',
          name: 'accept-version',
          schema: {
            type: 'string',
            example: '1.0.0',
          },
          required: true,
          description: 'API version requested',
        },
      },
    },
    tags: [
      { name: 'Drugs', description: 'Drug management endpoints' },
      { name: 'Manufacturers', description: 'Manufacturer management endpoints' },
      { name: 'Auth', description: 'Authentication endpoints' },
      { name: 'Dashboard', description: 'Dashboard and analytics endpoints' },
    ],
  },
  apis: ['./src/routes/*.js', './src/models/*.js'],
};

// Generate Swagger documentation for each version
const versions = ['1.0.0'];
export const specs = versions.reduce((acc, version) => {
  acc[version] = swaggerJsdoc({
    ...options,
    definition: {
      ...options.definition,
      info: {
        ...options.definition.info,
        version,
      },
    },
  });
  return acc;
}, {});