import type {
	SurfaceInputVariable,
	SurfaceOutputVariable,
	SurfaceSchemaControlDefinition,
	SurfaceSchemaLayoutDefinition,
} from '@companion-surface/base'
import type { ControlBase, ControlMessenger } from '../controls/base.js'

export abstract class Layout {
	protected layoutControls: ControlBase[]

	protected controlIdMap: Map<string, ControlBase> = new Map<string, ControlBase>()

	protected messenger: ControlMessenger

	static readonly id: string
	static readonly label: string

	constructor(messenger: ControlMessenger) {
		this.messenger = messenger

		this.layoutControls = this.createLayout()

		for (const control of this.layoutControls) {
			this.controlIdMap.set(control.id, control)
		}
	}

	get controls(): ControlBase[] {
		return this.layoutControls
	}

	getControlById(id: string): ControlBase | undefined {
		return this.controlIdMap.get(id)
	}

	abstract createLayout(): ControlBase[]

	getTransferVariables(): (SurfaceInputVariable | SurfaceOutputVariable)[] {
		const variables = this.controls.map((control) => control.getTransferVariables())

		return variables.flat()
	}

	getControlDefinitions(): { [k: string]: SurfaceSchemaControlDefinition } {
		const definitions = this.controls.reduce(
			(definitions: { [k: string]: SurfaceSchemaControlDefinition }, control: ControlBase) => {
				const definition = control.getControlDefinition()

				if (definition) {
					definitions[control.id] = definition
				}

				return definitions
			},
			{},
		)

		return definitions
	}

	abstract getLayoutDefinition(): SurfaceSchemaLayoutDefinition
}
