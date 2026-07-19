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

export interface MidiTrigger {
	type?: MidiTriggerType
	channel?: number
	note?: number
	control?: number
	number?: number
}

export enum MidiTriggerType {
	Fader = 'PitchBendChange',
	Button = 'NoteOn',
	Encoder = 'ControlChange',
	Meter = 'ChannelKeyPressure',
	Display = 'SysEx',
}

export enum ContextEventMap {
	KeyDown = 'keyDownById',
	KeyUp = 'keyUpById',
	KeyDownUp = 'keyDownUpById',
	RotateLeft = 'rotateLeftById',
	RotateRight = 'rotateRightById',
}

export interface ControlMessenger {
	sendMidi(message: MidiMessage | MidiMessage[]): void

	sendEvent(eventType: ContextEventMap, id: string): void

	sendVariableValue(name: string, value: any): void
}

export interface ControlOptions {
	midiTriggers?: MidiTrigger | string | (MidiTrigger | string)[]
	messenger: ControlMessenger
	definition?: SurfaceSchemaControlDefinition
	stylePresets: SurfaceSchemaLayoutDefinition['stylePresets']
}

export abstract class ControlBase {
	protected readonly options: ControlOptions

	protected readonly midiTriggerHashes: string[] = []

	protected readonly controlId: string

	protected readonly stylePreset: SurfaceSchemaControlStylePreset

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

	get id(): string {
		return this.controlId
	}

	get midiTriggers(): string[] {
		return this.midiTriggerHashes
	}

	getControlDefinition(): SurfaceSchemaControlDefinition | undefined {
		return this.options.definition
	}

	getTransferVariables(): (SurfaceInputVariable | SurfaceOutputVariable)[] {
		return []
	}

	onMidiMessage(_message: MidiMessage): void {}

	onVariableChange(_name: string, _value: unknown): void {}

	sendMidi(message: MidiMessage | MidiMessage[]): void {
		this.options.messenger.sendMidi(message)
	}

	sendEvent(eventType: ContextEventMap): void {
		this.options.messenger.sendEvent(eventType, this.id)
	}

	sendVariableValue(name: string, value: unknown): void {
		this.options.messenger.sendVariableValue(name, value)
	}

	draw(_drawProps: SurfaceDrawProps): void {}
}
