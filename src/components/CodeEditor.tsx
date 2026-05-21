import { useRef, useEffect } from 'react';
import { EditorView } from '@codemirror/view';
import { EditorState } from '@codemirror/state';
import { python } from '@codemirror/lang-python';
import { minimalSetup } from 'codemirror';

interface CodeEditorProps {
  code: string;
  onChange?: (code: string) => void;
  height?: string;
}

export default function CodeEditor({ code, onChange, height = '200px' }: CodeEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const onChangeRef = useRef(onChange);

  // 保持 onChange 引用最新
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    if (!containerRef.current) return;

    const updateListener = EditorView.updateListener.of((update) => {
      if (update.docChanged && onChangeRef.current) {
        onChangeRef.current(update.state.doc.toString());
      }
    });

    // macOS 风格的浅色主题
    const lightTheme = EditorView.theme({
      '&': {
        fontSize: '13px',
        backgroundColor: '#fafafa',
        color: '#1d1d1f',
      },
      '.cm-content': {
        fontFamily: "'JetBrains Mono', 'SF Mono', monospace",
        lineHeight: '1.6',
        padding: '12px 0',
        caretColor: '#0071e3',
      },
      '.cm-cursor': {
        borderLeftColor: '#0071e3',
        borderLeftWidth: '1.5px',
      },
      '.cm-activeLine': {
        backgroundColor: 'rgba(0, 113, 227, 0.04)',
      },
      '.cm-selectionBackground, &.cm-focused .cm-selectionBackground': {
        backgroundColor: 'rgba(0, 113, 227, 0.15) !important',
      },
      '.cm-focused': {
        outline: 'none',
      },
      '.cm-gutters': {
        backgroundColor: 'transparent',
        borderRight: 'none',
        color: '#aeaeb2',
      },
      '.cm-line': {
        padding: '0 12px',
      },
      '&.cm-focused .cm-matchingBracket': {
        backgroundColor: 'rgba(0, 113, 227, 0.2)',
        outline: '1px solid rgba(0, 113, 227, 0.4)',
      },
      '.cm-panels': {
        backgroundColor: '#fafafa',
        borderBottom: '0.5px solid #e5e5ea',
      },
      '.cm-searchMatch': {
        backgroundColor: 'rgba(255, 159, 10, 0.3)',
        outline: '1px solid rgba(255, 159, 10, 0.5)',
      },
      '.cm-searchMatch.cm-searchMatch-selected': {
        backgroundColor: 'rgba(255, 159, 10, 0.5)',
      },
      '.cm-tooltip': {
        backgroundColor: '#ffffff',
        border: '0.5px solid #e5e5ea',
        borderRadius: '8px',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.08)',
      },
      '.cm-tooltip-autocomplete': {
        '& > ul > li': {
          padding: '4px 8px',
          fontSize: '12px',
        },
        '& > ul > li[aria-selected]': {
          backgroundColor: 'rgba(0, 113, 227, 0.08)',
          color: '#0071e3',
        },
      },
    });

    const state = EditorState.create({
      doc: code,
      extensions: [
        minimalSetup,
        python(),
        updateListener,
        lightTheme,
        EditorView.lineWrapping,
      ],
    });

    const view = new EditorView({
      state,
      parent: containerRef.current,
    });

    viewRef.current = view;

    return () => {
      view.destroy();
      viewRef.current = null;
    };
    // 只在挂载时初始化编辑器
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      ref={containerRef}
      className="overflow-auto border-0"
      style={{ height }}
    />
  );
}
