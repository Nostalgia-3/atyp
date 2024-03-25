// deno-lint-ignore-file require-await
import { existsSync } from "https://deno.land/std@0.216.0/fs/mod.ts";
import { Editor, TextBuffer, Mode } from "../index.ts";

export type Type = 'string' | 'number' | 'bigint' | 'boolean' | 'symbol' | 'undefined' | 'object' | 'function';

export type Help = {
    name: string,
    description: string,
    usage: string
};

export class Command {
    name: string;

    constructor(name: string) {
        this.name = name;
    }

    getName() {
        return this.name;
    }

    checkArgs(ac: unknown[], ex: Type[]) {
        if(ac.length != ex.length) return false;

        for(let i=0;i<ac.length;i++) {
            // deno-lint-ignore valid-typeof
            if(typeof(ac) != ex[i]) {
                return false;
            }
        }

        return true;
    }

    async run(_args: string[], _editor: Editor) {
        // Stub time :sunglasses:
    }
}

export class CommandManager {
    commands: Map<string, { help: Help, run: (args: string[], editor: Editor)=>Promise<void> }>;
    editor: Editor;

    constructor(editor: Editor) {
        this.editor = editor;
        this.commands = new Map();
    }

    init() {
        this.register('q', { name: 'q', description: 'Closes the editor if all buffers are saved', usage: 'q' }, async(args: string[], editor: Editor) => {
            const curBuf = editor.buffers[editor.acBuf];

            if(curBuf.hasSaved) {
                await editor.exit();
            }

            if(args[0]) {
                editor.buffers[editor.acBuf].file = args[0];
    
                Deno.writeFileSync(args[0], new TextEncoder().encode(curBuf.getBuf()));
                curBuf.hasSaved = true;
                await editor.exit();
            } else if(!args[0] && !editor.buffers[editor.acBuf].file) {
                editor.spawnError(`Cannot save that buffer as it is not associated with any file.`);
                return;
            } else {
                Deno.writeFileSync(editor.buffers[editor.acBuf].file as string, new TextEncoder().encode(curBuf.getBuf()));
                curBuf.hasSaved = true;
                editor.mode = Mode.NORMAL;
                await editor.exit();
            }
    
            editor.mode = Mode.NORMAL;
        });

        this.register('wq', { name: 'wq', description: 'Closes editor and writes to file, but does not run if all of the buffers aren\'t saved', usage: 'wq [file: string]' }, async(args: string[], editor: Editor) => {
            const curBuf = editor.buffers[editor.acBuf];

            if(args[0]) {
                if(curBuf.canWrite) editor.buffers[editor.acBuf].file = args[0];

                if(curBuf.canWrite) Deno.writeFileSync(args[0], new TextEncoder().encode(curBuf.getBuf()));
                if(curBuf.canWrite) curBuf.hasSaved = true;
                Deno.exit(0);
            } else if(!args[0] && !editor.buffers[editor.acBuf].file) {
                if(curBuf.canWrite) editor.spawnError(`(W)rite (Q)uit required at least one argument. Provided 0.`);
                Deno.exit(0);
            } else {
                if(curBuf.canWrite) Deno.writeFileSync(editor.buffers[editor.acBuf].file as string, new TextEncoder().encode(curBuf.getBuf()));
                if(curBuf.canWrite) curBuf.hasSaved = true;
                editor.mode = Mode.NORMAL;
                return;
            }
        });

        this.register('q!', { name: 'q!', description: 'Forces the editor to quit', usage: 'q!' }, async(_args: string[], editor: Editor) => {
            await editor.exit();
        });

        this.register('w', { name: 'w', description: 'Writes to the open buffer', usage: 'w [file: string]' }, async(args: string[], editor: Editor) => {
            const curBuf = editor.buffers[editor.acBuf];
    
            if(!curBuf.canWrite) return;

            if(args[0]) {
                editor.buffers[editor.acBuf].file = args[0];
    
                Deno.writeFileSync(args[0], new TextEncoder().encode(curBuf.getBuf()));
                curBuf.hasSaved = true;
            } else if(!args[0] && !editor.buffers[editor.acBuf].file) {
                editor.spawnError(`(W)rite required at least one argument. Provided 0.`);
                return;
            } else {
                Deno.writeFileSync(editor.buffers[editor.acBuf].file as string, new TextEncoder().encode(curBuf.getBuf()));
                curBuf.hasSaved = true;
                editor.mode = Mode.NORMAL;
                return;
            }
    
            editor.mode = Mode.NORMAL;
        });

        this.register('m', { name: 'm', description: 'Moves the cursor on the y (and optionally the x) axis', usage: 'm <y: number> [x: number]' }, async function(args: string[], editor: Editor) {
            if(args[0] && !isNaN(parseInt(args[0].toLowerCase()))) {
                const y = parseInt(args[0].toLowerCase());
                editor.buffers[editor.acBuf].moveCursor(parseInt(args[1]) ?? 0, y-1);
            } else {
                editor.spawnError(`(M)ove requires at least one arg that is a number!`);
            }
        });

        this.register('o', { name: 'o', description: 'Opens the specified file', usage: 'o <file_path: string> [buf_id: number]' }, async function(args: string[], editor: Editor) {
            if(!args[0]) { editor.spawnError(`(O)pen requires at least one argument. Provided 0.`); return; }
            if(!existsSync(args[0])) { editor.spawnError(`That file doesn't exist!`); return; }

            editor.buffers.push(new TextBuffer(editor, args[0], true));
            editor.acBuf = editor.buffers.length-1;

            editor.buffers[editor.acBuf].setBuf(new TextDecoder().decode(Deno.readFileSync(editor.buffers[editor.acBuf].file as string)).replaceAll('\r',''));

            // const curBuf = editor.buffers[editor.acBuf];
        });
        
        this.register('p', { name: 'p', description: 'Opens a popup with a custom message', usage: 'p <message: string>' }, async function(args: string[], editor: Editor) {
            editor.spawnError(args.join(' '));
            editor.mode = Mode.POPUP;
        });

        this.register('t', { name: 't', description: 'Changes the theme to the specified theme', usage: 't <theme_id: string>' }, async function(args: string[], editor: Editor) {
            if(!args[0]) {
                editor.spawnError(`Requires a theme as an argument`);
                return;
            }

            if(editor.tm.getTheme(args[0])) {
                await editor.tm.setTheme(args[0]);
            } else {
                editor.spawnError(`Unknown theme: "${args[0]}"`);
                return;
            }
        });

        this.register('c', { name: 'c', description: 'Closes a buffer (if saved)', usage: 'c [id: number]' }, async function(args, editor) {
            let id = (args[0] == undefined) ? editor.acBuf : parseInt(args[0]);

            if(isNaN(id)) id = editor.acBuf;

            // TODO: Make another empty buffer if we close it
            if(editor.buffers.length == 1) return;
            if(!editor.buffers[id]) return;

            if(!editor.buffers[id]) { editor.spawnError(`Buffer with id ${id} doesn't exist!`); return; }
            if(!editor.buffers[id].hasSaved) { editor.spawnError(`That buffer needs to be saved!`); return; }

            editor.buffers.splice(id, 1);

            // Only go forward/backward if we closed the tab open
            if(id == editor.acBuf) {
                if(editor.buffers[id-1]) editor.acBuf = id-1;
                else editor.acBuf = id+1;
            }
        });

        this.register('c!', { name: 'c!', description: 'Closes a buffer', usage: 'c [id: number]' }, async function(args, editor) {
            let id = (args[0] == undefined) ? editor.acBuf : parseInt(args[0]);

            if(isNaN(id)) id = editor.acBuf;

            // TODO: Make another empty buffer if we close it
            if(editor.buffers.length == 1) return;

            if(!editor.buffers[id]) { editor.spawnError(`Buffer with id ${id} doesn't exist!`); return; }

            editor.buffers.splice(id, 1);

            // Only go forward/backward if we closed the tab open
            if(id == editor.acBuf) {
                if(editor.buffers[id-1]) editor.acBuf = id-1;
                else editor.acBuf = id+1;
            }
        });

        this.register('h', { name: 'h', description: 'Opens a readonly text buffer containing information about the editor', usage: 'h' }, async(_args: string[], editor: Editor) => {
            editor.buffers.push(new TextBuffer(editor, 'Help', false));
            editor.acBuf = editor.buffers.length-1;

            const buf = editor.buffers[editor.acBuf];

            let commands = '';

            let i=0;

            this.commands.forEach((v)=>{
                commands+=`    ${v.help.name}${editor.makeWhitespace(8-v.help.name.length)} : ${v.help.description}`;
                i++;
                if(i != this.commands.size) commands+='\n';
            });

            buf.unsafeSetBuf(`-= HELP =-\n  Commands:\n${commands}`);
        });

        this.register('lt', { name: 'lt', description: 'Loads a theme from a JSON file', usage: 't <file: string>' }, async function(args: string[], editor: Editor) {
            if(!args[0]) {
                editor.spawnError(`Requires a file as an argument`);
                return;
            }

            if(!existsSync(args[0])) {
                editor.spawnError(`That file doesn't exist!`);
                return;
            }

            await editor.tm.load(new TextDecoder().decode(Deno.readFileSync(args[0])));
        });

        this.register('tl', { name: 'tl', description: 'Moves the tab pointer left', usage: 'tl [amount:  number]' }, async function(_args: string[], editor: Editor) {
            if(editor.acBuf > 0) editor.acBuf--;
        });

        this.register('tr', { name: 'tr', description: 'Moves the tab pointer right', usage: 'tr [amount:  number]' }, async function(_args: string[], editor: Editor) {
            if(editor.acBuf < editor.buffers.length-1) editor.acBuf++;
        });

        this.register('oc', { name: 'oc', description: 'Opens a copy of the console buffer', usage: 'oc' }, async function(_args: string[], editor: Editor) {
            editor.buffers.push(editor.console);
            editor.acBuf = editor.buffers.length-1;
        });

        this.register('hil', { name: 'hil', description: 'Selects a highlighter', usage: 'hil <id: string>' }, async(args: string[], editor: Editor) => {
            if(args[0] == undefined) {
                editor.spawnError(`Requires a highlighter's id!`);
                return;
            }

            const hl = editor.hls.find((v)=>v.info.id == args[0])

            if(!hl) {
                editor.spawnError(`Couldn't find a highlighter with that id!`);
                return;
            }

            editor.buffers[editor.acBuf].acHL = hl;
        });

        this.register('r', { name: 'r', description: 'Runs a command in shell, opening stdout as a buffer', usage: 'r <command: string>' }, async(args: string[], editor: Editor) => {
            const com = args[0];
            const arg = args.slice(1);

            editor.log(com + `\n`);

            if(!com) {
                editor.spawnError(`Requires a command! Usage: ${this.commands.get('r')?.help.usage}`);
                return;
            }

            let command: Deno.Command;

            if(Deno.build.os == 'windows') {
                command = new Deno.Command('cmd', { args: ['/c', com].concat(arg) })
            } else {
                command = new Deno.Command(com, { args: arg });
            }

            const b = new TextBuffer(editor, `${com} ${arg.join(' ')}`, false);

            b.unsafeSetBuf(`Waiting for program to finish running...`);

            editor.buffers.push(b);
            editor.acBuf = editor.buffers.length-1;

            try {
                command.output().then(async(v) => {
                    const d = new TextDecoder();
                    
                    b.unsafeSetBuf(`${d.decode((v.success) ? v.stdout : v.stderr).replaceAll('\r', '')}\nProgram closed with code ${v.code}.`);

                    await editor.render();
                });
            } catch(e) {
                editor.spawnError(`${e}`);
            }
        });

        this.register('vset', { name: 'vset', description: 'Set an editor variable', usage: 'vset <id: string> <value: string>' }, async(args, editor)=>{
            if(!args[0]) {
                editor.spawnError('Requires a variable ID');
                return;
            } else if(!args[1]) {
                editor.spawnError('Requires a value');
                return;
            }

            switch(args[0]) {
                case 'home':
                    editor.spawnError('"home" is a readonly variable!');
                break;

                default:
                    if(isNaN(parseInt(args[1]))) {
                        editor.setVariable(args[0], args[1]);
                    } else {
                        editor.setVariable(args[0], parseInt(args[1]));
                    }
                break;
            }
        });

        this.register('vget', { name: 'vget', description: 'Get and create a popup containing an editor variable', usage: 'vget <id: string>' }, async(args, editor)=>{
            if(!args[0]) {
                editor.spawnError('Requires a variable ID');
                return;
            }

            if(editor.getVariable(args[0]) != null) {
                editor.spawnPopup(editor.getVariable(args[0]));
                return;
                
            }

            switch(args[0]) {
                case 'home':
                    editor.spawnPopup(editor.home.replaceAll('\\', '/') + '/atyp/');
                break;

                default:
                    editor.spawnPopup(`Unknown variable: "${args[0]}"`);
                return;
            }
        });
    }

    register(name: string, help: Help, onRun: (args: string[], editor: Editor)=>Promise<void>) {
        this.commands.set(name, { help, run: onRun });
    }

    run(name: string, args: string[]) {
        const com = this.commands.get(name);

        if(!com) return false;

        com.run(args, this.editor);
        
        return true;
    }
}