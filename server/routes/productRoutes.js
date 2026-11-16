const express = require("express");

const {
  getProducts,
  createProduct,
  updateProduct,
} = require("../controllers/productController");
const { requireRole } = require("../middleware/auth");

const router = express.Router();

router.get("/", getProducts);
// Catalogue and pricing are managed by Owners and Admins
router.post("/", requireRole("Owner", "Admin"), createProduct);
router.patch("/:id", requireRole("Owner", "Admin"), updateProduct);

module.exports = router;
