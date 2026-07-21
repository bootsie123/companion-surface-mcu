import type {
	SurfaceInputVariable,
	SurfaceOutputVariable,
	SurfacePincodeMap,
	SurfaceSchemaControlDefinition,
	SurfaceSchemaLayoutDefinition,
} from '@companion-surface/base'
import type { ControlBase, ControlMessenger } from '../controls/base.js'

/**
 * Abstract base for a device layout.
 */
export abstract class Layout {
	protected layoutControls: ControlBase[]

	protected controlIdMap: Map<string, ControlBase> = new Map<string, ControlBase>()

	protected messenger: ControlMessenger

	static readonly id: string
	static readonly label: string

	/**
	 * Creates a new Layout instance.
	 *
	 * @param messenger Messenger used by controls to send events and MIDI
	 */
	constructor(messenger: ControlMessenger) {
		this.messenger = messenger

		this.layoutControls = this.createLayout()

		for (const control of this.layoutControls) {
			this.controlIdMap.set(control.id, control)
		}
	}

	/**
	 * Gets the instantiated control objects for this layout.
	 *
	 * @returns An array of control instances
	 */
	get controls(): ControlBase[] {
		return this.layoutControls
	}

	/**
	 * Looks up a control instance by its generated control id.
	 *
	 * @param id The control id to lookup
	 * @returns The control instance or undefined when not found
	 */
	getControlById(id: string): ControlBase | undefined {
		return this.controlIdMap.get(id)
	}

	/**
	 * Instantiates control objects for this layout.
	 *
	 * @returns An array of control instances
	 */
	abstract createLayout(): ControlBase[]

	/**
	 * Retrieves all transfer variables exposed by every control in the layout.
	 *
	 *	@return An array of transfer variables
	 */
	getTransferVariables(): (SurfaceInputVariable | SurfaceOutputVariable)[] {
		const variables = this.controls.map((control) => control.getTransferVariables())

		return variables.flat()
	}

	/**
	 * Aggregates all control definitions into one definition for the layout.
	 * This is required by Companion's layout schema.
	 *
	 * @returns The control definitions for the layout
	 */
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

	/**
	 * Returns the mapping of pincode numbers to control IDs or null if not applicable.
	 *
	 * @return A SurfacePincodeMap or null when not applicable
	 */
	getPincodeMap(): SurfacePincodeMap | null {
		return null
	}

	/**
	 * Return the static layout definition used by Companion (controls and styles).
	 *
	 *	@returns SurfaceSchemaLayoutDefinition describing controls and style presets
	 */
	abstract getLayoutDefinition(): SurfaceSchemaLayoutDefinition
}
