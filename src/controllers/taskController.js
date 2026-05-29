const { run, get, all } = require('../config/db');
const { validateTask } = require('../utils/validators');

function overdueExpr() {
  return `CASE WHEN due_date IS NOT NULL AND date(due_date) < date('now') AND status != 'completed' THEN 1 ELSE 0 END AS is_overdue`;
}

exports.createTask = async (req, res) => {
  try {
    const errors = validateTask(req.body);
    if (errors.length) return res.status(400).json({ message: 'Validation failed.', errors });

    const { title, description = '', status = 'pending', priority = 'medium', due_date = null, parent_id = null } = req.body;
    if (parent_id) {
      const parent = await get('SELECT id FROM tasks WHERE id = ? AND user_id = ?', [parent_id, req.user.id]);
      if (!parent) return res.status(404).json({ message: 'Parent task not found or not yours.' });
    }

    const result = await run(
      'INSERT INTO tasks (user_id, parent_id, title, description, status, priority, due_date) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [req.user.id, parent_id, title.trim(), description, status, priority, due_date]
    );
    const task = await get(`SELECT *, ${overdueExpr()} FROM tasks WHERE id = ?`, [result.id]);
    return res.status(201).json({ message: 'Task created.', task });
  } catch (err) {
    return res.status(500).json({ message: 'Task creation failed.', error: err.message });
  }
};

exports.getTasks = async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page || '1'), 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit || '10'), 1), 100);
    const offset = (page - 1) * limit;
    const allowedSort = ['created_at', 'updated_at', 'due_date', 'priority', 'status', 'title'];
    const sortBy = allowedSort.includes(req.query.sortBy) ? req.query.sortBy : 'created_at';
    const order = (req.query.order || 'DESC').toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    const where = ['user_id = ?'];
    const params = [req.user.id];
    if (req.query.status) { where.push('status = ?'); params.push(req.query.status); }
    if (req.query.priority) { where.push('priority = ?'); params.push(req.query.priority); }
    if (req.query.parent === 'root') where.push('parent_id IS NULL');
    if (req.query.search) { where.push('(title LIKE ? OR description LIKE ?)'); params.push(`%${req.query.search}%`, `%${req.query.search}%`); }

    const whereSql = where.join(' AND ');
    const count = await get(`SELECT COUNT(*) as total FROM tasks WHERE ${whereSql}`, params);
    const tasks = await all(`SELECT *, ${overdueExpr()} FROM tasks WHERE ${whereSql} ORDER BY ${sortBy} ${order} LIMIT ? OFFSET ?`, [...params, limit, offset]);
    return res.json({ page, limit, total: count.total, totalPages: Math.ceil(count.total / limit), tasks });
  } catch (err) {
    return res.status(500).json({ message: 'Could not fetch tasks.', error: err.message });
  }
};

exports.getTaskById = async (req, res) => {
  try {
    const task = await get(`SELECT *, ${overdueExpr()} FROM tasks WHERE id = ? AND user_id = ?`, [req.params.id, req.user.id]);
    if (!task) return res.status(404).json({ message: 'Task not found.' });
    const subtasks = await all(`SELECT *, ${overdueExpr()} FROM tasks WHERE parent_id = ? AND user_id = ? ORDER BY created_at DESC`, [req.params.id, req.user.id]);
    return res.json({ task, subtasks });
  } catch (err) {
    return res.status(500).json({ message: 'Could not fetch task.', error: err.message });
  }
};

exports.updateTask = async (req, res) => {
  try {
    const task = await get('SELECT * FROM tasks WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
    if (!task) return res.status(404).json({ message: 'Task not found.' });
    const errors = validateTask(req.body, true);
    if (errors.length) return res.status(400).json({ message: 'Validation failed.', errors });

    const fields = ['title', 'description', 'status', 'priority', 'due_date', 'parent_id'];
    const set = [];
    const params = [];
    for (const field of fields) {
      if (req.body[field] !== undefined) {
        if (field === 'parent_id' && Number(req.body.parent_id) === Number(req.params.id)) {
          return res.status(400).json({ message: 'A task cannot be its own parent.' });
        }
        set.push(`${field} = ?`);
        params.push(field === 'title' ? req.body[field].trim() : req.body[field]);
      }
    }
    if (!set.length) return res.status(400).json({ message: 'No fields provided for update.' });
    set.push('updated_at = CURRENT_TIMESTAMP');
    await run(`UPDATE tasks SET ${set.join(', ')} WHERE id = ? AND user_id = ?`, [...params, req.params.id, req.user.id]);
    const updated = await get(`SELECT *, ${overdueExpr()} FROM tasks WHERE id = ?`, [req.params.id]);
    return res.json({ message: 'Task updated.', task: updated });
  } catch (err) {
    return res.status(500).json({ message: 'Task update failed.', error: err.message });
  }
};

exports.deleteTask = async (req, res) => {
  try {
    const task = await get('SELECT id FROM tasks WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
    if (!task) return res.status(404).json({ message: 'Task not found.' });
    await run('DELETE FROM tasks WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
    return res.json({ message: 'Task deleted with its subtasks.' });
  } catch (err) {
    return res.status(500).json({ message: 'Task delete failed.', error: err.message });
  }
};

exports.stats = async (req, res) => {
  try {
    const rows = await all(`SELECT status, COUNT(*) as count FROM tasks WHERE user_id = ? GROUP BY status`, [req.user.id]);
    const overdue = await get(`SELECT COUNT(*) as count FROM tasks WHERE user_id = ? AND due_date IS NOT NULL AND date(due_date) < date('now') AND status != 'completed'`, [req.user.id]);
    return res.json({ byStatus: rows, overdue: overdue.count });
  } catch (err) {
    return res.status(500).json({ message: 'Stats failed.', error: err.message });
  }
};
