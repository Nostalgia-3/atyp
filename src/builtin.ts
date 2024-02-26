import { Highlighter } from "./highlighter.ts";

export type Theme = {
    black: number[], white: number[], lred: number[], dred: number[],
    green: number[], lyellow: number[], dyellow: number[], blue: number[],
    magenta: number[], cyan: number[], gray1: number[], gray2: number[]
}

export class HighlighterNone extends Highlighter {
    constructor() {
        super({ black: [40, 44, 52], white: [171, 178, 191], lred: [224, 108, 117], dred: [190, 80, 70],
                green: [152, 195, 121], lyellow: [229, 192, 123], dyellow: [209, 154, 102], blue: [97, 175, 239],
                magenta: [198, 120, 221], cyan: [86, 182, 194], gray1: [76, 82, 89], gray2: [92, 99, 112]
        });
    }

    parseLine(l: string): string {
        return l;
    }
}

export class HighlighterTS extends Highlighter {
    constructor(theme: Theme) {
        super(theme);
    }

    parseLine(l: string): string {
        return l;
        
        // const j = l.split('//');

        // const t = new Tokenizer([
        //     { type: 'STRING', pattern: /\".*\"/ },
        //     { type: 'IDEN', pattern: /[a-zA-Z]+[a-zA-Z0-9]*/ },
        //     { type: 'NUM', pattern: /(0[Xx][0-9A-Fa-f]+)|([0-9]+)/ },
        //     { type: 'LEFT_PAREN', pattern: '(' },
        //     { type: 'RIGHT_PAREN', pattern: ')' },
        //     { type: 'LEFT_BRACKET', pattern: '{' },
        //     { type: 'RIGHT_BRACKET', pattern: '}' },
        //     { type: 'COLON', pattern: ':' },
        //     { type: 'SEMICOLON', pattern: ';' },
        //     { type: 'COMMA', pattern: ',' },
        //     { type: 'EQUALS', pattern: '=' },
        //     { type: 'WHITESPACE', pattern: /[ ]+/ },
        //     { type: 'KEYWORD', pattern: /(break)|(as)|(any)|(switch)|(case)|(if)|(throw)|(else)|(var)|(get)|(module)|(type)|(instanceof)|(typeof)|(public)|(private)|(enum)|(export)|(finally)|(for)|(while)|(super)|(this)|(new)|(in)|(return)|(true)|(false)|(extends)|(static)|(let)|(package)|(implements)|(interface)|(function)|(new)|(try)|(yield)|(const)|(continue)|(do)|(catch)/ },
        //     { type: 'BUILTIN_TYPE', pattern: /(void)|(number)|(string)|(null)|(any)/ }
        // ]);

        // const toks = t.tokenize(j[0]);
        // let m = '';

        // for(let i=0;i<toks.length;i++) {
        //     switch(toks[i].type) {
        //         case 'STRING':
        //             m += this.col(toks[i].value, this.theme.green);
        //         break;

        //         case 'IDEN':
        //             m += this.col(toks[i].value, this.theme.lred);
        //         break;

        //         case 'NUM':
        //             m += this.col(toks[i].value, this.theme.lyellow);
        //         break;

        //         case 'KEYWORD':
        //             m += this.col(toks[i].value, this.theme.magenta);
        //         break;

        //         case 'BUILTIN_TYPE':
        //             m += this.col(toks[i].value, this.theme.cyan);
        //         break;

        //         case 'LEFT_PAREN':
        //         case 'RIGHT_PAREN':
        //         case 'LEFT_BRACKET':
        //         case 'RIGHT_BRACKET':
        //         case 'COLON':
        //         case 'SEMICOLON':
        //         case 'EQUALS':
        //             m += this.col(toks[i].value, this.theme.white);
        //         break;

        //         case 'WHITESPACE':
        //             m += toks[i].value;
        //         break;
        //     }
        // }
        
        // return m + (j[1] ? this.col('//' + j[1], this.theme.gray2) : '');
    }
}

export class HighlighterSV extends Highlighter {
    constructor(theme: Theme) {
        super(theme);
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
            return this.col(sec, this.theme.magenta) + this.col((s.endsWith(',')) ? ',' : '', this.theme.white);
        } else if(!isNaN(parseInt(sec))) {
            return this.col(sec, this.theme.lyellow) + this.col((s.endsWith(',')) ? ',' : '', this.theme.white);
        } else if(sec.match(/^\[[rR][0-7]\]$/)) {
            return this.col('[', this.theme.cyan) + this.col(sec.substring(1,sec.length-1), this.theme.magenta) + this.col(']', this.theme.cyan) + this.col((s.endsWith(',')) ? ',' : '', this.theme.white);
        } else if(sec.match(/^\[([A-Za-z_])+([A-Za-z_0-9])*\]$/)) {
            return this.col(sec, this.theme.blue) + this.col((s.endsWith(',')) ? ',' : '', this.theme.white);
        } else if(sec.match(/^\[([0-9])+\]$/) || sec.match(/^\[0[Xx]([0-9A-Fa-f]){1,4}\]$/)) {
            return this.col(sec, this.theme.cyan) + this.col((s.endsWith(',')) ? ',' : '', this.theme.white);
        } else if(sec.match(/^".*"$/)) {
            return this.col(sec, this.theme.green) + this.col((s.endsWith(',')) ? ',' : '', this.theme.white);
        } else if(sec.match(/^.(asciiz|ascii|byte|short|include|define|org|global)$/)) {
            return this.col(sec, this.theme.magenta) + this.col((s.endsWith(',')) ? ',' : '', this.theme.white);
        } else if(sec.match(/^([A-Za-z_])\w+:$/)) {
            return this.col(sec, this.theme.blue) + this.col((s.endsWith(',')) ? ',' : '', this.theme.white);
        } else if(sec.toLowerCase().match(instructionRegex)) {
            return this.col(sec, this.theme.lred) + this.col((s.endsWith(',')) ? ',' : '', this.theme.white);
        } else if(sec.match(/^([A-Za-z_]+)\w$/)) {
            return this.col(sec, this.theme.white) + this.col((s.endsWith(',')) ? ',' : '', this.theme.white);
        } else {
            return this.col(sec, this.theme.white) + this.col((s.endsWith(',')) ? ',' : '', this.theme.white);
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

    parseLine(l: string): string {
        const pieces = this.split(l);

        for(let i=0;i<pieces.length;i++) {
            pieces[i] = this.getToken(pieces[i]);
        }

        return pieces.join(' ');
    }
}