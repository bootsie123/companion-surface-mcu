import type {
	SurfaceDrawProps,
	SurfaceInputVariable,
	SurfaceOutputVariable,
	SurfaceSchemaControlDefinition,
	SurfaceSchemaControlStylePreset,
	SurfaceSchemaLayoutDefinition,
} from '@companion-surface/base'
import type MidiMessage from '../midi.d.ts'
import hash from 'object-hash'
import { nanoid } from 'nanoid'

/**
 * MIDI trigger used to match incoming MIDI messages to a control or to send outgoing messages.
 */
export interface MidiTrigger {
	type?: MidiTriggerType // The type of MIDI message (e.g., NoteOn, ControlChange, PitchBendChange, SysEx)
	channel?: number // The MIDI channel number (indexed from 1) for the trigger (if applicable)
	note?: number // The MIDI note number for the trigger (if applicable)
	control?: number // The MIDI control number for the trigger (if applicable)
	number?: number // The MIDI number for the trigger (if applicable)
}

/**
 * Common MIDI trigger message types.
 */
export enum MidiTriggerType {
	Fader = 'PitchBendChange',
	Button = 'NoteOn',
	Encoder = 'ControlChange',
	Meter = 'ChannelKeyPressure',
	Display = 'SysEx',
	SegmentDisplay = 'ControlChange',
}

/**
 * Maps actions to the corresponding Companion context function.
 */
export enum ContextEventMap {
	KeyDown = 'keyDownById',
	KeyUp = 'keyUpById',
	KeyDownUp = 'keyDownUpById',
	RotateLeft = 'rotateLeftById',
	RotateRight = 'rotateRightById',
}

/**
 * Defines the interface for sending messages and events from a control.
 */
export interface ControlMessenger {
	sendMidi(message: MidiMessage | MidiMessage[]): void

	sendEvent(eventType: ContextEventMap, id: string): void

	sendVariableValue(name: string, value: any): void
}

/**
 * Configuration options provided when creating a control instance.
 */
export interface ControlOptions {
	midiTriggers?: MidiTrigger | string | (MidiTrigger | string)[] // The MIDI trigger(s) associated with the control
	messenger: ControlMessenger // The messenger used to send messages and events from the control
	definition?: SurfaceSchemaControlDefinition // The control definition for the control
	stylePresets: SurfaceSchemaLayoutDefinition['stylePresets'] // The style presets available for the control
}

/**
 * Abstract base class for controls.
 *
 * ControlBase manages shared control behavior such as MIDI trigger hashing,
 * stable ID creation, style preset resolution, and messaging to the Companion
 * runtime. Subclasses override event handling, variable updates, and drawing
 * behavior for specific control types like buttons, encoders, faders, and
 * displays.
 */
export abstract class ControlBase {
	protected readonly options: ControlOptions // The configuration options provided when creating the control

	protected readonly midiTriggerHashes: string[] = [] // The hashes of the MIDI triggers associated with the control

	protected readonly controlId: string // The stable ID for the control, derived from MIDI triggers or generated if none are provided

	protected readonly stylePreset: SurfaceSchemaControlStylePreset // The style preset resolved from the control definition or default style preset

	/**
	 * Initializes the control with the supplied options.
	 *
	 * @param options The configuration options for the control
	 */
	constructor(options: ControlOptions) {
		this.options = options

		const stylePresets = this.options.stylePresets
		const requestedPreset = this.options.definition?.stylePreset

		if (requestedPreset && stylePresets[requestedPreset]) {
			this.stylePreset = stylePresets[requestedPreset]
		} else {
			this.stylePreset = stylePresets.default
		}

		let triggers = this.options.midiTriggers

		if (triggers) {
			if (!Array.isArray(triggers)) {
				triggers = [triggers]
			}

			for (const midiTrigger of triggers) {
				this.midiTriggerHashes.push(
					hash(midiTrigger, {
						respectType: false,
					}),
				)
			}

			if (this.midiTriggerHashes.length === 1) {
				this.controlId = this.midiTriggerHashes[0]
			} else {
				this.controlId = hash(this.midiTriggerHashes, {
					respectType: false,
				})
			}
		} else {
			this.controlId = nanoid()
		}
	}

	/**
	 * Returns the ID for this control.
	 *
	 * @returns The control's ID
	 */
	get id(): string {
		return this.controlId
	}

	/**
	 * Returns the hashes of theMIDI triggers for the control.
	 *
	 * @returns An array of MIDI trigger hashes
	 */
	get midiTriggers(): string[] {
		return this.midiTriggerHashes
	}

	/**
	 * Returns the definition for the control.
	 *
	 * @returns The control definition or undefined if none is available
	 */
	getControlDefinition(): SurfaceSchemaControlDefinition | undefined {
		return this.options.definition
	}

	/**
	 * Return any input/output variables exposed by the control.
	 * Override in derived controls to expose specific transfer variables.
	 *
	 * @returns An array of SurfaceInputVariable or SurfaceOutputVariable
	 * 			objects, or an empty array if none are exposed
	 */
	getTransferVariables(): (SurfaceInputVariable | SurfaceOutputVariable)[] {
		return []
	}

	/**
	 * Handle an incoming MIDI message for this control.
	 * Override in derived controls to implement custom behavior.
	 *
	 * @param message The incoming MIDI message to handle
	 */
	onMidiMessage(_message: MidiMessage): void {}

	/**
	 * Handle a variable value change from Companion.
	 * Override in derived controls to implement custom behavior.
	 *
	 * @param name The name of the variable that changed
	 * @param value The new value of the variable
	 */
	onVariableChange(_name: string, _value: unknown): void {}

	/**
	 * Sends a MIDI message through the control's messenger.
	 *
	 * @param message The MIDI message to send
	 */
	sendMidi(message: MidiMessage | MidiMessage[]): void {
		this.options.messenger.sendMidi(message)
	}

	/**
	 * Sends an event through the control's messenger.
	 *
	 * @param eventType The type of event to send
	 */
	sendEvent(eventType: ContextEventMap): void {
		this.options.messenger.sendEvent(eventType, this.id)
	}

	/**
	 * Sends a variable value through the control's messenger.
	 *
	 * @param name The name of the variable to update
	 * @param value The new value of the variable
	 */
	sendVariableValue(name: string, value: unknown): void {
		this.options.messenger.sendVariableValue(name, value)
	}

	/**
	 * Render the control using the provided draw properties.
	 * Override in derived controls to implement custom rendering.
	 *
	 * @param drawProps The properties from Companion used to draw the control
	 */
	draw(_drawProps: SurfaceDrawProps): void {}

	/**
	 * Blank the control clearing any visual state.
	 */
	async blank(): Promise<void> {}
}
