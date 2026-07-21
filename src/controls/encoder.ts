import {
	colorToIntensity,
	readLedColor,
	type SurfaceDrawProps,
	type SurfaceInputVariable,
	type SurfaceOutputVariable,
	type SurfaceSchemaControlDefinition,
} from '@companion-surface/base'
import { ContextEventMap, ControlBase, MidiTriggerType, type ControlOptions, type MidiTrigger } from './base.js'
import type { MidiButtonTrigger } from './button.js'
import type MidiMessage from '../midi.d.ts'
import { BitSet } from 'bitset'

/**
 * MIDI trigger settings for the encoder control.
 */
export interface MidiEncoderTrigger extends MidiTrigger {
	channel: number // The MIDI channel number of the encoder (indexed from 1)
	control: number // The MIDI control number of the encoder
}

/**
 * Options required to create the encoder control.
 */
export interface ControlEncoderOptions extends Omit<ControlOptions, 'midiTriggers'> {
	midiEncoderTrigger: MidiEncoderTrigger // The MIDI trigger settings for the encoder
	midiButtonTrigger?: MidiButtonTrigger // Optional MIDI trigger settings for the encoder's push button
	ledControl?: number // Optional MIDI control number for the encoder's LED ring
	name?: string // Optional name for the encoder, used for transfer variable names
	definition: SurfaceSchemaControlDefinition // The control definition for the encoder
}

/**
 * Maps supported LED ring modes to their hex value.
 */
enum LedRing {
	EncoderLed = 0x40,
	SingleMode = 0x0,
	OffSetMode = 0x10,
	IncreasingMode = 0x20,
	CenteredMode = 0x30,
}

/**
 * Control implementation for a physical encoder on the surface.
 */
export class ControlEncoder extends ControlBase {
	private readonly midiEncoderTrigger: MidiEncoderTrigger

	private readonly ledControl: number | undefined

	private readonly name: string | undefined

	private useLowerLed: boolean = false

	private lastDrawProps: SurfaceDrawProps | undefined

	// For each mode, maps the LED number of the LED ring (determined by the index) to its corresponding bit pattern
	private static readonly ledRingBitPatterns = {
		[LedRing.SingleMode]: [0x0, 0x400, 0x200, 0x100, 0x80, 0x40, 0x20, 0x10, 0x8, 0x4, 0x2, 0x1],
		[LedRing.OffSetMode]: [0x0, 0x7e0, 0x3e0, 0x1e0, 0xe0, 0x60, 0x20, 0x30, 0x38, 0x3c, 0x3e, 0x3f],
		[LedRing.IncreasingMode]: [0x0, 0x400, 0x600, 0x700, 0x780, 0x7c0, 0x7e0, 0x7f0, 0x7f8, 0x7fc, 0x7fe, 0x7ff],
		[LedRing.CenteredMode]: [0x0, 0x20, 0x70, 0xf8, 0x1fc, 0x3fe, 0x7ff, 0x7ff, 0x7ff, 0x7ff, 0x7ff, 0x7ff],
	}

	/**
	 * Initializes the control with the supplied options.
	 *
	 * @param options The configuration options for the control
	 */
	constructor(options: ControlEncoderOptions) {
		const controlOptions: any = options

		controlOptions.midiEncoderTrigger.type = MidiTriggerType.Encoder

		controlOptions.midiTriggers = [controlOptions.midiEncoderTrigger]

		if (controlOptions.midiButtonTrigger) {
			controlOptions.midiButtonTrigger.type = MidiTriggerType.Button

			controlOptions.midiTriggers.push(controlOptions.midiButtonTrigger)
		}

		if (!controlOptions.definition.stylePreset) {
			controlOptions.definition.stylePreset = 'encoder'
		}

		super(controlOptions as ControlOptions)

		this.midiEncoderTrigger = options.midiEncoderTrigger
		this.name = options.name
		this.ledControl = options.ledControl
	}

	/**
	 * Returns the encoder's input/output transfer variables to be exposed in Companion.
	 *
	 * @returns The encoder's transfer variables
	 */
	getTransferVariables(): (SurfaceInputVariable | SurfaceOutputVariable)[] {
		if (!this.ledControl) return []

		return [
			{
				id: `${this.id}-led`,
				name: `${this.name ? this.name : '?'} Encoder LED`,
				description: 'Input to set the lower LEDs on the encoder on or off',
				type: 'output',
			},
		]
	}

	/**
	 * Updates the encoder's LEDs from a Companion variable change.
	 *
	 * @param name The name of the variable that changed
	 * @param value The new value of the variable
	 */
	onVariableChange(name: string, value: unknown): void {
		if (name.includes('-led')) {
			this.useLowerLed = value != 0

			if (this.lastDrawProps) {
				this.draw(this.lastDrawProps)
			} else {
				this.sendMidi({
					type: MidiTriggerType.Encoder,
					channel: this.midiEncoderTrigger.channel,
					control: this.ledControl,
					value: LedRing.EncoderLed,
				})
			}
		}
	}

	/**
	 * Handles incoming encoder and optional button MIDI messages.
	 *
	 * @param message The incoming MIDI message to handle
	 */
	onMidiMessage(message: MidiMessage): void {
		switch (message.type) {
			case MidiTriggerType.Encoder: {
				this.sendEvent(message.value > 32 ? ContextEventMap.RotateLeft : ContextEventMap.RotateRight)

				break
			}

			case MidiTriggerType.Button: {
				this.sendEvent(message.velocity > 0 ? ContextEventMap.KeyDown : ContextEventMap.KeyUp)

				break
			}
		}
	}

	/**
	 * Renders the encoder LED segments according to the draw properties given from Companion.
	 *
	 * @param drawProps The properties from Companion used to draw the control
	 */
	draw(drawProps: SurfaceDrawProps): void {
		this.lastDrawProps = drawProps

		if (drawProps.leds && this.stylePreset.leds && this.ledControl) {
			let segments: boolean[] = [] // Segment 0 is 6 o'clock

			for (let i = 0; i < this.stylePreset.leds.segments; i++) {
				segments.push(colorToIntensity(readLedColor(drawProps.leds, i)) > 127)
			}

			segments = this.reduceSegments(segments)

			this.setLedRing(segments)
		}
	}

	/**
	 * Reduce the LED segments from Companion down to the device's 11-position ring.
	 *
	 * @param segments A boolean array (on or off) of LED segments
	 *
	 * @returns A reduced boolean array of LED segments
	 */
	private reduceSegments(segments: boolean[]): boolean[] {
		const targetLength = 11

		const groups: boolean[][] = new Array(targetLength).fill(null).map((_) => [])

		for (const [i, segment] of segments.entries()) {
			const group = i % targetLength

			groups[group].push(segment)
		}

		return groups.map((group) => {
			const numTrue = group.reduce((previous: number, current: boolean) => (current ? previous + 1 : previous), 0)

			return numTrue > group.length / 2
		})
	}

	/**
	 * Matches a reduced LED segment array to the nearest supported LED ring mode.
	 *
	 * @param segments A boolean array of LED segments
	 *
	 * @returns The closest supported LED ring mode
	 */
	private ledRingMatch(segments: boolean[]): { mode: LedRing; value: number } {
		const segmentMask = new BitSet(segments.map((val) => (val ? '1' : '0')).join(''))

		let bestMode: LedRing = LedRing.CenteredMode
		let bestPattern: number | undefined = undefined
		let bestDistance: number | undefined = undefined

		for (const [mode, patterns] of Object.entries(ControlEncoder.ledRingBitPatterns)) {
			for (const [i, pattern] of patterns.entries()) {
				const patternMask = new BitSet(pattern)

				const distance = segmentMask.xor(patternMask).cardinality()

				if (bestDistance === undefined || distance < bestDistance) {
					bestDistance = distance

					bestMode = mode as unknown as LedRing
					bestPattern = i
				}
			}
		}

		return {
			mode: bestMode,
			value: bestPattern || 0,
		}
	}

	/**
	 * Updates the encoder's LED ring.
	 *
	 * @param segments A boolean array of LED segments
	 */
	setLedRing(segments: boolean[]): void {
		const message = {
			type: MidiTriggerType.Encoder,
			channel: this.midiEncoderTrigger.channel,
			control: this.ledControl,
			value: this.useLowerLed ? LedRing.EncoderLed : 0,
		}

		const allFalse = segments.every((val) => val === false)

		if (allFalse) {
			return this.sendMidi(message)
		}

		const { mode, value } = this.ledRingMatch(segments)

		message.value |= mode | value

		this.sendMidi(message)
	}

	/**
	 * Blanks the encoder clearing any visual state
	 */
	async blank(): Promise<void> {
		if (this.ledControl) {
			this.useLowerLed = false

			this.sendMidi({
				type: MidiTriggerType.Encoder,
				channel: this.midiEncoderTrigger.channel,
				control: this.ledControl,
				value: 0x0,
			})
		}
	}
}
