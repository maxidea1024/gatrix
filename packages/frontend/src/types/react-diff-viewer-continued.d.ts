declare module 'react-diff-viewer-continued' {
    import { ComponentType, ReactNode } from 'react';

    export enum DiffMethod {
        CHARS = 'diffChars',
        WORDS = 'diffWords',
        WORDS_WITH_SPACE = 'diffWordsWithSpace',
        LINES = 'diffLines',
        TRIMMED_LINES = 'diffTrimmedLines',
        SENTENCES = 'diffSentences',
        CSS = 'diffCss',
    }

    export interface ReactDiffViewerStylesOverride {
        variables?: {
            light?: Record<string, string>;
            dark?: Record<string, string>;
        };
        diffContainer?: React.CSSProperties;
        diffRemoved?: React.CSSProperties;
        diffAdded?: React.CSSProperties;
        marker?: React.CSSProperties;
        emptyGutter?: React.CSSProperties;
        highlightedLine?: React.CSSProperties;
        lineNumber?: React.CSSProperties;
        highlightedGutter?: React.CSSProperties;
        contentText?: React.CSSProperties;
        gutter?: React.CSSProperties;
        line?: React.CSSProperties;
        wordDiff?: React.CSSProperties;
        wordAdded?: React.CSSProperties;
        wordRemoved?: React.CSSProperties;
        codeFoldGutter?: React.CSSProperties;
        codeFold?: React.CSSProperties;
        emptyLine?: React.CSSProperties;
        content?: React.CSSProperties;
        titleBlock?: React.CSSProperties;
        splitView?: React.CSSProperties;
    }

    export interface ReactDiffViewerProps {
        oldValue: string;
        newValue: string;
        splitView?: boolean;
        disableWordDiff?: boolean;
        compareMethod?: DiffMethod;
        hideLineNumbers?: boolean;
        showDiffOnly?: boolean;
        extraLinesSurroundingDiff?: number;
        renderContent?: (source: string) => ReactNode;
        codeFoldMessageRenderer?: (totalFoldedLines: number, leftStartLineNumber: number, rightStartLineNumber: number) => ReactNode;
        onLineNumberClick?: (lineId: string, event: React.MouseEvent<HTMLTableCellElement>) => void;
        highlightLines?: string[];
        styles?: ReactDiffViewerStylesOverride;
        useDarkTheme?: boolean;
        leftTitle?: string | ReactNode;
        rightTitle?: string | ReactNode;
        linesOffset?: number;
    }

    const ReactDiffViewer: ComponentType<ReactDiffViewerProps>;
    export default ReactDiffViewer;
}
