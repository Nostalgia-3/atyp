/** Base class for all syntax highlighting */
export type Theme = {
    black: number[], white: number[], lred: number[], dred: number[],
    green: number[], lyellow: number[], dyellow: number[], blue: number[],
    magenta: number[], cyan: number[], gray1: number[], gray2: number[]
}

export class Highlighter {
    protected theme: Theme;

    constructor(theme: Theme) {
        this.theme = theme;
    }

    protected col(s: string, t: number[], b = false) {
        return `\x1b[${b?'48':'38'};2;${t[0]};${t[1]};${t[2]}m${s}\x1b[38;2;${this.theme.white[0]};${this.theme.white[1]};${this.theme.white[2]}m`;
    }
    
    parseLine(_l: string): string {
        throw new Error(`Hey, you can't use the base Highlighter class!`);
    }
}