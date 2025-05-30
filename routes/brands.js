const express = require('express');
const router = express.Router();
const brandController = require('../controllers/brandController');

// Get all brands for a user
router.get('/', brandController.getBrands);

// Get a single brand by ID
router.get('/:id', brandController.getBrandById);

// Create a new brand
router.post('/', brandController.createBrand);

// Update a brand
router.put('/:id', brandController.updateBrand);

// Delete a brand
router.delete('/:id', brandController.deleteBrand);

// Generate a brand from uploaded assets
router.post('/generate', brandController.generateBrandFromAssets);

// Update a brand with a new asset
router.post('/:id/add-asset', brandController.updateBrandWithAsset);

// Share a brand with other users
router.post('/:id/share', brandController.shareBrand);

module.exports = router;