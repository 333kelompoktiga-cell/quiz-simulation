import express from 'express';
import {
  getPetaBelajarSummary,
  getRoadmapBab,
  regenerateRoadmapBab,
} from '../controllers/RoadmapController.js';
import { verifyLoggedIn } from '../middleware/verifyLoggedIn.js';
import { verifyMahasiswa } from '../middleware/verifyMahasiswa.js';

const router = express.Router();

router.use(verifyLoggedIn, verifyMahasiswa);

router.get('/', getPetaBelajarSummary);
router.get('/:idBab', getRoadmapBab);
router.post('/:idBab/regenerate', regenerateRoadmapBab);

export default router;

