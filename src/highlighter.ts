import { ThemeManager } from "./theme.ts";

export class Highlighter {
    protected tm: ThemeManager;

    info: { name: string, id: string, author: string };

    constructor(tm: ThemeManager, info: { name: string, id: string, author: string }) {
        this.tm = tm;
        this.info = info;
    }

    protected col(s: string, t: number[], b = false) {
        return `\x1b[${b?'48':'38'};2;${t[0]};${t[1]};${t[2]}m${s}`;
    }
    
    parseLine(_l: string): string {
        throw new Error(`Hey, you can't use the base Highlighter class!`);
    }
}