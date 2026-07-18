import type { SurfaceSchemaControlDefinition } from '@companion-surface/base'
import { ControlBase, type ControlOptions } from './base.js'

export interface ControlDisplayOptions extends ControlOptions {
	definition: SurfaceSchemaControlDefinition
}

export class ControlDisplay extends ControlBase {
	constructor(options: ControlDisplayOptions) {
		super(options)
	}

	getControlDefinition(): SurfaceSchemaControlDefinition {
		const definition = super.getControlDefinition()!

		definition.stylePreset = 'display'

		return definition
	}
}
