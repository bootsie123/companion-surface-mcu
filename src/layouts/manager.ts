import type { DropdownChoice } from '@companion-surface/base'
import type { Layout } from './base.js'
import { LayoutXTouch } from './devices/xtouch.js'
import { LayoutXTouch2 } from './devices/xtouch2.js'
import { LayoutMCUPro } from './devices/mcu-pro.js'
import { LayoutMCUPro2 } from './devices/mcu-pro2.js'

/**
 * Concrete layout constructor type.
 *
 * Represents a class (constructor) that produces a `Layout` instance and also
 * exposes static `id` and `label` properties used for user selection.
 */
export type ConcreteLayout = (new (...args: any) => Layout) & {
	id: string
	label: string
}

/**
 * Utility for registering and querying available layouts.
 *
 * Provides a list of implemented layouts, a default selection, and helpers
 * to build UI choices and convert a layout id to its constructor.
 */
export class LayoutManager {
	private static layouts: ConcreteLayout[] = [LayoutXTouch, LayoutXTouch2, LayoutMCUPro, LayoutMCUPro2]

	static readonly defaultLayout = {
		id: 'xtouch',
		type: LayoutXTouch,
	}

	/**
	 * Build a dropdown choice list suitable for the Companion config UI.
	 *
	 * @returns An array of `DropdownChoice` objects describing available layouts
	 */
	static getLayoutSelection(): DropdownChoice[] {
		return this.layouts.map((layout) => ({
			id: layout?.id || layout.name,
			label: layout?.label || layout.name,
		}))
	}

	/**
	 * Map a layout id to its constructor/type.
	 *
	 * @param id Layout id string
	 *
	 * @returns The matching layout constructor or the default layout type
	 */
	static layoutIdToType(id: string): ConcreteLayout {
		return this.layouts.find((layout) => id === layout.id) || this.defaultLayout.type
	}
}
