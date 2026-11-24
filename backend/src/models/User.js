const mongoose = require('mongoose');

const ROLES = ['admin', 'doctor', 'patient'];

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 100 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: ROLES, default: 'patient', required: true },
    specialty: { type: String, trim: true, maxlength: 100 },
  },
  { timestamps: true }
);

userSchema.methods.toSafeJSON = function () {
  return { id: this._id.toString(), name: this.name, email: this.email, role: this.role, specialty: this.specialty };
};

module.exports = mongoose.model('User', userSchema);
module.exports.ROLES = ROLES;
