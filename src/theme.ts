// This is a copy of the theme so we can use
// $HOME/atyp/themes/default.json

import { Editor } from "./index.ts";

export type Theme = {
    metadata: {
        name: string,
        id: string,
        author: string,
        notes?: string
    },

    elements: Record<string, string>,

    colors: {name: string, rgb: number[]}[]
};

export class ThemeManager {
    editor: Editor;
    themes: Map<string, Theme>;
    activeTheme: string;

    constructor(ed: Editor) {
        this.editor = ed;
        this.themes = new Map<string, Theme>();

        this.activeTheme = 'default';
    }

    async setTheme(id: string) {
        const theme = this.themes.get(id);

        if(theme == undefined) {
            this.editor.spawnError(`Unknown theme id: ${id}`);
            return;
        }

        this.activeTheme = id;

        await this.editor.render();
    }

    get(name: 'foreground' | 'background' | 'selected_line' | 'info_bar_back' | 'info_bar_front' | 'tilda_empty' | 'tab_count' | 'mode_color' | 'line_num' | 'menu_bar_front' | 'menu_bar_selected' | 'menu_bar_back' | 'menu_bar_object' | 'menu_bar_func' | 'unknown' | string): number[] {
        const theme = this.themes.get(this.activeTheme);

        if(theme == undefined) { return [255, 255, 255]; }

        const c = theme.elements[name];

        // Handle this cooler
        if(!c) { return [255, 255, 255]; }

        return this.getColor(c);
    }

    getTheme(name: string) {
        if(this.themes.get(name)) return true;
        return false;
    }

    getColor(name: string): number[] {
        const theme = this.themes.get(this.activeTheme);

        if(theme == undefined) { return [255, 255, 255]; }

        for(let i=0;i<theme.colors.length;i++) {
            if(theme.colors[i].name == name) {
                return theme.colors[i].rgb;
            }
        }

        return [255, 255, 255];
    }

    async load(b: string) {
        try {
            JSON.parse(b);
        } catch {
            await this.editor.spawnError(`Unable to load ${b}!`);
        }

        const t = JSON.parse(b) as Theme;

        this.themes.set(t.metadata.id, t);
    }
}

export const DEFAULT_THEME = {
    "metadata": {
        "name": "Default",
        "id": "default",
        "author": "Nostalgia3",
        "notes": "Base theme for atyp"
    },

    "elements": {
        "foreground": "white",
        "background": "black",

        "selected_line": "gray3",

        "info_bar_back": "gray1",
        "info_bar_front": "white",
        
        "tilda_empty": "gray2",
        "tab_count": "lyellow",
        "mode_color": "green",
        "line_num": "lyellow",
        "tab_fore": "white",
        "tab_back": "gray4",
        "tab_back_selected": "gray5",

        "sel_back": "black2",
        
        "menu_bar_front": "white",
        "menu_bar_selected": "menublack",
        "menu_bar_back": "gray3",

        "menu_bar_object": "magenta",
        "menu_bar_func": "cyan",

        "select_fore": "black",
        "select_back": "white",

        "unknown": "white"
    },

    "colors": [
        { "name": "menublack",  "rgb": [10, 10, 10]     },
        { "name": "black",      "rgb": [0, 0, 0]        },
        { "name": "black2",     "rgb": [80, 80, 80]     },
        { "name": "white",      "rgb": [255, 255, 255]  },
        { "name": "lred",       "rgb": [207, 87, 87]    },
        { "name": "dred",       "rgb": [156, 61, 61]    },
        { "name": "green",      "rgb": [96, 194, 81]    },
        { "name": "lyellow",    "rgb": [217, 187, 69]   },
        { "name": "dyellow",    "rgb": [186, 159, 52]   },
        { "name": "blue",       "rgb": [36, 71, 143]    },
        { "name": "magenta",    "rgb": [191, 50, 182]   },
        { "name": "cyan",       "rgb": [50, 191, 191]   },
        { "name": "gray1",      "rgb": [23, 23, 23]     },
        { "name": "gray2",      "rgb": [52, 52, 52]     },
        { "name": "gray3",      "rgb": [30, 30, 30]     },
        { "name": "gray4",      "rgb": [40, 40, 40]     },
        { "name": "gray5",      "rgb": [70, 70, 70]     }
    ]
}