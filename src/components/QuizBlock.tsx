import { useState, useEffect, useCallback } from 'react';
import useProgress from '../hooks/useProgress';

export interface QuizQuestion {
  id: string;
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

interface Props {
  questions: QuizQuestion[];
  lessonId: string;
}

type AnswerState = {
  selectedIndex: number | null;
  isRevealed: boolean;
};

export default function QuizBlock({ questions, lessonId }: Props) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<AnswerState[]>(
    () => questions.map(() => ({ selectedIndex: null, isRevealed: false }))
  );
  const [showResults, setShowResults] = useState(false);
  const [resultsVisible, setResultsVisible] = useState(false);
  const [explanationVisible, setExplanationVisible] = useState(false);
  const [optionsVisible, setOptionsVisible] = useState(false);

  const { markQuizCompleted } = useProgress();

  const currentQuestion = questions[currentIndex];
  const currentAnswer = answers[currentIndex];
  const isLastQuestion = currentIndex === questions.length - 1;

  // Fade in options with stagger when question changes
  useEffect(() => {
    setOptionsVisible(false);
    setExplanationVisible(false);
    const timer = setTimeout(() => setOptionsVisible(true), 50);
    return () => clearTimeout(timer);
  }, [currentIndex]);

  // Fade in results screen
  useEffect(() => {
    if (showResults) {
      setResultsVisible(false);
      const timer = setTimeout(() => setResultsVisible(true), 50);
      return () => clearTimeout(timer);
    }
  }, [showResults]);

  const handleSelectOption = useCallback(
    (optionIndex: number) => {
      if (currentAnswer.isRevealed) return;

      setAnswers((prev) => {
        const next = [...prev];
        next[currentIndex] = {
          selectedIndex: optionIndex,
          isRevealed: true,
        };
        return next;
      });

      // Slide down explanation
      setExplanationVisible(false);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setExplanationVisible(true);
        });
      });
    },
    [currentAnswer.isRevealed, currentIndex]
  );

  const handleNext = useCallback(() => {
    if (isLastQuestion) {
      setShowResults(true);
    } else {
      setCurrentIndex((prev) => prev + 1);
    }
  }, [isLastQuestion]);

  const handleRestart = useCallback(() => {
    setCurrentIndex(0);
    setAnswers(questions.map(() => ({ selectedIndex: null, isRevealed: false })));
    setShowResults(false);
    setResultsVisible(false);
    setExplanationVisible(false);
    setOptionsVisible(false);
  }, [questions]);

  // Calculate score when showing results
  useEffect(() => {
    if (showResults) {
      const correctCount = answers.reduce((acc, answer, i) => {
        return acc + (answer.selectedIndex === questions[i].correctIndex ? 1 : 0);
      }, 0);
      markQuizCompleted(lessonId, correctCount, questions.length);
    }
  }, [showResults, answers, questions, lessonId, markQuizCompleted]);

  // ---- Results Screen ----
  if (showResults) {
    const correctCount = answers.reduce((acc, answer, i) => {
      return acc + (answer.selectedIndex === questions[i].correctIndex ? 1 : 0);
    }, 0);
    const total = questions.length;
    const percentage = Math.round((correctCount / total) * 100);

    let message: string;
    if (percentage === 100) {
      message = '\uD83C\uDF89 \u5B8C\u7F8E\uFF01\u4F60\u5DF2\u7ECF\u5B8C\u5168\u638C\u63E1\u4E86\u8FD9\u4E2A\u77E5\u8BC6\u70B9\uFF01';
    } else if (percentage >= 66) {
      message = '\uD83D\uDC4D \u4E0D\u9519\uFF01\u518D\u590D\u4E60\u4E00\u4E0B\u9519\u9898\u5C31\u80FD\u5B8C\u5168\u638C\u63E1\u4E86\u3002';
    } else {
      message = '\uD83D\uDCAA \u522B\u7070\u5FC3\uFF01\u56DE\u5230\u8BFE\u7A0B\u5185\u5BB9\u91CD\u65B0\u5B66\u4E60\u4E00\u4E0B\uFF0C\u7136\u540E\u518D\u8BD5\u8BD5\u3002';
    }

    return (
      <div
        className="bg-surface border border-border rounded-[12px] overflow-hidden shadow-sm p-8"
        style={{
          opacity: resultsVisible ? 1 : 0,
          transform: resultsVisible ? 'translateY(0)' : 'translateY(12px)',
          transition: 'opacity 0.4s ease, transform 0.4s ease',
        }}
      >
        <div className="flex flex-col items-center text-center">
          <div className="text-[48px] font-bold text-blue leading-none mb-2">
            {correctCount}
            <span className="text-[24px] font-medium text-ink-2">/{total}</span>
          </div>
          <p className="text-[14px] text-ink-2 mb-1">正确</p>

          <div className="w-12 h-0.5 bg-border my-4" />

          <p className="text-[15px] text-ink leading-relaxed mb-6">{message}</p>

          <button
            onClick={handleRestart}
            className="bg-blue text-white px-5 py-2.5 rounded-[10px] text-[14px] font-medium hover:opacity-90 transition-all cursor-pointer"
          >
            重新测验
          </button>
        </div>
      </div>
    );
  }

  // ---- Quiz Screen ----
  const isCorrect = currentAnswer.selectedIndex === currentQuestion.correctIndex;

  return (
    <div className="bg-surface border border-border rounded-[12px] overflow-hidden shadow-sm">
      {/* Header */}
      <div className="px-6 pt-5 pb-4 border-b border-border">
        <div className="flex items-center justify-between mb-3">
          <span className="bg-blue/10 text-blue text-[12px] font-medium px-2.5 py-1 rounded-full">
            第 {currentIndex + 1}/{questions.length} 题
          </span>
          {/* Progress dots */}
          <div className="flex gap-1.5">
            {questions.map((_, i) => (
              <div
                key={i}
                className={`w-1.5 h-1.5 rounded-full transition-colors duration-200 ${
                  i < currentIndex
                    ? answers[i].selectedIndex === questions[i].correctIndex
                      ? 'bg-green'
                      : 'bg-red'
                    : i === currentIndex
                      ? 'bg-blue'
                      : 'bg-border'
                }`}
              />
            ))}
          </div>
        </div>
        <p className="text-[16px] font-medium text-ink leading-relaxed">
          {currentQuestion.question}
        </p>
      </div>

      {/* Options */}
      <div className="px-6 py-4">
        <div className="flex flex-col gap-2.5">
          {currentQuestion.options.map((option, i) => {
            const isSelected = currentAnswer.selectedIndex === i;
            const isCorrectOption = i === currentQuestion.correctIndex;
            const isRevealed = currentAnswer.isRevealed;

            let optionClass =
              'w-full text-left px-4 py-3 rounded-[10px] border transition-all duration-200 text-[14px] cursor-pointer';

            if (!isRevealed) {
              optionClass += ' bg-bg border-border text-ink hover:border-border-2';
            } else if (isCorrectOption) {
              optionClass += ' bg-green/10 border-green text-green';
            } else if (isSelected && !isCorrect) {
              optionClass += ' bg-red/10 border-red text-red';
            } else {
              optionClass += ' bg-bg border-border text-ink-2';
            }

            const icon = isRevealed
              ? isCorrectOption
                ? ' \u2713'
                : isSelected
                  ? ' \u2717'
                  : ''
              : '';

            return (
              <button
                key={i}
                onClick={() => handleSelectOption(i)}
                disabled={isRevealed}
                className={optionClass}
                style={{
                  opacity: optionsVisible ? 1 : 0,
                  transform: optionsVisible ? 'translateY(0)' : 'translateY(8px)',
                  transition: `opacity 0.3s ease ${i * 0.05}s, transform 0.3s ease ${i * 0.05}s, border-color 0.2s ease, background-color 0.2s ease, color 0.2s ease`,
                }}
              >
                <span className="flex items-center gap-2">
                  <span className="text-[12px] text-ink-3 font-medium w-5 shrink-0">
                    {String.fromCharCode(65 + i)}.
                  </span>
                  <span className="flex-1">{option}</span>
                  {icon && (
                    <span className="text-[14px] font-bold shrink-0">{icon}</span>
                  )}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Explanation */}
      <div
        style={{
          maxHeight: explanationVisible ? '200px' : '0',
          opacity: explanationVisible ? 1 : 0,
          overflow: 'hidden',
          transition: 'max-height 0.35s ease, opacity 0.35s ease, margin 0.35s ease',
          marginTop: explanationVisible ? '0' : '-8px',
        }}
      >
        <div className="px-6 pb-4">
          <div className="bg-blue/5 border border-blue/20 rounded-lg p-4">
            <p className="text-[13px] font-semibold text-blue mb-1.5">
              {'\uD83D\uDCA1'} 解析
            </p>
            <p className="text-[14px] text-ink-2 leading-relaxed">
              {currentQuestion.explanation}
            </p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      {currentAnswer.isRevealed && (
        <div className="px-6 pb-5 pt-2">
          <button
            onClick={handleNext}
            className="bg-blue text-white px-5 py-2.5 rounded-[10px] text-[14px] font-medium hover:opacity-90 transition-all cursor-pointer"
          >
            {isLastQuestion ? '查看结果' : '下一题'}
          </button>
        </div>
      )}
    </div>
  );
}
