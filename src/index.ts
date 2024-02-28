import { goTo, showCursor, hideCursor } from "https://denopkg.com/iamnathanj/cursor@v2.2.0/mod.ts";
import { writeAllSync } from "https://deno.land/std@0.216.0/io/write_all.ts";
import { readKeypress } from "https://deno.land/x/keypress@0.0.11/mod.ts";
import { existsSync } from "https://deno.land/std@0.216.0/fs/mod.ts";
import { CommandManager } from './commands/index.ts';
import { HighlighterNone } from "./builtin.ts";
import { Highlighter } from './highlighter.ts';
import { DEFAULT_THEME, ThemeManager } from './theme.ts'

// Taken from https://deno.land/x/dir
function home_dir(): string | null {
    switch (Deno.build.os) {
      case "linux":
      case "darwin":
        return Deno.env.get("HOME") ?? null;
      case "windows":
        return Deno.env.get("USERPROFILE") ?? null;
    }
    return null;
}

const home = home_dir();

function ansiRegex({onlyFirst = false} = {}) {
    const pattern = [
        '[\\u001B\\u009B][[\\]()#;?]*(?:(?:(?:(?:;[-a-zA-Z\\d\\/#&.:=?%@~_]+)*|[a-zA-Z\\d]+(?:;[-a-zA-Z\\d\\/#&.:=?%@~_]*)*)?\\u0007)',
        '(?:(?:\\d{1,4}(?:;\\d{0,4})*)?[\\dA-PR-TZcf-nq-uy=><~]))'
    ].join('|');

    return new RegExp(pattern, onlyFirst ? undefined : 'g');
}

export enum Mode {
    NORMAL='N',
    COMMAND='C',
    INSERT='I',
    POPUP='P',
    SELECT='S',
    DOCS='D'
}

export class TextBuffer {
    file?: string;
    editor: Editor;
    protected buffer = '';
    offset = 0;
    canWrite: boolean;
    hasSaved = true;
    cursor = {
        x: 0, y: 0, c: 0,

        sel_start: 0,
        sel_x: 0,
        sel_y: 0
    };

    constructor(e: Editor, file?: string, canWrite = true) {
        this.editor = e;
        this.canWrite = canWrite;
        this.file = file;
    }

    getBuf() { return this.buffer; }
    getOffset() { return this.offset; }
    getCursor() { return this.cursor; }

    setBuf(buf: string) { if(!this.canWrite) return; this.buffer = buf; }
    writeBuf(buf: string) { this.buffer = buf; }
    setHasBufSaved(b: boolean) { this.hasSaved = b; }

    getLinesBefore(lines: string[], i: number) {
        const l = lines.slice(0, i);
        let s = '';
        for(let i=0;i<l.length;i++) { s += l[i]; }
        return s.length+l.length; // +l.length for counting newlines
    }

    left() {
        const lines = this.buffer.split('\n');
        if((this.cursor.x)>0) { this.cursor.x--; this.cursor.c--; }
        else if(lines[this.cursor.y+this.offset-1] != null) { this.cursor.y--; this.cursor.x = lines[this.cursor.y+this.offset].length; this.cursor.c--; }
    }

    right() {
        const lines = this.buffer.split('\n');
        const cLine = lines[this.cursor.y+this.offset];
        if(this.cursor.x < cLine.length) { this.cursor.x++; this.cursor.c++; }
        else if(lines[this.cursor.y+this.offset+1] != null) { this.cursor.x=0;this.cursor.y++;this.cursor.c++; }
    }

    up() {
        const lines = this.buffer.split('\n');

        if(this.editor.renderMenu) {
            this.editor.menuUp();
            return;
        }

        if(lines[this.cursor.y + this.offset - 1] != null) {
            if(this.cursor.y == 0 && this.offset > 0) this.offset--;
            else this.cursor.y--;

            if(lines[this.cursor.y+this.offset][this.cursor.x] == null) {
                this.cursor.x = lines[this.cursor.y+this.offset].length;
                this.cursor.c = this.getLinesBefore(lines, this.cursor.y+this.offset);
            } else {
                this.cursor.c = this.getLinesBefore(lines, this.cursor.y+this.offset)+this.cursor.x;
            }
        } else {
            this.editor.bell();
        }
    }

    down() {
        const termSize = Deno.consoleSize();
        const lines = this.buffer.split('\n');

        if(this.editor.renderMenu) {
            this.editor.menuDown();
            return;
        }

        if(lines[this.cursor.y+this.offset+1] != null) {
            if(this.cursor.y == termSize.rows-4) {
                this.offset++;
            } else {
                this.cursor.y++;
            }

            if(lines[this.cursor.y+this.offset][this.cursor.x] == null) {
                this.cursor.x = lines[this.cursor.y+this.offset].length;
                this.cursor.c = this.getLinesBefore(lines, this.cursor.y+this.offset)+lines[this.cursor.y+this.offset].length;
            } else {
                this.cursor.c = this.getLinesBefore(lines, this.cursor.y+this.offset);
            }
        } else {
            this.editor.bell();
        }
    }

    moveCursor(x: number, y: number) {
        const termSize = Deno.consoleSize();
        if(termSize.rows-1 >= y) {
            this.cursor.y = y;
            this.offset = 0;
            this.cursor.c = this.getLinesBefore(this.buffer.split('\n'), this.cursor.y);
        } else {
            this.cursor.c = this.getLinesBefore(this.buffer.split('\n'), this.cursor.y+this.offset);
            this.cursor.y = 0;
            this.offset = y;
        }

        this.cursor.x = x;
    }
}

export class Editor {
    config: { drawLines: boolean, listenBell: boolean, tab: number };

    mode = Mode.NORMAL;         // Mode for input
    debugMessage = '';          // Debug message shown on the info bar
    
    cm: CommandManager;         // Command manager
    tm: ThemeManager;           // Theme manager

    // file = '';               // File name
    popupText = '';             // Text for popup
    popupVisible = false;       // Whether or not the popup is visible
    
    renderMenu = false;         // Whether or not the menu should be rendered
    selectedMenuItem: number;   // 
    

    console: TextBuffer;    // Buffer for logging
    buffers: TextBuffer[];  // List of buffers
    acBuf: number;          // Pointer to active buffer in buffers

    command: TextBuffer;    // Command buffer

    constructor() {
        this.buffers = [];
        this.config = { drawLines: false, listenBell: false, tab: 4 };

        this.cm = new CommandManager(this);
        this.tm = new ThemeManager(this);

        this.loadConfig();
        this.loadThemes();

        this.command = new TextBuffer(this);
        this.console = new TextBuffer(this);

        this.buffers.push(new TextBuffer(this));
        this.acBuf = 0;

        this.selectedMenuItem = 0;

        this.cm.init();
    }

    // Handle pressing return in doc
    docReturn() {
        const curBuf = this.buffers[this.acBuf];

        // Get all of the "links," AKA {link}

        this.findLinkLocations(curBuf.getBuf());
    }

    findLinkLocations(file: string) {
        const sections = file.split('\n');
        for(let i=0;i<sections.length;i++) {
            this.console.setBuf(this.console.getBuf() + `${i} | ${sections[i]}: ${sections[i].search(/{.+}/)}\n`);
        }
    }

    select() {
        this.mode = Mode.SELECT;
        const curBuf = this.buffers[this.acBuf];

        const { x, y, c } = curBuf.getCursor();

        curBuf.cursor.sel_start = c;
        curBuf.cursor.sel_x = x;
        curBuf.cursor.sel_y = y+curBuf.getOffset();
    }

    selectLeft() {
        const curBuf = this.buffers[this.acBuf];

        curBuf.left();
    }
    
    selectRight() {
        const curBuf = this.buffers[this.acBuf];

        curBuf.right();
    }

    menuUp() {
        if(this.selectedMenuItem > 0) {
            this.selectedMenuItem--;
        }
    }

    menuDown() {

    }

    protected async clear(background: number[]) {
        let t = this.col(background);
        const termSize = Deno.consoleSize();
        for(let i=0;i<termSize.columns*termSize.rows;i++) {
            t += ' ';
        }

        await goTo(0, 0);
        writeAllSync(Deno.stdout, new TextEncoder().encode(t));
    }

    protected async drawPopup() {
        const termSize = Deno.consoleSize();

        const width = this.popupText.length+4;
        const height = 5;

        let x = 0;
        let y = 0;

        let top = '';
        let mid = '';
        let bot = '';

        for(let i=0;i<width;i++) {
            if(i == 0) { top+='┌'; mid+= '│'; bot+= '└'; }
            else if(i == width-1) { top+='┐'; mid+= '│'; bot+='┘';}
            else { top+='─'; bot+='─'; mid+=' '; }
        }

        x = Math.floor(termSize.columns/2);
        y = Math.floor(termSize.rows/2);

        await goTo(x-Math.floor(width/2), y-Math.floor(height/2));
        writeAllSync(Deno.stdout, new TextEncoder().encode(top));
        await goTo(x-Math.floor(width/2), y-Math.floor(height/2)+1);
        writeAllSync(Deno.stdout, new TextEncoder().encode(mid));
        await goTo(x-Math.floor((this.popupText.length+4)/2), y);
        writeAllSync(Deno.stdout, new TextEncoder().encode('│ ' + this.popupText + ' │'));
        await goTo(x-Math.floor(width/2), y-Math.floor(height/2)+3);
        writeAllSync(Deno.stdout, new TextEncoder().encode(mid));
        await goTo(x-Math.floor(width/2), y-Math.floor(height/2)+4);
        writeAllSync(Deno.stdout, new TextEncoder().encode(bot));
    }

    protected async drawBuffer(hl: Highlighter) {
        await goTo(0, 0);
    
        const termSize = Deno.consoleSize();

        const buffer = this.buffers[this.acBuf].getBuf();
        const offset = this.buffers[this.acBuf].getOffset();

        const curBuf = this.buffers[this.acBuf];

        const lines = buffer.split('\n');

        let renderedLines = 0;

        for(let i=offset;i<termSize.rows+offset-2;i++) {
            if(i-offset >= termSize.rows-2) break;

            const lineNum = (this.config.drawLines ? (this.col(this.tm.get('line_num'),true) + this.getLineNum(i+1, lines) + ' ' + this.col(this.tm.get('foreground'),true)) : '');
            const selectedLine = ((i == (curBuf.getCursor().y+offset)) ? this.col(this.tm.get('selected_line')) : this.col(this.tm.get('background')));

            if(lines[i] != undefined) {
                let line = lines[i].substring(0, termSize.columns-this.stripAnsi(lineNum).length);

                if(this.mode == Mode.SELECT) {
                    if(curBuf.cursor.sel_y == i) {
                        const xOff = Math.abs(curBuf.cursor.x-curBuf.cursor.sel_x);

                        if(xOff < 0) {
                            line = line.substring(0, curBuf.cursor.sel_x-xOff) + this.col(this.tm.get('sel_back')) + line.substring(curBuf.cursor.sel_x-xOff, curBuf.cursor.sel_x) + selectedLine + line.substring(curBuf.cursor.sel_x);
                        } else {
                            line = line.substring(0, curBuf.cursor.sel_x) + this.col(this.tm.get('sel_back')) + line.substring(curBuf.cursor.sel_x, curBuf.cursor.sel_x+xOff) + selectedLine + line.substring(curBuf.cursor.sel_x+xOff);
                        }
                    }
                }

                writeAllSync(Deno.stdout, new TextEncoder().encode(selectedLine + lineNum + hl.parseLine(line) + this.makeWhitespace(termSize.columns - this.stripAnsi(lineNum).length - lines[i].length) + this.col(this.tm.get('background')) + '\n'));
            } else {
                writeAllSync(Deno.stdout, new TextEncoder().encode(this.makeWhitespace(this.stripAnsi(lineNum).length) + this.col(this.tm.get('tilda_empty'), true) + '~' + '\n'));
            }

            renderedLines++;
        }
    }

    protected async drawMenu() {
        const termSize = Deno.consoleSize();
        const menuHeight = 10;
        const menuWidth = 20;

        const cursor = this.buffers[this.acBuf].getCursor();

        if(cursor.y+menuHeight < termSize.rows-2) { // Draw down
            for(let i=0;i<menuHeight;i++) {
                await goTo(cursor.x+4, cursor.y+i+2);
                const menuLine = ` ${this.col(this.tm.get('menu_bar_object'), true)}\uea8c${this.col(this.tm.get('foreground'), true)} hello`;
                const highlight = ((i == this.selectedMenuItem) ? this.col(this.tm.get('menu_bar_selected')) : '');
                writeAllSync(Deno.stdout, new TextEncoder().encode(this.col(this.tm.get('menu_bar_back')) + highlight + this.col(this.tm.get('foreground'),true) + menuLine + this.makeWhitespace(menuWidth-this.stripAnsi(menuLine).length) + this.col(this.tm.get('menu_bar_back'))));
            }
        }
    }

    makeWhitespace(amount: number) {
        let s = '';
        for(let i=0;i<amount;i++) s+=' ';
        return s;
    }

    protected async drawInfoBar(message: string, mRight: string, background: number[]) {
        let t: string = this.col(background);
        const termSize = Deno.consoleSize();
    
        t += message;

        for(let i=message.replace(ansiRegex(), '').length;i<termSize.columns-mRight.replace(ansiRegex(), '').length;i++) {
            t+=' ';
        }

        t += mRight;
    
        await goTo(0, termSize.rows-1);
        writeAllSync(Deno.stdout, new TextEncoder().encode(t));
    }

    protected async drawCommandBar(msg: string) {
        if(this.mode != Mode.COMMAND) return;

        let t: string = this.col(this.tm.get('background'));
        const termSize = Deno.consoleSize();
    
        t += ':';
    
        for(let i=1;i<termSize.columns;i++) {
            if(msg[i-1])  t+=msg[i-1];
            else          t+=' ';
        }
    
        await goTo(0, termSize.rows);
        writeAllSync(Deno.stdout, new TextEncoder().encode(t));
    }

    protected loadThemes() {
        // Default theme
        if(!existsSync(home+'/atyp/themes/', { isDirectory: true })) {
            Deno.mkdirSync(home+'/atyp/themes');
        }

        if(!existsSync(home+'/atyp/themes/default.json', { isFile: true })) {
            Deno.writeFileSync(home+'/atyp/themes/default.json', new TextEncoder().encode(JSON.stringify(DEFAULT_THEME)));
        }

        const files = Deno.readDirSync(home+'/atyp/themes/');

        const decoder = new TextDecoder();

        for(const file of files) {
            if(!file.isFile) continue;

            try { JSON.parse(decoder.decode(Deno.readFileSync(`${home}/atyp/themes/${file.name}`))) }
            catch { continue; }

            this.tm.load(decoder.decode(Deno.readFileSync(`${home}/atyp/themes/${file.name}`)));
        }
    }

    protected loadConfig() {
        if(!existsSync(home+'/atyp/', {isDirectory: true})) {
            console.error('No atyp folder - Making one');
            Deno.mkdirSync(home+'/atyp/');
        }
        
        if(!existsSync(home+'/atyp/config.json')) {
            console.error('No config file - Making one');
            Deno.writeFileSync(home+'/atyp/config.json', new TextEncoder().encode(JSON.stringify({
                drawLines: false,
                listenBell: true,
                tab: 4
            })));
        }

        try {
            this.config = JSON.parse(new TextDecoder().decode(Deno.readFileSync(home + '/atyp/config.json')));
        } catch {
            this.config = { drawLines: false, listenBell: false, tab: 4 };
        }
    }

    stripAnsi(s: string): string { return s.replaceAll(ansiRegex(), ''); }

    async showPopup() { this.mode = Mode.POPUP; this.popupVisible = true; await this.render(); }
    closePopup() { this.mode = Mode.NORMAL; this.popupVisible = false; }

    async render() {
        const c = Deno.consoleSize();

        const curBuf = this.buffers[this.acBuf];
        const buffer = this.buffers[this.acBuf].getBuf();
        const cursor = this.buffers[this.acBuf].getCursor();
        const offset = this.buffers[this.acBuf].getOffset();

        const lines = buffer.split('\n');

        const mode = `${this.col(this.tm.get('mode_color'),true)}${this.mode}${this.col(this.tm.get('foreground'),true)}`;
        const cursorPos = `${cursor.x+1}:${cursor.y+offset+1}`;
        const amount = `${this.col(this.tm.get('tab_count'),true)}${this.config.tab}${this.col(this.tm.get('foreground'),true)}`;

        // Make tab string
        let tabs = ``;

        for(let i=0;i<this.buffers.length;i++) {
            const fi = this.buffers[i].file;

            if(fi == null) {
                tabs += `${this.makeTabString('---', i)}${this.col(this.tm.get('info_bar_back'))}`;
            } else {
                tabs += `${this.makeTabString(fi as string, i)}${this.col(this.tm.get('info_bar_back'))}`;
            }
        }

        await hideCursor();

        await this.clear(this.tm.get('background'));
        await this.drawBuffer(new HighlighterNone(this.tm));
        await this.drawInfoBar(`${mode} ${curBuf.canWrite ? '':'(RO) '} ${this.col(this.tm.get('info_bar_front'),true)}${this.debugMessage} ${tabs}`, `${cursorPos} ${amount}`, this.tm.get('info_bar_back'));
        await this.drawCommandBar(this.command.getBuf());
        if(this.renderMenu) await this.drawMenu();
        
        if(this.mode == Mode.POPUP) await this.drawPopup();
        
        if(this.mode == Mode.COMMAND) {
            const comCursor = this.command.getCursor();
            await goTo(comCursor.x+2, c.rows);
        } else {
            await goTo(cursor.x+1+((this.config.drawLines) ? (this.getLineNum(0, lines).length+1) : 0), (cursor.y>0)?(cursor.y+1):(cursor.y));
        }

        await showCursor();

        // Change cursor depending on what you're doing
        // @TODO make this a configurable item
        if(this.mode == Mode.NORMAL) {
            writeAllSync(Deno.stdout, new TextEncoder().encode('\x1b[\x31 q'));
        } else {
            writeAllSync(Deno.stdout, new TextEncoder().encode('\x1b[\x35 q'));
        }
    }

    async writeToBuf(text: string, inCommand = false) {
        if(inCommand) {
            const comCursor = this.command.getCursor();
            const b = this.command.getBuf().slice(0, comCursor.x);
            const e = this.command.getBuf().slice(comCursor.x);
            this.command.setBuf(b + text + e);
            comCursor.x++;
            await this.render();
            return;
        }

        const activeBuf = this.buffers[this.acBuf];

        activeBuf.setHasBufSaved(false);
        const cursor = activeBuf.getCursor();
        const buffer = activeBuf.getBuf();

        const b = buffer.slice(0, cursor.c);
        const e = buffer.slice(cursor.c);
        activeBuf.setBuf(b + text + e);
        
        const termSize = Deno.consoleSize();

        if(text == '\n') {
            if(cursor.y > termSize.rows-4) {
                activeBuf.offset++;
            } else {
                cursor.y++;
            }

            cursor.c++; cursor.x=0;
        } else {
            cursor.x+=text.length; cursor.c+=text.length;
        }

        await this.render();
    }

    async removeCharForward(inCommand = false) {
        const acBuf  = this.buffers[this.acBuf];
        const cursor = acBuf.getCursor();
        const buffer = acBuf.getBuf();

        if(inCommand) {
            if(!this.command.getBuf()[this.command.cursor.x]) return;
            this.command.setBuf(buffer.slice(0, this.command.cursor.x).concat(buffer.slice(this.command.cursor.x+1)));
            await this.render();
        }
        
        if(!buffer[cursor.c]) return;
    
        acBuf.setHasBufSaved(false);

        acBuf.setBuf(buffer.slice(0, cursor.c).concat(buffer.slice(cursor.c+1)));
    }

    async removeChar(inCommand = false) {
        const acBuf  = this.buffers[this.acBuf];
        const cursor = acBuf.getCursor();
        const buffer = acBuf.getBuf();

        if(inCommand) {
            this.command.setBuf(this.command.getBuf().slice(0, this.command.cursor.x-1));
            this.command.cursor.x--;
            await this.render();
            return;
        }
    
        acBuf.setHasBufSaved(false);

        const lines = buffer.split('\n');
    
        if(buffer[cursor.c-1] == null) {
            return;
        }

        if(buffer[cursor.c-1] == '\n') {
            cursor.y--;
            cursor.x=lines[cursor.y].length;
        } else {
            cursor.x--;
        }

        acBuf.setBuf(buffer.slice(0, cursor.c-1).concat(buffer.slice(cursor.c)));
        cursor.c--;
    }

    async exit(code = 0) {
        await showCursor();
        writeAllSync(Deno.stdout, new TextEncoder().encode('\x1b[0m'));
        console.clear();
        Deno.exit(code);
    }

    async spawnError(msg: string) {
        // create a popup that is on the middle of the screen
        this.popupText = msg;
        await this.showPopup();
        this.bell();
    }

    async runCommand(c: string) {
        const cleanedString = c.trim();
        const sections = cleanedString.split(' ');

        this.mode = Mode.NORMAL;

        const ce = this.cm.run(sections[0], sections.slice(1));

        if(!ce) {
            await this.spawnError(`Unknown command: ${sections[0]}`);
        }
    }

    open(file: string) {
        if(existsSync(file)) {
            editor.buffers[editor.acBuf].file = file;
            editor.buffers[editor.acBuf].setBuf(new TextDecoder().decode(Deno.readFileSync(editor.buffers[editor.acBuf].file as string)).replaceAll('\r',''));
        } else {
            editor.buffers[editor.acBuf].file = file;
        }
    }

    bell() {
        if(this.config.listenBell) writeAllSync(Deno.stdout, new TextEncoder().encode('\x07'));
    }

    col(c: number[], front = false) {
        return `\x1b[${front?'38':'48'};2;${c[0]};${c[1]};${c[2]}m`;
    }

    underline() { return `\x1b[4m`; }
    noUnderline() { return `\x1b[24m`; }

    getLineNum(l: number, lines: string[]) {
        let len = 1;

        if(lines.length != 0) {
            len = lines.length.toString().padStart(2, ' ').length;
        }
    
        return l.toString().padStart(len, ' ');
    }

    // Opens a cool little menu for stuff
    openMenu() {
        this.renderMenu = true;
    }

    makeTabString(fn: string, i: number) {
        const back = (i == this.acBuf) ? 'tab_back_selected' : 'tab_back';
        return `${this.col(this.tm.get(back))} (${i}) ${fn}${this.makeWhitespace(10-fn.length)} ${this.col(this.tm.get('info_bar_back'))}`;
    }
}

const editor = new Editor();

if(Deno.args[0]) { editor.open(Deno.args[0]); }

await editor.render();

for await (const keypress of readKeypress()) {
    if (keypress.ctrlKey && keypress.key === 'c') await editor.exit();
    if(!keypress.key) {
        Deno.exit();
    }

    const activeBuf = editor.buffers[editor.acBuf];

    if(editor.mode == Mode.NORMAL) {
        switch(keypress.key) {
            case 'i':
                editor.mode = Mode.INSERT;
            break;

            case 'd':
                editor.mode = Mode.DOCS;
            break;

            case 's':
                editor.select();
            break;

            case ':':
                editor.mode = Mode.COMMAND;
            break;

            case 'left':    activeBuf.left();     break;
            case 'right':   activeBuf.right();    break;
            case 'up':      activeBuf.up();       break;
            case 'down':    activeBuf.down();     break;
            default:        editor.bell();        break;
        }
    } else if(editor.mode == Mode.INSERT) {
        switch(keypress.key) {
            case 'left':    activeBuf.left();     break;
            case 'right':   activeBuf.right();    break;
            case 'up':      activeBuf.up();       break;
            case 'down':    activeBuf.down();     break;

            case 'end':

            break;

            case 'backspace':
                await editor.removeChar();
            break;

            case 'delete':
                if(editor.buffers[editor.acBuf].getBuf().length >= 1) { await editor.removeCharForward(); } else editor.bell();
            break;

            case 'tab': {
                let s = '';
                for(let i=0;i<editor.config.tab;i++) s+=' ';
                await editor.writeToBuf(s);
            break; }

            case 'return':
                await editor.writeToBuf('\n');
                editor.buffers[editor.acBuf].hasSaved = false;
            break;

            case 'escape':
                editor.mode = Mode.NORMAL;
            break;

            case '`':
                if(keypress.ctrlKey) editor.openMenu();
                else await editor.writeToBuf('`');
            break;

            case '/':
                await editor.writeToBuf('/');
            break;

            case 'space':
                await editor.writeToBuf(' ');
            break;

            default: await editor.writeToBuf(keypress.key); break;
        }
    } else if(editor.mode == Mode.COMMAND) {
        switch(keypress.key) {
            case 'left': if(editor.command.cursor.x>0) { editor.command.cursor.x--; } break;
            case 'right': { if(editor.command.cursor.c < editor.command.getBuf().length) { editor.command.cursor.x++; } break; }
            case 'backspace': if(editor.command.getBuf().length >= 1) await editor.removeChar(true); else editor.bell(); break;
            case 'delete': if(editor.command.getBuf().length >= 1) { await editor.removeCharForward(true); } else editor.bell(); break;

            case 'up': break;
            case 'down': break;

            case 'return':
                await editor.runCommand(editor.command.getBuf());
                editor.command.setBuf('');
                editor.command.cursor.x=0;
            break;

            case 'escape':
                editor.command.setBuf('');
                editor.command.cursor.x=0;
                editor.mode = Mode.NORMAL;
            break;

            case 'space': await editor.writeToBuf(' ', true); break;
            default: await editor.writeToBuf(keypress.key, true); break;
        }
    } else if(editor.mode == Mode.POPUP) {
        editor.closePopup();

        if(keypress.key == ':') {
            editor.mode = Mode.COMMAND;
        }
    } else if(editor.mode == Mode.SELECT) {
        switch(keypress.key) {
            case 'right': editor.selectRight(); break;
            case 'left':  editor.selectLeft();  break;

            case 'escape':
                editor.mode = Mode.NORMAL;
            break;

            default:
                editor.bell();
            break;
        }
    } else if(editor.mode == Mode.DOCS) {
        switch(keypress.key) {
            case 'left':    activeBuf.left();     break;
            case 'right':   activeBuf.right();    break;
            case 'up':      activeBuf.up();       break;
            case 'down':    activeBuf.down();     break;

            case 'return':
                editor.docReturn();
            break;

            case 'escape':
                editor.mode = Mode.NORMAL;
            break;

            default:
                editor.bell();
            break;
        }
    }

    await editor.render();
}