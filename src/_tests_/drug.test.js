import request from 'supertest';
import app from '../app';
import Drug from '../models/Drug';
import Manufacturer from '../models/Manufacturer';
import { generateToken } from '../utils/auth';

describe('Drug API Endpoints', () => {
  let token;
  let manufacturer;

  beforeEach(async () => {
    // Create test manufacturer
    manufacturer = await Manufacturer.create({
      name: 'Test Manufacturer',
      country: 'Test Country'
    });

    // Generate admin token
    token = generateToken({ role: 'admin' });
  });

  describe('GET /api/drugs', () => {
    it('should return list of drugs', async () => {
      await Drug.create({
        tradeName: 'Test Drug',
        activeIngredient: 'Test Ingredient',
        manufacturer: manufacturer._id
      });

      const res = await request(app)
        .get('/api/drugs')
        .expect(200);

      expect(res.body.drugs).toHaveLength(1);
      expect(res.body.drugs[0].tradeName).toBe('Test Drug');
    });

    it('should support pagination', async () => {
      // Create 15 test drugs
      const drugs = Array(15).fill().map((_, i) => ({
        tradeName: `Test Drug ${i}`,
        activeIngredient: 'Test Ingredient',
        manufacturer: manufacturer._id
      }));
      await Drug.insertMany(drugs);

      const res = await request(app)
        .get('/api/drugs?page=2&limit=10')
        .expect(200);

      expect(res.body.drugs).toHaveLength(5);
      expect(res.body.totalPages).toBe(2);
    });
  });

  describe('POST /api/drugs', () => {
    it('should create new drug with valid token', async () => {
      const drugData = {
        tradeName: 'New Drug',
        activeIngredient: 'New Ingredient',
        manufacturer: manufacturer._id
      };

      const res = await request(app)
        .post('/api/drugs')
        .set('Authorization', `Bearer ${token}`)
        .send(drugData)
        .expect(201);

      expect(res.body.tradeName).toBe(drugData.tradeName);
    });

    it('should reject creation without token', async () => {
      const drugData = {
        tradeName: 'New Drug',
        activeIngredient: 'New Ingredient',
        manufacturer: manufacturer._id
      };

      await request(app)
        .post('/api/drugs')
        .send(drugData)
        .expect(401);
    });
  });
});