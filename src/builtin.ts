import { Highlighter } from "./highlighter.ts";
import { MenuItemType } from "./index.ts";
import { MenuItem } from "./index.ts";
import { ThemeManager } from "./theme.ts";

export class HighlighterNone extends Highlighter {
    constructor(tm: ThemeManager) {
        super(tm, {
            name: 'None',
            id: 'none',
            author: 'nostalgia3'
        });
    }

    parseLine(l: string): string {
        return l;
    }

    getMenuItems(file: string): MenuItem[] {
        const sec = file.replaceAll('\n', '').split(' ');

        const pieces: MenuItem[] = [];

        for(let i=0;i<sec.length;i++) {
            if(sec[i].trim() == '') continue;
            pieces.push({ type: MenuItemType.Word, value: sec[i] });
        }

        return pieces;
    }
}

export class HighlighterSV extends Highlighter {
    constructor(tm: ThemeManager) {
        super(tm, {
            name: 'SV16-ASM',
            id: 'sv16',
            author: 'nostalgia3'
        });
    }

    getToken(s: string) {
        const instructionRegex = /^(brk|int|rti|push|pop|pushr|popr|mov|str|add|sub|cmp|jump|jumpeq|jumpneq|jumple|jumpof|call|ret|and|or|not)$/;

        let sec = '';

        if(s[0] == '"') {
            sec = s;
        } else {
            sec = s.replace(',','');
        }

        // Note: the priority of this matters
        if(sec.match(/^[rR][0-7]$/)) {
            return this.col(sec, this.tm.get('keyword')) + this.col((s.endsWith(',')) ? ',' : '', this.tm.get('foreground'));
        } else if(!isNaN(parseInt(sec))) {
            return this.col(sec, this.tm.get('number')) + this.col((s.endsWith(',')) ? ',' : '', this.tm.get('foreground'));
        } else if(sec.match(/^\[[rR][0-7]\]$/)) {
            return this.col('[', this.tm.get('symbol')) + this.col(sec.substring(1,sec.length-1), this.tm.get('keyword')) + this.col(']', this.tm.get('symbol')) + this.col((s.endsWith(',')) ? ',' : '', this.tm.get('foreground'));
        } else if(sec.match(/^\[([A-Za-z_])+([A-Za-z_0-9])*\]$/)) {
            return this.col(sec, this.tm.get('symbol')) + this.col((s.endsWith(',')) ? ',' : '', this.tm.get('foreground'));
        } else if(sec.match(/^\[([0-9])+\]$/) || sec.match(/^\[0[Xx]([0-9A-Fa-f]){1,4}\]$/)) {
            return this.col(sec, this.tm.get('symbol')) + this.col((s.endsWith(',')) ? ',' : '', this.tm.get('foreground'));
        } else if(sec.match(/^".*"$/)) {
            return this.col(sec, this.tm.get('string')) + this.col((s.endsWith(',')) ? ',' : '', this.tm.get('foreground'));
        } else if(sec.match(/^.(asciiz|ascii|byte|short|include|define|org|global)$/)) {
            return this.col(sec, this.tm.get('keyword')) + this.col((s.endsWith(',')) ? ',' : '', this.tm.get('foreground'));
        } else if(sec.match(/^([A-Za-z_])\w+:$/)) {
            return this.col(sec, this.tm.get('decl_function')) + this.col((s.endsWith(',')) ? ',' : '', this.tm.get('foreground'));
        } else if(sec.toLowerCase().match(instructionRegex)) {
            return this.col(sec, this.tm.get('function')) + this.col((s.endsWith(',')) ? ',' : '', this.tm.get('foreground'));
        } else if(sec.match(/^([A-Za-z_]+)\w$/)) {
            return this.col(sec, this.tm.get('foreground')) + this.col((s.endsWith(',')) ? ',' : '', this.tm.get('foreground'));
        } else {
            return this.col(sec, this.tm.get('foreground')) + this.col((s.endsWith(',')) ? ',' : '', this.tm.get('foreground'));
        }
    }

    split(s: string): string[] {
        const pieces: string[] = [];
        let inString = false;
        let t = '';

        for(let i=0;i<s.length;i++) {
            switch(s[i]) {
                case '"':
                    if(inString) {
                        inString = false;
                        pieces.push(t + '"');
                        t = '';
                    } else {
                        if(t != '') pieces.push(t);
                        t = '"';
                    }
                break;

                case ' ':
                    if(!inString) {
                        pieces.push(t);
                        t = '';
                    } else {
                        t += ' ';
                    }
                break;

                default:
                    t += s[i];
                break;
            }
        }

        pieces.push(t);

        return pieces;
    }

    getMenuItems(file: string): MenuItem[] {
        const sec = file.replaceAll('\n', '').split(' ');

        const pieces: MenuItem[] = [];

        for(let i=0;i<sec.length;i++) {
            if(sec[i].trim() == '') continue;
            pieces.push({ type: MenuItemType.Word, value: sec[i] });
        }

        return pieces;
    }

    parseLine(l: string): string {
        const pl = l.split('#')[0];
        const com = l.split('#')[1];
        const pieces = this.split(pl);

        for(let i=0;i<pieces.length;i++) {
            pieces[i] = this.getToken(pieces[i]);
        }

        return pieces.join(' ') + (com != undefined ? this.col('#' + com, this.tm.get('comment')) : this.col('', this.tm.get('foreground')));
    }
}