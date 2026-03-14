const express = require('express');
const multer = require('multer');
const path = require('path');
const { db } = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth');
const { createAuditLog } = require('../utils/audit');

const router = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, process.env.UPLOAD_DIR || './uploads');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});
const upload = multer({
  storage,
  limits: { fileSize: parseInt(process.env.MAX_FILE_SIZE || '10485760') },
});

/** GET /api/documents/:applicationId - List documents for an application */
router.get('/:applicationId', authenticate, async (req, res) => {
  try {
    const documents = await db('documents')
      .leftJoin('users', 'documents.uploaded_by', 'users.id')
      .where('documents.application_id', req.params.applicationId)
      .select('documents.*', 'users.first_name as uploader_first_name', 'users.last_name as uploader_last_name');
    res.json(documents);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch documents' });
  }
});

/** POST /api/documents/:applicationId - Upload a document */
router.post('/:applicationId', authenticate, upload.single('file'), async (req, res) => {
  try {
    const [document] = await db('documents').insert({
      application_id: parseInt(req.params.applicationId),
      borrower_id: req.body.borrower_id || null,
      condition_id: req.body.condition_id || null,
      name: req.body.name || (req.file ? req.file.originalname : 'Untitled'),
      category: req.body.category || 'other',
      file_path: req.file ? req.file.path : `mock://uploads/${Date.now()}.pdf`,
      file_type: req.file ? req.file.mimetype : req.body.file_type || 'application/pdf',
      file_size: req.file ? req.file.size : 0,
      uploaded_by: req.user.id,
      status: 'uploaded',
      notes: req.body.notes || null,
    }).returning('*');

    await createAuditLog({
      userId: req.user.id,
      action: 'document_uploaded',
      entityType: 'document',
      entityId: document.id,
      details: { applicationId: req.params.applicationId, name: document.name, category: document.category },
    });

    res.status(201).json(document);
  } catch (error) {
    console.error('Document upload error:', error);
    res.status(500).json({ error: 'Failed to upload document' });
  }
});

/** PUT /api/documents/:id/review - Review/accept/reject a document */
router.put('/:id/review', authenticate, authorize('loan_officer', 'underwriter', 'branch_manager', 'system_admin'), async (req, res) => {
  try {
    const { status, notes } = req.body;
    if (!['reviewed', 'accepted', 'rejected'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    const [document] = await db('documents').where('id', req.params.id).update({ status, notes, updated_at: new Date() }).returning('*');
    if (!document) return res.status(404).json({ error: 'Document not found' });

    await createAuditLog({
      userId: req.user.id,
      action: 'document_reviewed',
      entityType: 'document',
      entityId: parseInt(req.params.id),
      details: { status, notes },
    });

    res.json(document);
  } catch (error) {
    res.status(500).json({ error: 'Failed to review document' });
  }
});

module.exports = router;
