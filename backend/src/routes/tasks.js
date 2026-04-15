const router = require('express').Router();
const { protect } = require('../middleware/auth');
const {
  createTask,
  runTask,
  getTasks,
  getTask,
  deleteTask,
} = require('../controllers/taskController');

router.use(protect);

router.route('/').get(getTasks).post(createTask);
router.route('/:id').get(getTask).delete(deleteTask);
router.post('/:id/run', runTask);

module.exports = router;
