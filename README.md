# atyp

Atypical (atyp) is a mode-based command line text editor written in TypeScript. It uses Deno, and is (almost) written from scratch. It's very bad, and in a state you probably shouldn't try to use on anything you care about.

## Building

You can build using the `compile` subcommand for Deno. To compile on Windows, run `deno compile -A src/index.ts -o atyp.exe`.

## Planned Features

FYI: this is not complete, and there's a pretty real chance that most of these won't be implemented, but hey, dream big!

- Syntax highlighting system
- Lots of themes
- "Documentation" mode
  - Buffers that can lead to other buffers (e.g. pressing enter on highlighted text will change the buffer to another RO file)
  - Well written documentation
- Readable and optimized code
  - Rendering won't redraw everything
- Moddable command system
  - Ability to easily make commands in TypeScript
  - Scripting language for the command-line (something like `@ print("Hello, world")`)
- Most, if not all, keys on a standard keyboard are handled properly
- Mouse support
- Selecting and modifying more than one character
- Plugin system
