import { Router } from 'express';
import {
  searchController,
  enrichController,
  searchCompleteController,
} from '../controllers/research.controller';

const router = Router();

// Phase 1: Scrape Google Maps for raw business listings
router.post('/search', searchController);

// Phase 2: Enrich raw leads with website discovery and contact extraction
router.post('/enrich', enrichController);

// One-shot end-to-end: scrape + enrich, streamed back as Server-Sent Events
router.post('/search-complete', searchCompleteController);

export default router;
