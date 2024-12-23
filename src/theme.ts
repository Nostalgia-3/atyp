import { grad, Gradient, RGB } from './utils.ts';

export type ThemeObject = {
    metadata: {
        name: string,
        id: string,
        author: string,
        notes: string
    },
    elements: Record<string, string | [string, string]>,
    colors: {
        name: string, rgb: RGB
    }[]
};

export class Theme {
    protected to: ThemeObject;

    constructor(theme: ThemeObject) {
        this.to = theme;
    }

    getElementRGB(name: string, def?: Gradient): Gradient {
        for(const el of Object.keys(this.to.elements)) {
            if(el == name) {
                const val = this.to.elements[el];
                if(typeof(val) == 'string') {
                    return this.getColor([val, val], def);
                } else {
                    return this.getColor(val, def);
                }
            }
        }

        return def ?? grad([120, 120, 120]);
    }

    getColor(name: [string, string], def?: Gradient): Gradient {
        const col1 = this.to.colors.find((v=>v.name == name[0])) ?? { name: 'cannot', rgb: def?.[0] ?? [140, 140, 140] };
        const col2 = this.to.colors.find((v=>v.name == name[1])) ?? { name: 'cannot', rgb: def?.[0] ?? [140, 140, 140] };
        return [col1.rgb, col2.rgb];
    }
}