import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Modal,
  RefreshControl,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Screen } from '@/components/Screen';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';

// 配色方案
const COLORS = {
  primary: '#002FA7',      // 克莱因蓝
  secondary: '#C9A96E',     // 香槟金
  background: '#F8F6F2',    // 米金白
  surface: '#FFFFFF',
  textPrimary: '#1A1A2E',
  textWhite: '#FFFFFF',
  textGold: '#C9A96E',
  muted: '#999999',
  border: 'rgba(0,47,167,0.1)',
};

// 类别定义
const CATEGORIES = [
  { id: 'train', name: '我们的专列', icon: 'train' },
  { id: 'travel', name: '出行新风貌', icon: 'bus' },
  { id: 'shelter', name: '梦想候车亭', icon: 'lamp' },
];

// API Base URL
const API_BASE = process.env.EXPO_PUBLIC_BACKEND_BASE_URL || 'http://localhost:9091';

// 作品接口
interface Work {
  id: string;
  categoryId: string;
  title: string;
  author: string;
  votes: number;
  imageUrl: string;
  description: string;
  workNumber: string;
}

// 投票状态接口
interface VoteState {
  remainingVotes: number;
  totalVotes: number;
  isRealNameVerified: boolean;
  isLocatedInTianjin: boolean;
  todayRides: number;
  todayShared: boolean;
  votedWorks: Set<string>;
}

// 模拟用户ID（实际应从登录态获取）
const USER_ID = 'user_' + Date.now();

export default function VotingPage() {
  const insets = useSafeAreaInsets();
  const [activeCategory, setActiveCategory] = useState(0);
  const [works, setWorks] = useState<Work[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [showRules, setShowRules] = useState(false);
  const [showPoster, setShowPoster] = useState(false);
  const [voteState, setVoteState] = useState<VoteState>({
    remainingVotes: 4,
    totalVotes: 4,
    isRealNameVerified: true,
    isLocatedInTianjin: true,
    todayRides: 0,
    todayShared: false,
    votedWorks: new Set(),
  });

  // 获取作品列表
  const fetchWorks = useCallback(async (categoryId: string) => {
    setLoading(true);
    try {
      /**
       * 服务端文件：server/src/routes/voting.ts
       * 接口：GET /api/v1/voting/works
       * Query 参数：categoryId: string
       */
      const response = await fetch(`${API_BASE}/api/v1/voting/works?categoryId=${categoryId}`);
      const result = await response.json();
      if (result.code === 0) {
        setWorks(result.data);
      }
    } catch (error) {
      console.error('获取作品列表失败:', error);
      // 降级使用本地数据
      setWorks(generateLocalWorks(categoryId));
    } finally {
      setLoading(false);
    }
  }, []);

  // 获取用户投票状态
  const fetchVoteStatus = useCallback(async () => {
    try {
      /**
       * 服务端文件：server/src/routes/voting.ts
       * 接口：GET /api/v1/voting/status
       * Query 参数：userId: string
       */
      const response = await fetch(`${API_BASE}/api/v1/voting/status?userId=${USER_ID}`);
      const result = await response.json();
      if (result.code === 0) {
        setVoteState(prev => ({
          ...prev,
          remainingVotes: result.data.remainingVotes,
          votedWorks: new Set(result.data.votedWorks || []),
          isRealNameVerified: result.data.isRealNameVerified,
          isLocatedInTianjin: result.data.isLocatedInTianjin,
        }));
      }
    } catch (error) {
      console.error('获取投票状态失败:', error);
    }
  }, []);

  // 初始化数据
  React.useEffect(() => {
    fetchWorks(CATEGORIES[0].id);
    fetchVoteStatus();
  }, []);

  // 本地生成作品数据（备用）
  const generateLocalWorks = (categoryId: string): Work[] => {
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
      description: `「${title}」是天津公交2024年度创意设计大赛参赛作品。`,
      workNumber: `${categoryId.toUpperCase()}-${String(index + 1).padStart(2, '0')}`,
    })) || [];
  };

  // 切换类别
  const handleCategoryChange = useCallback((index: number) => {
    setActiveCategory(index);
    fetchWorks(CATEGORIES[index].id);
  }, [fetchWorks]);

  // 刷新数据
  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchWorks(CATEGORIES[activeCategory].id);
    fetchVoteStatus();
    setTimeout(() => setRefreshing(false), 1000);
  }, [activeCategory, fetchWorks, fetchVoteStatus]);

  // 投票操作
  const handleVote = useCallback(async (work: Work) => {
    const { remainingVotes, votedWorks, isRealNameVerified, isLocatedInTianjin } = voteState;

    // 验证检查
    if (!isRealNameVerified) {
      Alert.alert('提示', '请先完成实名认证后再投票');
      return;
    }
    if (!isLocatedInTianjin) {
      Alert.alert('提示', '投票需定位在天津，请检查您的位置权限');
      return;
    }
    if (votedWorks.has(work.id)) {
      Alert.alert('提示', '该作品今日已投票');
      return;
    }
    if (remainingVotes <= 0) {
      showVoteExhaustedAlert();
      return;
    }

    // 确认投票
    Alert.alert(
      '确认投票',
      `确定要为「${work.title}」投出宝贵一票吗？`,
      [
        { text: '取消', style: 'cancel' },
        {
          text: '确认投票',
          onPress: async () => {
            try {
              /**
               * 服务端文件：server/src/routes/voting.ts
               * 接口：POST /api/v1/voting/vote
               * Body 参数：userId: string, workId: string, workNumber: string
               */
              const response = await fetch(`${API_BASE}/api/v1/voting/vote`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: USER_ID, workId: work.id, workNumber: work.workNumber }),
              });
              const result = await response.json();
              
              if (result.code === 0) {
                setVoteState(prev => ({
                  ...prev,
                  remainingVotes: result.data.remainingVotes,
                  votedWorks: new Set([...prev.votedWorks, work.id]),
                }));
                setWorks(prev => prev.map(w => 
                  w.id === work.id ? { ...w, votes: w.votes + 1 } : w
                ));
                Alert.alert('投票成功', `感谢您为「${work.title}」投票！`);
              } else {
                Alert.alert('投票失败', result.message);
              }
            } catch (error) {
              // 离线模式：本地更新
              setVoteState(prev => ({
                ...prev,
                remainingVotes: prev.remainingVotes - 1,
                votedWorks: new Set([...prev.votedWorks, work.id]),
              }));
              setWorks(prev => prev.map(w => 
                w.id === work.id ? { ...w, votes: w.votes + 1 } : w
              ));
              Alert.alert('投票成功', `感谢您为「${work.title}」投票！`);
            }
          },
        },
      ]
    );
  }, [voteState]);

  // 票数用完提示
  const showVoteExhaustedAlert = () => {
    const { todayRides, todayShared } = voteState;
    const canEarnRide = todayRides < 1;
    const canEarnShare = !todayShared;

    if (canEarnRide || canEarnShare) {
      Alert.alert(
        '票数已用完',
        '当前票数已用完，乘坐公交或分享活动获得更多票数吧！',
        [
          { text: '稍后再说', style: 'cancel' },
          {
            text: '扫码乘车',
            onPress: () => {
              Alert.alert('提示', '请使用天津公交APP或小程序扫码乘车');
            },
          },
          canEarnShare ? {
            text: '分享活动',
            onPress: () => handleShareActivity(),
          } : { text: '明日再来', style: 'cancel', onPress: undefined },
        ]
      );
    } else {
      Alert.alert(
        '今日票数已用完',
        '今天的票数已用完，明天再来为你喜欢的作品投票吧！',
        [{ text: '我知道了' }]
      );
    }
  };

  // 分享活动
  const handleShareActivity = () => {
    Alert.alert(
      '分享至朋友圈',
      '分享活动至朋友圈可获得1次投票机会',
      [
        { text: '取消', style: 'cancel' },
        {
          text: '分享',
          onPress: () => {
            setVoteState(prev => ({
              ...prev,
              todayShared: true,
              remainingVotes: prev.remainingVotes + 1,
            }));
            Alert.alert('分享成功', '恭喜获得1次投票机会！');
          },
        },
      ]
    );
  };

  // 生成拉票海报
  const handleGeneratePoster = () => {
    setShowPoster(true);
  };

  // 选择作品生成海报
  const handleSelectWorkForPoster = async (work: Work) => {
    setShowPoster(false);
    
    try {
      /**
       * 服务端文件：server/src/routes/voting.ts
       * 接口：POST /api/v1/voting/poster
       * Body 参数：workId: string
       */
      const response = await fetch(`${API_BASE}/api/v1/voting/poster`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workId: work.id }),
      });
      const result = await response.json();
      
      if (result.code === 0) {
        Alert.alert(
          '海报已生成',
          `「${result.data.workTitle}」的拉票海报已生成\n拉票文案：${result.data.slogan}`,
          [
            { text: '关闭' },
            { text: '保存图片', onPress: () => Alert.alert('提示', '图片已保存到相册') },
            { text: '分享', onPress: () => Alert.alert('提示', '跳转分享...') },
          ]
        );
      }
    } catch (error) {
      Alert.alert(
        '海报已生成',
        `「${work.title}」的拉票海报已生成，可保存或分享至朋友圈`,
        [
          { text: '关闭' },
          { text: '保存图片', onPress: () => Alert.alert('提示', '图片已保存到相册') },
        ]
      );
    }
  };

  // 查看作品简介
  const handleViewDetail = (work: Work) => {
    Alert.alert(
      work.title,
      `${work.description}\n\n作者：${work.author}\n编号：${work.workNumber}\n当前票数：${work.votes}`,
      [{ text: '关闭' }]
    );
  };

  const { remainingVotes, isRealNameVerified, isLocatedInTianjin, todayRides, todayShared, votedWorks } = voteState;

  return (
    <Screen backgroundColor={COLORS.background} statusBarStyle="light">
      <View style={styles.container}>
        {/* 顶部区域 */}
        <LinearGradient
          colors={[COLORS.primary, '#001a6e']}
          style={[styles.header, { paddingTop: insets.top + 16 }]}
        >
          <View style={styles.headerContent}>
            <Text style={styles.headerTitle}>天津公交创意投票</Text>
            <Text style={styles.headerSubtitle}>2024年度创意设计评选</Text>
            <View style={styles.goldDivider} />
          </View>
        </LinearGradient>

        {/* 投票状态卡片 */}
        <View style={[styles.statusCard, { marginTop: -40 }]}>
          <View style={styles.statusTop}>
            <View style={styles.voteCount}>
              <Text style={styles.voteCountNumber}>{remainingVotes}</Text>
              <Text style={styles.voteCountLabel}>剩余票数</Text>
            </View>
            <View style={styles.statusTags}>
              <View style={[styles.statusTag, isRealNameVerified && styles.statusTagActive]}>
                <Ionicons name="checkmark-circle" size={14} color={isRealNameVerified ? COLORS.secondary : COLORS.muted} />
                <Text style={[styles.statusTagText, isRealNameVerified && styles.statusTagTextActive]}>已实名</Text>
              </View>
              <View style={[styles.statusTag, isLocatedInTianjin && styles.statusTagActive]}>
                <Ionicons name="location" size={14} color={isLocatedInTianjin ? COLORS.secondary : COLORS.muted} />
                <Text style={[styles.statusTagText, isLocatedInTianjin && styles.statusTagTextActive]}>天津定位</Text>
              </View>
            </View>
          </View>
          
          {/* 今日任务 */}
          <View style={styles.tasks}>
            <View style={styles.taskItem}>
              <MaterialCommunityIcons 
                name="bus" 
                size={18} 
                color={todayRides > 0 ? COLORS.secondary : COLORS.muted} 
              />
              <Text style={[styles.taskText, todayRides > 0 && styles.taskTextDone]}>
                {todayRides > 0 ? '今日已乘车' : '扫码乘车+1票'}
              </Text>
              {todayRides === 0 && (
                <>
                  <View style={styles.limitedTag}>
                    <Text style={styles.limitedTagText}>限时</Text>
                  </View>
                  <TouchableOpacity 
                    style={styles.taskBtn}
                    onPress={() => Alert.alert('提示', '请使用天津公交APP或小程序扫码乘车')}
                  >
                    <Text style={styles.taskBtnText}>去乘车</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
            <View style={[styles.taskItem, { marginTop: 8 }]}>
              <MaterialCommunityIcons 
                name="share-variant" 
                size={18} 
                color={todayShared ? COLORS.secondary : COLORS.muted} 
              />
              <Text style={[styles.taskText, todayShared && styles.taskTextDone]}>
                {todayShared ? '今日已分享' : '分享活动+1票'}
              </Text>
              {!todayShared && (
                <>
                  <View style={styles.limitedTag}>
                    <Text style={styles.limitedTagText}>限时</Text>
                  </View>
                  <TouchableOpacity style={styles.taskBtn} onPress={handleShareActivity}>
                    <Text style={styles.taskBtnText}>去分享</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          </View>

          {/* 规则按钮 */}
          <TouchableOpacity 
            style={styles.rulesBtn}
            onPress={() => setShowRules(true)}
          >
            <Ionicons name="document-text-outline" size={16} color={COLORS.primary} />
            <Text style={styles.rulesBtnText}>投票规则</Text>
          </TouchableOpacity>
        </View>

        {/* 类别Tab */}
        <View style={styles.categoryTabs}>
          {CATEGORIES.map((cat, index) => (
            <TouchableOpacity
              key={cat.id}
              style={[styles.categoryTab, activeCategory === index && styles.categoryTabActive]}
              onPress={() => handleCategoryChange(index)}
            >
              <MaterialCommunityIcons 
                name={cat.icon as any} 
                size={18} 
                color={activeCategory === index ? COLORS.textWhite : COLORS.primary} 
              />
              <Text style={[styles.categoryTabText, activeCategory === index && styles.categoryTabTextActive]}>
                {cat.name}
              </Text>
              {activeCategory === index && <View style={styles.activeIndicator} />}
            </TouchableOpacity>
          ))}
        </View>

        {/* 作品列表 */}
        <ScrollView
          style={styles.workList}
          contentContainerStyle={styles.workListContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        >
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={COLORS.primary} />
              <Text style={styles.loadingText}>加载中...</Text>
            </View>
          ) : (
            <View style={styles.worksGrid}>
              {works.map((work) => {
                const isVoted = votedWorks.has(work.id);
                return (
                  <View key={work.id} style={styles.workCard}>
                    <Image 
                      source={{ uri: work.imageUrl }} 
                      style={styles.workImage}
                      resizeMode="cover"
                    />
                    <View style={styles.workInfo}>
                      <Text style={styles.workTitle} numberOfLines={1}>{work.title}</Text>
                      <Text style={styles.workAuthor}>by {work.author}</Text>
                      <View style={styles.workFooter}>
                        <View style={styles.voteInfo}>
                          <Ionicons name="heart" size={12} color={COLORS.textGold} />
                          <Text style={styles.voteNum}>{work.votes}</Text>
                        </View>
                        <View style={styles.workActions}>
                          <TouchableOpacity 
                            style={styles.detailBtn}
                            onPress={() => handleViewDetail(work)}
                          >
                            <Text style={styles.detailBtnText}>简介</Text>
                          </TouchableOpacity>
                          <TouchableOpacity 
                            style={[styles.voteBtn, isVoted && styles.voteBtnDisabled]}
                            onPress={() => handleVote(work)}
                            disabled={isVoted}
                          >
                            <Text style={[styles.voteBtnText, isVoted && styles.voteBtnTextDisabled]}>
                              {isVoted ? '已投票' : '投票'}
                            </Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    </View>
                  </View>
                );
              })}
            </View>
          )}
          {/* 底部留白 */}
          <View style={{ height: 100 }} />
        </ScrollView>

        {/* 底部固定按钮 */}
        <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 16 }]}>
          <TouchableOpacity 
            style={styles.posterBtn}
            onPress={handleGeneratePoster}
          >
            <Ionicons name="image-outline" size={20} color={COLORS.textWhite} />
            <Text style={styles.posterBtnText}>生成拉票海报</Text>
          </TouchableOpacity>
        </View>

        {/* 投票规则弹窗 */}
        <Modal visible={showRules} transparent animationType="slide">
          <View style={styles.modalOverlay}>
            <TouchableOpacity 
              style={styles.modalBackdrop} 
              activeOpacity={1} 
              onPress={() => setShowRules(false)}
            />
            <View style={[styles.rulesModal, { paddingBottom: insets.bottom + 20 }]}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>投票规则</Text>
                <TouchableOpacity onPress={() => setShowRules(false)}>
                  <Ionicons name="close" size={24} color={COLORS.textPrimary} />
                </TouchableOpacity>
              </View>
              <ScrollView style={styles.rulesContent} showsVerticalScrollIndicator={false}>
                <View style={styles.ruleItem}>
                  <Text style={styles.ruleNum}>1</Text>
                  <Text style={styles.ruleText}>活动页面共设置3个类别的投票作品展示板块</Text>
                </View>
                <View style={styles.ruleItem}>
                  <Text style={styles.ruleNum}>2</Text>
                  <Text style={styles.ruleText}>天津公交微信小程序的注册用户每日拥有2票投票权</Text>
                </View>
                <View style={styles.ruleItem}>
                  <Text style={styles.ruleNum}>3</Text>
                  <Text style={styles.ruleText}>每个作品每日限投1票</Text>
                </View>
                <View style={styles.ruleItem}>
                  <Text style={styles.ruleNum}>4</Text>
                  <Text style={styles.ruleText}>投票需通过实名认证</Text>
                </View>
                <View style={styles.ruleItem}>
                  <Text style={styles.ruleNum}>5</Text>
                  <Text style={styles.ruleText}>投票时当前定位需在「天津」</Text>
                </View>
                <View style={styles.ruleDivider} />
                <Text style={styles.ruleSectionTitle}>活动奖励</Text>
                <View style={styles.ruleItem}>
                  <Text style={styles.ruleNum}>6</Text>
                  <Text style={styles.ruleText}>活动期间注册并完成首次投票的用户，可领取免费乘车券5张，7日内有效</Text>
                </View>
                <View style={styles.ruleItem}>
                  <Text style={styles.ruleNum}>7</Text>
                  <Text style={styles.ruleText}>当日使用天津公交APP或小程序扫码乘坐公交车1次，可额外获得1次投票机会（单日上限1次）</Text>
                </View>
                <View style={styles.ruleItem}>
                  <Text style={styles.ruleNum}>8</Text>
                  <Text style={styles.ruleText}>当日分享活动至朋友圈可获得1次投票机会（单日上限1次）</Text>
                </View>
                <View style={styles.ruleItem}>
                  <Text style={styles.ruleNum}>9</Text>
                  <Text style={styles.ruleText}>投票权当日未使用则自动失效，活动期间每人每日至多可拥有4次投票机会</Text>
                </View>
              </ScrollView>
            </View>
          </View>
        </Modal>

        {/* 选择作品弹窗 */}
        <Modal visible={showPoster} transparent animationType="slide">
          <View style={styles.modalOverlay}>
            <TouchableOpacity 
              style={styles.modalBackdrop} 
              activeOpacity={1} 
              onPress={() => setShowPoster(false)}
            />
            <View style={[styles.posterModal, { paddingBottom: insets.bottom + 20 }]}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>选择作品</Text>
                <TouchableOpacity onPress={() => setShowPoster(false)}>
                  <Ionicons name="close" size={24} color={COLORS.textPrimary} />
                </TouchableOpacity>
              </View>
              <ScrollView style={styles.posterWorkList} showsVerticalScrollIndicator={false}>
                <View style={styles.posterWorksGrid}>
                  {works.map((work) => (
                    <TouchableOpacity
                      key={work.id}
                      style={styles.posterWorkItem}
                      onPress={() => handleSelectWorkForPoster(work)}
                    >
                      <Image 
                        source={{ uri: work.imageUrl }} 
                        style={styles.posterWorkImage}
                      />
                      <Text style={styles.posterWorkTitle} numberOfLines={1}>{work.title}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
            </View>
          </View>
        </Modal>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    paddingBottom: 32,
    paddingHorizontal: 24,
  },
  headerContent: {
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '600',
    color: COLORS.textWhite,
    letterSpacing: 2,
  },
  headerSubtitle: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 6,
    letterSpacing: 1,
  },
  goldDivider: {
    width: 40,
    height: 1,
    backgroundColor: COLORS.secondary,
    marginTop: 16,
  },
  statusCard: {
    marginHorizontal: 20,
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 16,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 4,
  },
  statusTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  voteCount: {
    alignItems: 'center',
  },
  voteCountNumber: {
    fontSize: 36,
    fontWeight: '700',
    color: COLORS.secondary,
  },
  voteCountLabel: {
    fontSize: 12,
    color: COLORS.muted,
    marginTop: 2,
  },
  statusTags: {
    flexDirection: 'row',
    gap: 8,
  },
  statusTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.04)',
  },
  statusTagActive: {
    backgroundColor: 'rgba(201,169,110,0.15)',
  },
  statusTagText: {
    fontSize: 12,
    color: COLORS.muted,
  },
  statusTagTextActive: {
    color: COLORS.secondary,
    fontWeight: '500',
  },
  tasks: {
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: 0.5,
    borderTopColor: COLORS.border,
  },
  taskItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  taskText: {
    fontSize: 13,
    color: COLORS.textPrimary,
    flex: 1,
  },
  taskTextDone: {
    color: COLORS.muted,
  },
  taskBtn: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  taskBtnText: {
    fontSize: 11,
    color: COLORS.textWhite,
    fontWeight: '500',
  },
  limitedTag: {
    backgroundColor: '#FFF3E0',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginRight: 8,
  },
  limitedTagText: {
    fontSize: 10,
    color: '#E65100',
    fontWeight: '600',
  },
  rulesBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 0.5,
    borderTopColor: COLORS.border,
  },
  rulesBtnText: {
    fontSize: 12,
    color: COLORS.primary,
  },
  categoryTabs: {
    flexDirection: 'row',
    marginHorizontal: 20,
    marginTop: 16,
    backgroundColor: COLORS.surface,
    borderRadius: 8,
    padding: 4,
  },
  categoryTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 6,
    position: 'relative',
  },
  categoryTabActive: {
    backgroundColor: COLORS.primary,
  },
  categoryTabText: {
    fontSize: 13,
    color: COLORS.primary,
    fontWeight: '500',
  },
  categoryTabTextActive: {
    color: COLORS.textWhite,
  },
  activeIndicator: {
    position: 'absolute',
    bottom: 2,
    width: 20,
    height: 2,
    backgroundColor: COLORS.secondary,
    borderRadius: 1,
  },
  workList: {
    flex: 1,
    marginTop: 12,
  },
  workListContent: {
    paddingHorizontal: 16,
  },
  loadingContainer: {
    alignItems: 'center',
    paddingTop: 60,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: COLORS.muted,
  },
  worksGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  workCard: {
    width: '48%',
    backgroundColor: COLORS.surface,
    borderRadius: 8,
    marginBottom: 12,
    overflow: 'hidden',
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  workImage: {
    width: '100%',
    height: 160,
    backgroundColor: '#f0f0f0',
  },
  workInfo: {
    padding: 10,
  },
  workTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  workAuthor: {
    fontSize: 11,
    color: COLORS.muted,
    marginTop: 2,
  },
  workFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  voteInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  voteNum: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.textGold,
  },
  workActions: {
    flexDirection: 'row',
    gap: 6,
  },
  detailBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    borderWidth: 0.5,
    borderColor: COLORS.border,
  },
  detailBtnText: {
    fontSize: 10,
    color: COLORS.muted,
  },
  voteBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 4,
    backgroundColor: COLORS.primary,
  },
  voteBtnDisabled: {
    backgroundColor: '#e0e0e0',
  },
  voteBtnText: {
    fontSize: 10,
    color: COLORS.textWhite,
    fontWeight: '500',
  },
  voteBtnTextDisabled: {
    color: COLORS.muted,
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    paddingTop: 12,
    backgroundColor: COLORS.surface,
    borderTopWidth: 0.5,
    borderTopColor: COLORS.border,
  },
  posterBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: COLORS.primary,
    paddingVertical: 14,
    borderRadius: 8,
  },
  posterBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.textWhite,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  rulesModal: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
  },
  posterModal: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '70%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 0.5,
    borderBottomColor: COLORS.border,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  rulesContent: {
    padding: 16,
  },
  ruleItem: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  ruleNum: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: COLORS.primary,
    color: COLORS.textWhite,
    fontSize: 11,
    textAlign: 'center',
    lineHeight: 20,
    marginRight: 10,
  },
  ruleText: {
    flex: 1,
    fontSize: 14,
    color: COLORS.textPrimary,
    lineHeight: 20,
  },
  ruleDivider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginVertical: 16,
  },
  ruleSectionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.primary,
    marginBottom: 12,
  },
  posterWorkList: {
    padding: 16,
  },
  posterWorksGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  posterWorkItem: {
    width: '30%',
    alignItems: 'center',
  },
  posterWorkImage: {
    width: 90,
    height: 90,
    borderRadius: 8,
    backgroundColor: '#f0f0f0',
  },
  posterWorkTitle: {
    fontSize: 11,
    color: COLORS.textPrimary,
    marginTop: 6,
    textAlign: 'center',
  },
});
