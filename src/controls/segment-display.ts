import type { SurfaceDrawProps, SurfaceSchemaControlDefinition } from '@companion-surface/base'
import { ControlBase, MidiTriggerType, type ControlOptions } from './base.js'

const EMPTY = 0x0
const DOT = 0x40

/**
 * Table mapping ASCII characters to their MCU specific hex value
 */
const ASCII_TABLE: { [k: string]: number } = (() => {
	const table: { [k: string]: number } = {
		'-': 0x2d,
		_: 0x2e,
	}

	for (let i = 0; i < 26; i++) {
		const char = String.fromCharCode(65 + i)

		table[char] = i + 1
	}

	for (let i = 0; i <= 9; i++) {
		const char = String.fromCharCode(48 + i)

		table[char] = i + 0x30
	}

	return table
})()

/**
 * Options required to create a segmentdisplay control.
 */
export interface ControlSegmentDisplayOptions extends ControlOptions {
	channel: number // The MIDI channel number of the segment display (indexed from 1)
	control: number // The MIDI starting control number of the segment display (calculates additional control numbers for each digit)
	width: number // The width of the display in characters (use negative values to indicate a right-aligned display)
	definition: SurfaceSchemaControlDefinition // The control definition for the display
}

/**
 * Control implementation for a character/text display.
 */
export class ControlSegmentDisplay extends ControlBase {
	private readonly channel: number
	private readonly control: number
	private readonly width: number
	private readonly growDirection: number

	/**
	 * Initializes the control with the supplied options.
	 *
	 * @param options The configuration options for the control
	 */
	constructor(options: ControlSegmentDisplayOptions) {
		if (!options.definition.stylePreset) {
			options.definition.stylePreset = 'segmentDisplay'
		}

		super(options)

		this.channel = options.channel
		this.width = Math.abs(options.width)
		this.control = options.control
		this.growDirection = options.width > 0 ? 1 : -1
	}

	/**
	 * Draws the new text onto the display.
	 *
	 * @params drawProps The properties from Companion used to draw the control
	 */
	draw(drawProps: SurfaceDrawProps): void {
		if (drawProps.text || drawProps.text === '') {
			this.drawText(drawProps.text)
		}
	}

	/**
	 * Renders text across the configured display. Text is truncated to the display width.
	 *
	 * @param text The text to render on the display
	 */
	drawText(text: string): void {
		const chars: number[] = []

		text = text.toUpperCase()

		for (let i = 0; i < text.length; i++) {
			if (chars.length >= this.width) break

			const char = text.substring(i, i + 1)

			if (char === '.') continue

			const asciiCode = ASCII_TABLE[char] ? ASCII_TABLE[char] : EMPTY

			const nextChar = text.substring(i + 1, i + 2)

			chars.push(nextChar === '.' ? DOT | asciiCode : asciiCode)
		}

		for (let i = chars.length; i < this.width; i++) {
			chars.push(EMPTY)
		}

		for (const [i, char] of chars.entries()) {
			this.sendMidi({
				type: MidiTriggerType.SegmentDisplay,
				channel: this.channel,
				control: this.control + i * this.growDirection,
				value: char,
			})
		}
	}

	/**
	 * Blanks the display clearing any text.
	 */
	async blank(): Promise<void> {
		this.drawText('')
	}
}
