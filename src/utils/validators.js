function isEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function validateTask(body, partial = false) {
  const errors = [];
  if (!partial && (!body.title || body.title.trim().length < 3)) {
    errors.push('Title must be at least 3 characters.');
  }
  if (body.title !== undefined && body.title.trim().length < 3) {
    errors.push('Title must be at least 3 characters.');
  }
  if (body.status && !['pending', 'in_progress', 'completed'].includes(body.status)) {
    errors.push('Status must be pending, in_progress, or completed.');
  }
  if (body.priority && !['low', 'medium', 'high'].includes(body.priority)) {
    errors.push('Priority must be low, medium, or high.');
  }
  if (body.due_date && Number.isNaN(Date.parse(body.due_date))) {
    errors.push('Due date must be a valid date.');
  }
  return errors;
}

module.exports = { isEmail, validateTask };
