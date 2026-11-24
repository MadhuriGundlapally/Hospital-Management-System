const mongoose = require('mongoose');

const noteSchema = new mongoose.Schema(
  {
    doctor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    text: { type: String, required: true, trim: true, maxlength: 4000 },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

const patientSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    name: { type: String, required: true, trim: true },
    dateOfBirth: Date,
    gender: { type: String, enum: ['female', 'male', 'other'] },
    phone: { type: String, trim: true, maxlength: 30 },
    address: { type: String, trim: true, maxlength: 300 },
    notes: [noteSchema],
  },
  { timestamps: true }
);

module.exports = mongoose.model('Patient', patientSchema);
