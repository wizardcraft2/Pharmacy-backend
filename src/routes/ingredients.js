import express from 'express';
import { getData } from '../controllers/ingredients.controller.js';
var router = express.Router();
router.get('/get-data', async function (req, res, next) {
    await getData(req, res);
});
export default router;