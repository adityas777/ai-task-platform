const Task = require('../models/Task');
const taskQueue = require('../config/redis');

exports.createTask = async (req, res) => {
  const { title, inputText, operation } = req.body;
  if (!title || !inputText || !operation)
    return res.status(400).json({ message: 'title, inputText, operation required' });

  const task = await Task.create({
    userId: req.user._id,
    title,
    inputText,
    operation,
    status: 'pending',
  });

  res.status(201).json({ task });
};

exports.runTask = async (req, res) => {
  const task = await Task.findOne({ _id: req.params.id, userId: req.user._id });
  if (!task) return res.status(404).json({ message: 'Task not found' });

  if (['running', 'success'].includes(task.status))
    return res.status(400).json({ message: `Task already ${task.status}` });

  const job = await taskQueue.add(
    {
      taskId: task._id.toString(),
      inputText: task.inputText,
      operation: task.operation,
    },
    { jobId: task._id.toString() }
  );

  task.status = 'pending';
  task.jobId = job.id.toString();
  task.result = null;
  task.logs = [{ message: 'Job queued', timestamp: new Date() }];
  await task.save();

  res.json({ task });
};

exports.getTasks = async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(50, parseInt(req.query.limit) || 20);
  const skip = (page - 1) * limit;

  const filter = { userId: req.user._id };
  if (req.query.status) filter.status = req.query.status;

  const [tasks, total] = await Promise.all([
    Task.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    Task.countDocuments(filter),
  ]);

  res.json({ tasks, total, page, pages: Math.ceil(total / limit) });
};

exports.getTask = async (req, res) => {
  const task = await Task.findOne({ _id: req.params.id, userId: req.user._id }).lean();
  if (!task) return res.status(404).json({ message: 'Task not found' });
  res.json({ task });
};

exports.deleteTask = async (req, res) => {
  const task = await Task.findOneAndDelete({ _id: req.params.id, userId: req.user._id });
  if (!task) return res.status(404).json({ message: 'Task not found' });
  res.json({ message: 'Task deleted' });
};
