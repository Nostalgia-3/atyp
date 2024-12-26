// This file is basically a remake of the core bits of atyp,
// because I did a lot of stuff in a way that makes it hard to
// do now

import { Keypress, readKeypress } from 'https://deno.land/x/keypress@0.0.11/mod.ts';
import { Renderer } from './renderer.ts';
import { Theme, ThemeObject } from './theme.ts';
import * as utils from './utils.ts';
import { existsSync } from 'https://deno.land/std@0.216.0/fs/exists.ts';
import { DEFAULT_THEME } from './default.ts';

export class TextBuffer {
    file?: string;
    editor: Editor;
    protected buffer = '';
    canWrite: boolean;
    hasSaved = true;
    crlf = false;

    cursor = {
        c: 0,
        offset: 0
    };

    constructor(e: Editor, file?: string, canWrite = true) {
        this.editor = e;
        this.canWrite = canWrite;
        this.file = file;
        this.crlf = false;
    }

    getBuf() { if(this.crlf) return this.buffer.replaceAll('\n', '\r\n'); return this.buffer; }
    getCursor() { return this.cursor; }

    setBuf(buf: string, crlf: boolean = false) {
        if(!this.canWrite) return;
        this.buffer = buf.replaceAll('\r', '');
        this.crlf = crlf;
    }
    unsafeSetBuf(buf: string) { this.buffer = buf; }
    setHasBufSaved(b: boolean) { this.hasSaved = b; }

    write(s: string) {
        if(!this.canWrite) {
            utils.bell();
            
            return;
        }

        this.setHasBufSaved(false);
        const cursor = this.getCursor();
        const buffer = this.getBuf();

        const b = buffer.slice(0, this.cursor.c);
        const e = buffer.slice(this.cursor.c);
        this.buffer = b + s + e;

        cursor.c+=s.length;
    }

    delete() {
        const buffer = this.getBuf();

        // return value
        this.setHasBufSaved(false);

        if(buffer[this.cursor.c-1] == null) return;

        this.setBuf(buffer.slice(0, this.cursor.c-1).concat(buffer.slice(this.cursor.c)));
        this.cursor.c--;
    }

    getCursorPos() {
        const lines = this.buffer.substring(0, this.cursor.c).replace('\r','').split('\n');
        const x = (lines.at(-1) ?? '').length;
        const y = lines.length - 1;

        return { x, y };
    }

    startLine() {
        const lines = this.buffer.split('\n')
        
        // lines we care about
        const lwca = lines.slice(0, this.getCursorPos().y);
        this.cursor.c = lwca.join('\n').length;
    }

    endLine() {
        const lines = this.buffer.split('\n')
        
        // lines we care about
        const lwca = lines.slice(0, this.getCursorPos().y+1);
        this.cursor.c = lwca.join('\n').length;
    }

    getLinesBefore(lines: string[], i: number) {
        const l = lines.slice(0, i);
        let s = '';
        for(let i=0;i<l.length;i++) { s += l[i] + 1; }
        return s.length+l.length; // +l.length for counting newlines
    }

    left(x: number = 1) {
        for(let i=0;i<x;i++) {
            if(this.cursor.c > 0) {
                this.cursor.c--;
                if(this.buffer[this.cursor.c] == '\r') this.cursor.c--;
            } else {
                utils.bell();
                break;
            }
        }
    }

    right(x: number = 1) {

        for(let i=0;i<x;i++) {
            if(this.cursor.c < this.buffer.length) {
                this.cursor.c++;
                if(this.buffer[this.cursor.c] == '\r') this.cursor.c++;
            } else {
                utils.bell();
                break;
            }
        }
    }

    up() {
        const lines = this.buffer.split('\n');
        const { x, y } = this.getCursorPos();

        if(lines[y] != null) {
            if(!lines[y - 1]) {
                this.cursor.c = 0;
                return;
            }

            if(lines[y - 1] && x > lines[y - 1].length) {
                this.cursor.c -= x + 1;
            } else {
                this.cursor.c -= lines[y - 1].length+1;
            }

            if(this.cursor.c < 0) {
                this.cursor.c = 0;
            }
        } else {
            utils.bell();
        }
    }

    down() {
        const lines = this.buffer.split('\n');
        const { x, y } = this.getCursorPos();

        if(lines[y] != null) {            
            if(lines[y + 1] && x > lines[y + 1].length) {
                this.cursor.c += lines[y].length - x + lines[y+1].length + 1;
            } else {
                this.cursor.c += lines[y].length+1;
            }

            if(this.cursor.c > this.buffer.length) {
                this.cursor.c = this.buffer.length;
            }
        } else {
            utils.bell();
        }
    }

    setCursor(x: number, y: number) {
        const lines = this.buffer.split('\n');

        this.cursor.c = 0;

        for(let i=0;i<y-1;i++) {
            if(lines[i] == undefined) break;
            this.cursor.c += lines[i].length+1;
        }

        if(this.cursor.c < 0) {
            this.cursor.c = 0;
        }

        this.cursor.c += Math.min(x, lines[y].length);

        if(this.cursor.c > this.buffer.length) {
            this.cursor.c = this.buffer.length;
        }
        return true;
    }
}

type MouseButton = number;

export enum Format {
    NORMAL,
    FLIPPED,
    ZEN,
    CUSTOM
}

export enum Mode {
    NORMAL,
    INSERT,
    COMMAND
}

export enum UIStyle {
    BORDERLESS,
    BORDERED
}

class Editor extends utils.TypedEventEmitter<{
    click: [MouseButton, number, number, boolean],
    scroll: [number, number, number],
    keypress: [Keypress],
    drag: [MouseButton, number, number, number, number]
}> {
    protected theme: Theme;
    protected renderer: Renderer;
    protected buffers: TextBuffer[];
    protected activeBuffer: number;
    protected command: TextBuffer;

    protected mode: Mode;

    protected dragX = 0;
    protected dragY = 0;

    layout: {
        format: Format,
        explorerWidth: number
    };
    
    constructor() {
        super();
        const { columns, rows } = Deno.consoleSize();
        this.theme = new Theme(DEFAULT_THEME as ThemeObject);
        this.renderer = new Renderer(columns, rows);
        this.buffers = [];
        this.layout = {
            format: Format.NORMAL,
            explorerWidth: 35
        };
        this.command = new TextBuffer(this);
        this.mode = Mode.NORMAL;
        this.activeBuffer = 0;
        this.new();
    }

    public async start() {
        utils.enableMouse();
        utils.setAltBuffer(true);

        let c = Deno.consoleSize();
        setInterval(()=>{
            const cur = Deno.consoleSize();
            if(cur.columns != c.columns || cur.rows != c.rows) {
                console.clear();
                editor.render();
                c = cur;
            }
        }, 100);

        this.render();

        for await(const keypress of readKeypress(Deno.stdin)) {
            if(keypress.ctrlKey && keypress.key == 'c') {
                this.exit();
            }
        
            const d = keypress.unicode.split('\\u').map((v)=>parseInt('0x0'+v,16));
            d.shift();
        
            if(d[0] == 0x1b && d[2] == 0x3C) {
                const secs = String.fromCharCode(...d).split('<')[1].split(';');
                const button = parseInt(secs[0]);
                const x = parseInt(secs[1]);
                const y = parseInt(secs[2].slice(0,-1));
                const released = secs[2].includes('m');
                if(button == 64)
                    this.emit('scroll', -1, x, y);
                else if(button == 65)
                    this.emit('scroll', 1, x, y);
                else
                    this.emit('click', button, x, y, released);

                if(released) {
                    if(this.dragX != x || this.dragY != y) this.emit('drag', button, this.dragX, this.dragY, x, y);
                } else {
                    this.dragX = x;
                    this.dragY = y;
                }

                continue;
            }

            const acBuf = this.buffers[this.activeBuffer];

            this.emit('keypress', keypress);
            if(this.mode == Mode.NORMAL) {
                switch(keypress.key) {
                    case 'i':
                        this.mode = Mode.INSERT;
                        break;
                    case ':':
                        this.mode = Mode.COMMAND;
                        this.command.setBuf(':');
                        this.command.setCursor(1, 0);
                        break;

                    case 'up': this.buffers[this.activeBuffer].up(); break;
                    case 'down': this.buffers[this.activeBuffer].down(); break;
                    case 'left':
                        if(keypress.ctrlKey)
                            this.layout.explorerWidth++;
                        else
                            this.buffers[this.activeBuffer].left();
                        break;
                    case 'right':
                        if(keypress.ctrlKey)
                            this.layout.explorerWidth--;
                        else
                            this.buffers[this.activeBuffer].right();
                        break;

                    default:
                        utils.bell();
                        break;
                }
            } else if(this.mode == Mode.INSERT) {
                switch(keypress.key) {
                    case 'space':
                        this.write(' ');
                        break;

                    case 'backspace':
                        this.delete();
                        break;

                    case 'return':
                        this.write('\n');
                        break;

                    case 'escape':
                        this.mode = Mode.NORMAL;
                        break;

                    case 'end':
                        this.cursorEnd();
                        break;

                    case 'home':
                        this.cursorStart();
                        break;

                    case 'up':
                        acBuf.up();
                        if(acBuf.getCursorPos().y - acBuf.cursor.offset < 0) {
                            acBuf.cursor.offset--;
                        }
                    break;
                    case 'down':
                        acBuf.down();
                        if(acBuf.getCursorPos().y > Deno.consoleSize().rows-5) {
                            acBuf.cursor.offset++;
                        }
                    break;
                    case 'left':
                        if(keypress.ctrlKey)
                            this.layout.explorerWidth++;
                        else
                            this.buffers[this.activeBuffer].left();
                        break;
                    case 'right':
                        if(keypress.ctrlKey)
                            this.layout.explorerWidth--;
                        else
                            this.buffers[this.activeBuffer].right();
                        break;

                    default:
                        this.write(keypress.key ?? 'undefined');
                        break;
                }
            } else { // Mode.COMMAND
                switch(keypress.key) {
                    case 'up':
                    case 'down':
                        utils.bell();
                    break;

                    case 'escape':
                        this.mode = Mode.NORMAL;
                        break;
                    case 'left':
                        if(keypress.ctrlKey)
                            this.layout.explorerWidth++;
                        else
                            this.command.left();
                        break;
                    case 'right':
                        if(keypress.ctrlKey)
                            this.layout.explorerWidth--;
                        else
                            this.command.right();
                        break;
                    case 'space':
                        this.command.write(' ');
                        break;
                    case 'backspace':
                        this.command.delete();
                        if(this.command.getBuf().length == 0) {
                            this.mode = Mode.NORMAL;
                        }
                        break;
                    case 'return': {
                        // parse and run command
                        this.runCommand(this.command.getBuf());
                        this.mode = Mode.NORMAL;
                        break; }
                    default:
                        this.command.write(keypress.key ?? 'undefined');
                        break;
                }
            }
            this.render();
        }
    }

    public render() {
        const { columns: w, rows: h } = Deno.consoleSize();
        this.renderer.size(w, h);

        if(this.buffers[this.activeBuffer] == undefined) {
            this.activeBuffer = 0;
        }

        console.clear();
        this.renderer.clear(this.theme.getElementRGB('background'));

        const buf = this.buffers[this.activeBuffer];
        const { x, y } = buf.getCursorPos();

        if(this.layout.explorerWidth)

        // normal
        switch(this.layout.format) {
            case Format.NORMAL:
                this.editor(
                    0, 0,
                    w-this.layout.explorerWidth, h-2, buf
                );
                this.explorer(w-this.layout.explorerWidth, 0, this.layout.explorerWidth, h-2);
                break;
            case Format.FLIPPED:
                this.editor(this.layout.explorerWidth, 0, w-this.layout.explorerWidth, h-2, buf);
                this.explorer(0, 0, this.layout.explorerWidth, h-2);
                break;
            case Format.ZEN:
                this.editor(0, 0, w, h-2, buf);
                break;
            case Format.CUSTOM: // implement a way to define custom formats
                break;
        }

        if(this.layout.format != Format.CUSTOM) {
            this.commandLine(0, h-2, w);
            this.statusLine(0, h, w);
        }
        
        this.renderer.flush();
        switch(this.mode) {
            case Mode.NORMAL:
                utils.write(utils.cursorTo(x+6, Math.min(y+1, h-4))); // normal
                utils.setCursor(utils.CursorShape.BLINKING_BLOCK);
                break;
            case Mode.INSERT:
                utils.setCursor(utils.CursorShape.BLINKING_BAR);
                utils.write(utils.cursorTo(x+6, Math.min(y+1, h-4))); // normal
                break;
            case Mode.COMMAND:
                utils.setCursor(utils.CursorShape.BLINKING_BAR);
                utils.write(utils.cursorTo(0+this.command.getCursorPos().x, h-2)); // command
                break;
        }

        utils.showCursor();
    }

    public runCommand(s: string) {
        if(!s.startsWith(':')) return;

        const args: string[] = [];
        let carg = '';
        let inString = false;

        for(let i=0;i<s.length;i++) {
            switch(s[i]) {
                case '"':
                    if(inString) {
                        args.push(carg + '"');
                        carg = '';
                        inString = false;
                    } else {
                        if(carg != '') args.push(carg);
                        carg = '"';
                        inString = true;
                    }
                break;

                case ' ':
                    if(inString) carg += ' ';
                    else {
                        if(carg != '') args.push(carg);
                        carg = '';
                    }
                break;

                default:
                    carg += s[i];
                break;
            }
        }
        if(carg != '') args.push(carg);

        switch(args[0].substring(1)) {
            case 'q!':
                this.exit();
            break;

            case 'wq':
                if(!this.save(args[1])) break;
                if(!this.buffers[this.activeBuffer].hasSaved) {
                    this.command.setBuf(`Error: No write since last change!`);
                    break;
                }
                this.exit();
            break;

            case 'w':
                this.save(args[1])
            break;
                
            case 'q': {
                if(!this.buffers[this.activeBuffer].hasSaved) {
                    this.command.setBuf(`Error: No write since last change!`);
                    break;
                }
                this.exit();
            break; }

            case 'b':
                if(!args[1]) {
                    this.command.setBuf(`Error: requires at least one argument`);
                    break;
                } else if(isNaN(parseInt(args[1]))) {
                    this.command.setBuf(`Error: args #0 should be a number`);
                    break;
                }

                this.setBuffer(parseInt(args[1])+1);
            break;

            case 'nb': this.new(true); break;

            default:
                this.command.setBuf(`Unknown command "${args[0].substring(1)}"`);
            break;
        }
    }

    public setBuffer(x: number) {
        if(this.buffers[x]) {
            this.activeBuffer = x;
        }
    }

    public deleteBuffer(x: number) {
        if(this.buffers[x] != undefined && this.buffers[x].hasSaved) {
            this.buffers.splice(x, 1);
            this.setBuffer(x-1);
        }
    }

    public new(active = false, readonly = false) {
        const buf = new TextBuffer(this, `[Buffer ${this.buffers.length+1}]`, !readonly);
        this.buffers.push(buf);
        if(active) {
            this.activeBuffer = this.buffers.length-1;
        }
    }

    public open(file: string, readonly = false) {
        if(!existsSync(file)) {
            return false;
        }

        const buf = new TextBuffer(this, file, !readonly);
        const f = Deno.readTextFileSync(file);
        buf.setBuf(f, f.includes('\r'));
        this.buffers.push(buf);
        this.activeBuffer = this.buffers.length-1;
        return true;
    }

    public save(file?: string, setWrittenFlag = true) {
        const buf = this.buffers[this.activeBuffer];
        if(file != undefined) buf.file = file;

        if(buf.file == undefined) {
            this.command.setBuf('Error: No file name');
            return false;
        }

        try {
            Deno.writeTextFileSync(buf.file, buf.getBuf());
        } catch(e) {
            this.command.setBuf(`Error: Failed writing to file (${(e as Error).message})`);
            return false;
        }

        buf.setHasBufSaved(setWrittenFlag);
        return true;
    }

    public cursorStart() { this.buffers[this.activeBuffer].startLine(); }
    public cursorEnd() { this.buffers[this.activeBuffer].endLine(); }
    public setCursorPos(x: number, y: number) { this.buffers[this.activeBuffer].setCursor(x, y); }
    public write(s: string) { this.buffers[this.activeBuffer].write(s); }
    public delete() { this.buffers[this.activeBuffer].delete(); }

    public exit() {
        utils.disableMouse();
        utils.setAltBuffer(false); // go back to buffer #0
        Deno.exit(0);
    }

    protected editor(x: number, y: number, w: number, h: number, buf: TextBuffer, active = true, style = UIStyle.BORDERED) {
        if(style == UIStyle.BORDERED)
            this.renderer.box(x, y, w, h, `${buf.file ?? '[Unknown]'}`, this.theme.getElementRGB('editor_fg'));
        else if(style == UIStyle.BORDERLESS)
            this.renderer.rect(x, y, w, h, this.theme.getElementRGB('editor_bg'));
        const lines = buf.getBuf().split('\n');
        for(let i=0;i<h-2;i++) {
            if(i > h-3) break;
            if(lines[i] != undefined) {
                if(active && buf.getCursorPos().y == i) {
                    this.renderer.rect(x+1,y+1+i, w-2, 1, this.theme.getElementRGB('selected_line'));
                    this.renderer.text(x+1, y+1+i, `${(i+1).toString().padStart(4)}`, this.theme.getElementRGB('selected_line_num'));
                } else
                    this.renderer.text(x+1, y+1+i, `${(i+1).toString().padStart(4)}`, this.theme.getElementRGB('line_num'));
                this.renderer.text(x+6, y+1+i, lines[i].substring(0,w-7), this.theme.getElementRGB('unknown'));
            } else {
                this.renderer.text(x+6, y+1+i, `~`, this.theme.getElementRGB('tilda_empty'));
            }
        }
    }

    protected explorer(x: number, y: number, w: number, h: number) {
        this.renderer.box(x, y, w, h, 'Explorer', this.theme.getElementRGB('explorer_bg'));
        this.renderer.text(x+2,y+1, 'Open Buffers'.slice(0,w-5), this.theme.getElementRGB('explorer_title'), undefined, {});
        for(let i=0;i<this.buffers.length;i++) {
            let fgc = this.theme.getElementRGB('explorer_fg');
            if(i == this.activeBuffer) {
                fgc = this.theme.getElementRGB('explorer_active_fg');
                this.renderer.rect(x+2,y+2+i, w-4, 1, this.theme.getElementRGB('selected_name'));
            }

            const ts = this.buffers[i].file ?? '????';
            this.renderer.text(x+5, y+2+i, ts.slice(0, w-5), fgc);
            if(!this.buffers[i].hasSaved)
                this.renderer.text(x+3, y+2+i, '\uf111', this.theme.getElementRGB('write_bubble'));
        }
    }

    protected statusLine(x: number, y: number, w: number) {
        this.renderer.rect(x, y, w, 1, this.theme.getElementRGB('info_bar_bg'));
        const acBuf = this.buffers[this.activeBuffer];
        const c = acBuf.getCursorPos();

        const chevies: { st: string, fg: utils.Gradient, bg: utils.Gradient }[] = [
            {
                st: 'NORMAL',
                fg: this.theme.getElementRGB('mode_normal_fg'),
                bg: this.theme.getElementRGB('mode_normal_bg')
            },
            {
                st: `Ln ${c.y}, Col ${c.x}`,
                fg: this.theme.getElementRGB('foreground'),
                bg: this.theme.getElementRGB('chevy_1')
            }
        ];

        switch(this.mode) {
            case Mode.NORMAL: break;
            case Mode.INSERT:
                chevies[0].st = 'INSERT';
                chevies[0].fg = this.theme.getElementRGB('mode_insert_fg');
                chevies[0].bg = this.theme.getElementRGB('mode_insert_bg');
                break;
            case Mode.COMMAND:
                chevies[0].st = 'COMMAND';
                chevies[0].fg = this.theme.getElementRGB('mode_command_fg');
                chevies[0].bg = this.theme.getElementRGB('mode_command_bg');
                break;
        }

        for(let i=0;i<chevies.length;i++) {
            x += this.calcChevy(chevies[i].st);
        }

        chevies.reverse();
        for(let i=0;i<chevies.length;i++) {
            x -= this.calcChevy(chevies[i].st);
            this.chevy(x, y, ((i == 0) ? ' ' : '') + chevies[i].st, chevies[i].fg, chevies[i].bg);
        }
    }

    protected commandLine(x: number, y: number, w: number) {
        this.renderer.rect(x, y, w, 1, this.theme.getElementRGB('command_bg'));
        this.renderer.text(x, y, this.command.getBuf().slice(0,w), this.theme.getElementRGB('command_fg'));
    }

    protected calcChevy(s: string) {
        return s.length+2;
    }

    protected chevy(x: number, y: number, s: string, fg?: utils.Gradient, bg?: utils.Gradient) {
        const bgc = this.renderer.getBG(x+s.length+2, y);
        this.renderer.rect(x, y, s.length+3, 1, bg);
        this.renderer.text(
            x, y, ` ${s} `,
            fg, bg
        );
        this.renderer.text(
            x+s.length+2, y, '\ue0b0',
            utils.grad(this.renderer.getBG(x+s.length+1, y)),
            utils.grad(bgc),
            // utils.grad(this.renderer.getFG(x+s.length+2, y)),
        )

        return s.length+3;
    }
}

const editor = new Editor();

utils.setTitle('Atyp');

editor.on('click', (mouse, x, y, released) => {
    const { columns: w, rows: h } = Deno.consoleSize();

    if(released) {
        if(x > w-editor.layout.explorerWidth && x < w && y <= h-2) {
            // Unhardcode this
            const relY = y;
            if(relY > 2) {
                if(mouse == 0)
                    editor.setBuffer(relY-3)
                else if(mouse == 2)
                    editor.deleteBuffer(relY-3);
            }
            editor.render();
        } else if(x > 6 && x < w-editor.layout.explorerWidth && y > 1 && y < h-2) {
            // figure out how to do mouse movement in the editor
            editor.render();
        }
    }
});

if(Deno.args[0]) editor.open(Deno.args[0]);

editor.start();