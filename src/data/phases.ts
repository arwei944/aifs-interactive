export interface Lesson {
  id: string;
  num: number;
  title: string;
  type: 'build' | 'learn' | 'capstone';
  lang: string;
  duration: string;
  summary: string;
  keywords: string[];
}

export interface Phase {
  id: string;
  num: number;
  title: string;
  shortTitle: string;
  lessons: Lesson[];
  duration: string;
  status: 'completed' | 'in-progress' | 'planned';
  description: string;
}

export const phases: Phase[] = [
  {
    id: 'phase-0',
    num: 0,
    title: '环境搭建与工具链',
    shortTitle: '环境搭建',
    lessons: [
      { id: '00-01', num: 1, title: '开发环境配置', type: 'build', lang: 'Python, TypeScript, Rust', duration: '45min', summary: '配置 Python、Node.js、Rust 开发环境，安装核心工具链', keywords: ['Python', 'Node.js', 'Rust', '环境变量', 'IDE'] },
      { id: '00-02', num: 2, title: 'Git 与协作', type: 'learn', lang: '—', duration: '30min', summary: 'Git 基础操作、分支策略、Pull Request 工作流', keywords: ['Git', 'GitHub', '分支', '合并'] },
      { id: '00-03', num: 3, title: 'GPU 配置与云服务', type: 'build', lang: 'Python', duration: '40min', summary: '配置 CUDA、使用 Google Colab 和云端 GPU 资源', keywords: ['GPU', 'CUDA', 'Colab', '云计算'] },
      { id: '00-04', num: 4, title: 'API 与密钥管理', type: 'build', lang: 'Python, TypeScript', duration: '25min', summary: '管理 OpenAI、Anthropic 等 API 密钥，环境变量配置', keywords: ['API', '密钥', '环境变量', '.env'] },
      { id: '00-05', num: 5, title: 'Jupyter Notebook', type: 'build', lang: 'Python', duration: '35min', summary: 'Jupyter Notebook 基础操作、快捷键、魔法命令', keywords: ['Jupyter', 'Notebook', '魔法命令'] },
      { id: '00-06', num: 6, title: 'Python 环境管理', type: 'build', lang: 'Python', duration: '30min', summary: 'venv、conda、pip、pyproject.toml 包管理', keywords: ['venv', 'conda', 'pip', 'pyproject.toml'] },
      { id: '00-07', num: 7, title: 'Docker 入门', type: 'build', lang: 'Python', duration: '40min', summary: 'Docker 基础、Dockerfile 编写、容器化 AI 项目', keywords: ['Docker', 'Dockerfile', '容器', '镜像'] },
      { id: '00-08', num: 8, title: '编辑器配置', type: 'build', lang: '—', duration: '20min', summary: 'VS Code / Cursor 配置、扩展推荐、快捷键', keywords: ['VS Code', 'Cursor', '扩展', '快捷键'] },
      { id: '00-09', num: 9, title: '数据管理', type: 'build', lang: 'Python', duration: '35min', summary: '数据集下载、格式转换、版本控制', keywords: ['数据集', 'CSV', 'Parquet', 'DVC'] },
      { id: '00-10', num: 10, title: '终端与 Shell', type: 'learn', lang: '—', duration: '25min', summary: 'Bash 基础、常用命令、管道与重定向', keywords: ['Bash', 'Shell', '终端', '管道'] },
      { id: '00-11', num: 11, title: 'Linux 基础', type: 'learn', lang: '—', duration: '30min', summary: 'Linux 文件系统、权限、进程管理', keywords: ['Linux', '文件系统', '权限', '进程'] },
      { id: '00-12', num: 12, title: '调试与性能分析', type: 'build', lang: 'Python', duration: '35min', summary: 'pdb 调试、cProfile 性能分析、内存泄漏检测', keywords: ['调试', 'pdb', 'cProfile', '性能'] },
    ],
    duration: '~14h',
    status: 'completed',
    description: '配置开发环境、工具链和基础设施，为后续所有课程做准备。',
  },
  {
    id: 'phase-1',
    num: 1,
    title: '数学基础',
    shortTitle: '数学基础',
    lessons: [
      { id: '01-01', num: 1, title: '线性代数直觉', type: 'learn', lang: 'Python, Julia', duration: '50min', summary: '向量、矩阵的几何直觉，为什么 AI 需要线性代数', keywords: ['向量', '矩阵', '线性变换', '几何'] },
      { id: '01-02', num: 2, title: '向量与矩阵运算', type: 'build', lang: 'Python, Julia', duration: '55min', summary: '从零实现向量点积、矩阵乘法、转置、逆矩阵', keywords: ['点积', '矩阵乘法', '转置', '逆矩阵'] },
      { id: '01-03', num: 3, title: '矩阵变换与特征值', type: 'build', lang: 'Python, Julia', duration: '60min', summary: '特征值分解、SVD、PCA 的数学原理和代码实现', keywords: ['特征值', 'SVD', 'PCA', '对角化'] },
      { id: '01-04', num: 4, title: '微积分：导数与梯度', type: 'learn', lang: 'Python', duration: '45min', summary: '导数、偏导数、梯度、链式法则的直觉理解', keywords: ['导数', '梯度', '链式法则', '偏导数'] },
      { id: '01-05', num: 5, title: '链式法则与自动微分', type: 'build', lang: 'Python', duration: '50min', summary: '从零实现计算图和反向模式自动微分', keywords: ['自动微分', '计算图', '反向传播', 'autograd'] },
      { id: '01-06', num: 6, title: '概率与分布', type: 'learn', lang: 'Python', duration: '40min', summary: '概率空间、常见分布（正态、伯努利、泊松）', keywords: ['概率', '正态分布', '伯努利', '泊松'] },
      { id: '01-07', num: 7, title: '贝叶斯定理与统计思维', type: 'build', lang: 'Python', duration: '45min', summary: '贝叶斯推断、先验/后验、最大似然估计', keywords: ['贝叶斯', '先验', '后验', 'MLE'] },
      { id: '01-08', num: 8, title: '优化：梯度下降家族', type: 'build', lang: 'Python', duration: '55min', summary: 'SGD、Momentum、Adam、学习率调度策略', keywords: ['SGD', 'Adam', '学习率', '动量'] },
      { id: '01-09', num: 9, title: '信息论：熵与 KL 散度', type: 'learn', lang: 'Python', duration: '40min', summary: '信息熵、交叉熵、KL 散度在 ML 中的应用', keywords: ['熵', '交叉熵', 'KL散度', '信息论'] },
      { id: '01-10', num: 10, title: '降维：PCA、t-SNE、UMAP', type: 'build', lang: 'Python', duration: '50min', summary: '三种降维算法的原理对比和实现', keywords: ['PCA', 't-SNE', 'UMAP', '降维'] },
    ],
    duration: '~23h',
    status: 'completed',
    description: 'AI 背后的数学直觉，从线性代数到信息论。',
  },
  {
    id: 'phase-2',
    num: 2,
    title: '机器学习基础',
    shortTitle: '机器学习',
    lessons: [
      { id: '02-01', num: 1, title: '什么是机器学习', type: 'learn', lang: 'Python', duration: '25min', summary: '监督学习、无监督学习、强化学习的定义和区别', keywords: ['监督学习', '无监督学习', '强化学习'] },
      { id: '02-02', num: 2, title: '线性回归从零实现', type: 'build', lang: 'Python', duration: '50min', summary: '从最小二乘法推导到代码实现，理解损失函数', keywords: ['线性回归', '最小二乘', '损失函数', 'MSE'] },
      { id: '02-03', num: 3, title: '逻辑回归与分类', type: 'build', lang: 'Python', duration: '45min', summary: 'Sigmoid 函数、二分类、多分类（Softmax）', keywords: ['逻辑回归', 'Sigmoid', '分类', 'Softmax'] },
      { id: '02-04', num: 4, title: '决策树与随机森林', type: 'build', lang: 'Python', duration: '50min', summary: '信息增益、基尼系数、Bagging 集成', keywords: ['决策树', '随机森林', '信息增益', 'Bagging'] },
      { id: '02-05', num: 5, title: '支持向量机', type: 'build', lang: 'Python', duration: '50min', summary: '最大间隔分类器、核技巧、软间隔', keywords: ['SVM', '核技巧', '间隔', '对偶问题'] },
      { id: '02-06', num: 6, title: 'KNN 与距离度量', type: 'build', lang: 'Python', duration: '35min', summary: 'K 近邻算法、欧氏距离、曼哈顿距离、余弦相似度', keywords: ['KNN', '距离度量', '欧氏距离', '余弦相似度'] },
    ],
    duration: '~21h',
    status: 'completed',
    description: '经典机器学习算法，仍然是大多数生产 AI 的骨干。',
  },
  {
    id: 'phase-3',
    num: 3,
    title: '深度学习核心',
    shortTitle: '深度学习',
    lessons: [
      { id: '03-01', num: 1, title: '感知机：一切的起点', type: 'build', lang: 'Python', duration: '40min', summary: '从感知机到线性分类器，理解神经网络的起源', keywords: ['感知机', '线性分类', '阈值', '决策边界'] },
      { id: '03-02', num: 2, title: '多层网络与前向传播', type: 'build', lang: 'Python', duration: '50min', summary: '从零实现多层感知机，理解前向传播的计算过程', keywords: ['MLP', '前向传播', '隐藏层', '权重'] },
      { id: '03-03', num: 3, title: '反向传播从零实现', type: 'build', lang: 'Python', duration: '60min', summary: '链式法则推导梯度、手动实现反向传播算法', keywords: ['反向传播', '链式法则', '梯度', '计算图'] },
      { id: '03-04', num: 4, title: '激活函数：ReLU、Sigmoid、GELU', type: 'build', lang: 'Python', duration: '45min', summary: '为什么需要激活函数、各种激活函数的对比和选择', keywords: ['ReLU', 'Sigmoid', 'GELU', 'Swish', '梯度消失'] },
      { id: '03-05', num: 5, title: '损失函数', type: 'build', lang: 'Python', duration: '45min', summary: 'MSE、交叉熵、Focal Loss 的原理和适用场景', keywords: ['MSE', '交叉熵', 'Focal Loss', '损失函数'] },
      { id: '03-06', num: 6, title: '优化器', type: 'build', lang: 'Python', duration: '50min', summary: 'SGD、Momentum、RMSprop、Adam 的原理和对比', keywords: ['SGD', 'Adam', 'RMSprop', '学习率'] },
      { id: '03-07', num: 7, title: '正则化', type: 'build', lang: 'Python', duration: '40min', summary: 'L1/L2 正则化、Dropout、Early Stopping', keywords: ['L1', 'L2', 'Dropout', '正则化'] },
      { id: '03-08', num: 8, title: '批量归一化', type: 'build', lang: 'Python', duration: '40min', summary: 'BatchNorm 的原理、为什么有效、LayerNorm 对比', keywords: ['BatchNorm', 'LayerNorm', '归一化', '内部协变量偏移'] },
    ],
    duration: '~15h',
    status: 'in-progress',
    description: '神经网络从第一性原理出发，不用框架直到你自己造一个。',
  },
  {
    id: 'phase-4',
    num: 4,
    title: '计算机视觉',
    shortTitle: '计算机视觉',
    lessons: [
      { id: '04-01', num: 1, title: '图像基础与卷积', type: 'build', lang: 'Python', duration: '50min', summary: '像素、通道、卷积运算的直觉和实现', keywords: ['卷积', '像素', '通道', '滤波器'] },
      { id: '04-02', num: 2, title: 'CNN 架构演进', type: 'build', lang: 'Python', duration: '55min', summary: 'LeNet → AlexNet → VGG → ResNet 的演进历程', keywords: ['CNN', 'ResNet', 'VGG', 'AlexNet'] },
      { id: '04-03', num: 3, title: '目标检测', type: 'build', lang: 'Python', duration: '60min', summary: 'YOLO、SSD、Faster R-CNN 的原理和对比', keywords: ['YOLO', 'R-CNN', '目标检测', '锚框'] },
    ],
    duration: '~27h',
    status: 'planned',
    description: '从像素到理解，卷积神经网络如何让机器「看见」。',
  },
  {
    id: 'phase-5',
    num: 5,
    title: '自然语言处理',
    shortTitle: '自然语言处理',
    lessons: [
      { id: '05-01', num: 1, title: '文本预处理', type: 'build', lang: 'Python', duration: '40min', summary: '分词、词嵌入、文本向量化的方法', keywords: ['分词', '词嵌入', 'Word2Vec', 'TF-IDF'] },
      { id: '05-02', num: 2, title: 'RNN 与序列建模', type: 'build', lang: 'Python', duration: '55min', summary: '从零实现 RNN、LSTM、GRU，理解序列建模', keywords: ['RNN', 'LSTM', 'GRU', '序列建模'] },
    ],
    duration: '~30h',
    status: 'planned',
    description: '让机器理解和生成人类语言。',
  },
  {
    id: 'phase-7',
    num: 7,
    title: 'Transformer 深入',
    shortTitle: 'Transformer',
    lessons: [
      { id: '07-01', num: 1, title: '自注意力机制', type: 'build', lang: 'Python', duration: '60min', summary: '从零实现 Scaled Dot-Product Attention', keywords: ['注意力', 'QKV', '自注意力', '缩放点积'] },
      { id: '07-02', num: 2, title: 'Transformer 编码器', type: 'build', lang: 'Python', duration: '65min', summary: '多头注意力、位置编码、编码器层堆叠', keywords: ['多头注意力', '位置编码', '编码器', '层归一化'] },
    ],
    duration: '~14h',
    status: 'planned',
    description: '深入理解 Transformer 架构的每一个细节。',
  },
  {
    id: 'phase-10',
    num: 10,
    title: '大语言模型从零构建',
    shortTitle: '大语言模型',
    lessons: [
      { id: '10-01', num: 1, title: 'Tokenizer 从零实现', type: 'build', lang: 'Python', duration: '60min', summary: 'BPE 算法、SentencePiece、从语料训练分词器', keywords: ['BPE', 'Tokenizer', 'SentencePiece', '分词'] },
      { id: '10-02', num: 2, title: 'GPT 架构实现', type: 'build', lang: 'Python', duration: '90min', summary: '从零实现完整的 GPT-2 架构', keywords: ['GPT', '因果注意力', '前馈网络', '层归一化'] },
    ],
    duration: '~26h',
    status: 'planned',
    description: '亲手构建一个 GPT，理解大语言模型的每一个组件。',
  },
  {
    id: 'phase-14',
    num: 14,
    title: '智能体工程',
    shortTitle: '智能体工程',
    lessons: [
      { id: '14-01', num: 1, title: 'Agent Loop 从零实现', type: 'build', lang: 'Python', duration: '45min', summary: 'ReAct 风格的 Agent 循环，120 行纯 Python', keywords: ['Agent', 'ReAct', '工具调用', '循环'] },
      { id: '14-02', num: 2, title: 'MCP 协议', type: 'build', lang: 'Python', duration: '50min', summary: 'Model Context Protocol，从零构建 MCP Server', keywords: ['MCP', '协议', 'Server', '工具'] },
    ],
    duration: '~20h',
    status: 'planned',
    description: '从 Agent Loop 到自主系统，构建能使用工具的 AI。',
  },
];

export function getPhase(id: string): Phase | undefined {
  return phases.find(p => p.id === id);
}

export function getLesson(phaseId: string, lessonId: string): Lesson | undefined {
  const phase = getPhase(phaseId);
  return phase?.lessons.find(l => l.id === lessonId);
}

export function getTotalLessons(): number {
  return phases.reduce((sum, p) => sum + p.lessons.length, 0);
}

export function getAllLessons(): { lesson: Lesson; phase: Phase }[] {
  return phases.flatMap(p => p.lessons.map(l => ({ lesson: l, phase: p })));
}
