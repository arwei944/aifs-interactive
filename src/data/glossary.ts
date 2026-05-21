export interface Term {
  id: string;
  term: string;
  peopleSay: string;
  actually: string;
  phaseId: string;
}

export const glossary: Term[] = [
  { id: 'g-01', term: '神经元死亡 (Dying ReLU)', peopleSay: 'ReLU 有时候会坏掉', actually: '当神经元输出恒为 0，梯度永远为 0，该神经元不再学习。Leaky ReLU 和 ELU 通过在负区域保留小梯度来解决这个问题。', phaseId: 'phase-3' },
  { id: 'g-02', term: '梯度消失 (Vanishing Gradient)', peopleSay: '深层网络训练不动', actually: '梯度在反向传播中逐层衰减至接近 0，导致底层网络几乎不更新。LSTM、残差连接和 LayerNorm 是主要解决方案。', phaseId: 'phase-3' },
  { id: 'g-03', term: '饱和 (Saturation)', peopleSay: '激活函数输出不变了', actually: '激活函数在输入极端值时输出趋于常数，梯度接近 0。Sigmoid 在 |x|>5 时饱和，ReLU 在 x<0 时饱和。', phaseId: 'phase-3' },
  { id: 'g-04', term: '过拟合 (Overfitting)', peopleSay: '训练集分数很高但测试集很差', actually: '模型记住了训练数据中的噪声而非真实模式。正则化（L1/L2）、Dropout、数据增强和早停是主要对策。', phaseId: 'phase-2' },
  { id: 'g-05', term: '注意力 (Attention)', peopleSay: 'Transformer 的核心机制', actually: '一种让模型在处理序列时「关注」最相关部分的方法。Query-Key-Value 机制计算输入之间的相关性权重。', phaseId: 'phase-7' },
  { id: 'g-06', term: '温度 (Temperature)', peopleSay: '控制 AI 回复的随机性', actually: 'Softmax 中的温度参数。低温 → 更确定性的输出，高温 → 更随机的输出。采样时常用 0.7-1.0。', phaseId: 'phase-10' },
  { id: 'g-07', term: 'Token', peopleSay: 'AI 看到的一个词', actually: '文本被分词器切分后的最小单位。一个 Token 可能是一个字、一个词或一个子词。GPT-4 的词表大小约 100K。', phaseId: 'phase-10' },
  { id: 'g-08', term: 'Embedding', peopleSay: '把文字变成数字', actually: '将离散的符号映射到连续的向量空间，使语义相近的词在向量空间中也相近。Word2Vec、GloVe、位置编码都是 Embedding。', phaseId: 'phase-5' },
];
