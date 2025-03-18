import request from 'supertest';
import app from '../app';
import Manufacturer from '../models/Manufacturer';
import { generateToken } from '../utils/auth';

describe('Manufacturer API Endpoints', () => {
  let token;

  beforeEach(() => {
    token = generateToken({ role: 'admin' });
  });

  describe('GET /api/manufacturers', () => {
    it('should return list of manufacturers', async () => {
      await Manufacturer.create({
        name: 'Test Manufacturer',
        country: 'Test Country',
        website: 'http://test.com'
      });

      const res = await request(app)
        .get('/api/manufacturers')
        .expect(200);

      expect(res.body.manufacturers).toHaveLength(1);
      expect(res.body.manufacturers[0].name).toBe('Test Manufacturer');
    });

    it('should support search functionality', async () => {
      await Manufacturer.create([
        { name: 'ABC Pharma', country: 'USA' },
        { name: 'XYZ Pharma', country: 'UK' }
      ]);

      const res = await request(app)
        .get('/api/manufacturers/search?q=ABC')
        .expect(200);

      expect(res.body.manufacturers).toHaveLength(1);
      expect(res.body.manufacturers[0].name).toBe('ABC Pharma');
    });
  });

  describe('POST /api/manufacturers', () => {
    it('should create new manufacturer with valid token', async () => {
      const manufacturerData = {
        name: 'New Manufacturer',
        country: 'New Country',
        website: 'http://new.com'
      };

      const res = await request(app)
        .post('/api/manufacturers')
        .set('Authorization', `Bearer ${token}`)
        .send(manufacturerData)
        .expect(201);

      expect(res.body.name).toBe(manufacturerData.name);
    });

    it('should validate required fields', async () => {
      const res = await request(app)
        .post('/api/manufacturers')
        .set('Authorization', `Bearer ${token}`)
        .send({})
        .expect(400);

      expect(res.body.error).toBe('Validation Error');
    });
  });
});