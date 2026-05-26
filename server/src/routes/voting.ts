import express, { Router } from "express";

const router = express.Router();

// 类别定义
const CATEGORIES = [
  { id: 'train', name: '我们的专列', icon: 'train' },
  { id: 'travel', name: '出行新风貌', icon: 'bus' },
  { id: 'shelter', name: '梦想候车亭', icon: 'lamp' },
];

// 作品数据生成
const generateWorks = (categoryId: string) => {
  const titles: Record<string, string[]> = {
    train: ['城市脉动', '未来车站', '穿梭时光', '绿色出行', '智慧车厢', '流动风景', '城市动脉', '极速之旅', '温暖归途', '科技先锋'],
    travel: ['公交微笑', '服务至上', '绿色公交', '平安出行', '舒适车厢', '文明礼让', '快捷通勤', '低碳生活', '优质服务', '安全驾驶'],
    shelter: ['休憩驿站', '智慧候车', '城市家具', '避风港湾', '文化驿站', '智能站台', '温馨候车', '信息枢纽', '艺术空间', '绿色能源'],
  };
  
  return titles[categoryId]?.map((title, index) => ({
    id: `${categoryId}-${index + 1}`,
    categoryId,
    title,
    author: `设计师${String.fromCharCode(65 + index)}`,
    votes: Math.floor(Math.random() * 500) + 50,
    imageUrl: `https://picsum.photos/seed/${categoryId}${index}/400/500`,
    description: `「${title}」是天津公交2024年度创意设计大赛参赛作品，融合了现代美学与公共交通实用功能。`,
    workNumber: `${categoryId.toUpperCase()}-${String(index + 1).padStart(2, '0')}`,
  })) || [];
};

// 存储投票记录（内存中，临时使用）
const voteRecords: Map<string, { workId: string; votedAt: string }[]> = new Map();
const dailyVotes: Map<string, { count: number; lastReset: string }> = new Map();

// 获取所有类别
router.get('/categories', (req, res) => {
  res.json({ code: 0, data: CATEGORIES });
});

// 获取作品列表
/**
 * 服务端文件：server/src/routes/voting.ts
 * 接口：GET /api/v1/voting/works
 * Query 参数：categoryId: string
 */
router.get('/works', (req, res) => {
  const { categoryId } = req.query;
  if (!categoryId || typeof categoryId !== 'string') {
    return res.status(400).json({ code: 400, message: 'categoryId is required' });
  }
  
  const works = generateWorks(categoryId);
  res.json({ code: 0, data: works });
});

// 获取全部作品（所有类别）
router.get('/works/all', (req, res) => {
  const allWorks = CATEGORIES.flatMap(cat => generateWorks(cat.id));
  res.json({ code: 0, data: allWorks });
});

// 投票
/**
 * 服务端文件：server/src/routes/voting.ts
 * 接口：POST /api/v1/voting/vote
 * Body 参数：userId: string, workId: string, workNumber: string
 */
router.post('/vote', (req, res) => {
  const { userId, workId, workNumber } = req.body;
  
  if (!userId || !workId) {
    return res.status(400).json({ code: 400, message: 'userId and workId are required' });
  }
  
  const today = new Date().toISOString().split('T')[0];
  
  // 检查用户今日投票记录
  const userVotes = voteRecords.get(userId) || [];
  const todayVotes = userVotes.filter(v => v.votedAt.startsWith(today));
  
  // 检查是否已投该作品
  const hasVoted = todayVotes.some(v => v.workId === workId);
  if (hasVoted) {
    return res.status(400).json({ code: 400, message: '该作品今日已投票' });
  }
  
  // 检查投票次数限制（每日4次）
  if (todayVotes.length >= 4) {
    return res.status(400).json({ code: 400, message: '今日投票次数已用完' });
  }
  
  // 记录投票
  userVotes.push({ workId, votedAt: new Date().toISOString() });
  voteRecords.set(userId, userVotes);
  
  res.json({ 
    code: 0, 
    message: '投票成功',
    data: {
      remainingVotes: 4 - todayVotes.length - 1,
      workNumber
    }
  });
});

// 获取用户投票状态
/**
 * 服务端文件：server/src/routes/voting.ts
 * 接口：GET /api/v1/voting/status
 * Query 参数：userId: string
 */
router.get('/status', (req, res) => {
  const { userId } = req.query;
  
  if (!userId) {
    return res.status(400).json({ code: 400, message: 'userId is required' });
  }
  
  const today = new Date().toISOString().split('T')[0];
  const userVotes = voteRecords.get(userId as string) || [];
  const todayVotes = userVotes.filter(v => v.votedAt.startsWith(today));
  
  res.json({
    code: 0,
    data: {
      remainingVotes: Math.max(0, 4 - todayVotes.length),
      totalVotes: 4,
      votedWorks: todayVotes.map(v => v.workId),
      isRealNameVerified: true,
      isLocatedInTianjin: true,
    }
  });
});

// 生成拉票海报数据
/**
 * 服务端文件：server/src/routes/voting.ts
 * 接口：POST /api/v1/voting/poster
 * Body 参数：workId: string
 */
router.post('/poster', (req, res) => {
  const { workId } = req.body;
  
  if (!workId) {
    return res.status(400).json({ code: 400, message: 'workId is required' });
  }
  
  // 查找作品信息
  let work = null;
  for (const cat of CATEGORIES) {
    const works = generateWorks(cat.id);
    work = works.find(w => w.id === workId);
    if (work) break;
  }
  
  if (!work) {
    return res.status(404).json({ code: 404, message: '作品不存在' });
  }
  
  // 生成海报数据（实际项目中会调用图像合成服务）
  res.json({
    code: 0,
    data: {
      workId: work.id,
      workNumber: work.workNumber,
      workTitle: work.title,
      workImageUrl: work.imageUrl,
      // 模拟二维码URL
      qrCodeUrl: `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=https://tjbus.com/vote/${work.id}`,
      // 拉票文案
      slogan: `「${work.title}」等你投票`,
    }
  });
});

export default router;
