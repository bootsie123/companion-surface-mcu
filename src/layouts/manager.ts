import type { DropdownChoice } from '@companion-surface/base'
import type { Layout } from './base.js'
import { LayoutXTouch } from './devices/xtouch.js'

export type ConcreteLayout = (new (...args: any) => Layout) & {
	id: string
	label: string
}

export class LayoutManager {
	private static layouts: ConcreteLayout[] = [LayoutXTouch]

	static readonly defaultLayout = {
		id: 'xtouch',
		type: LayoutXTouch,
	}

	static getLayoutSelection(): DropdownChoice[] {
		return this.layouts.map((layout) => ({
			id: layout?.id || layout.name,
			label: layout?.label || layout.name,
		}))
	}

	static layoutIdToType(id: string): ConcreteLayout {
		return this.layouts.find((layout) => id === layout.id) || this.defaultLayout.type
	}
}
