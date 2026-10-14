import { successResponse, errorResponse } from '../models/apiResponse.js';
import {
  getAllRoadmapsForUser,
  getRoadmapByBab,
  generateOrUpdateRoadmapBab,
} from '../services/roadmapService.js';

export const getPetaBelajarSummary = async (req, res) => {
  try {
    const data = await getAllRoadmapsForUser(req.currentUser.id);
    return res.json(successResponse({
      message: 'Berhasil memuat daftar peta belajar.',
      data,
    }));
  } catch (err) {
    console.error('[RoadmapController] getPetaBelajarSummary error:', err);
    return res.status(500).json(errorResponse({
      message: err.message || 'Gagal memuat daftar peta belajar.',
    }));
  }
};

export const getRoadmapBab = async (req, res) => {
  try {
    const { idBab } = req.params;
    const data = await getRoadmapByBab(req.currentUser.id, idBab);
    return res.json(successResponse({
      message: 'Berhasil memuat roadmap bab.',
      data,
    }));
  } catch (err) {
    console.error('[RoadmapController] getRoadmapBab error:', err);
    return res.status(500).json(errorResponse({
      message: err.message || 'Gagal memuat roadmap bab.',
    }));
  }
};

export const regenerateRoadmapBab = async (req, res) => {
  try {
    const { idBab } = req.params;
    const data = await generateOrUpdateRoadmapBab(req.currentUser.id, idBab);
    return res.json(successResponse({
      message: 'Berhasil memperbarui roadmap bab dari hasil kuis terbaru.',
      data,
    }));
  } catch (err) {
    console.error('[RoadmapController] regenerateRoadmapBab error:', err);
    return res.status(500).json(errorResponse({
      message: err.message || 'Gagal memperbarui roadmap bab.',
    }));
  }
};

