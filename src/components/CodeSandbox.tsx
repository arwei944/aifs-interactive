import { useState, useEffect, useRef, useCallback } from 'react';
import { loadPyodide, type PyodideInterface } from 'pyodide';
import CodeEditor from './CodeEditor';

interface CodeSandboxProps {
  initialCode: string;
  language?: string;
}

export default function CodeSandbox({ initialCode, language = 'python' }: CodeSandboxProps) {
  const [code, setCode] = useState(initialCode);
  const [output, setOutput] = useState<string[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const pyodideRef = useRef<PyodideInterface | null>(null);
  const outputEndRef = useRef<HTMLDivElement>(null);

  // 加载 Pyodide
  useEffect(() => {
    let cancelled = false;

    async function loadRuntime() {
      try {
        setIsLoading(true);
        const pyodide = await loadPyodide({
          indexURL: 'https://cdn.jsdelivr.net/pyodide/v0.25.0/full/',
        });
        if (!cancelled) {
          pyodideRef.current = pyodide;
          setIsLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          setIsLoading(false);
          setOutput((prev) => [
            ...prev,
            `[错误] Python 运行时加载失败: ${err instanceof Error ? err.message : String(err)}`,
          ]);
        }
      }
    }

    loadRuntime();

    return () => {
      cancelled = true;
    };
  }, []);

  // 自动滚动输出到底部
  useEffect(() => {
    outputEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [output]);

  const handleRun = useCallback(async () => {
    const pyodide = pyodideRef.current;
    if (!pyodide || isRunning) return;

    setIsRunning(true);

    // 捕获 stdout 和 stderr
    const newOutput: string[] = [];

    pyodide.setStdout({
      batched: (msg: string) => {
        newOutput.push(msg);
      },
    });

    pyodide.setStderr({
      batched: (msg: string) => {
        newOutput.push(`[错误] ${msg}`);
      },
    });

    try {
      pyodide.runPython(code);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      // 提取有用的错误信息
      const lines = errorMsg.split('\n').filter((line) => !line.startsWith('PythonError:'));
      newOutput.push(`[错误] ${lines.join('\n')}`);
    } finally {
      setOutput((prev) => [...prev, ...newOutput]);
      setIsRunning(false);
    }
  }, [code, isRunning]);

  const handleClear = useCallback(() => {
    setOutput([]);
  }, []);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // 降级方案
      const textarea = document.createElement('textarea');
      textarea.value = code;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  }, [code]);

  return (
    <div className="bg-surface border border-border rounded-[12px] overflow-hidden shadow-sm">
      {/* 头部工具栏 */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-[#fafafa] border-b border-border">
        <span className="text-[12px] font-medium text-ink-2 font-mono">
          {language === 'python' ? 'Python' : language}
        </span>
        <div className="flex items-center gap-2">
          <button
            onClick={handleCopy}
            className="px-3 py-1.5 rounded-md text-[12px] font-medium transition-all bg-bg border border-border text-ink-2 hover:border-border-2 hover:text-ink cursor-pointer"
          >
            {copied ? '已复制' : '复制代码'}
          </button>
          <button
            onClick={handleClear}
            className="px-3 py-1.5 rounded-md text-[12px] font-medium transition-all bg-bg border border-border text-ink-2 hover:border-border-2 hover:text-ink cursor-pointer"
          >
            清空
          </button>
          <button
            onClick={handleRun}
            disabled={isRunning || isLoading}
            className="px-3 py-1.5 rounded-md text-[12px] font-medium transition-all bg-blue text-white hover:bg-blue-hover disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            {isRunning ? '运行中...' : '▶ 运行'}
          </button>
        </div>
      </div>

      {/* 代码编辑器 */}
      <div className="relative">
        {isLoading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-surface/80 backdrop-blur-sm">
            <div className="flex items-center gap-2.5">
              <div className="w-4 h-4 border-2 border-blue border-t-transparent rounded-full animate-spin" />
              <span className="text-[13px] text-ink-2">加载 Python 运行时...</span>
            </div>
          </div>
        )}
        <CodeEditor code={code} onChange={setCode} height="220px" />
      </div>

      {/* 输出面板 */}
      <div className="border-t border-border">
        <div className="flex items-center px-4 py-2 bg-[#fafafa] border-b border-border">
          <span className="text-[12px] font-medium text-ink-3">输出</span>
        </div>
        <div
          className="bg-bg font-mono text-[12.5px] leading-relaxed px-4 py-3 overflow-y-auto"
          style={{ maxHeight: '200px' }}
        >
          {output.length === 0 ? (
            <span className="text-ink-3 italic">运行代码后，输出将显示在这里...</span>
          ) : (
            output.map((line, i) => (
              <div
                key={i}
                className={`whitespace-pre-wrap break-all ${
                  line.startsWith('[错误]') ? 'text-red' : 'text-ink'
                }`}
              >
                {line}
              </div>
            ))
          )}
          <div ref={outputEndRef} />
        </div>
      </div>
    </div>
  );
}
