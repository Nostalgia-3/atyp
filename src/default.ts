import { ThemeObject } from "./theme.ts";

export const DEFAULT_THEME: ThemeObject = {
    "metadata": {
        "name": "Default",
        "id": "default",
        "author": "Nostalgia3",
        "notes": "Base theme for atyp. This is based on a one-dark palette"
    },
    "elements": {
        "foreground": "white",
        "background": "black",

        "editor_bg": "blue",

        "explorer_title": "white",
        "explorer_active_fg": "green",
        "explorer_fg": "commentgray",
        "explorer_bg": "magenta",

        "select_back": "white",
        "select_fore": "black",

        "line_num": "commentgray",
        "selected_line_num": "lyellow",
        "selected_line": "guttergray",
        "tilda_empty": "lblack",

        "info_bar_fg": "white",
        "info_bar_bg": "lblack",
        "command_fg": "white",
        "command_bg": "guttergray",

        "unknown": "white",
        "keyword": "magenta",
        "number": "dyellow",
        "symbol": "magenta",
        "string": "green",
        "function": "cyan",
        "comment": "commentgray",

        "mode_normal_fg": "black",
        "mode_insert_fg": "black",
        "mode_command_fg": "black",

        "chevy_1": ["lblack", "black"],

        "mode_normal_bg": ["lyellow", "dyellow"],
        "mode_insert_bg": ["blue", "cyan"],
        "mode_command_bg": "magenta"
    },
    "colors": [
        { "name": "black",      "rgb": [ 40, 44, 52 ] },
        { "name": "lblack",     "rgb": [ 55, 59, 67 ] },
        { "name": "guttergray", "rgb": [ 76, 82, 99 ] },
        { "name": "commentgray","rgb": [ 92, 99, 112 ] },
        { "name": "white",      "rgb": [ 171, 178, 191 ] },
        { "name": "lred",       "rgb": [ 224, 108, 117 ] },
        { "name": "dred",       "rgb": [ 190, 80, 70 ] },
        { "name": "green",      "rgb": [ 152, 195, 121 ] },
        { "name": "lyellow",    "rgb": [ 229, 192, 123 ] },
        { "name": "dyellow",    "rgb": [ 209, 154, 102 ] },
        { "name": "blue",       "rgb": [ 97, 175, 239 ] },
        { "name": "magenta",    "rgb": [ 198, 120, 221 ] },
        { "name": "cyan",       "rgb": [ 86, 182, 194 ] }
    ]
};